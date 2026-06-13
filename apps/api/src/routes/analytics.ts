import type { FastifyPluginAsync } from 'fastify';
import { metricsService } from '../services/metricsService.js';
import { aiService } from '../services/aiService.js';
import type { DashboardFilters } from '@flow-analytics/shared';

type FiltersQuery = {
  cycleId?: string;
  assigneeId?: string;
  labelIds?: string;
  priority?: string;
  dateFrom?: string;
  dateTo?: string;
};

function parseFilters(query: FiltersQuery): DashboardFilters {
  return {
    cycleId: query.cycleId,
    assigneeId: query.assigneeId,
    labelIds: query.labelIds?.split(',').filter(Boolean),
    priority: query.priority,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  };
}

const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/analytics/contributors
  fastify.get<{
    Querystring: { connectionId: string; dateFrom?: string; dateTo?: string };
  }>(
    '/contributors',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { connectionId, dateFrom, dateTo } = request.query;
      const from = dateFrom ?? new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
      const to   = dateTo   ?? new Date().toISOString().slice(0, 10);
      const result = await metricsService.getContributors(connectionId, from, to);
      return reply.send({ data: result });
    }
  );

  // GET /api/analytics/:projectId/flow-efficiency
  fastify.get<{ Params: { projectId: string }; Querystring: FiltersQuery }>(
    '/:projectId/flow-efficiency',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId } = request.params;
      const filters = parseFilters(request.query);
      const result = await metricsService.getFlowEfficiency(projectId, filters);
      return reply.send({ data: result });
    }
  );

  // GET /api/analytics/:projectId/scope-creep
  fastify.get<{
    Params: { projectId: string };
    Querystring: { limit?: string };
  }>(
    '/:projectId/scope-creep',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId } = request.params;
      const limit = Math.max(1, Math.min(50, parseInt(request.query.limit ?? '8', 10)));
      const result = await metricsService.getScopeCreep(projectId, limit);
      return reply.send({ data: result });
    }
  );

  // GET /api/analytics/:projectId/flow-health
  fastify.get<{ Params: { projectId: string } }>(
    '/:projectId/flow-health',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId } = request.params;
      const result = await metricsService.getFlowHealthScore(projectId);
      return reply.send({ data: result });
    }
  );

  // GET /api/analytics/:projectId/at-risk
  fastify.get<{ Params: { projectId: string } }>(
    '/:projectId/at-risk',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId } = request.params;
      const result = await metricsService.getAtRiskIssues(projectId);
      return reply.send({ data: result });
    }
  );

  // GET /api/analytics/:projectId/issues/:workItemId/journey
  fastify.get<{ Params: { projectId: string; workItemId: string } }>(
    '/:projectId/issues/:workItemId/journey',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { workItemId } = request.params;
      const result = await metricsService.getIssueJourney(workItemId);
      if (!result) return reply.status(404).send({ error: 'Issue not found' });
      return reply.send({ data: result });
    }
  );

  // GET /api/analytics/:projectId/cycle-time
  fastify.get<{ Params: { projectId: string }; Querystring: FiltersQuery }>(
    '/:projectId/cycle-time',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId } = request.params;
      const filters = parseFilters(request.query);
      const result = await metricsService.getCycleTimeSummary(projectId, filters);
      return reply.send({ data: result });
    }
  );

  // GET /api/analytics/:projectId/bottleneck
  fastify.get<{ Params: { projectId: string }; Querystring: FiltersQuery }>(
    '/:projectId/bottleneck',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId } = request.params;
      const filters = parseFilters(request.query);
      const result = await metricsService.getBottleneckReport(projectId, filters);
      return reply.send({ data: result });
    }
  );

  // GET /api/analytics/:projectId/cfd
  fastify.get<{ Params: { projectId: string }; Querystring: FiltersQuery }>(
    '/:projectId/cfd',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId } = request.params;
      const filters = parseFilters(request.query);
      const result = await metricsService.getCfd(projectId, filters);
      return reply.send({ data: result });
    }
  );

  // GET /api/analytics/:projectId/sprint-comparison
  fastify.get<{
    Params: { projectId: string };
    Querystring: { limit?: string };
  }>(
    '/:projectId/sprint-comparison',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId } = request.params;
      const limit = Math.max(1, Math.min(50, parseInt(request.query.limit ?? '6', 10)));
      const result = await metricsService.getSprintComparison(projectId, limit);
      return reply.send({ data: result });
    }
  );

  // GET /api/analytics/:projectId/forecast
  fastify.get<{
    Params: { projectId: string };
    Querystring: { backlogSize?: string; historyWeeks?: string };
  }>(
    '/:projectId/forecast',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId } = request.params;
      const backlogSize   = Math.max(1, parseInt(request.query.backlogSize  ?? '10', 10));
      const historyWeeks  = Math.max(4, Math.min(52, parseInt(request.query.historyWeeks ?? '12', 10)));
      const result = await metricsService.getForecast(projectId, backlogSize, historyWeeks);
      return reply.send({ data: result });
    }
  );

  // GET /api/analytics/:projectId/throughput
  fastify.get<{
    Params: { projectId: string };
    Querystring: FiltersQuery & { periodDays?: string };
  }>(
    '/:projectId/throughput',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId } = request.params;
      const filters = parseFilters(request.query);
      const periodDays = parseInt(request.query.periodDays ?? '30', 10);
      const result = await metricsService.getThroughput(projectId, filters, periodDays);
      return reply.send({ data: result });
    }
  );

  // GET /api/analytics/:projectId/lead-time
  fastify.get<{ Params: { projectId: string }; Querystring: FiltersQuery }>(
    '/:projectId/lead-time',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId } = request.params;
      const filters = parseFilters(request.query);
      const result = await metricsService.getLeadTimeSummary(projectId, filters);
      return reply.send({ data: result });
    }
  );

  // GET /api/analytics/:projectId/summary
  fastify.get<{ Params: { projectId: string } }>(
    '/:projectId/summary',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId } = request.params;
      const result = await metricsService.getProjectSummary(projectId);
      return reply.send({ data: result });
    }
  );

  // GET /api/analytics/:projectId/assignee-health
  fastify.get<{ Params: { projectId: string } }>(
    '/:projectId/assignee-health',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId } = request.params;
      const result = await metricsService.getAssigneeHealth(projectId);
      return reply.send({ data: result });
    }
  );

  // POST /api/analytics/:projectId/sprint-retrospective
  fastify.post<{
    Params: { projectId: string };
    Body: {
      cycleName: string;
      startDate: string;
      endDate: string;
      durationDays: number;
      itemsCompleted: number;
      p50Hours: number | null;
      p85Hours: number | null;
      prevCycleName?: string;
      prevItemsCompleted?: number;
      prevP50Hours?: number | null;
      prevP85Hours?: number | null;
    };
  }>(
    '/:projectId/sprint-retrospective',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const narrative = await aiService.generateSprintRetro(request.body);
        return reply.send({ data: { narrative } });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'AI generation failed';
        return reply.status(503).send({ error: msg });
      }
    }
  );
};

export default analyticsRoutes;
