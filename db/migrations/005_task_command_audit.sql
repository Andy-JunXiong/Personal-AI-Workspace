CREATE TABLE task_command_audit (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    principal_id TEXT NOT NULL REFERENCES principals(id),
    task_id TEXT NOT NULL REFERENCES tasks(id),
    operation TEXT NOT NULL CHECK (operation IN ('workspace_create_task', 'workspace_update_task')),
    channel TEXT NOT NULL CHECK (channel IN ('MCP', 'WEB')),
    intent_key TEXT NOT NULL,
    authority_type TEXT NOT NULL CHECK (authority_type IN ('EXPLICIT_USER_DEV', 'EXPLICIT_USER_WEB')),
    authority_reference TEXT NOT NULL,
    before_record_version INTEGER NOT NULL CHECK (before_record_version >= 0),
    after_record_version INTEGER NOT NULL CHECK (after_record_version >= before_record_version),
    changed_fields_json TEXT NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome = 'SUCCESS'),
    created_at TEXT NOT NULL,
    UNIQUE (workspace_id, operation, intent_key)
);

CREATE INDEX idx_task_command_audit_task
    ON task_command_audit(task_id, created_at, id);
