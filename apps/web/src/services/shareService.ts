import { apiRequest } from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001/api';

export const shareService = {
  async createShare(projectId: string): Promise<string> {
    const data = await apiRequest<{ token: string }>('/shares', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    });
    return data.token;
  },

  async getShare(projectId: string): Promise<string | null> {
    const data = await apiRequest<{ token: string } | null>(`/shares/project/${projectId}`);
    return data?.token ?? null;
  },

  async revokeShare(token: string): Promise<void> {
    await apiRequest(`/shares/${token}`, { method: 'DELETE' });
  },
};

// Public API — no auth, uses share token
export async function publicFetch<T>(token: string, endpoint: string): Promise<T> {
  const res = await fetch(`${API_URL}/public/share/${token}/${endpoint}`);
  const body = await res.json() as { data?: T; error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed: ${res.status}`);
  return body.data as T;
}

export async function resolveShareToken(token: string): Promise<{ projectId: string; projectName: string }> {
  const res = await fetch(`${API_URL}/public/share/${token}`);
  const body = await res.json() as { data?: { projectId: string; projectName: string }; error?: string };
  if (!res.ok) throw new Error(body.error ?? 'Invalid link');
  return body.data!;
}
