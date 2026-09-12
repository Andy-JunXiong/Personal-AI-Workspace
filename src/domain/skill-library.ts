import { z } from "zod";
import { canonicalHash } from "./canonical-json.js";
import type { LibrarySource } from "../application/job-library-service.js";

export const SKILL_CATALOG_KEY = "skills:catalog";
const text = (max: number) => z.string().trim().min(1).max(max);
export const sourceReferenceSchema = z.object({
  sourceId: z.uuid(), recordVersion: z.number().int().positive(),
  hash: z.string().regex(/^[a-f0-9]{64}$/u), quote: text(2000),
}).strict();
const key = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/u);
export const skillCatalogSchema = z.object({
  format: z.literal("skill-library-v1"),
  reviewedSources: z.array(z.object({ sourceId: z.uuid(), recordVersion: z.number().int().positive(),
    hash: z.string().regex(/^[a-f0-9]{64}$/u) }).strict()).max(100),
  skills: z.array(z.object({
    id: key, name: text(120), aliases: z.array(text(120)).max(15),
    category: z.enum(["TECHNICAL", "DOMAIN", "EDUCATION", "EXPERIENCE_FACT"]),
    summary: text(1500), status: z.enum(["SUPPORTED", "UNKNOWN", "CONFLICT"]),
    projectIds: z.array(key).max(15), evidence: z.array(sourceReferenceSchema).max(15),
  }).strict()).max(100),
  projects: z.array(z.object({
    id: key, name: text(200), contribution: text(1500),
    repositorySourceId: z.uuid().nullable(), evidence: z.array(sourceReferenceSchema).max(15),
  }).strict()).max(30),
  limitations: z.array(text(1000)).max(30),
}).strict();
export type SkillCatalog = z.infer<typeof skillCatalogSchema>;

export function referenceCurrent(ref: z.infer<typeof sourceReferenceSchema>, sources: LibrarySource[]) {
  const source = sources.find(s => s.id === ref.sourceId && s.source_key !== SKILL_CATALOG_KEY && s.review_status !== "EXCLUDED");
  if (!source || source.record_version !== ref.recordVersion || canonicalHash(source) !== ref.hash) return false;
  if (source.source_key.startsWith("github:")) {
    try { return githubSnapshotSchema.parse(JSON.parse(source.content)).files.some(f => f.text.includes(ref.quote)); } catch { return false; }
  }
  return source.content.includes(ref.quote);
}

export function skillLibraryState(sources: LibrarySource[]) {
  const source = sources.find(s => s.source_key === SKILL_CATALOG_KEY && s.review_status !== "EXCLUDED");
  if (!source) return { source: null, catalog: null, status: "MISSING" as const, staleSkillIds: [] as string[] };
  let parsed;
  try { parsed = skillCatalogSchema.safeParse(JSON.parse(source.content)); } catch { parsed = null; }
  if (!parsed?.success) return { source, catalog: null, status: "INVALID" as const, staleSkillIds: [] as string[] };
  const catalog = parsed.data;
  const staleProjects = catalog.projects.filter(p => p.evidence.some(r => !referenceCurrent(r, sources)) ||
    (p.repositorySourceId !== null && !sources.some(s => s.id === p.repositorySourceId && s.review_status !== "EXCLUDED")));
  const staleSkillIds = catalog.skills.filter(s => s.evidence.some(r => !referenceCurrent(r, sources)) ||
    s.projectIds.some(id => staleProjects.some(p => p.id === id))).map(s => s.id);
  const currentReferences = sources.filter(s => s.source_key !== SKILL_CATALOG_KEY && s.review_status !== "EXCLUDED")
    .map(s => ({ sourceId: s.id, recordVersion: s.record_version, hash: canonicalHash(s) })).sort((a,b) => a.sourceId.localeCompare(b.sourceId));
  const coverageChanged = canonicalHash(currentReferences) !== canonicalHash([...catalog.reviewedSources].sort((a,b) => a.sourceId.localeCompare(b.sourceId)));
  return { source, catalog, status: staleSkillIds.length || staleProjects.length || coverageChanged ? "STALE" as const : "CURRENT" as const, staleSkillIds };
}

export const skillWriteAuthority = {
  userConfirmed: z.boolean(), authorityReference: text(2000), idempotencyKey: text(200),
};
export const recordSkillLibrarySchema = z.object({
  expectedVersion: z.number().int().min(0), catalog: skillCatalogSchema,
  ...skillWriteAuthority,
}).strict();
export const recordSkillSourceSchema = z.object({
  sourceKey: z.string().regex(/^import:[A-Za-z0-9_.:/-]{1,450}$/u),
  title: text(500), sourceUrl: z.url().max(2000).nullable(), content: text(50000),
  expectedVersion: z.number().int().min(0), ...skillWriteAuthority,
}).strict();

export const githubRefreshSchema = z.object({
  repositoryUrl: z.string().regex(/^https:\/\/github\.com\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+\/?$/u)
    .refine(value => ![".", "..", ".git"].includes(value.replace(/\/$/u, "").split("/").at(-1)!)),
  paths: z.array(z.string().min(1).max(300).refine(p => !p.startsWith("/") && !p.includes("\\") &&
    p.split("/").every(part => part !== "." && part !== ".." && part.length > 0))).min(1).max(8).refine(paths => new Set(paths).size === paths.length),
  expectedVersion: z.number().int().min(0), ...skillWriteAuthority,
}).strict();
export const githubSnapshotSchema = z.object({
  format: z.literal("github-project-v1"), repositoryUrl: z.string(),
  commit: z.string().regex(/^[a-f0-9]{40}$/u), paths: z.array(z.string()),
  files: z.array(z.object({ path: z.string(), url: z.string(), text: z.string() })),
  limitation: z.string(),
});
