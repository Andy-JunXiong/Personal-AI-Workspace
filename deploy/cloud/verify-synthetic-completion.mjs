import Database from "better-sqlite3";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const fail = (message) => { throw new Error(message); };

export function verifySyntheticCompletion(databasePath, taskId, WorkspaceService) {
  if (!databasePath || !taskId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(taskId)) {
    fail("Expected a database path and UUID Task ID");
  }
  const database = new Database(databasePath, { fileMustExist: true });
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");

  try {
  const task = database.prepare(
    `SELECT t.status, t.record_version, t.completed_at, t.title,
            p.workspace_id, p.metadata_json
     FROM tasks t JOIN projects p ON p.id = t.project_id
     WHERE t.id = ?`,
  ).get(taskId);
  if (!task) fail("Synthetic Task does not exist");
  const metadata = JSON.parse(task.metadata_json);
  if (task.title !== "SYNTHETIC TEST - Complete once through Web" ||
      metadata.company !== "PAW Synthetic Acceptance" ||
      metadata.role !== "S1-05B Browser Completion Fixture") {
    fail("Task is not the approved S1-05B synthetic fixture");
  }
  if (task.status !== "DONE" || task.record_version !== 2 || !task.completed_at) {
    fail("Synthetic Task does not have the expected terminal state");
  }

  const audits = database.prepare(
    `SELECT workspace_id, principal_id, intent_key, channel, authority_type,
            before_record_version, after_record_version, changed_fields_json, outcome
     FROM task_command_audit
     WHERE task_id = ? AND operation = 'workspace_update_task'`,
  ).all(taskId);
  if (audits.length !== 1) fail("Expected exactly one completion audit row");
  const audit = audits[0];
  if (audit.workspace_id !== task.workspace_id || audit.channel !== "WEB" ||
      audit.authority_type !== "EXPLICIT_USER_WEB" || audit.outcome !== "SUCCESS" ||
      audit.before_record_version !== 1 || audit.after_record_version !== 2 ||
      JSON.stringify(JSON.parse(audit.changed_fields_json)) !== JSON.stringify(["status"])) {
    fail("Completion audit does not match the approved Web transition");
  }

  const idempotencyCount = database.prepare(
    `SELECT COUNT(*) AS count FROM idempotency_records
     WHERE workspace_id = ? AND operation = 'workspace_update_task'
       AND idempotency_key = ?`,
  ).get(audit.workspace_id, audit.intent_key).count;
  if (idempotencyCount !== 1) fail("Expected exactly one completion idempotency row");

  const changesBeforeReplay = database.prepare("SELECT total_changes() AS count").get().count;
  const service = new WorkspaceService(database, {
    principalId: audit.principal_id,
    workspaceId: audit.workspace_id,
    channel: "WEB",
    requestId: "s1-05b-idempotency-replay-verification",
  });
  const replay = service.taskService.completeTaskFromWeb({
    taskId,
    expectedRecordVersion: 1,
    intentKey: audit.intent_key,
  });
  const changesAfterReplay = database.prepare("SELECT total_changes() AS count").get().count;
  if (!replay.replayed || !replay.changed || replay.task.status !== "DONE" ||
      replay.task.recordVersion !== 2 || replay.task.completedAt !== task.completed_at ||
      changesAfterReplay !== changesBeforeReplay) {
    fail("Completion idempotency replay changed data or returned a different result");
  }

  const auditCountAfter = database.prepare(
    `SELECT COUNT(*) AS count FROM task_command_audit
     WHERE task_id = ? AND operation = 'workspace_update_task'`,
  ).get(taskId).count;
  if (auditCountAfter !== 1) fail("Replay created a duplicate audit row");

  return {
    status: task.status,
    recordVersion: task.record_version,
    completedAtPresent: true,
    completionAuditRows: audits.length,
    idempotencyRows: idempotencyCount,
    replayed: replay.replayed,
    replayDatabaseChanges: changesAfterReplay - changesBeforeReplay,
  };
  } finally {
    database.close();
  }
}

async function main() {
  const databasePath = process.argv[2]?.trim();
  const taskId = process.argv[3]?.trim();
  if (!databasePath || !taskId) {
    throw new Error("Usage: node verify-synthetic-completion.mjs <database-path> <task-id>");
  }
  const { WorkspaceService } = await import(
    "../../dist/src/application/workspace-service.js"
  );
  console.log(JSON.stringify(
    verifySyntheticCompletion(databasePath, taskId, WorkspaceService),
  ));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await main();
  } catch (error) {
    console.error(
      `Synthetic completion verification failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    process.exitCode = 1;
  }
}
