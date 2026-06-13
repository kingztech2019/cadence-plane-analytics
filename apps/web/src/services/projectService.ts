import { apiRequest } from './api';

export const projectService = {
  async listStates(projectId: string) {
    return apiRequest<Array<{
      id: string;
      name: string;
      color: string;
      plane_group: string;
      flow_category: string;
    }>>(`/projects/${projectId}/states`);
  },

  async updateStateMappings(
    projectId: string,
    updates: Array<{ stateId: string; flowCategory: string }>
  ) {
    return apiRequest<{ updated: number }>(`/projects/${projectId}/states`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async listCycles(projectId: string) {
    return apiRequest<Array<{
      id: string;
      name: string;
      status: string;
      start_date: string | null;
      end_date: string | null;
    }>>(`/projects/${projectId}/cycles`);
  },
};
