-- Bounded OpenAI Platform Watch report-to-decision flow. Reports are immutable
-- source records; each finding has an independently versioned human disposition.
-- The initial ingress and decision channel is the authenticated website only.
CREATE TABLE platform_watch_reports (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    external_id TEXT NOT NULL,
    title TEXT NOT NULL,
    generated_at TEXT NOT NULL,
    source_url TEXT NOT NULL,
    evidence_cutoff TEXT,
    repository_sha TEXT,
    directional_judgment TEXT NOT NULL CHECK (
        directional_judgment IN ('NO_DRIFT', 'NARROW', 'EXPAND', 'REPOSITION')
    ),
    summary TEXT NOT NULL,
    body TEXT NOT NULL,
    canonical_hash TEXT NOT NULL,
    created_by_principal_id TEXT NOT NULL REFERENCES principals(id),
    recorded_at TEXT NOT NULL,
    UNIQUE (workspace_id, external_id),
    UNIQUE (workspace_id, canonical_hash)
);

CREATE INDEX idx_platform_watch_reports_workspace
    ON platform_watch_reports(workspace_id, generated_at DESC, id);

CREATE TABLE platform_watch_findings (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL REFERENCES platform_watch_reports(id) ON DELETE CASCADE,
    finding_key TEXT NOT NULL,
    title TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (
        direction IN ('IGNORE', 'ADOPT', 'REMOVE', 'DOUBLE_DOWN')
    ),
    verification TEXT NOT NULL CHECK (
        verification IN ('NOT_TESTED', 'LIVE_VERIFIED', 'BLOCKED', 'UNRESOLVED', 'NOT_APPLICABLE')
    ),
    recommendation TEXT NOT NULL,
    next_step TEXT NOT NULL,
    evidence_json TEXT NOT NULL,
    decision TEXT NOT NULL DEFAULT 'PENDING' CHECK (
        decision IN ('PENDING', 'ACCEPTED', 'REJECTED', 'DEFERRED')
    ),
    decision_note TEXT,
    decision_at TEXT,
    record_version INTEGER NOT NULL DEFAULT 1 CHECK (record_version >= 1),
    UNIQUE (report_id, finding_key)
);

CREATE INDEX idx_platform_watch_findings_report
    ON platform_watch_findings(report_id, decision, finding_key);

CREATE TABLE platform_watch_decisions (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    report_id TEXT NOT NULL REFERENCES platform_watch_reports(id),
    finding_id TEXT NOT NULL REFERENCES platform_watch_findings(id),
    action TEXT NOT NULL CHECK (action IN ('ACCEPT', 'REJECT', 'DEFER', 'REOPEN')),
    from_decision TEXT NOT NULL CHECK (
        from_decision IN ('PENDING', 'ACCEPTED', 'REJECTED', 'DEFERRED')
    ),
    to_decision TEXT NOT NULL CHECK (
        to_decision IN ('PENDING', 'ACCEPTED', 'REJECTED', 'DEFERRED')
    ),
    note TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel = 'WEB'),
    principal_id TEXT NOT NULL REFERENCES principals(id),
    authority_type TEXT NOT NULL CHECK (authority_type = 'EXPLICIT_USER_WEB'),
    authority_reference TEXT NOT NULL,
    record_version INTEGER NOT NULL CHECK (record_version >= 1),
    created_at TEXT NOT NULL
);

CREATE INDEX idx_platform_watch_decisions_finding
    ON platform_watch_decisions(finding_id, created_at, id);
