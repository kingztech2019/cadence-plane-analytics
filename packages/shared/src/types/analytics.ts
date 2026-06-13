// Analytics result types shared between apps/api and apps/web

export type FlowCategory = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled';

// ─── Cycle & Lead Time ────────────────────────────────────────────────────────

export interface WorkItemMetric {
  workItemId: string;
  sequenceId: number;
  title: string;
  cycleTimeHours: number | null;
  leadTimeHours: number | null;
  completedAt: string | null;
  assigneeId: string | null;
  cycleId: string | null;
  priority: string;
  isReactivated: boolean;
}

export interface CycleTimeStats {
  p50Hours: number;
  p85Hours: number;
  avgHours: number;
  count: number;
}

export interface CycleTimeSummary {
  items: WorkItemMetric[];
  stats: CycleTimeStats;
}

// ─── Bottleneck / Time-in-State ───────────────────────────────────────────────

export interface StateBottleneck {
  stateId: string;
  stateName: string;
  flowCategory: FlowCategory;
  avgHours: number;
  p85Hours: number;
  itemCount: number;
  sequenceOrder: number;
}

export interface BottleneckReport {
  states: StateBottleneck[];
  bottleneckStateId: string | null;  // state with highest p85Hours
  persistencePeriods: number;        // how many consecutive 30-day windows this was the bottleneck
}

// ─── Cumulative Flow Diagram ──────────────────────────────────────────────────

export interface CfdDataPoint {
  date: string;               // ISO date string 'YYYY-MM-DD'
  stateName: string;
  flowCategory: FlowCategory;
  itemCount: number;
}

export interface CfdSeries {
  dates: string[];
  series: {
    stateName: string;
    flowCategory: FlowCategory;
    color: string;
    data: number[];           // parallel array with dates
  }[];
}

// ─── Per-Assignee Throughput ──────────────────────────────────────────────────

export interface AssigneeThroughput {
  assigneeId: string;
  displayName: string;
  itemsCompleted: number;
  avgCycleTimeHours: number | null;
  p50CycleTimeHours: number | null;
  p85CycleTimeHours: number | null;
}

export interface ThroughputReport {
  periodDays: number;
  assignees: AssigneeThroughput[];
}

// ─── Sync Status ──────────────────────────────────────────────────────────────

export type SyncStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface SyncState {
  connectionId: string;
  status: SyncStatus;
  recentDataReady: boolean;
  fullHistoryReady: boolean;
  itemsSynced: number;
  lastSyncedAt: string | null;
  errorMessage: string | null;
}

// ─── Issue Journey (drill-through) ───────────────────────────────────────────

export interface IssueStateSegment {
  stateId: string;
  stateName: string;
  flowCategory: FlowCategory;
  stateColor: string | null;
  enteredAt: string;
  exitedAt: string | null;
  durationHours: number | null;
}

export interface IssueJourney {
  workItemId: string;
  sequenceId: number;
  title: string;
  priority: string;
  isReactivated: boolean;
  createdAt: string;
  completedAt: string | null;
  cycleTimeHours: number | null;
  leadTimeHours: number | null;
  assigneeName: string | null;
  assigneeId: string | null;
  states: IssueStateSegment[];
}

// ─── Cross-Project Contributors ───────────────────────────────────────────────

export interface ContributorProjectBreakdown {
  projectId:   string;
  projectName: string;
  issues:      number;
  p50Hours:    number | null;
}

export interface ContributorProfile {
  memberId:     string;
  displayName:  string;
  totalIssues:  number;
  projectCount: number;
  p50Hours:     number | null;
  p85Hours:     number | null;
  avgHours:     number | null;
  projects:     ContributorProjectBreakdown[];
}

export interface ContributorsResult {
  contributors: ContributorProfile[];
  dateFrom:     string;
  dateTo:       string;
}

// ─── Sprint Comparison ────────────────────────────────────────────────────────

export interface SprintMetrics {
  cycleId:        string;
  cycleName:      string;
  startDate:      string;   // YYYY-MM-DD
  endDate:        string;   // YYYY-MM-DD
  durationDays:   number;
  status:         string;
  itemsCompleted: number;
  p50Hours:       number | null;
  p85Hours:       number | null;
  avgHours:       number | null;
}

export interface SprintComparisonResult {
  sprints: SprintMetrics[];
}

// ─── Monte Carlo Forecast ─────────────────────────────────────────────────────

export interface ForecastHistogramPoint {
  week:   number;   // weeks from now
  count:  number;   // simulations finishing THIS week
  pct:    number;   // % finishing this week
  cumPct: number;   // % finishing BY this week (cumulative)
}

export interface ForecastResult {
  backlogSize:          number;
  historicalWeeks:      number;
  weeklyThroughputs:    number[];   // raw weekly counts used as input
  avgWeeklyThroughput:  number;
  simulations:          number;
  p50Weeks:             number;
  p85Weeks:             number;
  p95Weeks:             number;
  p50Date:              string;     // ISO date YYYY-MM-DD
  p85Date:              string;
  p95Date:              string;
  histogram:            ForecastHistogramPoint[];
  insufficient:         boolean;    // true when historical data is too sparse
}

// ─── Dashboard Filters ────────────────────────────────────────────────────────

export interface DashboardFilters {
  projectId?: string;
  cycleId?: string;
  assigneeId?: string;
  labelIds?: string[];
  priority?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ─── Flow Efficiency ─────────────────────────────────────────────────────────

export interface FlowEfficiencyItem {
  workItemId:    string;
  sequenceId:    number;
  title:         string;
  leadTimeHours: number;
  activeHours:   number;     // time in in_progress + review
  waitingHours:  number;     // time in backlog + todo
  efficiencyPct: number;     // min(activeHours / leadTimeHours * 100, 100)
  completedAt:   string | null;
}

export interface FlowEfficiencyReport {
  items:                FlowEfficiencyItem[];
  medianEfficiencyPct:  number;
  avgEfficiencyPct:     number;
  industryBenchmarkPct: number;   // always 15
  totalActiveHours:     number;
  totalWaitingHours:    number;
}

// ─── Scope Creep ──────────────────────────────────────────────────────────────

export interface ScopeSprint {
  cycleId:          string;
  cycleName:        string;
  startDate:        string;
  endDate:          string;
  status:           string;
  totalItems:       number;
  committedItems:   number;    // created before sprint start
  addedDuringItems: number;    // created during sprint
  scopeCreepPct:    number;
  completedItems:   number;
}

export interface ScopeCreepResult {
  sprints:          ScopeSprint[];
  avgScopeCreepPct: number;
  highCreepCount:   number;    // sprints with >30% creep
}

// ─── Flow Health Score ────────────────────────────────────────────────────────

export interface FlowHealthSignal {
  key:      string;
  label:    string;
  score:    number;     // 0–100
  value:    string;     // e.g. "2.4d" or "2.1x"
  context:  string;     // e.g. "12% faster than prior 30d"
  goodDir:  'up' | 'down';
}

export type FlowGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface FlowHealthScore {
  overall:      number;
  grade:        FlowGrade;
  signals:      FlowHealthSignal[];
  insufficient: boolean;
}

// ─── At-Risk Issue Radar ──────────────────────────────────────────────────────

export interface AtRiskIssue {
  workItemId:          string;
  sequenceId:          number;
  title:               string;
  currentState:        string;
  flowCategory:        FlowCategory;
  hoursInCurrentState: number;
  p85ForState:         number;
  overageHours:        number;
  overagePct:          number;
  assigneeName:        string | null;
  projectP85:          number | null;
}

export interface AtRiskResult {
  issues:     AtRiskIssue[];
  projectP85: number | null;
}

// ─── Lead Time ────────────────────────────────────────────────────────────────

export interface LeadTimeSummary {
  items: WorkItemMetric[];
  stats: CycleTimeStats;
  prior: CycleTimeStats | null;   // last 30d prior window for trend comparison
}

// ─── Project Summary Signals ──────────────────────────────────────────────────

export type SummarySignalSeverity = 'critical' | 'warning' | 'good' | 'info';

export interface SummarySignal {
  key: string;
  severity: SummarySignalSeverity;
  title: string;
  metric: string;
  detail: string;
  tabKey: string;
}

export interface ProjectSummary {
  signals: SummarySignal[];
}

// ─── Assignee Health ──────────────────────────────────────────────────────────

export interface AssigneeHealthEntry {
  assigneeId: string;
  displayName: string;
  currentWip: number;
  totalCompleted: number;
  reactivatedCount: number;
  reactivationRate: number;
  p85Hours: number | null;
  teamP85: number | null;
  teamAvgWip: number;
  isOverloaded: boolean;
  isSlow: boolean;
  hasHighReactivation: boolean;
}

export interface AssigneeHealthResult {
  entries: AssigneeHealthEntry[];
  teamP85: number | null;
  teamAvgWip: number;
  flaggedCount: number;
}
