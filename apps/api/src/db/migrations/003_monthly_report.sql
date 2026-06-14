-- Monthly Performance Review entries — narrative text per project per month
CREATE TABLE IF NOT EXISTS monthly_report_entries (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_connection_id UUID NOT NULL REFERENCES workspace_connections(id) ON DELETE CASCADE,
  plane_project_id        UUID NOT NULL REFERENCES plane_projects(id) ON DELETE CASCADE,
  report_month            TEXT NOT NULL CHECK (report_month ~ '^[0-9]{4}-[0-9]{2}$'),
  goal_text               TEXT NOT NULL DEFAULT '',
  activities_text         TEXT NOT NULL DEFAULT '',
  projections_text        TEXT NOT NULL DEFAULT '',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_connection_id, plane_project_id, report_month)
);

CREATE INDEX IF NOT EXISTS idx_mre_connection_month
  ON monthly_report_entries(workspace_connection_id, report_month);
