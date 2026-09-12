import { z } from "zod";
import type { WorkspaceDatabase } from "../persistence/database.js";
import type { IdentityContext } from "../domain/types.js";
import { canonicalHash, canonicalJson } from "../domain/canonical-json.js";
import { AuthorizationError, ConcurrencyConflictError, IdempotencyConflictError, ValidationError } from "../domain/errors.js";
import { parseAssessment } from "../domain/candidate-match-assessment.js";
import { githubRefreshSchema, githubSnapshotSchema, recordSkillLibrarySchema, recordSkillSourceSchema,
  referenceCurrent, skillLibraryState, SKILL_CATALOG_KEY } from "../domain/skill-library.js";
import type { JobLibraryService } from "./job-library-service.js";
import { readGithubProject } from "./github-project-reader.js";

export class SkillLibraryService {
  constructor(private db: WorkspaceDatabase,
    private identity: () => IdentityContext & { channel: "MCP" | "WEB" },
    private library: JobLibraryService, private clock = () => new Date()) {}

  read(input: unknown = {}) {
    const options = parseAssessment(z.object({ sourceOffset: z.number().int().min(0).default(0),
      sourceIds: z.array(z.uuid()).max(20).default([]) }).strict(), input);
    const sources = this.library.snapshot().sources;
    const state = skillLibraryState(sources);
    const raw = sources.filter(s => s.source_key !== SKILL_CATALOG_KEY);
    const selected = raw.filter(s => options.sourceIds.includes(s.id));
    if (JSON.stringify(selected).length > 600000) throw new ValidationError("Select fewer source documents");
    return { ...state, version: state.source?.record_version ?? 0,
      sourceDirectory: { items: raw.slice(options.sourceOffset, options.sourceOffset + 50).map(s => ({
        id: s.id, title: s.title, sourceKey: s.source_key, sourceUrl: s.source_url,
        recordVersion: s.record_version, hash: canonicalHash(s), reviewStatus: s.review_status,
      })), total: raw.length, nextOffset: options.sourceOffset + 50 < raw.length ? options.sourceOffset + 50 : null },
      sources: selected, unavailableSourceIds: options.sourceIds.filter(id => !selected.some(s => s.id === id)),
      githubProjects: raw.filter(s => s.source_key.startsWith("github:")).map(s => {
        let snapshot = null;
        try { const parsed = githubSnapshotSchema.safeParse(JSON.parse(s.content)); if (parsed.success) snapshot = parsed.data; } catch { /* surface invalid snapshot */ }
        const last = this.db.prepare(`SELECT response_json FROM idempotency_records WHERE workspace_id=? AND operation=? ORDER BY created_at DESC,rowid DESC LIMIT 1`)
          .get(this.identity().workspaceId, `skills.github:${s.source_key}`) as { response_json: string } | undefined;
        return { sourceId: s.id, recordVersion: s.record_version, repositoryUrl: s.source_url,
          commit: snapshot?.commit ?? null, capturedAt: s.updated_at, paths: snapshot?.paths ?? [], lastCheck: last ? JSON.parse(last.response_json) : null };
      }),
      instructions: "Refresh registered GitHub projects before each analysis. Read raw sources, merge duplicate skills/projects with exact evidence and current versions, preserve UNKNOWN/conflicts. Saving a synthesis does not confirm personal facts. Reread candidate context after updating the library.",
    };
  }

  private authorize(input: { userConfirmed: boolean }, web = false) {
    const identity = this.identity();
    if (!input.userConfirmed || (!web && identity.channel !== "MCP")) throw new AuthorizationError("Explicit interactive user authority required");
    return identity;
  }
  private prior(operation: string, key: string, hash: string) {
    const row = this.db.prepare("SELECT request_hash,response_json FROM idempotency_records WHERE workspace_id=? AND operation=? AND idempotency_key=?")
      .get(this.identity().workspaceId, operation, key) as { request_hash: string; response_json: string } | undefined;
    if (!row) return null;
    if (row.request_hash !== hash) throw new IdempotencyConflictError("Skill library request conflicts with its durable receipt");
    return { ...JSON.parse(row.response_json), replayed: true };
  }
  private receipt(operation: string, key: string, hash: string, value: object) {
    this.db.prepare("INSERT INTO idempotency_records(workspace_id,operation,idempotency_key,request_hash,response_json,created_at) VALUES(?,?,?,?,?,?)")
      .run(this.identity().workspaceId, operation, key, hash, canonicalJson(value), this.clock().toISOString());
    return value;
  }
  private save(sourceKey: string, title: string, sourceUrl: string | null, content: string, expectedVersion: number) {
    const old = this.library.sources().find(s => s.source_key === sourceKey);
    if ((old?.record_version ?? 0) !== expectedVersion) throw new ConcurrencyConflictError("Source version changed; reread before writing");
    const result = this.library.saveSource({ sourceKey, title, sourceUrl, content, expectedVersion, reviewStatus: "SOURCE" }, true);
    const source = this.library.sources().find(s => s.id === result.id)!;
    return { sourceId: source.id, recordVersion: source.record_version, hash: canonicalHash(source), source };
  }

  record(input: unknown) {
    const parsed = parseAssessment(recordSkillLibrarySchema, input), identity = this.authorize(parsed);
    const operation = "skills.catalog.record", hash = canonicalHash({ ...parsed, principalId: identity.principalId });
    return this.db.transaction(() => {
      const prior = this.prior(operation, parsed.idempotencyKey, hash); if (prior) return prior;
      const sources = this.library.snapshot().sources;
      const catalog = parsed.catalog;
      const raw = sources.filter(s => s.source_key !== SKILL_CATALOG_KEY);
      if (catalog.reviewedSources.length !== raw.length || new Set(catalog.reviewedSources.map(s => s.sourceId)).size !== raw.length ||
          catalog.reviewedSources.some(ref => !raw.some(s => s.id === ref.sourceId && s.record_version === ref.recordVersion && canonicalHash(s) === ref.hash))) {
        throw new ConcurrencyConflictError("Reviewed source coverage changed or is incomplete; page and review the current source directory");
      }
      const unique = (values: string[]) => new Set(values.map(v => v.normalize("NFKC").toLowerCase().replace(/\s+/gu, " "))).size === values.length;
      if (!unique(catalog.skills.map(s => s.id)) || !unique(catalog.skills.map(s => s.name)) || !unique(catalog.projects.map(p => p.id)))
        throw new ValidationError("Merge duplicate skills and project IDs before saving");
      for (const skill of catalog.skills) {
        if (skill.status === "SUPPORTED" && !skill.evidence.length) throw new ValidationError("Supported skills require source evidence");
        if (skill.projectIds.some(id => !catalog.projects.some(p => p.id === id))) throw new ValidationError("Unknown skill project");
      }
      for (const project of catalog.projects) {
        if (!project.evidence.length) throw new ValidationError("Projects require evidence; contribution may remain UNKNOWN");
        if (project.repositorySourceId && (!sources.some(s => s.id === project.repositorySourceId && s.source_key.startsWith("github:")) ||
            !project.evidence.some(e => e.sourceId === project.repositorySourceId))) throw new ValidationError("Project repository requires a current GitHub source citation");
      }
      for (const reference of [...catalog.skills, ...catalog.projects].flatMap(s => s.evidence)) {
        if (!referenceCurrent(reference, sources)) throw new ConcurrencyConflictError("Skill evidence is unavailable, stale or not an exact source quote");
      }
      const result = this.save(SKILL_CATALOG_KEY, "技能与项目库", null, canonicalJson(catalog), parsed.expectedVersion);
      return this.receipt(operation, parsed.idempotencyKey, hash, { ...result,
        authorityReference: parsed.authorityReference, principalId: identity.principalId, savedAt: this.clock().toISOString(), replayed: false });
    })();
  }

  importSource(input: unknown) {
    const parsed = parseAssessment(recordSkillSourceSchema, input), identity = this.authorize(parsed);
    if (parsed.sourceUrl && !["https:", "http:"].includes(new URL(parsed.sourceUrl).protocol)) throw new ValidationError("HTTP(S) source URL required");
    const operation = "skills.source.import", hash = canonicalHash({ ...parsed, principalId: identity.principalId });
    return this.db.transaction(() => {
      const prior = this.prior(operation, parsed.idempotencyKey, hash); if (prior) return prior;
      const result = this.save(parsed.sourceKey, parsed.title, parsed.sourceUrl, parsed.content, parsed.expectedVersion);
      return this.receipt(operation, parsed.idempotencyKey, hash, { ...result,
        authorityReference: parsed.authorityReference, principalId: identity.principalId, savedAt: this.clock().toISOString(), replayed: false });
    })();
  }

  async refreshGithub(input: unknown, reauthorize?: () => unknown, fetcher: typeof fetch = fetch) {
    const parsed = parseAssessment(githubRefreshSchema, input), identity = this.authorize(parsed, true);
    const url = parsed.repositoryUrl.replace(/\/$/u, "").replace(/\.git$/u, "").toLowerCase();
    const sourceKey = `github:${new URL(url).pathname.slice(1)}`;
    const operation = `skills.github:${sourceKey}`, hash = canonicalHash({ ...parsed, principalId: identity.principalId });
    const prior = this.prior(operation, parsed.idempotencyKey, hash); if (prior) return prior;
    const old = this.library.sources().find(s => s.source_key === sourceKey);
    if ((old?.record_version ?? 0) !== parsed.expectedVersion) throw new ConcurrencyConflictError("GitHub source changed; reread");
    let previous = null;
    try { previous = old ? githubSnapshotSchema.parse(JSON.parse(old.content)) : null; } catch { /* repair malformed snapshot through a fresh fetch */ }
    let result: Awaited<ReturnType<typeof readGithubProject>> | null = null;
    let failure: string | null = null;
    try { result = await readGithubProject(url, parsed.paths,
      previous && canonicalHash(previous.paths) === canonicalHash(parsed.paths) ? previous.commit : null, fetcher); }
    catch (error) { failure = error instanceof ValidationError ? error.message : "GitHub could not be refreshed; previous evidence retained"; }
    reauthorize?.();
    const currentIdentity = this.authorize(parsed, true);
    if (canonicalHash(identity) !== canonicalHash(currentIdentity)) throw new AuthorizationError("Identity changed during refresh");
    return this.db.transaction(() => {
      const prior = this.prior(operation, parsed.idempotencyKey, hash); if (prior) return prior;
      const current = this.library.sources().find(s => s.source_key === sourceKey);
      if ((current?.record_version ?? 0) !== parsed.expectedVersion) throw new ConcurrencyConflictError("GitHub source changed during refresh");
      const saved = result?.snapshot ? this.save(sourceKey, `GitHub · ${sourceKey.slice(7)}`, url, canonicalJson(result.snapshot), parsed.expectedVersion) : null;
      return this.receipt(operation, parsed.idempotencyKey, hash, { status: failure ? "FAILED" : saved ? "UPDATED" : "UNCHANGED",
        sourceId: saved?.sourceId ?? old?.id ?? null, recordVersion: saved?.recordVersion ?? old?.record_version ?? 0,
        commit: result?.commit ?? previous?.commit ?? null, checkedAt: this.clock().toISOString(), failure,
        authorityReference: parsed.authorityReference, principalId: identity.principalId, replayed: false });
    })();
  }
}
