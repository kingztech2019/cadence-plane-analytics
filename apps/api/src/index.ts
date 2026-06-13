import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import { env } from './config/env.js';

// Plugins
import authPlugin from './plugins/auth.js';
import sensiblePlugin from './plugins/sensible.js';

// Routes
import authRoutes from './routes/auth.js';
import workspacesRoutes from './routes/workspaces.js';
import projectsRoutes from './routes/projects.js';
import analyticsRoutes from './routes/analytics.js';
import webhooksRoutes from './routes/webhooks.js';
import sharesRoutes from './routes/shares.js';
import publicAnalyticsRoutes from './routes/publicAnalytics.js';

const app = Fastify({
  logger:
    env.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } } }
      : true,
});

// CORS
await app.register(fastifyCors, {
  origin: env.FRONTEND_URL,
  credentials: true,
});

// Plugins
await app.register(authPlugin);
await app.register(sensiblePlugin);

// Routes — all under /api prefix
await app.register(authRoutes,       { prefix: '/api/auth' });
await app.register(workspacesRoutes, { prefix: '/api/workspaces' });
await app.register(projectsRoutes,   { prefix: '/api/projects' });
await app.register(analyticsRoutes,       { prefix: '/api/analytics' });
await app.register(webhooksRoutes,        { prefix: '/api/webhooks' });
await app.register(sharesRoutes,          { prefix: '/api/shares' });
await app.register(publicAnalyticsRoutes, { prefix: '/api/public' });

// Health check
app.get('/health', async () => ({ status: 'ok' }));

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  console.log(`API running on port ${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
