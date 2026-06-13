import type { FastifyPluginAsync } from 'fastify';
import { pool } from '../config/db.js';
import { metricsService } from '../services/metricsService.js';

// Resolves a share token → project ID. Returns null if invalid/expired.
async function resolveToken(token: string): Promise<{ projectId: string; projectName: string } | null> {
  const res = await pool.query(
    `SELECT st.plane_project_id::text AS "projectId", pp.name AS "projectName"
     FROM share_tokens st
     JOIN plane_projects pp ON pp.id = st.plane_project_id
     WHERE st.token = $1
       AND (st.expires_at IS NULL OR st.expires_at > NOW())`,
    [token]
  );
  if (!res.rows[0]) return null;
  return { projectId: res.rows[0].projectId as string, projectName: res.rows[0].projectName as string };
}

const publicAnalyticsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/public/share/:token — validate token + return project meta
  fastify.get<{ Params: { token: string } }>(
    '/share/:token',
    async (request, reply) => {
      const { token } = request.params;
      const resolved = await resolveToken(token);
      if (!resolved) return reply.status(404).send({ error: 'Invalid or expired link' });
      return reply.send({ data: resolved });
    }
  );

  // GET /api/public/share/:token/cycle-time
  fastify.get<{ Params: { token: string } }>(
    '/share/:token/cycle-time',
    async (request, reply) => {
      const resolved = await resolveToken(request.params.token);
      if (!resolved) return reply.status(404).send({ error: 'Invalid or expired link' });
      const result = await metricsService.getCycleTimeSummary(resolved.projectId, {});
      return reply.send({ data: result });
    }
  );

  // GET /api/public/share/:token/bottleneck
  fastify.get<{ Params: { token: string } }>(
    '/share/:token/bottleneck',
    async (request, reply) => {
      const resolved = await resolveToken(request.params.token);
      if (!resolved) return reply.status(404).send({ error: 'Invalid or expired link' });
      const result = await metricsService.getBottleneckReport(resolved.projectId, {});
      return reply.send({ data: result });
    }
  );

  // GET /api/public/share/:token/throughput
  fastify.get<{ Params: { token: string } }>(
    '/share/:token/throughput',
    async (request, reply) => {
      const resolved = await resolveToken(request.params.token);
      if (!resolved) return reply.status(404).send({ error: 'Invalid or expired link' });
      const result = await metricsService.getThroughput(resolved.projectId, {}, 90);
      return reply.send({ data: result });
    }
  );

  // GET /api/public/share/:token/flow-efficiency
  fastify.get<{ Params: { token: string } }>(
    '/share/:token/flow-efficiency',
    async (request, reply) => {
      const resolved = await resolveToken(request.params.token);
      if (!resolved) return reply.status(404).send({ error: 'Invalid or expired link' });
      const result = await metricsService.getFlowEfficiency(resolved.projectId, {});
      return reply.send({ data: result });
    }
  );
};

export default publicAnalyticsRoutes;
