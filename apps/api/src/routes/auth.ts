import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from '../config/db.js';
import { env } from '../config/env.js';

const PLANE_APP_URL = 'https://app.plane.so';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/auth/signup
  fastify.post<{ Body: { name: string; email: string; password: string } }>(
    '/signup',
    async (request, reply) => {
      const { name, email, password } = request.body;
      if (!name || !email || password.length < 8) {
        return reply.status(400).send({ error: 'Invalid input' });
      }

      const hash = await bcrypt.hash(password, 12);
      const result = await pool.query(
        `INSERT INTO users (name, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, name, email`,
        [name, email, hash]
      );

      const user = result.rows[0];
      const token = fastify.jwt.sign({ sub: user.id, email: user.email });
      return reply.status(201).send({ data: { token, user: { id: user.id, name: user.name, email: user.email } } });
    }
  );

  // POST /api/auth/login
  fastify.post<{ Body: { email: string; password: string } }>(
    '/login',
    async (request, reply) => {
      const { email, password } = request.body;
      const result = await pool.query(
        'SELECT id, name, email, password_hash FROM users WHERE email = $1',
        [email]
      );
      const user = result.rows[0];
      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }
      const token = fastify.jwt.sign({ sub: user.id, email: user.email });
      return reply.send({ data: { token, user: { id: user.id, name: user.name, email: user.email } } });
    }
  );

  // GET /api/auth/me
  fastify.get(
    '/me',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const result = await pool.query(
        'SELECT id, name, email, created_at FROM users WHERE id = $1',
        [(request.user as { id: string }).id]
      );
      if (!result.rows[0]) return reply.status(404).send({ error: 'Not found' });
      return reply.send({ data: result.rows[0] });
    }
  );

  // GET /api/auth/plane/authorize — initiate OAuth 2.0 PKCE flow
  fastify.get(
    '/plane/authorize',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      if (!env.PLANE_CLIENT_ID || !env.OAUTH_REDIRECT_URI) {
        return reply.status(501).send({ error: 'OAuth not configured' });
      }

      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');
      const stateToken = crypto.randomUUID();

      await pool.query(
        `INSERT INTO oauth_states (state_token, user_id, code_verifier, expires_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')`,
        [stateToken, (request.user as { id: string }).id, codeVerifier]
      );

      const authUrl = new URL(`${PLANE_APP_URL}/o/authorize/`);
      authUrl.searchParams.set('client_id', env.PLANE_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', env.OAUTH_REDIRECT_URI);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'read');
      authUrl.searchParams.set('state', stateToken);
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');

      return reply.send({ data: { authUrl: authUrl.toString() } });
    }
  );

  // GET /api/auth/plane/callback — OAuth 2.0 code exchange
  fastify.get<{ Querystring: { code: string; state: string; error?: string } }>(
    '/plane/callback',
    async (request, reply) => {
      const { code, state, error } = request.query;

      if (error) {
        return reply.redirect(`${env.FRONTEND_URL}/connect?error=${error}`);
      }

      const stateRow = await pool.query(
        `SELECT * FROM oauth_states WHERE state_token = $1 AND expires_at > NOW()`,
        [state]
      );
      if (!stateRow.rows[0]) {
        return reply.redirect(`${env.FRONTEND_URL}/connect?error=state_mismatch`);
      }

      const { user_id: userId, code_verifier: codeVerifier } = stateRow.rows[0];

      // Exchange code for tokens
      const tokenRes = await fetch(`${PLANE_APP_URL}/o/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: env.OAUTH_REDIRECT_URI!,
          client_id: env.PLANE_CLIENT_ID!,
          client_secret: env.PLANE_CLIENT_SECRET!,
          code_verifier: codeVerifier,
        }),
      });

      if (!tokenRes.ok) {
        return reply.redirect(`${env.FRONTEND_URL}/connect?error=token_exchange_failed`);
      }

      const tokens = (await tokenRes.json()) as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
      };

      // Clean up used state
      await pool.query('DELETE FROM oauth_states WHERE state_token = $1', [state]);

      // Fetch workspace list to populate connection
      const wsRes = await fetch('https://api.plane.so/api/v1/workspaces/', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const wsData = (await wsRes.json()) as { results: Array<{ id: string; slug: string }> };
      const workspace = wsData.results[0];

      if (!workspace) {
        return reply.redirect(`${env.FRONTEND_URL}/connect?error=no_workspace`);
      }

      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      const conn = await pool.query(
        `INSERT INTO workspace_connections
           (owner_user_id, plane_workspace_slug, plane_workspace_id, base_url, auth_method,
            oauth_access_token, oauth_refresh_token, oauth_token_expires_at)
         VALUES ($1, $2, $3, 'https://api.plane.so', 'oauth', $4, $5, $6)
         ON CONFLICT (owner_user_id, plane_workspace_slug)
         DO UPDATE SET oauth_access_token = $4, oauth_refresh_token = $5, oauth_token_expires_at = $6
         RETURNING id`,
        [userId, workspace.slug, workspace.id, tokens.access_token, tokens.refresh_token, expiresAt]
      );

      const connectionId = conn.rows[0].id;
      return reply.redirect(`${env.FRONTEND_URL}/setup/state-mapping?connectionId=${connectionId}`);
    }
  );
};

export default authRoutes;
