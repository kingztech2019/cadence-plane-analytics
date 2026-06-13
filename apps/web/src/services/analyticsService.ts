import { apiRequest } from './api';
import type {
  CycleTimeSummary,
  BottleneckReport,
  CfdSeries,
  ThroughputReport,
  IssueJourney,
  ForecastResult,
  SprintComparisonResult,
  SprintMetrics,
  ContributorsResult,
  FlowEfficiencyReport,
  ScopeCreepResult,
  FlowHealthScore,
  AtRiskResult,
  LeadTimeSummary,
  DashboardFilters,
  ProjectSummary,
  AssigneeHealthResult,
} from '@flow-analytics/shared';

function toQueryString(filters: DashboardFilters): string {
  const params = new URLSearchParams();
  if (filters.cycleId) params.set('cycleId', filters.cycleId);
  if (filters.assigneeId) params.set('assigneeId', filters.assigneeId);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.labelIds?.length) params.set('labelIds', filters.labelIds.join(','));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const analyticsService = {
  getCycleTime(projectId: string, filters: DashboardFilters = {}): Promise<CycleTimeSummary> {
    return apiRequest<CycleTimeSummary>(`/analytics/${projectId}/cycle-time${toQueryString(filters)}`);
  },

  getBottleneck(projectId: string, filters: DashboardFilters = {}): Promise<BottleneckReport> {
    return apiRequest<BottleneckReport>(`/analytics/${projectId}/bottleneck${toQueryString(filters)}`);
  },

  getCfd(projectId: string, filters: DashboardFilters = {}): Promise<CfdSeries> {
    return apiRequest<CfdSeries>(`/analytics/${projectId}/cfd${toQueryString(filters)}`);
  },

  getThroughput(projectId: string, filters: DashboardFilters = {}, periodDays = 30): Promise<ThroughputReport> {
    const params = new URLSearchParams(toQueryString(filters).slice(1));
    params.set('periodDays', periodDays.toString());
    return apiRequest<ThroughputReport>(`/analytics/${projectId}/throughput?${params}`);
  },

  getIssueJourney(projectId: string, workItemId: string): Promise<IssueJourney> {
    return apiRequest<IssueJourney>(`/analytics/${projectId}/issues/${workItemId}/journey`);
  },

  getContributors(connectionId: string, dateFrom: string, dateTo: string): Promise<ContributorsResult> {
    return apiRequest<ContributorsResult>(
      `/analytics/contributors?connectionId=${connectionId}&dateFrom=${dateFrom}&dateTo=${dateTo}`
    );
  },

  getSprintComparison(projectId: string, limit: number): Promise<SprintComparisonResult> {
    return apiRequest<SprintComparisonResult>(
      `/analytics/${projectId}/sprint-comparison?limit=${limit}`
    );
  },

  getForecast(projectId: string, backlogSize: number, historyWeeks: number): Promise<ForecastResult> {
    return apiRequest<ForecastResult>(
      `/analytics/${projectId}/forecast?backlogSize=${backlogSize}&historyWeeks=${historyWeeks}`
    );
  },

  getFlowHealthScore(projectId: string): Promise<FlowHealthScore> {
    return apiRequest<FlowHealthScore>(`/analytics/${projectId}/flow-health`);
  },

  getAtRiskIssues(projectId: string): Promise<AtRiskResult> {
    return apiRequest<AtRiskResult>(`/analytics/${projectId}/at-risk`);
  },

  getFlowEfficiency(projectId: string, filters: DashboardFilters = {}): Promise<FlowEfficiencyReport> {
    return apiRequest<FlowEfficiencyReport>(`/analytics/${projectId}/flow-efficiency${toQueryString(filters)}`);
  },

  getScopeCreep(projectId: string, limit: number): Promise<ScopeCreepResult> {
    return apiRequest<ScopeCreepResult>(`/analytics/${projectId}/scope-creep?limit=${limit}`);
  },

  getLeadTimeSummary(projectId: string, filters: DashboardFilters = {}): Promise<LeadTimeSummary> {
    return apiRequest<LeadTimeSummary>(`/analytics/${projectId}/lead-time${toQueryString(filters)}`);
  },

  getProjectSummary(projectId: string): Promise<ProjectSummary> {
    return apiRequest<ProjectSummary>(`/analytics/${projectId}/summary`);
  },

  getAssigneeHealth(projectId: string): Promise<AssigneeHealthResult> {
    return apiRequest<AssigneeHealthResult>(`/analytics/${projectId}/assignee-health`);
  },

  generateSprintRetro(
    projectId: string,
    sprint: SprintMetrics,
    prev: SprintMetrics | null
  ): Promise<{ narrative: string }> {
    return apiRequest<{ narrative: string }>(`/analytics/${projectId}/sprint-retrospective`, {
      method: 'POST',
      body: JSON.stringify({
        cycleName: sprint.cycleName,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        durationDays: sprint.durationDays,
        itemsCompleted: sprint.itemsCompleted,
        p50Hours: sprint.p50Hours,
        p85Hours: sprint.p85Hours,
        ...(prev
          ? {
              prevCycleName: prev.cycleName,
              prevItemsCompleted: prev.itemsCompleted,
              prevP50Hours: prev.p50Hours,
              prevP85Hours: prev.p85Hours,
            }
          : {}),
      }),
    });
  },
};
