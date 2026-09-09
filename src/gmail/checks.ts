import { createHash, randomUUID } from "node:crypto";
import type { WorkspaceService } from "../application/workspace-service.js";
import type { IdentityContext } from "../domain/types.js";
import type { GmailConnections } from "./connections.js";
import type { GmailAuthorization, MailInterpreter, MailReader } from "./providers.js";
import { isApplicationEvidence, validateInterpretation } from "./providers.js";
import { diagnosticText, mailDiagnostic, MailCheckError, type MailCheckStage, type MailDiagnostic } from "../domain/mail-diagnostics.js";
import { gmailAccountKey, gmailSourceId } from "./source-identity.js";
import { isOngoingApplication } from "../domain/job-application-lifecycle.js";
import { ActionDeniedError } from "../domain/errors.js";

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
  current(_identity: IdentityContext, projectId: string, service:WorkspaceService) { return service.manualMailService.current(projectId); }
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
          if (!isOngoingApplication(service.jobSearchQueryService.getApplication(target.projectId).project)) {
            batch.results.push({ ...target, outcome: "SKIPPED" });
            continue;
          }
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
    if (!isOngoingApplication(detail.project)) throw new ActionDeniedError("已拒绝或已结束的申请不再补查邮件");
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
    const persisted=service.manualMailService.begin(projectId);
    if(!persisted.created) return persisted;
    const run: CheckRun = { id: persisted.id, state: "RUNNING", startedAt: persisted.startedAt };
    this.runs.set(key, run);
    const diagnostics: MailDiagnostic[] = [];
    const promise = this.execute(identity, service, detail.project, run, diagnostics)
      .catch(error => {
        run.state = "FAILED"; run.outcome = "PARTIAL";
        try { service.manualMailService.fail(run.id,projectId,[...diagnostics,mailDiagnostic(error,"COMPLETE")]); }
        catch { console.error("Manual mail failure receipt could not be saved", { runId: run.id, code: "RECEIPT_SAVE_FAILED" }); }
      })
      .finally(() => { this.pending.delete(key); });
    this.pending.set(key, promise);
    return run;
  }
  private async execute(identity: IdentityContext, service: WorkspaceService,
    project: ReturnType<WorkspaceService["jobSearchQueryService"]["getApplication"]>["project"], run: CheckRun, diagnostics: MailDiagnostic[]) {
    const { connections, authorization, reader, interpreter } = this.runtime;
    const signal = AbortSignal.timeout(180_000);
    let successful = 0, matched = 0, newMessages = 0, complete = true;
    const summaries: { at: string; text: string }[] = [], scopes: string[] = [];
    const report = (diagnostic: MailDiagnostic) => { diagnostics.push(diagnostic); scopes.push(diagnosticText(diagnostic)); };
    const company = String(project.metadata.company ?? ""), role = String(project.metadata.role ?? project.title);
    const since = typeof project.metadata.appliedDate === "string" ? project.metadata.appliedDate : project.createdAt;
    const queryKey=createHash("sha256").update(JSON.stringify(["keyword-metadata-v1",company,role,since])).digest("hex");
    const coverage:{accountKey:string;queryKey:string;coveredThrough:string}[]=[];
    const assertOngoing = () => {
      if (!isOngoingApplication(service.jobSearchQueryService.getApplication(project.id).project))
        throw new ActionDeniedError("Application tracking stopped during the check");
    };
    for (const slot of [1, 2]) {
      let stage: MailCheckStage = "AUTHORIZE";
      try {
        assertOngoing();
        const connection = connections.get(identity, slot);
        if (!connection) throw new MailCheckError("NOT_CONNECTED");
        const accountKey=gmailAccountKey(connection.subject);
        const range=service.manualMailService.range(project.id,accountKey,queryKey,run.startedAt);
        const token = await authorization.access(connection);
        signal.throwIfAborted();
        assertOngoing();
        stage = "SEARCH";
        const search = await reader.search(token, company, role, since, signal,range);
        let mailboxComplete = search.complete && !search.issues?.length;
        for (const code of new Set(search.issues ?? [])) report(mailDiagnostic(new MailCheckError(code),stage,slot));
        complete &&= mailboxComplete;
        scopes.push(`邮箱 ${slot}：${range.searchedFrom} 至 ${range.coveredThrough}，${search.complete ? "搜索完成" : "搜索或正文不完整"}`);
        const messages=search.messages.filter(m=>Date.parse(m.receivedAt)>=Date.parse(range.searchedFrom)&&Date.parse(m.receivedAt)<Date.parse(range.coveredThrough));
        const unseen=[];
        stage = "DEDUPLICATE";
        for(const message of messages) {
          const old=service.findGmailEvidence(project.id,gmailSourceId(accountKey,message.id));
          if(old) {matched++;summaries.push({at:old.observedAt,text:`${old.observedAt.slice(0,10)}：${old.summary}`});}
          else unseen.push(message);
        }
        for (let offset = 0; offset < unseen.length; offset += 10) {
          const batch = unseen.slice(offset, offset + 10);
          stage = "INTERPRET";
          const interpreted = validateInterpretation(await interpreter.interpret(company, role, batch, signal),batch);
          signal.throwIfAborted();
          assertOngoing();
          if(connections.get(identity,slot)?.subject!==connection.subject) throw new MailCheckError("ACCOUNT_CHANGED");
          if (interpreted.items.some(item => item.category === "UNCERTAIN")) {
            mailboxComplete = false; complete = false;
            if (!diagnostics.some(d => d.mailbox === `mailbox-${slot}` && d.code === "CLASSIFICATION_UNCERTAIN"))
              report(mailDiagnostic(new MailCheckError("CLASSIFICATION_UNCERTAIN"),stage,slot));
          }
          stage = "SAVE";
          for (const item of interpreted.items.filter(isApplicationEvidence)) {
            const message = batch.find(m => m.id === item.messageId)!;
            matched++;
            const externalId = gmailSourceId(accountKey,message.id);
            const saved = service.recordGmailObservationFromWeb({ projectId: project.id, provider: "gmail",
              resourceType: "EMAIL", externalId, externalUri: null, title: "岗位邮件更新",
              observedAt: message.receivedAt, idempotencyKey: `${run.id}:${externalId}`,
              observedFacts: { contractVersion: "gmail-job-observation-v0.1",
                sourceFacts: { receivedAt: message.receivedAt, senderDomain: message.senderDomain, threadId: message.threadId },
                interpretation: { company, role, emailKind: "OTHER", summary: item.summary, category: item.category } } });
            if (!saved.deduplicated) newMessages++;
            summaries.push({ at: message.receivedAt, text: `${message.receivedAt.slice(0, 10)}：${item.summary}` });
          }
        }
        signal.throwIfAborted();
        if(connections.get(identity,slot)?.subject!==connection.subject) throw new MailCheckError("ACCOUNT_CHANGED");
        if(mailboxComplete) coverage.push({accountKey,queryKey,coveredThrough:range.coveredThrough});
        successful++;
      } catch (error) { complete = false; report(mailDiagnostic(error,stage,slot)); }
    }
    const status = successful === 0 && matched === 0 ? "FAILED" : !complete ? "PARTIAL" : newMessages > 0 ? "UPDATED" : "NO_UPDATE";
    const latest = summaries.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3).map(s => s.text).join("\n");
    const summary = (status === "FAILED" ? "未能完成邮箱检查，不能确认是否有更新。"
      : `${complete ? "两个邮箱检查完成。" : "检查不完整，不能排除其他更新。"}${newMessages ? `保存 ${newMessages} 封新增相关邮件。` : "未保存新增相关邮件。"}${latest ? `\n${latest}` : complete ? "未找到该岗位的相关邮件。" : ""}`).slice(0, 1000);
    service.manualMailService.complete(run.id,project.id,status,{scope:scopes,diagnostics,matchedMessageCount:matched},coverage,()=>service.recordGmailObservationFromWeb({ projectId: project.id, provider: "workspace-gmail-check", resourceType: "NOTE",
      externalId: run.id, externalUri: null, title: "双邮箱岗位检查", observedAt: new Date(this.now()).toISOString(),
      idempotencyKey: run.id, observedFacts: { contractVersion: "gmail-application-check-v0.1", status,
        summary, searchScope: `仅进行中申请按公司或岗位关键词补查（含垃圾邮件），只读主题和 Gmail 摘要，最多回看七天；不代表全文审阅或全邮箱覆盖。${scopes.join("；")}`.slice(0, 1000), matchedMessageCount: matched } }));
    run.state = "DONE";
    run.outcome = status;
  }
}
