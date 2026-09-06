-- Job Search recommendation runs: the durable ledger for each digest run.
-- A run records the source, run time, attempted delivery and known delivery
-- outcome, plus source coverage. An empty result with COMPLETE coverage is a
-- truthful "no new jobs"; a FAILED/PARTIAL source or UNKNOWN delivery is not.
CREATE TABLE recommendation_runs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    provider TEXT NOT NULL,
    run_reference TEXT,
    run_at TEXT NOT NULL,
    coverage_status TEXT NOT NULL
        CHECK (coverage_status IN ('COMPLETE', 'PARTIAL', 'FAILED', 'UNKNOWN')),
    delivery_status TEXT NOT NULL
        CHECK (delivery_status IN ('DELIVERED', 'ATTEMPTED', 'UNKNOWN')),
    coverage_note TEXT,
    item_count INTEGER NOT NULL CHECK (item_count >= 0),
    retention_until TEXT,
    recorded_at TEXT NOT NULL
);

CREATE INDEX idx_recommendation_runs_workspace
    ON recommendation_runs(workspace_id, run_at DESC, id);

-- Run items snapshot the fit suggestion at delivery time so a later run does
-- not overwrite an earlier run's delivery context. candidate_id is the durable
-- workspace candidate; the snapshot columns preserve this run's advisory view.
CREATE TABLE recommendation_run_items (
    run_id TEXT NOT NULL REFERENCES recommendation_runs(id) ON DELETE CASCADE,
    candidate_id TEXT NOT NULL REFERENCES job_candidates(id),
    position INTEGER NOT NULL,
    fit_reason TEXT,
    fit_uncertainty TEXT
        CHECK (fit_uncertainty IS NULL OR fit_uncertainty IN ('LOW', 'MEDIUM', 'HIGH', 'UNKNOWN')),
    source_availability TEXT
        CHECK (source_availability IS NULL OR source_availability IN ('AVAILABLE', 'UNAVAILABLE', 'UNKNOWN')),
    PRIMARY KEY (run_id, candidate_id)
);
