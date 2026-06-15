import type { FastifyPluginAsync } from 'fastify';
import { pool } from '../config/db.js';
import { syncService } from '../services/syncService.js';
import { aiService, type WeeklyProjectSummaryInput } from '../services/aiService.js';

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

  // POST /api/workspaces/:connectionId/resync — re-trigger full backfill
  fastify.post<{ Params: { connectionId: string } }>(
    '/:connectionId/resync',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request.user as { id: string }).id;
      const { connectionId } = request.params;

      const check = await pool.query(
        `SELECT id FROM workspace_connections WHERE id = $1 AND owner_user_id = $2`,
        [connectionId, userId]
      );
      if (!check.rows[0]) {
        return reply.status(404).send({ error: 'Connection not found' });
      }

      await syncService.kickoffBackfill(connectionId);
      return reply.send({ ok: true, message: 'Backfill re-queued' });
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
  // ── WEEKLY REPORT SUMMARIES ───────────────────────────────────────────────

  // GET /api/workspaces/:connectionId/report-summaries?from=&to=
  // Returns all saved AI summaries for the given date range
  fastify.get<{
    Params: { connectionId: string };
    Querystring: { from: string; to: string };
  }>(
    '/:connectionId/report-summaries',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request.user as { id: string }).id;
      const { connectionId } = request.params;
      const { from, to } = request.query;

      const conn = await pool.query(
        'SELECT id FROM workspace_connections WHERE id = $1 AND owner_user_id = $2',
        [connectionId, userId]
      );
      if (!conn.rows[0]) return reply.status(404).send({ error: 'Not found' });

      const result = await pool.query(
        `SELECT wrs.plane_project_id, pp.name AS project_name,
                wrs.summary_text, wrs.generated_at
         FROM weekly_report_summaries wrs
         JOIN plane_projects pp ON pp.id = wrs.plane_project_id
         WHERE wrs.workspace_connection_id = $1
           AND wrs.date_from = $2
           AND wrs.date_to   = $3`,
        [connectionId, from, to]
      );

      // Keyed by project id for easy lookup
      const byProject: Record<string, { summary_text: string; generated_at: string }> = {};
      for (const row of result.rows) {
        byProject[row.plane_project_id] = {
          summary_text: row.summary_text,
          generated_at: row.generated_at,
        };
      }
      return reply.send({ data: byProject });
    }
  );

  // POST /api/workspaces/:connectionId/report-summaries/:projectId?from=&to=
  // Generate (or regenerate) and save an AI summary for one project
  fastify.post<{
    Params: { connectionId: string; projectId: string };
    Querystring: { from: string; to: string };
  }>(
    '/:connectionId/report-summaries/:projectId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request.user as { id: string }).id;
      const { connectionId, projectId } = request.params;
      const { from, to } = request.query;

      const conn = await pool.query(
        'SELECT id FROM workspace_connections WHERE id = $1 AND owner_user_id = $2',
        [connectionId, userId]
      );
      if (!conn.rows[0]) return reply.status(404).send({ error: 'Not found' });

      const fromDate = from ?? new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
      const toDate   = to   ?? new Date().toISOString().slice(0, 10);

      // Fetch all work items active in this date range for this project
      const itemsResult = await pool.query(
        `SELECT
           wi.title,
           wi.priority,
           ps.flow_category,
           ps.name AS state_name,
           wm.display_name AS assignee_name,
           wi.completed_at_plane,
           COALESCE(
             ROUND(EXTRACT(EPOCH FROM (NOW() - tis_cur.entered_at)) / 86400)::int,
             ROUND(EXTRACT(EPOCH FROM (NOW() - wi.updated_at_plane)) / 86400)::int
           ) AS days_in_state
         FROM work_items wi
         JOIN plane_states ps      ON wi.plane_state_id  = ps.id
         JOIN plane_projects pp    ON wi.plane_project_id = pp.id
         LEFT JOIN workspace_members wm ON wi.assignee_id = wm.id
         LEFT JOIN LATERAL (
           SELECT entered_at FROM time_in_state
           WHERE work_item_id = wi.id AND state_id = wi.plane_state_id AND exited_at IS NULL
           ORDER BY entered_at DESC LIMIT 1
         ) tis_cur ON true
         WHERE pp.workspace_connection_id = $1
           AND pp.id = $2
           AND wi.updated_at_plane >= $3::date
           AND wi.updated_at_plane <  ($4::date + INTERVAL '1 day')`,
        [connectionId, projectId, fromDate, toDate]
      );

      const projectRow = await pool.query(
        'SELECT name FROM plane_projects WHERE id = $1',
        [projectId]
      );
      if (!projectRow.rows[0]) return reply.status(404).send({ error: 'Project not found' });

      const items = itemsResult.rows as Array<{
        title: string;
        priority: string;
        flow_category: string;
        state_name: string;
        assignee_name: string | null;
        completed_at_plane: string | null;
        days_in_state: number;
      }>;

      // Build aggregated inputs for the AI
      const STALE_THRESHOLD: Record<string, number> = { in_progress: 7, review: 7, todo: 14 };
      const completedItems = items.filter(i => i.flow_category === 'done' || i.completed_at_plane);
      const inProgressItems = items.filter(i => i.flow_category === 'in_progress');
      const reviewItems = items.filter(i => i.flow_category === 'review');
      const staleItems = items.filter(i => {
        const thresh = STALE_THRESHOLD[i.flow_category];
        return thresh !== undefined && i.days_in_state >= thresh;
      });
      const highPriorityItems = items.filter(i => ['urgent','highest','high'].includes(i.priority));

      // Per-assignee stats
      const assigneeMap: Record<string, { name: string; completed: number; inProgress: number; stale: number; totalActive: number }> = {};
      for (const item of items) {
        const name = item.assignee_name ?? 'Unassigned';
        if (!assigneeMap[name]) assigneeMap[name] = { name, completed: 0, inProgress: 0, stale: 0, totalActive: 0 };
        const row = assigneeMap[name]!;
        row.totalActive++;
        if (item.flow_category === 'done' || item.completed_at_plane) row.completed++;
        if (item.flow_category === 'in_progress') row.inProgress++;
        const staleThresh = STALE_THRESHOLD[item.flow_category];
        if (staleThresh !== undefined && item.days_in_state >= staleThresh) row.stale++;
      }

      const summaryInput: WeeklyProjectSummaryInput = {
        projectName: projectRow.rows[0].name,
        dateFrom: fromDate,
        dateTo: toDate,
        totalItems: items.length,
        completedItems: completedItems.length,
        inProgressItems: inProgressItems.length,
        reviewItems: reviewItems.length,
        staleItems: staleItems.length,
        highPriorityItems: highPriorityItems.length,
        assigneeStats: Object.values(assigneeMap),
        completedTitles: completedItems.map(i => i.title),
        staleTitles: staleItems.map(i => `${i.title} (${i.days_in_state}d in ${i.state_name})`),
        blockedTitles: items
          .filter(i => i.priority === 'urgent' && i.flow_category !== 'done')
          .map(i => i.title),
      };

      const summaryText = await aiService.generateWeeklyProjectSummary(summaryInput);

      // Upsert — regeneration replaces the previous summary for the same period
      await pool.query(
        `INSERT INTO weekly_report_summaries
           (workspace_connection_id, plane_project_id, date_from, date_to, summary_text, generated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (workspace_connection_id, plane_project_id, date_from, date_to)
         DO UPDATE SET summary_text = EXCLUDED.summary_text, generated_at = NOW()`,
        [connectionId, projectId, fromDate, toDate, summaryText]
      );

      return reply.send({ data: { summary_text: summaryText, generated_at: new Date().toISOString() } });
    }
  );

  // ── VELOCITY ─────────────────────────────────────────────────────────────

  // GET /api/workspaces/:connectionId/velocity
  // Returns last 6 months of shipped-item counts per project
  fastify.get<{ Params: { connectionId: string } }>(
    '/:connectionId/velocity',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request.user as { id: string }).id;
      const { connectionId } = request.params;

      const conn = await pool.query(
        'SELECT id FROM workspace_connections WHERE id = $1 AND owner_user_id = $2',
        [connectionId, userId]
      );
      if (!conn.rows[0]) return reply.status(404).send({ error: 'Not found' });

      const result = await pool.query(
        `WITH months AS (
           SELECT generate_series(
             date_trunc('month', NOW()) - INTERVAL '5 months',
             date_trunc('month', NOW()),
             '1 month'::interval
           ) AS month_start
         )
         SELECT
           pp.id                                    AS project_id,
           to_char(m.month_start, 'YYYY-MM')       AS month,
           COALESCE(COUNT(wi.id), 0)::int           AS shipped_count
         FROM plane_projects pp
         CROSS JOIN months m
         LEFT JOIN work_items wi
           ON wi.plane_project_id = pp.id
          AND wi.completed_at_plane >= m.month_start
          AND wi.completed_at_plane <  m.month_start + INTERVAL '1 month'
         WHERE pp.workspace_connection_id = $1
         GROUP BY pp.id, m.month_start
         ORDER BY pp.id, m.month_start ASC`,
        [connectionId]
      );

      // Shape: { [projectId]: [ { month, shipped_count } x 6 ] }
      const byProject: Record<string, Array<{ month: string; shipped_count: number }>> = {};
      for (const row of result.rows) {
        if (!byProject[row.project_id]) byProject[row.project_id] = [];
        byProject[row.project_id]!.push({ month: row.month, shipped_count: row.shipped_count });
      }
      return reply.send({ data: byProject });
    }
  );

  // ── REPORT ARCHIVE ────────────────────────────────────────────────────────

  // GET /api/workspaces/:connectionId/report-archive
  fastify.get<{ Params: { connectionId: string } }>(
    '/:connectionId/report-archive',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request.user as { id: string }).id;
      const { connectionId } = request.params;

      const conn = await pool.query(
        'SELECT id FROM workspace_connections WHERE id = $1 AND owner_user_id = $2',
        [connectionId, userId]
      );
      if (!conn.rows[0]) return reply.status(404).send({ error: 'Not found' });

      // Months with saved entries
      const entriesResult = await pool.query(
        `SELECT
           mre.report_month,
           COUNT(DISTINCT mre.plane_project_id)::int                          AS projects_count,
           SUM(CASE WHEN LENGTH(TRIM(mre.activities_text)) > 0 THEN 1 ELSE 0 END)::int AS filled_count
         FROM monthly_report_entries mre
         JOIN plane_projects pp ON mre.plane_project_id = pp.id
         WHERE pp.workspace_connection_id = $1
         GROUP BY mre.report_month
         ORDER BY mre.report_month DESC`,
        [connectionId]
      );

      // Shipped counts per calendar month (from work_items)
      const shippedResult = await pool.query(
        `SELECT
           to_char(date_trunc('month', wi.completed_at_plane), 'YYYY-MM') AS month,
           COUNT(*)::int AS shipped_count
         FROM work_items wi
         JOIN plane_projects pp ON wi.plane_project_id = pp.id
         WHERE pp.workspace_connection_id = $1
           AND wi.completed_at_plane IS NOT NULL
         GROUP BY date_trunc('month', wi.completed_at_plane)
         ORDER BY month DESC`,
        [connectionId]
      );

      const shippedMap: Record<string, number> = {};
      for (const row of shippedResult.rows) shippedMap[row.month] = row.shipped_count;

      const months = entriesResult.rows.map((r) => ({
        month: r.report_month as string,
        projects_count: r.projects_count as number,
        filled_count: r.filled_count as number,
        shipped_count: shippedMap[r.report_month] ?? 0,
      }));

      return reply.send({ data: months });
    }
  );

  // ── QUARTERLY REPORT ─────────────────────────────────────────────────────

  // GET /api/workspaces/:connectionId/quarterly-report?quarter=2026-Q2
  fastify.get<{
    Params: { connectionId: string };
    Querystring: { quarter?: string };
  }>(
    '/:connectionId/quarterly-report',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request.user as { id: string }).id;
      const { connectionId } = request.params;

      // Default to current quarter
      const now = new Date();
      const defaultQ = `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;
      const quarter = request.query.quarter ?? defaultQ;

      const match = quarter.match(/^(\d{4})-Q([1-4])$/);
      if (!match) return reply.status(400).send({ error: 'quarter must be YYYY-Q[1-4]' });

      const year = Number(match[1]);
      const q    = Number(match[2]);
      const firstMonth = (q - 1) * 3 + 1; // 1,4,7,10
      const months = [firstMonth, firstMonth + 1, firstMonth + 2].map(
        (m) => `${year}-${String(m).padStart(2, '0')}`
      );
      const rangeStart = `${year}-${String(firstMonth).padStart(2, '0')}-01`;
      const rangeEnd   = `${year}-${String(firstMonth + 3).padStart(2, '0')}-01`; // exclusive

      const conn = await pool.query(
        'SELECT id FROM workspace_connections WHERE id = $1 AND owner_user_id = $2',
        [connectionId, userId]
      );
      if (!conn.rows[0]) return reply.status(404).send({ error: 'Not found' });

      // Projects
      const projectsResult = await pool.query(
        `SELECT id, name, identifier FROM plane_projects
         WHERE workspace_connection_id = $1 ORDER BY name`,
        [connectionId]
      );

      if (projectsResult.rows.length === 0) {
        return reply.send({ data: { quarter, months, projects: [] } });
      }

      const projectIds = projectsResult.rows.map((p: { id: string }) => p.id);

      // Shipped counts per project per month in the quarter
      const shippedResult = await pool.query(
        `SELECT
           pp.id AS project_id,
           to_char(date_trunc('month', wi.completed_at_plane), 'YYYY-MM') AS month,
           COUNT(*)::int AS shipped_count
         FROM work_items wi
         JOIN plane_projects pp ON wi.plane_project_id = pp.id
         WHERE pp.id = ANY($1::uuid[])
           AND wi.completed_at_plane >= $2::date
           AND wi.completed_at_plane <  $3::date
         GROUP BY pp.id, date_trunc('month', wi.completed_at_plane)`,
        [projectIds, rangeStart, rangeEnd]
      );

      // Narrative entries for the 3 months
      const entriesResult = await pool.query(
        `SELECT plane_project_id, report_month, goal_text, activities_text, projections_text
         FROM monthly_report_entries
         WHERE workspace_connection_id = $1 AND report_month = ANY($2::text[])`,
        [connectionId, months]
      );

      // Index shipped and entries
      type ShippedKey = string; // `${projectId}:${month}`
      const shippedMap: Record<ShippedKey, number> = {};
      for (const r of shippedResult.rows) shippedMap[`${r.project_id}:${r.month}`] = r.shipped_count;

      type EntryVal = { goal_text: string; activities_text: string; projections_text: string };
      const entryMap: Record<ShippedKey, EntryVal> = {};
      for (const r of entriesResult.rows) {
        entryMap[`${r.plane_project_id}:${r.report_month}`] = {
          goal_text: r.goal_text,
          activities_text: r.activities_text,
          projections_text: r.projections_text,
        };
      }

      const projects = projectsResult.rows.map((p: { id: string; name: string; identifier: string }) => ({
        id: p.id,
        name: p.name,
        identifier: p.identifier,
        monthData: months.map((m) => ({
          month: m,
          shipped_count: shippedMap[`${p.id}:${m}`] ?? 0,
          entry: entryMap[`${p.id}:${m}`] ?? null,
        })),
      }));

      return reply.send({ data: { quarter, months, projects } });
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
