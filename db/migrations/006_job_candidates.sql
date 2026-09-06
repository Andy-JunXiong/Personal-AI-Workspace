-- Job Search candidates: durable job postings the user is considering.
-- The user decision (UNREVIEWED/SAVED/DISMISSED) is independent of source
-- availability and of any later application link. Recommendation recording
-- never writes a decision, an application link, or a lifecycle change.
CREATE TABLE job_candidates (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    provider TEXT NOT NULL,
    posting_id TEXT,
    source_url TEXT,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    role TEXT NOT NULL,
    location TEXT,
    fit_reason TEXT,
    fit_uncertainty TEXT NOT NULL DEFAULT 'UNKNOWN'
        CHECK (fit_uncertainty IN ('LOW', 'MEDIUM', 'HIGH', 'UNKNOWN')),
    source_availability TEXT NOT NULL DEFAULT 'UNKNOWN'
        CHECK (source_availability IN ('AVAILABLE', 'UNAVAILABLE', 'UNKNOWN')),
    decision TEXT NOT NULL DEFAULT 'UNREVIEWED'
        CHECK (decision IN ('UNREVIEWED', 'SAVED', 'DISMISSED')),
    record_version INTEGER NOT NULL CHECK (record_version >= 1),
    decision_at TEXT,
    linked_project_id TEXT REFERENCES projects(id),
    linked_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (posting_id IS NOT NULL OR source_url IS NOT NULL)
);

CREATE INDEX idx_job_candidates_workspace
    ON job_candidates(workspace_id, decision, updated_at DESC);

CREATE UNIQUE INDEX uq_job_candidates_posting
    ON job_candidates(workspace_id, provider, posting_id)
    WHERE posting_id IS NOT NULL;

CREATE UNIQUE INDEX uq_job_candidates_url
    ON job_candidates(workspace_id, source_url)
    WHERE source_url IS NOT NULL;

-- Actor-attributed candidate decisions. These rows are written only by an
-- explicit user SAVE/DISMISS/RESTORE action through MCP or Web.
CREATE TABLE candidate_decisions (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    candidate_id TEXT NOT NULL REFERENCES job_candidates(id),
    action TEXT NOT NULL CHECK (action IN ('SAVE', 'DISMISS', 'RESTORE')),
    from_decision TEXT NOT NULL CHECK (from_decision IN ('UNREVIEWED', 'SAVED', 'DISMISSED')),
    to_decision TEXT NOT NULL CHECK (to_decision IN ('UNREVIEWED', 'SAVED', 'DISMISSED')),
    channel TEXT NOT NULL CHECK (channel IN ('MCP', 'WEB')),
    principal_id TEXT NOT NULL REFERENCES principals(id),
    authority_type TEXT NOT NULL CHECK (authority_type IN ('EXPLICIT_USER_DEV', 'EXPLICIT_USER_WEB')),
    authority_reference TEXT NOT NULL,
    record_version INTEGER NOT NULL CHECK (record_version >= 1),
    created_at TEXT NOT NULL
);

CREATE INDEX idx_candidate_decisions_candidate
    ON candidate_decisions(candidate_id, created_at, id);
