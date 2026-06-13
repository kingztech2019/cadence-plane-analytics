import type { FastifyPluginAsync } from 'fastify';
import { pool } from '../config/db.js';

const sharesRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/shares — create or return existing share token for a project
  fastify.post<{
    Body: { projectId: string };
  }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId } = request.body;
      if (!projectId) return reply.status(400).send({ error: 'projectId required' });

      const projRes = await pool.query(
        `SELECT workspace_connection_id FROM plane_projects WHERE id = $1`,
        [projectId]
      );
      if (!projRes.rows[0]) return reply.status(404).send({ error: 'Project not found' });

      const { workspace_connection_id } = projRes.rows[0];

      // Return existing token if already shared
      const existing = await pool.query(
        `SELECT token FROM share_tokens WHERE plane_project_id = $1 AND expires_at IS NULL LIMIT 1`,
        [projectId]
      );
      if (existing.rows[0]) {
        return reply.send({ data: { token: existing.rows[0].token as string } });
      }

      // Create new token (hex-encoded for URL safety)
      const res = await pool.query(
        `INSERT INTO share_tokens (workspace_connection_id, plane_project_id, token)
         VALUES ($1, $2, encode(gen_random_bytes(16), 'hex'))
         RETURNING token`,
        [workspace_connection_id, projectId]
      );
      return reply.send({ data: { token: res.rows[0].token as string } });
    }
  );

  // GET /api/shares/project/:projectId — get existing share for a project
  fastify.get<{ Params: { projectId: string } }>(
    '/project/:projectId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId } = request.params;
      const res = await pool.query(
        `SELECT token FROM share_tokens WHERE plane_project_id = $1 AND expires_at IS NULL LIMIT 1`,
        [projectId]
      );
      if (!res.rows[0]) return reply.send({ data: null });
      return reply.send({ data: { token: res.rows[0].token as string } });
    }
  );

  // DELETE /api/shares/:token — revoke a share link
  fastify.delete<{ Params: { token: string } }>(
    '/:token',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { token } = request.params;
      await pool.query(`DELETE FROM share_tokens WHERE token = $1`, [token]);
      return reply.send({ data: { revoked: true } });
    }
  );
};

export default sharesRoutes;
