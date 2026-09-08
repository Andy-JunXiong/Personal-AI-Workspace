-- Additive only: retain historical resources, receipts and queue rows unchanged.
CREATE TABLE mail_source_bindings (
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 mailbox TEXT NOT NULL CHECK(mailbox IN ('mailbox-1','mailbox-2')),
 account_key TEXT NOT NULL,
 PRIMARY KEY(workspace_id,mailbox)
);
CREATE TABLE mail_batch_source_ids (
 batch_id TEXT NOT NULL,
 message_id TEXT NOT NULL,
 external_id TEXT NOT NULL,
 PRIMARY KEY(batch_id,message_id),
 FOREIGN KEY(batch_id,message_id) REFERENCES mail_scan_batch_items(batch_id,message_id)
);
CREATE TABLE mail_manual_runs (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 project_id TEXT NOT NULL REFERENCES projects(id),
 started_at TEXT NOT NULL,
 finished_at TEXT,
 status TEXT NOT NULL CHECK(status IN ('RUNNING','DONE','FAILED','INTERRUPTED')),
 outcome TEXT CHECK(outcome IN ('UPDATED','NO_UPDATE','PARTIAL','FAILED')),
 result_json TEXT
);
CREATE UNIQUE INDEX idx_mail_manual_active ON mail_manual_runs(workspace_id,project_id) WHERE status='RUNNING';
CREATE INDEX idx_mail_manual_recent ON mail_manual_runs(workspace_id,started_at DESC);
CREATE TABLE mail_manual_coverage (
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 project_id TEXT NOT NULL REFERENCES projects(id),
 account_key TEXT NOT NULL,
 query_key TEXT NOT NULL,
 covered_through TEXT NOT NULL,
 run_id TEXT NOT NULL REFERENCES mail_manual_runs(id),
 PRIMARY KEY(workspace_id,project_id,account_key,query_key)
);
