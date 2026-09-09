CREATE TABLE job_library_sources (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 source_key TEXT NOT NULL, title TEXT NOT NULL, source_url TEXT,
 content TEXT NOT NULL, review_status TEXT NOT NULL DEFAULT 'SOURCE'
 CHECK(review_status IN ('SOURCE','CONFIRMED','EXCLUDED')),
 record_version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL,
 UNIQUE(workspace_id,source_key)
);
CREATE TABLE job_candidate_fit (
 candidate_id TEXT PRIMARY KEY REFERENCES job_candidates(id),
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 jd_text TEXT NOT NULL, jd_source_url TEXT, library_hash TEXT NOT NULL,
 assessment_json TEXT NOT NULL, score INTEGER, coverage INTEGER NOT NULL,
 resume_draft TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE job_discovery_runs (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 started_at TEXT NOT NULL, finished_at TEXT, status TEXT NOT NULL,
 result_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE job_candidate_descriptions (
 candidate_id TEXT PRIMARY KEY REFERENCES job_candidates(id),
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 jd_text TEXT NOT NULL, source_url TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX job_discovery_active ON job_discovery_runs(workspace_id) WHERE status='RUNNING';
