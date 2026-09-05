CREATE TABLE principal_identity_links (
    issuer TEXT NOT NULL,
    subject TEXT NOT NULL,
    principal_id TEXT NOT NULL REFERENCES principals(id),
    created_at TEXT NOT NULL,
    linked_by_principal_id TEXT NOT NULL REFERENCES principals(id),
    revoked_at TEXT,
    PRIMARY KEY (issuer, subject)
);

CREATE TABLE identity_link_events (
    id TEXT PRIMARY KEY,
    issuer TEXT NOT NULL,
    subject TEXT NOT NULL,
    principal_id TEXT NOT NULL REFERENCES principals(id),
    actor_principal_id TEXT NOT NULL REFERENCES principals(id),
    action TEXT NOT NULL CHECK (action IN ('LINK', 'REVOKE')),
    created_at TEXT NOT NULL
);

-- Short-lived verified claims for explicit operator association; never tokens.
CREATE TABLE pending_web_identities (
    id TEXT PRIMARY KEY,
    issuer TEXT NOT NULL,
    subject TEXT NOT NULL,
    verified_email TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);
