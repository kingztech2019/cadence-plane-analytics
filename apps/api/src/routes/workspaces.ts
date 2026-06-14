import type { FastifyPluginAsync } from 'fastify';
import { pool } from '../config/db.js';
import { syncService } from '../services/syncService.js';
import { aiService } from '../services/aiService.js';

const workspacesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/workspaces — list connected workspaces for current user
  fastify.get(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request.user as { id: string }).id;
      const result = await pool.query(
        `SELECT id, plane_workspace_slug, base_url, auth_method,
                sync_status, last_full_sync_at, last_incremental_sync_at
         FROM workspace_connections
         WHERE owner_user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );
      return reply.send({ data: result.rows });
    }
  );

  // POST /api/workspaces/connect/apikey — connect via API key
  fastify.post<{ Body: { baseUrl: string; apiKey: string; workspaceSlug: string } }>(
    '/connect/apikey',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request.user as { id: string }).id;
      const { baseUrl, apiKey, workspaceSlug } = request.body;

      const base = baseUrl.replace(/\/$/, '');

      // Step 1 — validate API key via /users/me/
      const meRes = await fetch(`${base}/api/v1/users/me/`, {
        headers: { 'X-Api-Key': apiKey },
      });
      if (meRes.status === 403 || meRes.status === 401) {
        return reply.status(400).send({ error: 'Invalid API key — check the token in Plane → Profile → API tokens' });
      }
      if (!meRes.ok) {
        return reply.status(400).send({ error: `Could not reach Plane at ${base} (status ${meRes.status})` });
      }

      // Step 2 — confirm workspace slug exists by listing projects (accessible to all members)
      // The /workspaces/{slug}/ endpoint requires owner/admin; projects/ works for any member.
      const projRes = await fetch(`${base}/api/v1/workspaces/${workspaceSlug}/projects/`, {
        headers: { 'X-Api-Key': apiKey },
      });
      if (projRes.status === 404) {
        return reply.status(400).send({ error: `Workspace "${workspaceSlug}" not found — check the slug in your Plane URL` });
      }
      // Any other non-404 response (200, 403, etc.) means the workspace exists; proceed.

      // Use slug as-is since we can't always fetch workspace id from member-level endpoints.
      // The workspace id will be populated during the first backfill.
      const wsData = { id: null as string | null, slug: workspaceSlug };

      // Encrypt API key before storing
      const { encryptApiKey } = await import('../services/crypto.js');
      const encryptedKey = encryptApiKey(apiKey);

      const conn = await pool.query(
        `INSERT INTO workspace_connections
           (owner_user_id, plane_workspace_slug, plane_workspace_id, base_url, auth_method, api_key_encrypted)
         VALUES ($1, $2, $3, $4, 'api_key', $5)
         ON CONFLICT (owner_user_id, plane_workspace_slug)
         DO UPDATE SET api_key_encrypted = $5, base_url = $4, plane_workspace_id = COALESCE($3, workspace_connections.plane_workspace_id)
         RETURNING id`,
        [userId, wsData.slug, wsData.id, baseUrl, encryptedKey]
      );

      const connectionId = conn.rows[0].id;

      // Kick off backfill asynchronously
      await syncService.kickoffBackfill(connectionId);

      return reply.status(201).send({
        data: { connectionId, workspaceSlug: wsData.slug },
      });
    }
  );

  // GET /api/workspaces/:connectionId/sync-status
  fastify.get<{ Params: { connectionId: string } }>(
    '/:connectionId/sync-status',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request.user as { id: string }).id;
      const { connectionId } = request.params;

      const result = await pool.query(
        `SELECT wc.sync_status, wc.last_full_sync_at, wc.last_incremental_sync_at,
                COUNT(sj.id) FILTER (WHERE sj.status = 'completed') AS completed_jobs,
                SUM(sj.items_synced) AS total_items_synced,
                MAX(sj.error_message) FILTER (WHERE sj.status = 'failed') AS last_error
         FROM workspace_connections wc
         LEFT JOIN sync_jobs sj ON sj.workspace_connection_id = wc.id
         WHERE wc.id = $1 AND wc.owner_user_id = $2
         GROUP BY wc.id`,
        [connectionId, userId]
      );

      if (!result.rows[0]) {
        return reply.status(404).send({ error: 'Connection not found' });
      }

      return reply.send({ data: result.rows[0] });
    }
  );

  // GET /api/workspaces/:connectionId/projects
  fastify.get<{ Params: { connectionId: string } }>(
    '/:connectionId/projects',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request.user as { id: string }).id;
      const { connectionId } = request.params;

      // Verify ownership
      const conn = await pool.query(
        'SELECT id FROM workspace_connections WHERE id = $1 AND owner_user_id = $2',
        [connectionId, userId]
      );
      if (!conn.rows[0]) return reply.status(404).send({ error: 'Not found' });

      const result = await pool.query(
        `SELECT id, plane_project_id, name, identifier, synced_at
         FROM plane_projects
         WHERE workspace_connection_id = $1
         ORDER BY name`,
        [connectionId]
      );
      return reply.send({ data: result.rows });
    }
  );

  // GET /api/workspaces/:connectionId/report
  fastify.get<{
    Params: { connectionId: string };
    Querystring: { from?: string; to?: string; projectId?: string };
  }>(
    '/:connectionId/report',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request.user as { id: string }).id;
      const { connectionId } = request.params;
      const { from, to, projectId } = request.query;

      const conn = await pool.query(
        'SELECT id FROM workspace_connections WHERE id = $1 AND owner_user_id = $2',
        [connectionId, userId]
      );
      if (!conn.rows[0]) return reply.status(404).send({ error: 'Not found' });

      const fromDate = from ?? new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
      const toDate   = to   ?? new Date().toISOString().slice(0, 10);

      const params: unknown[] = [connectionId, fromDate, toDate];
      let projectClause = '';
      if (projectId) {
        params.push(projectId);
        projectClause = ` AND pp.id = $${params.length}`;
      }

      const result = await pool.query(
        `SELECT
           wi.sequence_id,
           wi.title,
           wi.priority,
           wi.created_at_plane,
           wi.updated_at_plane,
           ps.name            AS state_name,
           ps.sequence_order  AS state_order,
           ps.color           AS state_color,
           ps.flow_category,
           wm.display_name    AS assignee_name,
           pp.identifier      AS project_identifier,
           pp.id              AS project_id,
           pp.name            AS project_name,
           -- Days item has been sitting in its current state (open time_in_state interval)
           COALESCE(
             ROUND(EXTRACT(EPOCH FROM (NOW() - tis_cur.entered_at)) / 86400)::int,
             ROUND(EXTRACT(EPOCH FROM (NOW() - wi.updated_at_plane)) / 86400)::int
           ) AS days_in_current_state
         FROM work_items wi
         JOIN plane_states ps      ON wi.plane_state_id  = ps.id
         JOIN plane_projects pp    ON wi.plane_project_id = pp.id
         LEFT JOIN workspace_members wm ON wi.assignee_id = wm.id
         -- Most recent open interval for this item in its current state
         LEFT JOIN LATERAL (
           SELECT entered_at
           FROM time_in_state
           WHERE work_item_id = wi.id
             AND state_id = wi.plane_state_id
             AND exited_at IS NULL
           ORDER BY entered_at DESC
           LIMIT 1
         ) tis_cur ON true
         WHERE pp.workspace_connection_id = $1
           AND wi.updated_at_plane >= $2::date
           AND wi.updated_at_plane <  ($3::date + INTERVAL '1 day')
           ${projectClause}
         ORDER BY ps.sequence_order ASC, wi.updated_at_plane DESC`,
        params
      );

      return reply.send({ data: result.rows });
    }
  );
  // ── MONTHLY REPORT ────────────────────────────────────────────────────────

  // GET /api/workspaces/:connectionId/monthly-report?month=YYYY-MM
  fastify.get<{
    Params: { connectionId: string };
    Querystring: { month?: string };
  }>(
    '/:connectionId/monthly-report',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request.user as { id: string }).id;
      const { connectionId } = request.params;
      const month = request.query.month ?? new Date().toISOString().slice(0, 7);

      if (!/^\d{4}-\d{2}$/.test(month)) {
        return reply.status(400).send({ error: 'month must be YYYY-MM' });
      }

      const conn = await pool.query(
        'SELECT id FROM workspace_connections WHERE id = $1 AND owner_user_id = $2',
        [connectionId, userId]
      );
      if (!conn.rows[0]) return reply.status(404).send({ error: 'Not found' });

      const monthStart = `${month}-01`;
      // First day of next month
      const [y, m] = month.split('-').map(Number) as [number, number];
      const nextMonth = m === 12
        ? `${y + 1}-01-01`
        : `${y}-${String(m + 1).padStart(2, '0')}-01`;

      // Fetch all projects
      const projectsResult = await pool.query(
        `SELECT id, name, identifier FROM plane_projects
         WHERE workspace_connection_id = $1 ORDER BY name`,
        [connectionId]
      );

      if (projectsResult.rows.length === 0) {
        return reply.send({ data: { month, projects: [] } });
      }

      const projectIds = projectsResult.rows.map((p: { id: string }) => p.id);

      // Fetch work items active or completed this month, grouped by state
      const itemsResult = await pool.query(
        `SELECT
           pp.id              AS project_id,
           wi.sequence_id,
           wi.title,
           wi.priority,
           ps.flow_category,
           ps.name            AS state_name,
           ps.color           AS state_color,
           ps.sequence_order  AS state_order
         FROM work_items wi
         JOIN plane_projects pp   ON wi.plane_project_id = pp.id
         JOIN plane_states ps     ON wi.plane_state_id   = ps.id
         WHERE pp.id = ANY($1::uuid[])
           AND ps.flow_category NOT IN ('backlog', 'cancelled')
           AND (
             (wi.updated_at_plane >= $2::date AND wi.updated_at_plane < $3::date)
             OR (wi.completed_at_plane >= $2::date AND wi.completed_at_plane < $3::date)
           )
         ORDER BY pp.name, ps.sequence_order ASC, wi.updated_at_plane DESC`,
        [projectIds, monthStart, nextMonth]
      );

      // Fetch saved narrative entries for this month
      const entriesResult = await pool.query(
        `SELECT plane_project_id, goal_text, activities_text, projections_text
         FROM monthly_report_entries
         WHERE workspace_connection_id = $1 AND report_month = $2`,
        [connectionId, month]
      );
      const entryMap: Record<string, { goal_text: string; activities_text: string; projections_text: string }> = {};
      for (const row of entriesResult.rows) {
        entryMap[row.plane_project_id] = {
          goal_text: row.goal_text,
          activities_text: row.activities_text,
          projections_text: row.projections_text,
        };
      }

      // Group items by project → state
      type ItemRow = { project_id: string; sequence_id: number; title: string; priority: string; flow_category: string; state_name: string; state_color: string | null; state_order: number };
      type StateGroup = { state_name: string; state_color: string | null; flow_category: string; sequence_order: number; items: Array<{ sequence_id: number; title: string; priority: string }> };

      const itemsByProject: Record<string, Record<string, StateGroup>> = {};
      for (const row of itemsResult.rows as ItemRow[]) {
        if (!itemsByProject[row.project_id]) itemsByProject[row.project_id] = {};
        if (!itemsByProject[row.project_id]![row.state_name]) {
          itemsByProject[row.project_id]![row.state_name] = {
            state_name: row.state_name,
            state_color: row.state_color,
            flow_category: row.flow_category,
            sequence_order: row.state_order,
            items: [],
          };
        }
        itemsByProject[row.project_id]![row.state_name]!.items.push({
          sequence_id: row.sequence_id,
          title: row.title,
          priority: row.priority,
        });
      }

      const projects = projectsResult.rows.map((p: { id: string; name: string; identifier: string }) => {
        const stateMap = itemsByProject[p.id] ?? {};
        const itemsByState = Object.values(stateMap).sort((a, b) => a.sequence_order - b.sequence_order);
        const totalItems = itemsByState.reduce((s, g) => s + g.items.length, 0);
        return {
          id: p.id,
          name: p.name,
          identifier: p.identifier,
          totalItems,
          itemsByState,
          entry: entryMap[p.id] ?? null,
        };
      });

      return reply.send({ data: { month, projects } });
    }
  );

  // PUT /api/workspaces/:connectionId/monthly-report/:projectId?month=YYYY-MM
  fastify.put<{
    Params: { connectionId: string; projectId: string };
    Querystring: { month?: string };
    Body: { goal_text?: string; activities_text?: string; projections_text?: string };
  }>(
    '/:connectionId/monthly-report/:projectId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request.user as { id: string }).id;
      const { connectionId, projectId } = request.params;
      const month = request.query.month ?? new Date().toISOString().slice(0, 7);
      const { goal_text = '', activities_text = '', projections_text = '' } = request.body;

      if (!/^\d{4}-\d{2}$/.test(month)) {
        return reply.status(400).send({ error: 'month must be YYYY-MM' });
      }

      const conn = await pool.query(
        'SELECT id FROM workspace_connections WHERE id = $1 AND owner_user_id = $2',
        [connectionId, userId]
      );
      if (!conn.rows[0]) return reply.status(404).send({ error: 'Not found' });

      await pool.query(
        `INSERT INTO monthly_report_entries
           (workspace_connection_id, plane_project_id, report_month, goal_text, activities_text, projections_text, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (workspace_connection_id, plane_project_id, report_month)
         DO UPDATE SET
           goal_text        = EXCLUDED.goal_text,
           activities_text  = EXCLUDED.activities_text,
           projections_text = EXCLUDED.projections_text,
           updated_at       = NOW()`,
        [connectionId, projectId, month, goal_text, activities_text, projections_text]
      );

      return reply.send({ data: { ok: true } });
    }
  );

  // POST /api/workspaces/:connectionId/monthly-report/:projectId/ai-draft?month=YYYY-MM&type=activities|projections
  fastify.post<{
    Params: { connectionId: string; projectId: string };
    Querystring: { month?: string; type?: string };
  }>(
    '/:connectionId/monthly-report/:projectId/ai-draft',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request.user as { id: string }).id;
      const { connectionId, projectId } = request.params;
      const month = request.query.month ?? new Date().toISOString().slice(0, 7);
      const draftType = request.query.type === 'projections' ? 'projections' : 'activities';

      if (!/^\d{4}-\d{2}$/.test(month)) {
        return reply.status(400).send({ error: 'month must be YYYY-MM' });
      }

      const conn = await pool.query(
        'SELECT id FROM workspace_connections WHERE id = $1 AND owner_user_id = $2',
        [connectionId, userId]
      );
      if (!conn.rows[0]) return reply.status(404).send({ error: 'Not found' });

      const monthStart = `${month}-01`;
      const [y, m] = month.split('-').map(Number) as [number, number];
      const nextMonth = m === 12
        ? `${y + 1}-01-01`
        : `${y}-${String(m + 1).padStart(2, '0')}-01`;

      const projectResult = await pool.query(
        'SELECT name FROM plane_projects WHERE id = $1 AND workspace_connection_id = $2',
        [projectId, connectionId]
      );
      if (!projectResult.rows[0]) return reply.status(404).send({ error: 'Project not found' });
      const projectName = projectResult.rows[0].name as string;

      const itemsResult = await pool.query(
        `SELECT wi.title, wi.priority, ps.name AS state_name, ps.flow_category, ps.sequence_order AS state_order
         FROM work_items wi
         JOIN plane_states ps ON wi.plane_state_id = ps.id
         JOIN plane_projects pp ON wi.plane_project_id = pp.id
         WHERE pp.id = $1
           AND ps.flow_category NOT IN ('backlog', 'cancelled')
           AND (
             (wi.updated_at_plane >= $2::date AND wi.updated_at_plane < $3::date)
             OR (wi.completed_at_plane >= $2::date AND wi.completed_at_plane < $3::date)
           )
         ORDER BY ps.sequence_order ASC, wi.updated_at_plane DESC`,
        [projectId, monthStart, nextMonth]
      );

      // Group by state for AI context
      type AiRow = { title: string; priority: string; state_name: string; flow_category: string; state_order: number };
      const stateMap: Record<string, { state_name: string; flow_category: string; sequence_order: number; items: Array<{ title: string; priority: string }> }> = {};
      for (const row of itemsResult.rows as AiRow[]) {
        if (!stateMap[row.state_name]) {
          stateMap[row.state_name] = { state_name: row.state_name, flow_category: row.flow_category, sequence_order: row.state_order, items: [] };
        }
        if (stateMap[row.state_name]!.items.length < 25) {
          stateMap[row.state_name]!.items.push({ title: row.title, priority: row.priority });
        }
      }
      const stateGroups = Object.values(stateMap).sort((a, b) => a.sequence_order - b.sequence_order);

      const monthLabel = new Date(`${month}-15`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      let draft: string;

      if (draftType === 'projections') {
        // For projections: fetch items currently in active development (regardless of month)
        const activeResult = await pool.query(
          `SELECT wi.title, wi.priority, ps.name AS state_name, ps.flow_category, ps.sequence_order AS state_order
           FROM work_items wi
           JOIN plane_states ps ON wi.plane_state_id = ps.id
           JOIN plane_projects pp ON wi.plane_project_id = pp.id
           WHERE pp.id = $1
             AND ps.flow_category IN ('in_progress', 'review', 'todo')
             AND wi.completed_at_plane IS NULL
           ORDER BY ps.sequence_order ASC, wi.updated_at_plane DESC`,
          [projectId]
        );

        type ActiveRow = { title: string; priority: string; state_name: string; flow_category: string; state_order: number };
        const activeStateMap: Record<string, { state_name: string; flow_category: string; sequence_order: number; items: Array<{ title: string; priority: string }> }> = {};
        for (const row of activeResult.rows as ActiveRow[]) {
          if (!activeStateMap[row.state_name]) {
            activeStateMap[row.state_name] = { state_name: row.state_name, flow_category: row.flow_category, sequence_order: row.state_order, items: [] };
          }
          if (activeStateMap[row.state_name]!.items.length < 25) {
            activeStateMap[row.state_name]!.items.push({ title: row.title, priority: row.priority });
          }
        }
        const activeGroups = Object.values(activeStateMap).sort((a, b) => a.sequence_order - b.sequence_order);

        const [y, m] = month.split('-').map(Number) as [number, number];
        const nextM = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
        const nextMonthLabel = new Date(`${nextM}-15`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        draft = await aiService.generateMonthlyProjections({
          projectName,
          monthLabel,
          nextMonthLabel,
          stateGroups: activeGroups,
        });
      } else {
        draft = await aiService.generateMonthlyActivities({
          projectName,
          monthLabel,
          stateGroups,
        });
      }

      return reply.send({ data: { draft } });
    }
  );
};

export default workspacesRoutes;
