import type { FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { metricsQueue } from '../workers/queues.js';
import type { PlaneWebhookEvent } from '@flow-analytics/shared';

const webhooksRoutes: FastifyPluginAsync = async (fastify) => {
  // Register raw body parser for this route only — needed for HMAC verification
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => done(null, body)
  );

  fastify.post<{ Body: Buffer }>(
    '/plane',
    async (request, reply) => {
      // 1. Verify HMAC-SHA256 signature
      const signature = request.headers['x-plane-signature'] as string | undefined;

      if (!signature || !env.PLANE_WEBHOOK_SECRET) {
        return reply.status(401).send({ error: 'Missing signature' });
      }

      const expected = crypto
        .createHmac('sha256', env.PLANE_WEBHOOK_SECRET)
        .update(request.body)
        .digest('hex');

      const sigBuffer = Buffer.from(signature, 'hex');
      const expBuffer = Buffer.from(expected, 'hex');

      if (
        sigBuffer.length !== expBuffer.length ||
        !crypto.timingSafeEqual(sigBuffer, expBuffer)
      ) {
        return reply.status(401).send({ error: 'Invalid signature' });
      }

      // 2. Respond immediately — Plane retries on non-2xx
      await reply.status(200).send({ received: true });

      // 3. Enqueue for async processing
      const event = JSON.parse(request.body.toString()) as PlaneWebhookEvent;
      await metricsQueue.add(
        'webhook_process',
        {
          eventType: event.event,
          action: event.action,
          data: event.data,
          workspaceSlug: event.workspace_slug,
          projectId: event.project_id,
        },
        {
          priority: 1, // highest — beats backfill jobs
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        }
      );
    }
  );
};

export default webhooksRoutes;
