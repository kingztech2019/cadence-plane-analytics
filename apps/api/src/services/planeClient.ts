/**
 * Rate-limited Plane API client.
 * Enforces 58 req/min per workspace connection via a Redis Lua token bucket.
 * All sync workers use this — never call the Plane API directly.
 */
import type { Redis } from 'ioredis';
import type {
  PlaneWorkItem,
  PlaneActivity,
  PlaneState,
  PlaneCycle,
  PlaneMember,
  PlanePaginatedResponse,
} from '@flow-analytics/shared';

const BUCKET_CAPACITY = 58;
const REFILL_RATE_PER_SEC = 1;       // 60/min = 1/sec; -2 for headroom

// Atomic Lua: refill tokens from elapsed time, then claim 1 or return wait_ms
const TOKEN_BUCKET_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local rate = tonumber(ARGV[3])

local data = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(data[1]) or capacity
local lastRefill = tonumber(data[2]) or now

local elapsed = math.max(0, now - lastRefill)
local newTokens = math.min(capacity, tokens + elapsed * rate)

if newTokens >= 1 then
  redis.call('HMSET', key, 'tokens', newTokens - 1, 'last_refill', now)
  redis.call('EXPIRE', key, 120)
  return 0
else
  local waitMs = math.ceil((1 - newTokens) / rate * 1000)
  redis.call('HMSET', key, 'tokens', newTokens, 'last_refill', now)
  redis.call('EXPIRE', key, 120)
  return waitMs
end
`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class PlaneClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private bucketKey: string;
  private redis: Redis;

  constructor(opts: {
    baseUrl: string;
    apiKey?: string;
    accessToken?: string;
    connectionId: string;
    redis: Redis;
  }) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.headers = {
      'Content-Type': 'application/json',
      ...(opts.apiKey
        ? { 'X-Api-Key': opts.apiKey }
        : { Authorization: `Bearer ${opts.accessToken}` }),
    };
    this.bucketKey = `rate_bucket:${opts.connectionId}`;
    this.redis = opts.redis;
  }

  private async claimToken(): Promise<number> {
    const now = Date.now() / 1000;
    const result = await this.redis.eval(
      TOKEN_BUCKET_LUA,
      1,
      this.bucketKey,
      now.toString(),
      BUCKET_CAPACITY.toString(),
      REFILL_RATE_PER_SEC.toString()
    );
    return result as number;
  }

  private async fetch<T>(path: string): Promise<T> {
    const waitMs = await this.claimToken();
    if (waitMs > 0) await sleep(waitMs);

    const res = await fetch(`${this.baseUrl}/api/v1/${path}`, {
      headers: this.headers,
    });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '60', 10);
      await sleep(retryAfter * 1000);
      return this.fetch<T>(path);
    }

    if (!res.ok) {
      throw new Error(`Plane API ${res.status}: ${path}`);
    }

    return res.json() as Promise<T>;
  }

  async listWorkspaces(): Promise<PlanePaginatedResponse<{ id: string; slug: string; name: string }>> {
    return this.fetch('workspaces/');
  }

  async listProjects(workspaceSlug: string): Promise<PlanePaginatedResponse<{ id: string; name: string; identifier: string }>> {
    return this.fetch(`workspaces/${workspaceSlug}/projects/`);
  }

  async listStates(workspaceSlug: string, projectId: string): Promise<PlanePaginatedResponse<PlaneState>> {
    return this.fetch(`workspaces/${workspaceSlug}/projects/${projectId}/states/`);
  }

  async listCycles(workspaceSlug: string, projectId: string): Promise<PlanePaginatedResponse<PlaneCycle>> {
    return this.fetch(`workspaces/${workspaceSlug}/projects/${projectId}/cycles/`);
  }

  async listMembers(workspaceSlug: string): Promise<PlaneMember[]> {
    return this.fetch(`workspaces/${workspaceSlug}/members/`);
  }

  async listWorkItems(
    workspaceSlug: string,
    projectId: string,
    opts: { cursor?: string; updatedAtGte?: string } = {}
  ): Promise<PlanePaginatedResponse<PlaneWorkItem>> {
    const params = new URLSearchParams({ per_page: '100' });
    if (opts.cursor) params.set('cursor', opts.cursor);
    if (opts.updatedAtGte) params.set('updated_at__gte', opts.updatedAtGte);
    return this.fetch(
      `workspaces/${workspaceSlug}/projects/${projectId}/work-items/?${params}`
    );
  }

  async listActivities(
    workspaceSlug: string,
    projectId: string,
    issueId: string
  ): Promise<PlanePaginatedResponse<PlaneActivity>> {
    // Activities endpoint still uses /issues/ path (not deprecated)
    return this.fetch(
      `workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/activities/`
    );
  }

  async registerWebhook(
    workspaceSlug: string,
    webhookUrl: string,
    secret: string
  ): Promise<{ id: string }> {
    const waitMs = await this.claimToken();
    if (waitMs > 0) await sleep(waitMs);

    const res = await fetch(
      `${this.baseUrl}/api/v1/workspaces/${workspaceSlug}/webhooks/`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          url: webhookUrl,
          is_active: true,
          secret,
          project: true,
          issue: true,
          cycle: true,
          module: true,
          issue_comment: false,
        }),
      }
    );
    if (!res.ok) throw new Error(`Failed to register webhook: ${res.status}`);
    return res.json() as Promise<{ id: string }>;
  }
}
