CREATE TABLE principals (
    id TEXT PRIMARY KEY,
    issuer TEXT NOT NULL,
    subject TEXT NOT NULL,
    display_name TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (issuer, subject)
);

CREATE TABLE workspaces (
    id TEXT PRIMARY KEY,
    owner_principal_id TEXT NOT NULL REFERENCES principals(id),
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (owner_principal_id)
);

CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    project_type TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'PAUSED', 'CLOSED')),
    lifecycle_state TEXT NOT NULL,
    lifecycle_version INTEGER NOT NULL CHECK (lifecycle_version >= 1),
    metadata_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_projects_workspace ON projects(workspace_id);

CREATE TABLE resources (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    resource_type TEXT NOT NULL,
    provider TEXT NOT NULL,
    external_id TEXT,
    external_uri TEXT,
    title TEXT,
    observed_facts_json TEXT NOT NULL,
    evidence_snapshot_json TEXT,
    observed_at TEXT NOT NULL,
    canonical_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX idx_resources_project ON resources(project_id, created_at DESC);
CREATE UNIQUE INDEX uq_resources_external_identity
    ON resources(project_id, provider, external_id)
    WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX uq_resources_exact_canonical
    ON resources(project_id, canonical_hash)
    WHERE external_id IS NULL;

CREATE TABLE state_transitions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    from_state TEXT NOT NULL,
    to_state TEXT NOT NULL,
    from_version INTEGER NOT NULL,
    to_version INTEGER,
    trigger_type TEXT NOT NULL CHECK (
        trigger_type IN ('USER_ASSERTION', 'EXTERNAL_EVIDENCE', 'ACTION_OUTCOME', 'IMPORT')
    ),
    status TEXT NOT NULL CHECK (status IN ('PROPOSED', 'ADMITTED', 'REJECTED')),
    proposed_by TEXT NOT NULL CHECK (proposed_by IN ('USER', 'CHATGPT', 'SYSTEM')),
    proposal_rationale TEXT,
    canonical_hash TEXT NOT NULL,
    admitted_by TEXT CHECK (admitted_by IN ('USER', 'RULE', 'SYSTEM')),
    admission_authority_type TEXT CHECK (
        admission_authority_type IN ('EXPLICIT_USER_DEV', 'DETERMINISTIC_RULE')
    ),
    admission_authority_reference TEXT,
    proposed_at TEXT NOT NULL,
    admitted_at TEXT,
    rejection_reason TEXT
);

CREATE INDEX idx_transitions_project ON state_transitions(project_id, proposed_at DESC);
CREATE UNIQUE INDEX uq_transitions_exact_canonical
    ON state_transitions(project_id, canonical_hash);
CREATE UNIQUE INDEX uq_transitions_admitted_version
    ON state_transitions(project_id, to_version)
    WHERE status = 'ADMITTED';

CREATE TABLE transition_evidence (
    transition_id TEXT NOT NULL REFERENCES state_transitions(id) ON DELETE CASCADE,
    resource_id TEXT NOT NULL REFERENCES resources(id),
    PRIMARY KEY (transition_id, resource_id)
);

CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    title TEXT NOT NULL,
    task_kind TEXT NOT NULL,
    status TEXT NOT NULL CHECK (
        status IN ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED')
    ),
    priority TEXT NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    due_at TEXT,
    created_by TEXT NOT NULL CHECK (created_by IN ('USER', 'CHATGPT', 'SYSTEM')),
    source_transition_id TEXT REFERENCES state_transitions(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_tasks_project ON tasks(project_id, status);
CREATE UNIQUE INDEX uq_tasks_transition_kind
    ON tasks(source_transition_id, task_kind)
    WHERE source_transition_id IS NOT NULL;

CREATE TABLE idempotency_records (
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    operation TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    response_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (workspace_id, operation, idempotency_key)
);
