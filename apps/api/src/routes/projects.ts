import type { FastifyPluginAsync } from 'fastify';
import { pool } from '../config/db.js';

const projectsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/projects/:projectId/states — list states with flow_category mapping
  fastify.get<{ Params: { projectId: string } }>(
    '/:projectId/states',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId } = request.params;
      const result = await pool.query(
        `SELECT id, plane_state_id, name, color, plane_group, flow_category,
                mapping_override, sequence_order
         FROM plane_states
         WHERE plane_project_id = $1
         ORDER BY sequence_order`,
        [projectId]
      );
      return reply.send({ data: result.rows });
    }
  );

  // PATCH /api/projects/:projectId/states — update flow_category mapping
  fastify.patch<{
    Params: { projectId: string };
    Body: Array<{ stateId: string; flowCategory: string }>;
  }>(
    '/:projectId/states',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId } = request.params;
      const updates = request.body;

      await Promise.all(
        updates.map(({ stateId, flowCategory }) =>
          pool.query(
            `UPDATE plane_states
             SET flow_category = $1, mapping_override = true
             WHERE id = $2 AND plane_project_id = $3`,
            [flowCategory, stateId, projectId]
          )
        )
      );

      return reply.send({ data: { updated: updates.length } });
    }
  );

  // GET /api/projects/:projectId/cycles
  fastify.get<{ Params: { projectId: string } }>(
    '/:projectId/cycles',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId } = request.params;
      const result = await pool.query(
        `SELECT id, plane_cycle_id, name, status, start_date, end_date
         FROM plane_cycles
         WHERE plane_project_id = $1
         ORDER BY start_date DESC NULLS LAST`,
        [projectId]
      );
      return reply.send({ data: result.rows });
    }
  );

  // GET /api/projects/:projectId/members
  fastify.get<{ Params: { projectId: string } }>(
    '/:projectId/members',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId } = request.params;

      // Get workspace connection from project
      const proj = await pool.query(
        `SELECT workspace_connection_id FROM plane_projects WHERE id = $1`,
        [projectId]
      );
      if (!proj.rows[0]) return reply.status(404).send({ error: 'Project not found' });

      const result = await pool.query(
        `SELECT id, plane_member_id, display_name, email, role
         FROM workspace_members
         WHERE workspace_connection_id = $1
         ORDER BY display_name`,
        [proj.rows[0].workspace_connection_id]
      );
      return reply.send({ data: result.rows });
    }
  );
};

export default projectsRoutes;
