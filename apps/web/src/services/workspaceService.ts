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

  async getVelocity(connectionId: string) {
    return apiRequest<Record<string, Array<{ month: string; shipped_count: number }>>>(
      `/workspaces/${connectionId}/velocity`
    );
  },

  async getReportArchive(connectionId: string) {
    return apiRequest<Array<{
      month: string;
      projects_count: number;
      filled_count: number;
      shipped_count: number;
    }>>(`/workspaces/${connectionId}/report-archive`);
  },

  async getQuarterlyReport(connectionId: string, quarter: string) {
    return apiRequest<{
      quarter: string;
      months: string[];
      projects: Array<{
        id: string;
        name: string;
        identifier: string;
        monthData: Array<{
          month: string;
          shipped_count: number;
          entry: { goal_text: string; activities_text: string; projections_text: string } | null;
        }>;
      }>;
    }>(`/workspaces/${connectionId}/quarterly-report?quarter=${quarter}`);
  },

  async getMonthlyReport(connectionId: string, month: string) {
    return apiRequest<{
      month: string;
      projects: Array<{
        id: string;
        name: string;
        identifier: string;
        totalItems: number;
        itemsByState: Array<{
          state_name: string;
          state_color: string | null;
          flow_category: string;
          sequence_order: number;
          items: Array<{ sequence_id: number; title: string; priority: string }>;
        }>;
        entry: { goal_text: string; activities_text: string; projections_text: string } | null;
      }>;
    }>(`/workspaces/${connectionId}/monthly-report?month=${month}`);
  },

  async saveMonthlyEntry(
    connectionId: string,
    projectId: string,
    month: string,
    data: { goal_text: string; activities_text: string; projections_text: string },
  ) {
    return apiRequest<{ ok: boolean }>(
      `/workspaces/${connectionId}/monthly-report/${projectId}?month=${month}`,
      { method: 'PUT', body: JSON.stringify(data) },
    );
  },

  async aiDraftActivities(connectionId: string, projectId: string, month: string) {
    return apiRequest<{ draft: string }>(
      `/workspaces/${connectionId}/monthly-report/${projectId}/ai-draft?month=${month}&type=activities`,
      { method: 'POST', body: '{}' },
    );
  },

  async aiDraftProjections(connectionId: string, projectId: string, month: string) {
    return apiRequest<{ draft: string }>(
      `/workspaces/${connectionId}/monthly-report/${projectId}/ai-draft?month=${month}&type=projections`,
      { method: 'POST', body: '{}' },
    );
  },

  async getReport(
    connectionId: string,
    from: string,
    to: string,
    projectId?: string,
  ) {
    const params = new URLSearchParams({ from, to });
    if (projectId) params.set('projectId', projectId);
    return apiRequest<Array<{
      sequence_id: number;
      title: string;
      priority: string;
      created_at_plane: string;
      updated_at_plane: string;
      state_name: string;
      state_order: number;
      state_color: string | null;
      flow_category: string;
      days_in_current_state: number;
      assignee_name: string | null;
      project_identifier: string;
      project_id: string;
      project_name: string;
    }>>(`/workspaces/${connectionId}/report?${params.toString()}`);
  },

  async getReportSummaries(connectionId: string, from: string, to: string) {
    return apiRequest<Record<string, { summary_text: string; generated_at: string }>>(
      `/workspaces/${connectionId}/report-summaries?from=${from}&to=${to}`
    );
  },

  async generateReportSummary(connectionId: string, projectId: string, from: string, to: string) {
    return apiRequest<{ summary_text: string; generated_at: string }>(
      `/workspaces/${connectionId}/report-summaries/${projectId}?from=${from}&to=${to}`,
      { method: 'POST', body: '{}' }
    );
  },
};
