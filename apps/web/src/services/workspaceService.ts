import { apiRequest } from './api';

export const workspaceService = {
  async listConnections() {
    return apiRequest<Array<{ id: string; plane_workspace_slug: string; sync_status: string; last_full_sync_at: string | null }>>('/workspaces/');
  },

  async connectApiKey(baseUrl: string, apiKey: string, workspaceSlug: string) {
    return apiRequest<{ connectionId: string; workspaceSlug: string }>('/workspaces/connect/apikey', {
      method: 'POST',
      body: JSON.stringify({ baseUrl, apiKey, workspaceSlug }),
    });
  },

  async getOAuthUrl() {
    return apiRequest<{ authUrl: string }>('/auth/plane/authorize');
  },

  async getSyncStatus(connectionId: string) {
    return apiRequest<{
      sync_status: string;
      total_items_synced: number | null;
      last_error: string | null;
    }>(`/workspaces/${connectionId}/sync-status`);
  },

  async listProjects(connectionId: string) {
    return apiRequest<Array<{ id: string; name: string; identifier: string }>>(
      `/workspaces/${connectionId}/projects`
    );
  },
};
