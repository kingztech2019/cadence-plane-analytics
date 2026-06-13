import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4001),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().length(64), // 32-byte hex

  PLANE_CLIENT_ID: z.string().optional(),
  PLANE_CLIENT_SECRET: z.string().optional(),
  PLANE_WEBHOOK_SECRET: z.string().optional(),
  OAUTH_REDIRECT_URI: z.string().url().optional(),

  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  OPENROUTER_API_KEY: z.string().optional(),
});

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;
