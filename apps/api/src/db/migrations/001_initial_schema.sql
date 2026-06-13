-- Flow Analytics for Plane — Initial Schema
-- Run via: node apps/api/dist/db/migrate.js

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- USERS (tool-level accounts, separate from Plane's own users)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- WORKSPACE CONNECTIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspace_connections (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plane_workspace_slug     TEXT NOT NULL,
  plane_workspace_id       TEXT NOT NULL,
  base_url                 TEXT NOT NULL DEFAULT 'https://api.plane.so',
  auth_method              TEXT NOT NULL CHECK (auth_method IN ('api_key', 'oauth')),
  -- API key path (AES-256-GCM encrypted: iv:authTag:ciphertext)
  api_key_encrypted        TEXT,
  -- OAuth path
  oauth_access_token       TEXT,
  oauth_refresh_token      TEXT,
  oauth_token_expires_at   TIMESTAMPTZ,
  oauth_scope              TEXT,
  -- Sync state
  sync_status              TEXT NOT NULL DEFAULT 'pending'
                             CHECK (sync_status IN ('pending','running','completed','failed')),
  last_full_sync_at        TIMESTAMPTZ,
  last_incremental_sync_at TIMESTAMPTZ,
  incremental_cursor       TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_user_id, plane_workspace_slug)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- WORKSPACE MEMBERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspace_members (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_connection_id UUID NOT NULL REFERENCES workspace_connections(id) ON DELETE CASCADE,
  user_id                 UUID REFERENCES users(id),
  plane_member_id         TEXT NOT NULL,
  display_name            TEXT NOT NULL,
  email                   TEXT,
  role                    TEXT,
  is_admin                BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_connection_id, plane_member_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PROJECTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plane_projects (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_connection_id UUID NOT NULL REFERENCES workspace_connections(id) ON DELETE CASCADE,
  plane_project_id        TEXT NOT NULL,
  name                    TEXT NOT NULL,
  identifier              TEXT NOT NULL,
  network                 INTEGER,
  created_at_plane        TIMESTAMPTZ,
  updated_at_plane        TIMESTAMPTZ,
  synced_at               TIMESTAMPTZ,
  UNIQUE (workspace_connection_id, plane_project_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- STATES — with flow_category mapping for analytics
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plane_states (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plane_project_id UUID NOT NULL REFERENCES plane_projects(id) ON DELETE CASCADE,
  plane_state_id   TEXT NOT NULL,
  name             TEXT NOT NULL,
  color            TEXT,
  -- Plane native group: backlog | unstarted | started | completed | cancelled
  plane_group      TEXT NOT NULL,
  -- Our analytics category
  flow_category    TEXT NOT NULL DEFAULT 'backlog'
                   CHECK (flow_category IN ('backlog','todo','in_progress','review','done','cancelled')),
  mapping_override BOOLEAN NOT NULL DEFAULT false,
  sequence_order   INTEGER NOT NULL DEFAULT 0,
  UNIQUE (plane_project_id, plane_state_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- CYCLES (sprints)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plane_cycles (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plane_project_id UUID NOT NULL REFERENCES plane_projects(id) ON DELETE CASCADE,
  plane_cycle_id   TEXT NOT NULL,
  name             TEXT NOT NULL,
  status           TEXT,
  start_date       DATE,
  end_date         DATE,
  UNIQUE (plane_project_id, plane_cycle_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- WORK ITEMS (issues) — uses /work-items/ API (not deprecated /issues/)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_items (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plane_project_id    UUID NOT NULL REFERENCES plane_projects(id) ON DELETE CASCADE,
  plane_work_item_id  TEXT NOT NULL,
  sequence_id         INTEGER,
  title               TEXT NOT NULL,
  priority            TEXT DEFAULT 'none',
  plane_state_id      UUID REFERENCES plane_states(id),
  assignee_id         UUID REFERENCES workspace_members(id),
  label_ids           TEXT[] DEFAULT '{}',
  cycle_id            UUID REFERENCES plane_cycles(id),
  estimate_points     NUMERIC,
  created_at_plane    TIMESTAMPTZ NOT NULL,
  updated_at_plane    TIMESTAMPTZ NOT NULL,
  completed_at_plane  TIMESTAMPTZ,
  -- Computed metrics — updated by metricsWorker after each sync
  lead_time_hours     NUMERIC,
  cycle_time_hours    NUMERIC,
  is_reactivated      BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (plane_project_id, plane_work_item_id)
);

CREATE INDEX IF NOT EXISTS idx_wi_project    ON work_items(plane_project_id);
CREATE INDEX IF NOT EXISTS idx_wi_state      ON work_items(plane_state_id);
CREATE INDEX IF NOT EXISTS idx_wi_cycle      ON work_items(cycle_id);
CREATE INDEX IF NOT EXISTS idx_wi_assignee   ON work_items(assignee_id);
CREATE INDEX IF NOT EXISTS idx_wi_completed  ON work_items(completed_at_plane)
  WHERE completed_at_plane IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- STATE TRANSITIONS — raw activity events; core table for time-in-state
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS state_transitions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_item_id      UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  from_state_id     UUID REFERENCES plane_states(id),
  to_state_id       UUID NOT NULL REFERENCES plane_states(id),
  transitioned_at   TIMESTAMPTZ NOT NULL,
  actor_id          UUID REFERENCES workspace_members(id),
  -- Idempotency: Plane activity UUID prevents duplicate inserts on re-sync
  plane_activity_id TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_st_work_item       ON state_transitions(work_item_id);
CREATE INDEX IF NOT EXISTS idx_st_to_state        ON state_transitions(to_state_id);
CREATE INDEX IF NOT EXISTS idx_st_transitioned_at ON state_transitions(transitioned_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- TIME IN STATE — computed per work item per state; powers bottleneck & CFD
-- duration_hours is a generated column for fast aggregation
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS time_in_state (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_item_id   UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  state_id       UUID NOT NULL REFERENCES plane_states(id),
  entered_at     TIMESTAMPTZ NOT NULL,
  exited_at      TIMESTAMPTZ,
  duration_hours NUMERIC GENERATED ALWAYS AS (
    CASE WHEN exited_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (exited_at - entered_at)) / 3600.0
    END
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_tis_work_item ON time_in_state(work_item_id);
CREATE INDEX IF NOT EXISTS idx_tis_state     ON time_in_state(state_id);
CREATE INDEX IF NOT EXISTS idx_tis_entered   ON time_in_state(entered_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- SYNC JOBS — audit trail for backfill and incremental runs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_jobs (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_connection_id UUID NOT NULL REFERENCES workspace_connections(id) ON DELETE CASCADE,
  job_type                TEXT NOT NULL CHECK (job_type IN ('backfill','incremental','webhook')),
  bullmq_job_id           TEXT,
  status                  TEXT NOT NULL DEFAULT 'queued'
                          CHECK (status IN ('queued','running','completed','failed')),
  items_synced            INTEGER DEFAULT 0,
  error_message           TEXT,
  started_at              TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- OAUTH STATES — short-lived PKCE tokens (10 min TTL)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oauth_states (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  state_token   TEXT NOT NULL UNIQUE,
  user_id       UUID REFERENCES users(id),
  code_verifier TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SHARE TOKENS — read-only shareable dashboard links (P1)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS share_tokens (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_connection_id UUID NOT NULL REFERENCES workspace_connections(id) ON DELETE CASCADE,
  plane_project_id        UUID REFERENCES plane_projects(id),
  token                   TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64'),
  created_by_user_id      UUID REFERENCES users(id),
  expires_at              TIMESTAMPTZ,
  view_config             JSONB NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
