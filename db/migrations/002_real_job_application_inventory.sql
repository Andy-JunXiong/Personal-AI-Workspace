ALTER TABLE projects
ADD COLUMN record_version INTEGER NOT NULL DEFAULT 1
CHECK (record_version >= 1);
