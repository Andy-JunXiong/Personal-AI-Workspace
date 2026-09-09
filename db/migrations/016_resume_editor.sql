CREATE TABLE resume_documents (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id),
  template_docx BLOB NOT NULL,
  template_sha256 TEXT NOT NULL,
  source_url TEXT NOT NULL,
  content_json TEXT NOT NULL,
  record_version INTEGER NOT NULL CHECK(record_version > 0),
  updated_by TEXT NOT NULL REFERENCES principals(id),
  updated_at TEXT NOT NULL
);
