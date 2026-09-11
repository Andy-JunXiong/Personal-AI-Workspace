-- Interactive advisory assessments do not mutate candidate/application state.
CREATE TABLE candidate_match_assessments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  candidate_id TEXT NOT NULL REFERENCES job_candidates(id),
  record_version INTEGER NOT NULL CHECK(record_version > 0),
  supersedes_id TEXT REFERENCES candidate_match_assessments(id),
  input_manifest_json TEXT NOT NULL,
  input_snapshot_json TEXT NOT NULL,
  report_json TEXT NOT NULL,
  correction_json TEXT,
  created_by TEXT NOT NULL REFERENCES principals(id),
  channel TEXT NOT NULL CHECK(channel = 'MCP'),
  authority_reference TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(workspace_id, candidate_id, record_version)
);
CREATE INDEX idx_candidate_match_history
  ON candidate_match_assessments(workspace_id, candidate_id, record_version DESC);
CREATE TRIGGER candidate_match_assessments_no_update
BEFORE UPDATE ON candidate_match_assessments BEGIN
  SELECT RAISE(ABORT, 'Candidate assessments are immutable');
END;
CREATE TRIGGER candidate_match_assessments_no_delete
BEFORE DELETE ON candidate_match_assessments BEGIN
  SELECT RAISE(ABORT, 'Candidate assessments are immutable');
END;
