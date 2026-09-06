-- Job Search candidate application links: the durable record that a
-- candidate was associated with an actual Job Application. Linking is a
-- separate actor-attributed action from save/dismiss/restore; it never writes
-- a decision and never creates a Project. A candidate links to at most one
-- Project at a time via the linked_project_id column on job_candidates.
CREATE TABLE candidate_links (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    candidate_id TEXT NOT NULL REFERENCES job_candidates(id),
    project_id TEXT NOT NULL REFERENCES projects(id),
    channel TEXT NOT NULL CHECK (channel IN ('MCP', 'WEB')),
    principal_id TEXT NOT NULL REFERENCES principals(id),
    authority_type TEXT NOT NULL CHECK (authority_type IN ('EXPLICIT_USER_DEV', 'EXPLICIT_USER_WEB')),
    authority_reference TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX idx_candidate_links_candidate
    ON candidate_links(candidate_id, created_at, id);
