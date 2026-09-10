-- Named working copies; a target link never means this resume was submitted.
CREATE TABLE resume_variants (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES resume_documents(workspace_id),
  name TEXT NOT NULL,
  candidate_id TEXT REFERENCES job_candidates(id),
  project_id TEXT REFERENCES projects(id),
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  source_base_version INTEGER NOT NULL CHECK(source_base_version > 0),
  content_json TEXT NOT NULL,
  record_version INTEGER NOT NULL CHECK(record_version > 0),
  created_by TEXT NOT NULL REFERENCES principals(id),
  updated_by TEXT NOT NULL REFERENCES principals(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((candidate_id IS NOT NULL) != (project_id IS NOT NULL)),
  UNIQUE(workspace_id, name COLLATE NOCASE)
);
CREATE INDEX idx_resume_variants_workspace ON resume_variants(workspace_id, updated_at DESC, id);
