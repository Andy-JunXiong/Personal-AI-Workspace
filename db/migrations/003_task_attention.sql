ALTER TABLE tasks
ADD COLUMN record_version INTEGER NOT NULL DEFAULT 1
CHECK (record_version >= 1);

ALTER TABLE tasks
ADD COLUMN updated_by TEXT NOT NULL DEFAULT 'SYSTEM'
CHECK (updated_by IN ('USER', 'CHATGPT', 'SYSTEM'));

ALTER TABLE tasks
ADD COLUMN completed_at TEXT;
