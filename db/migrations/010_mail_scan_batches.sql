-- Durable source processing; separate recent coverage from historical backfill.
CREATE TABLE mail_scan_streams (
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 mailbox TEXT NOT NULL CHECK(mailbox IN ('mailbox-1','mailbox-2')),
 lane TEXT NOT NULL CHECK(lane IN ('RECENT','BACKFILL')),
 starts_at TEXT NOT NULL,
 covered_through TEXT NOT NULL,
 target_at TEXT,
 excluded_before TEXT,
 PRIMARY KEY(workspace_id,mailbox,lane)
);
CREATE TABLE mail_scan_batches (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 mailbox TEXT NOT NULL,
 lane TEXT NOT NULL,
 searched_from TEXT NOT NULL,
 covered_through TEXT NOT NULL,
 page_token TEXT,
 listing_done INTEGER NOT NULL DEFAULT 0 CHECK(listing_done IN (0,1)),
 revision INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL CHECK(status IN ('ACTIVE','COMPLETE','EXPIRED')),
 FOREIGN KEY(workspace_id,mailbox,lane) REFERENCES mail_scan_streams(workspace_id,mailbox,lane)
);
CREATE UNIQUE INDEX idx_mail_batch_active ON mail_scan_batches(workspace_id,mailbox,lane) WHERE status='ACTIVE';
CREATE TABLE mail_scan_processed (
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 mailbox TEXT NOT NULL,
 message_id TEXT NOT NULL,
 outcome TEXT NOT NULL CHECK(outcome IN ('IRRELEVANT','EXISTING','RECORDED')),
 run_id TEXT NOT NULL REFERENCES mail_scan_runs(id),
 processed_at TEXT NOT NULL,
 PRIMARY KEY(workspace_id,mailbox,message_id)
);
CREATE TABLE mail_scan_batch_items (
 batch_id TEXT NOT NULL REFERENCES mail_scan_batches(id),
 message_id TEXT NOT NULL,
 read_run_id TEXT REFERENCES mail_scan_runs(id),
 body_complete INTEGER NOT NULL DEFAULT 0 CHECK(body_complete IN (0,1)),
 outside_range INTEGER NOT NULL DEFAULT 0 CHECK(outside_range IN (0,1)),
 last_error TEXT,
 PRIMARY KEY(batch_id,message_id)
);
