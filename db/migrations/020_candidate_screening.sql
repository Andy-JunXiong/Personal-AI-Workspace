CREATE TABLE candidate_screenings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  candidate_id TEXT NOT NULL REFERENCES job_candidates(id),
  profile_source_id TEXT NOT NULL REFERENCES job_library_sources(id),
  record_version INTEGER NOT NULL CHECK(record_version > 0),
  input_manifest_json TEXT NOT NULL,
  input_snapshot_json TEXT NOT NULL,
  screening_input_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  reason TEXT NOT NULL,
  provenance_reference TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES principals(id),
  authority_reference TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(workspace_id,candidate_id,record_version)
);
CREATE TABLE candidate_screening_overrides (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  candidate_id TEXT NOT NULL REFERENCES job_candidates(id),
  record_version INTEGER NOT NULL CHECK(record_version > 0),
  mode TEXT NOT NULL CHECK(mode IN ('KEEP','AUTOMATIC')),
  reason TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES principals(id),
  channel TEXT NOT NULL CHECK(channel IN ('WEB','MCP')),
  authority_reference TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(workspace_id,candidate_id,record_version)
);
CREATE TRIGGER candidate_screenings_no_update BEFORE UPDATE ON candidate_screenings BEGIN
  SELECT RAISE(ABORT,'Candidate screening history is immutable');
END;
CREATE TRIGGER candidate_screenings_no_delete BEFORE DELETE ON candidate_screenings BEGIN
  SELECT RAISE(ABORT,'Candidate screening history is immutable');
END;
CREATE TRIGGER candidate_screening_overrides_no_update BEFORE UPDATE ON candidate_screening_overrides BEGIN
  SELECT RAISE(ABORT,'Candidate screening override history is immutable');
END;
CREATE TRIGGER candidate_screening_overrides_no_delete BEFORE DELETE ON candidate_screening_overrides BEGIN
  SELECT RAISE(ABORT,'Candidate screening override history is immutable');
END;
