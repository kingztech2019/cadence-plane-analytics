import type { FastifyPluginAsync } from 'fastify';
import { pool } from '../config/db.js';
import { syncService } from '../services/syncService.js';

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
};

export default workspacesRoutes;
