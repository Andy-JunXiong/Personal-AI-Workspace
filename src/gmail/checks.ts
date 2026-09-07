import { createHash, randomUUID } from "node:crypto";
import type { WorkspaceService } from "../application/workspace-service.js";
import type { IdentityContext } from "../domain/types.js";
import type { GmailConnections } from "./connections.js";
import type { GmailAuthorization, MailInterpreter, MailReader } from "./providers.js";

export interface GmailRuntime {
  connections: GmailConnections;
  authorization: GmailAuthorization;
  reader: MailReader;
  interpreter: MailInterpreter;
}
export interface CheckRun { id: string; state: "RUNNING" | "DONE" | "FAILED"; startedAt: number; outcome?: "UPDATED" | "NO_UPDATE" | "PARTIAL" | "FAILED"; }
export interface BatchRun {
  id: string; state: "RUNNING" | "DONE" | "FAILED"; startedAt: number; total: number;
  results: { projectId: string; company: string; role: string; outcome: string }[];
}

export class GmailChecks {
  private readonly runs = new Map<string, CheckRun>();
  private readonly pending = new Map<string, Promise<void>>();
  private readonly batches = new Map<string, BatchRun>();
  constructor(private readonly runtime: GmailRuntime, private readonly now = Date.now) {}
  private key(identity: IdentityContext, projectId: string) { return `${identity.workspaceId}:${identity.principalId}:${projectId}`; }
  current(identity: IdentityContext, projectId: string) { return this.runs.get(this.key(identity, projectId)) ?? null; }
  currentBatch(identity: IdentityContext) { return this.batches.get(this.key(identity, "batch")) ?? null; }
  startBatch(identity: IdentityContext, service: WorkspaceService): BatchRun {
    const targets = service.jobSearchQueryService.applicationCheckTargets();
    const key = this.key(identity, "batch"), existing = this.batches.get(key);
    if (existing && (existing.state === "RUNNING" || this.now() - existing.startedAt < 60_000)) return existing;
    for (const [k, batch] of this.batches) if (batch.state !== "RUNNING" && this.now() - batch.startedAt > 86_400_000) this.batches.delete(k);
    if (this.batches.size >= 100) throw new Error("Batch capacity reached");
    const batch: BatchRun = { id: randomUUID(), state: "RUNNING", startedAt: this.now(), total: targets.length, results: [] };
    this.batches.set(key, batch);
    void (async () => {
      for (const target of targets) {
        try {
          while (this.pending.size >= 2) await Promise.race(this.pending.values());
          const run = this.start(identity, service, target.projectId);
          await this.pending.get(this.key(identity, target.projectId));
          batch.results.push({ ...target, outcome: run.outcome ?? "FAILED" });
        } catch { batch.results.push({ ...target, outcome: "FAILED" }); }
      }
      batch.state = "DONE";
    })().catch(() => { batch.state = "FAILED"; });
    return batch;
  }
  start(identity: IdentityContext, service: WorkspaceService, projectId: string): CheckRun {
    const detail = service.jobSearchQueryService.getApplication(projectId);
    const key = this.key(identity, projectId), existing = this.runs.get(key);
    if (existing && (existing.state === "RUNNING" || this.now() - existing.startedAt < 60_000)) return existing;
    for (const [k, run] of this.runs) if (run.state !== "RUNNING" && this.now() - run.startedAt > 600_000) this.runs.delete(k);
    // Completed receipts are durable in the database; don't let the small
    // in-memory status cache truncate an all-application batch.
    if (this.runs.size >= 100) {
      const completed = [...this.runs].find(([, run]) => run.state !== "RUNNING");
      if (completed) this.runs.delete(completed[0]);
    }
    if ([...this.runs.values()].filter(r => r.state === "RUNNING").length >= 2 || this.runs.size >= 100) throw new Error("Check capacity reached");
    const run: CheckRun = { id: randomUUID(), state: "RUNNING", startedAt: this.now() };
    this.runs.set(key, run);
    const promise = this.execute(identity, service, detail.project, run)
      .catch(() => { run.state = "FAILED"; run.outcome = "FAILED"; })
      .finally(() => { this.pending.delete(key); });
    this.pending.set(key, promise);
    return run;
  }
  private async execute(identity: IdentityContext, service: WorkspaceService,
    project: ReturnType<WorkspaceService["jobSearchQueryService"]["getApplication"]>["project"], run: CheckRun) {
    const { connections, authorization, reader, interpreter } = this.runtime;
    const signal = AbortSignal.timeout(180_000);
    let successful = 0, matched = 0, newMessages = 0, complete = true;
    const summaries: { at: string; text: string }[] = [], scopes: string[] = [];
    const company = String(project.metadata.company ?? ""), role = String(project.metadata.role ?? project.title);
    const since = typeof project.metadata.appliedDate === "string" ? project.metadata.appliedDate : project.createdAt;
    for (const slot of [1, 2]) {
      try {
        const connection = connections.get(identity, slot);
        if (!connection) { complete = false; scopes.push(`邮箱 ${slot} 未连接`); continue; }
        const token = await authorization.access(connection);
        signal.throwIfAborted();
        const search = await reader.search(token, company, role, since, signal);
        complete &&= search.complete;
        scopes.push(`邮箱 ${slot}：${search.complete ? "搜索完成" : "搜索或正文不完整"}，${search.messages.length} 封候选邮件`);
        for (let offset = 0; offset < search.messages.length; offset += 10) {
          const batch = search.messages.slice(offset, offset + 10);
          const interpreted = await interpreter.interpret(company, role, batch, signal);
          for (const item of interpreted.items.filter(i => i.relevant)) {
            const message = batch.find(m => m.id === item.messageId)!;
            matched++;
            const mailbox = createHash("sha256").update(connection.subject).digest("hex").slice(0, 24);
            // Gmail message IDs are mailbox-local, so namespace them by a non-reversible account fingerprint.
            const externalId = `${mailbox}:${message.id}`;
            const saved = service.recordGmailObservationFromWeb({ projectId: project.id, provider: "gmail",
              resourceType: "EMAIL", externalId, externalUri: null, title: "岗位邮件更新",
              observedAt: message.receivedAt, idempotencyKey: `${run.id}:${externalId}`,
              observedFacts: { contractVersion: "gmail-job-observation-v0.1",
                sourceFacts: { receivedAt: message.receivedAt, senderDomain: message.senderDomain, threadId: message.threadId },
                interpretation: { company, role, emailKind: "OTHER", summary: item.summary } } });
            if (!saved.deduplicated) newMessages++;
            summaries.push({ at: message.receivedAt, text: `${message.receivedAt.slice(0, 10)}：${item.summary}` });
          }
        }
        successful++;
      } catch { complete = false; scopes.push(`邮箱 ${slot} 检查未完成，请检查授权后重试`); }
    }
    const status = successful === 0 && matched === 0 ? "FAILED" : !complete ? "PARTIAL" : newMessages > 0 ? "UPDATED" : "NO_UPDATE";
    const latest = summaries.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3).map(s => s.text).join("\n");
    const summary = (status === "FAILED" ? "未能完成邮箱检查，不能确认是否有更新。"
      : `${complete ? "两个邮箱检查完成。" : "检查不完整，不能排除其他更新。"}${newMessages ? `保存 ${newMessages} 封新增相关邮件。` : "未保存新增相关邮件。"}${latest ? `\n${latest}` : complete ? "未找到该岗位的相关邮件。" : ""}`).slice(0, 1000);
    service.recordGmailObservationFromWeb({ projectId: project.id, provider: "workspace-gmail-check", resourceType: "NOTE",
      externalId: run.id, externalUri: null, title: "双邮箱岗位检查", observedAt: new Date(this.now()).toISOString(),
      idempotencyKey: run.id, observedFacts: { contractVersion: "gmail-application-check-v0.1", status,
        summary, searchScope: `从 ${since.slice(0, 10)} 前一天起按公司或岗位搜索（含垃圾邮件），每邮箱最多 120 封。${scopes.join("；")}`.slice(0, 1000), matchedMessageCount: matched } });
    run.state = "DONE";
    run.outcome = status;
  }
}
