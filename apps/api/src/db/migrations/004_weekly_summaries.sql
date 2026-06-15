CREATE TABLE IF NOT EXISTS weekly_report_summaries (
  id                       UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_connection_id  UUID        NOT NULL REFERENCES workspace_connections(id) ON DELETE CASCADE,
  plane_project_id         UUID        NOT NULL REFERENCES plane_projects(id) ON DELETE CASCADE,
  date_from                TEXT        NOT NULL CHECK (date_from ~ '^\d{4}-\d{2}-\d{2}$'),
  date_to                  TEXT        NOT NULL CHECK (date_to   ~ '^\d{4}-\d{2}-\d{2}$'),
  summary_text             TEXT        NOT NULL,
  generated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_connection_id, plane_project_id, date_from, date_to)
);

CREATE INDEX IF NOT EXISTS idx_wrs_connection_dates
  ON weekly_report_summaries(workspace_connection_id, date_from, date_to);
