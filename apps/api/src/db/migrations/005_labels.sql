CREATE TABLE IF NOT EXISTS plane_labels (
  id                       UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_connection_id  UUID  NOT NULL REFERENCES workspace_connections(id) ON DELETE CASCADE,
  plane_project_id         UUID  REFERENCES plane_projects(id) ON DELETE CASCADE,
  plane_label_id           TEXT  NOT NULL,
  name                     TEXT  NOT NULL,
  color                    TEXT,
  UNIQUE (workspace_connection_id, plane_label_id)
);

CREATE INDEX IF NOT EXISTS idx_plane_labels_conn ON plane_labels(workspace_connection_id);
CREATE INDEX IF NOT EXISTS idx_plane_labels_proj ON plane_labels(plane_project_id);
