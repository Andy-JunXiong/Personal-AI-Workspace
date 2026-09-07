-- Independent of recommendation digests: actual application-mail ingestion.
CREATE TABLE mail_scan_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  authority_reference TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK(trigger_type IN ('SCHEDULED','MANUAL','UNKNOWN')),
  execution_reference TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL CHECK(status IN ('RUNNING','COMPLETE','PARTIAL','FAILED')),
  result_json TEXT,
  result_hash TEXT
);
CREATE INDEX idx_mail_scan_runs_workspace ON mail_scan_runs(workspace_id, started_at DESC, id);
CREATE TABLE mail_scan_checkpoints (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  mailbox TEXT NOT NULL CHECK(mailbox IN ('mailbox-1','mailbox-2')),
  covered_through TEXT NOT NULL,
  run_id TEXT NOT NULL REFERENCES mail_scan_runs(id),
  PRIMARY KEY(workspace_id, mailbox)
);
