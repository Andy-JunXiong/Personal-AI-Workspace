-- Query-scoped receipts and attributable metadata. No bodies or old-row rewrites.
CREATE TABLE job_mail_search_runs (
 run_id TEXT PRIMARY KEY REFERENCES mail_scan_runs(id),
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 policy_json TEXT NOT NULL
);
CREATE TABLE job_mail_metadata (
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 mailbox TEXT NOT NULL,
 message_id TEXT NOT NULL,
 thread_id TEXT NOT NULL,
 subject TEXT NOT NULL,
 sender_email TEXT,
 received_at TEXT NOT NULL,
 project_id TEXT REFERENCES projects(id),
 PRIMARY KEY(workspace_id,mailbox,message_id)
);
CREATE TABLE job_mail_screening (
 batch_id TEXT NOT NULL,
 message_id TEXT NOT NULL,
 run_id TEXT NOT NULL REFERENCES mail_scan_runs(id),
 matched INTEGER NOT NULL CHECK(matched IN (0,1)),
 reason TEXT NOT NULL,
 PRIMARY KEY(batch_id,message_id),
 FOREIGN KEY(batch_id,message_id) REFERENCES mail_scan_batch_items(batch_id,message_id)
);
