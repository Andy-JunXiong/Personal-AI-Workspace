-- Additive opt-in ledger. Historical runs and business rows are not rewritten.
CREATE TABLE mail_scan_ledgers (
 run_id TEXT PRIMARY KEY REFERENCES mail_scan_runs(id),
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 heartbeat_at TEXT NOT NULL,
 scope_json TEXT NOT NULL
);
CREATE TABLE mail_scan_batch_runs (
 run_id TEXT NOT NULL REFERENCES mail_scan_ledgers(run_id),
 batch_id TEXT NOT NULL REFERENCES mail_scan_batches(id),
 PRIMARY KEY(run_id,batch_id)
);
CREATE TABLE mail_scan_actions (
 id TEXT PRIMARY KEY,
 run_id TEXT NOT NULL REFERENCES mail_scan_ledgers(run_id),
 batch_id TEXT NOT NULL,
 message_id TEXT NOT NULL,
 action_key TEXT NOT NULL,
 operation TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('PENDING','SUCCEEDED','FAILED')),
 created_at TEXT NOT NULL,
 result_json TEXT,
 FOREIGN KEY(batch_id,message_id) REFERENCES mail_scan_batch_items(batch_id,message_id)
);
CREATE INDEX idx_scan_action_source ON mail_scan_actions(run_id,batch_id,message_id,action_key);
CREATE TABLE mail_scan_acknowledgements (
 run_id TEXT NOT NULL REFERENCES mail_scan_ledgers(run_id),
 batch_id TEXT NOT NULL,
 message_id TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 PRIMARY KEY(run_id,batch_id,message_id),
 FOREIGN KEY(batch_id,message_id) REFERENCES mail_scan_batch_items(batch_id,message_id)
);
-- Exists only inside the synchronous business transaction; SQLite serializes writers.
CREATE TABLE mail_scan_write_scope (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 action_id TEXT NOT NULL REFERENCES mail_scan_actions(id)
);
CREATE TABLE mail_scan_effects (
 action_id TEXT NOT NULL REFERENCES mail_scan_actions(id),
 kind TEXT NOT NULL CHECK(kind IN ('APPLICATION','EVIDENCE','TRANSITION','TASK')),
 record_id TEXT NOT NULL,
 project_id TEXT NOT NULL REFERENCES projects(id),
 PRIMARY KEY(kind,record_id)
);
CREATE TRIGGER scan_effect_application AFTER INSERT ON projects
WHEN NEW.project_type='job_application' AND EXISTS(SELECT 1 FROM mail_scan_write_scope)
BEGIN
 INSERT INTO mail_scan_effects SELECT action_id,'APPLICATION',NEW.id,NEW.id FROM mail_scan_write_scope;
END;
CREATE TRIGGER scan_effect_evidence AFTER INSERT ON resources
WHEN NEW.provider='gmail' AND NEW.resource_type='EMAIL' AND EXISTS(SELECT 1 FROM mail_scan_write_scope)
BEGIN
 INSERT INTO mail_scan_effects SELECT action_id,'EVIDENCE',NEW.id,NEW.project_id FROM mail_scan_write_scope;
END;
CREATE TRIGGER scan_effect_task AFTER INSERT ON tasks
WHEN 1 AND EXISTS(SELECT 1 FROM mail_scan_write_scope)
BEGIN
 INSERT INTO mail_scan_effects SELECT action_id,'TASK',NEW.id,NEW.project_id FROM mail_scan_write_scope;
END;
CREATE TRIGGER scan_effect_transition AFTER UPDATE OF status ON state_transitions
WHEN NEW.status='ADMITTED' AND OLD.status<>'ADMITTED' AND NEW.from_state<>'NONE' AND EXISTS(SELECT 1 FROM mail_scan_write_scope)
BEGIN
 INSERT INTO mail_scan_effects SELECT action_id,'TRANSITION',NEW.id,NEW.project_id FROM mail_scan_write_scope;
END;
