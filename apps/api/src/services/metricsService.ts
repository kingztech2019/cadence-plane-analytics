import { pool } from '../config/db.js';
import type {
  CycleTimeSummary,
  BottleneckReport,
  CfdSeries,
  ThroughputReport,
  IssueJourney,
  ForecastResult,
  ForecastHistogramPoint,
  SprintMetrics,
  SprintComparisonResult,
  ContributorProfile,
  ContributorProjectBreakdown,
  ContributorsResult,
  FlowEfficiencyItem,
  FlowEfficiencyReport,
  ScopeSprint,
  ScopeCreepResult,
  FlowHealthScore,
  FlowHealthSignal,
  FlowGrade,
  AtRiskIssue,
  AtRiskResult,
  LeadTimeSummary,
  DashboardFilters,
  ProjectSummary,
  SummarySignal,
  SummarySignalSeverity,
  AssigneeHealthEntry,
  AssigneeHealthResult,
} from '@flow-analytics/shared';

// State category colours for CFD chart
const CATEGORY_COLORS: Record<string, string> = {
  backlog: '#94a3b8',
  todo: '#60a5fa',
  in_progress: '#f59e0b',
  review: '#a78bfa',
  done: '#34d399',
  cancelled: '#f87171',
};

function buildFilterClauses(
  filters: DashboardFilters,
  tableAlias = 'wi'
): { clauses: string[]; params: unknown[]; offset: number } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let offset = 2; // $1 is always projectId

  if (filters.cycleId) {
    clauses.push(`${tableAlias}.cycle_id = $${offset++}`);
    params.push(filters.cycleId);
  }
  if (filters.assigneeId) {
    clauses.push(`${tableAlias}.assignee_id = $${offset++}`);
    params.push(filters.assigneeId);
  }
  if (filters.priority) {
    clauses.push(`${tableAlias}.priority = $${offset++}`);
    params.push(filters.priority);
  }
  if (filters.dateFrom) {
    clauses.push(`${tableAlias}.completed_at_plane >= $${offset++}`);
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    clauses.push(`${tableAlias}.completed_at_plane <= $${offset++}`);
    params.push(filters.dateTo);
  }

  return { clauses, params, offset };
}

export const metricsService = {
  async getCycleTimeSummary(
    projectId: string,
    filters: DashboardFilters
  ): Promise<CycleTimeSummary> {
    const { clauses, params } = buildFilterClauses(filters);
    const whereExtra = clauses.length ? `AND ${clauses.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT
         wi.id             AS "workItemId",
         wi.sequence_id    AS "sequenceId",
         wi.title,
         wi.cycle_time_hours AS "cycleTimeHours",
         wi.lead_time_hours  AS "leadTimeHours",
         wi.completed_at_plane AS "completedAt",
         wi.assignee_id    AS "assigneeId",
         wi.cycle_id       AS "cycleId",
         wi.priority,
         wi.is_reactivated AS "isReactivated"
       FROM work_items wi
       WHERE wi.plane_project_id = $1
         AND wi.completed_at_plane IS NOT NULL
         ${whereExtra}
       ORDER BY wi.completed_at_plane DESC`,
      [projectId, ...params]
    );

    const items = result.rows;
    const cycleTimes = items
      .filter((r) => r.cycleTimeHours !== null)
      .map((r) => r.cycleTimeHours as number)
      .sort((a, b) => a - b);

    const p50 = percentileFromSorted(cycleTimes, 50);
    const p85 = percentileFromSorted(cycleTimes, 85);
    const avg = cycleTimes.reduce((s, v) => s + v, 0) / (cycleTimes.length || 1);

    return {
      items,
      stats: { p50Hours: p50, p85Hours: p85, avgHours: avg, count: cycleTimes.length },
    };
  },

  async getBottleneckReport(
    projectId: string,
    filters: DashboardFilters
  ): Promise<BottleneckReport> {
    const dateFrom = filters.dateFrom ?? new Date(Date.now() - 90 * 86400_000).toISOString();
    const dateTo = filters.dateTo ?? new Date().toISOString();

    const [result, persistenceResult] = await Promise.all([
      pool.query(
        `SELECT
           ps.id             AS "stateId",
           ps.name           AS "stateName",
           ps.flow_category  AS "flowCategory",
           AVG(tis.duration_hours)::float                                          AS "avgHours",
           PERCENTILE_CONT(0.85) WITHIN GROUP (ORDER BY tis.duration_hours)::float AS "p85Hours",
           COUNT(*)::int                                                            AS "itemCount",
           ps.sequence_order AS "sequenceOrder"
         FROM time_in_state tis
         JOIN plane_states ps ON ps.id = tis.state_id
         JOIN work_items wi   ON wi.id = tis.work_item_id
         WHERE wi.plane_project_id = $1
           AND tis.exited_at IS NOT NULL
           AND tis.entered_at BETWEEN $2 AND $3
           AND ps.flow_category NOT IN ('cancelled')
         GROUP BY ps.id, ps.name, ps.flow_category, ps.sequence_order
         ORDER BY ps.sequence_order`,
        [projectId, dateFrom, dateTo]
      ),
      pool.query(
        `WITH period_analysis AS (
           SELECT
             CASE
               WHEN tis.exited_at >= NOW() - INTERVAL '30 days' THEN 'p1'
               WHEN tis.exited_at >= NOW() - INTERVAL '60 days' THEN 'p2'
               ELSE 'p3'
             END AS period,
             tis.state_id,
             PERCENTILE_CONT(0.85) WITHIN GROUP (ORDER BY tis.duration_hours)::float AS p85
           FROM time_in_state tis
           JOIN plane_states ps ON ps.id = tis.state_id
           JOIN work_items wi ON wi.id = tis.work_item_id
           WHERE wi.plane_project_id = $1
             AND tis.exited_at >= NOW() - INTERVAL '90 days'
             AND tis.duration_hours > 0
             AND ps.flow_category NOT IN ('done', 'cancelled')
           GROUP BY period, tis.state_id
           HAVING COUNT(*) >= 3
         ),
         ranked AS (
           SELECT *, ROW_NUMBER() OVER (PARTITION BY period ORDER BY p85 DESC) AS rn
           FROM period_analysis
         ),
         top_per_period AS (
           SELECT period, state_id FROM ranked WHERE rn = 1
         )
         SELECT state_id::text, COUNT(*)::int AS periods
         FROM top_per_period
         GROUP BY state_id`,
        [projectId]
      ),
    ]);

    const states = result.rows;
    const bottleneck = states.reduce(
      (max: { id: string | null; p85: number }, s) =>
        s.p85Hours > max.p85 ? { id: s.stateId, p85: s.p85Hours } : max,
      { id: null, p85: 0 }
    );

    const persistenceRow = persistenceResult.rows.find(
      (r: { state_id: string; periods: number }) => r.state_id === bottleneck.id
    );
    const persistencePeriods = persistenceRow ? Number(persistenceRow.periods) : 0;

    return { states, bottleneckStateId: bottleneck.id, persistencePeriods };
  },

  async getCfd(
    projectId: string,
    filters: DashboardFilters
  ): Promise<CfdSeries> {
    const dateFrom = filters.dateFrom ?? new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    const dateTo = filters.dateTo ?? new Date().toISOString().slice(0, 10);

    const result = await pool.query(
      `WITH daily AS (
         SELECT generate_series($2::date, $3::date, '1 day'::interval)::date AS day
       ),
       transitions AS (
         SELECT
           tis.state_id,
           tis.entered_at::date                                              AS enter_day,
           COALESCE(tis.exited_at::date, $3::date + 1)                      AS exit_day
         FROM time_in_state tis
         JOIN work_items wi ON wi.id = tis.work_item_id
         WHERE wi.plane_project_id = $1
       )
       SELECT
         d.day::text   AS date,
         ps.name       AS "stateName",
         ps.flow_category AS "flowCategory",
         COUNT(*)::int AS "itemCount"
       FROM daily d
       JOIN transitions t  ON d.day >= t.enter_day AND d.day < t.exit_day
       JOIN plane_states ps ON ps.id = t.state_id
       GROUP BY d.day, ps.id, ps.name, ps.flow_category, ps.sequence_order
       ORDER BY d.day, ps.sequence_order`,
      [projectId, dateFrom, dateTo]
    );

    // Pivot into series format for Recharts
    const dateSet = new Set<string>();
    const stateSet = new Map<string, { flowCategory: string; data: Map<string, number> }>();

    for (const row of result.rows) {
      dateSet.add(row.date);
      if (!stateSet.has(row.stateName)) {
        stateSet.set(row.stateName, { flowCategory: row.flowCategory, data: new Map() });
      }
      stateSet.get(row.stateName)!.data.set(row.date, row.itemCount);
    }

    const dates = [...dateSet].sort();
    const series = [...stateSet.entries()].map(([stateName, info]) => ({
      stateName,
      flowCategory: info.flowCategory as CfdSeries['series'][number]['flowCategory'],
      color: CATEGORY_COLORS[info.flowCategory] ?? '#94a3b8',
      data: dates.map((d) => info.data.get(d) ?? 0),
    }));

    return { dates, series };
  },

  async getThroughput(
    projectId: string,
    filters: DashboardFilters,
    periodDays: number
  ): Promise<ThroughputReport> {
    const dateFrom =
      filters.dateFrom ??
      new Date(Date.now() - periodDays * 86400_000).toISOString();
    const dateTo = filters.dateTo ?? new Date().toISOString();

    const result = await pool.query(
      `SELECT
         wm.id             AS "assigneeId",
         wm.display_name   AS "displayName",
         COUNT(wi.id)::int AS "itemsCompleted",
         AVG(wi.cycle_time_hours)::float                                          AS "avgCycleTimeHours",
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY wi.cycle_time_hours)::float  AS "p50CycleTimeHours",
         PERCENTILE_CONT(0.85) WITHIN GROUP (ORDER BY wi.cycle_time_hours)::float AS "p85CycleTimeHours"
       FROM work_items wi
       JOIN workspace_members wm ON wm.id = wi.assignee_id
       WHERE wi.plane_project_id = $1
         AND wi.completed_at_plane BETWEEN $2 AND $3
         AND wi.cycle_time_hours IS NOT NULL
       GROUP BY wm.id, wm.display_name
       ORDER BY "itemsCompleted" DESC`,
      [projectId, dateFrom, dateTo]
    );

    return { periodDays, assignees: result.rows };
  },

  async getContributors(
    connectionId: string,
    dateFrom: string,
    dateTo: string
  ): Promise<ContributorsResult> {
    // workspace_members and plane_projects both use workspace_connection_id FK
    const summaryResult = await pool.query(
      `SELECT
         wm.id              AS "memberId",
         wm.display_name    AS "displayName",
         COUNT(wi.id)::int  AS "totalIssues",
         COUNT(DISTINCT wi.plane_project_id)::int AS "projectCount",
         PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY wi.cycle_time_hours)::float AS "p50Hours",
         PERCENTILE_CONT(0.85) WITHIN GROUP (ORDER BY wi.cycle_time_hours)::float AS "p85Hours",
         AVG(wi.cycle_time_hours)::float AS "avgHours"
       FROM workspace_members wm
       JOIN work_items wi ON wi.assignee_id = wm.id
       JOIN plane_projects pp ON pp.id = wi.plane_project_id
       WHERE wm.workspace_connection_id = $1
         AND pp.workspace_connection_id = $1
         AND wi.completed_at_plane >= $2
         AND wi.completed_at_plane <= $3
         AND wi.cycle_time_hours IS NOT NULL
       GROUP BY wm.id, wm.display_name
       HAVING COUNT(wi.id) > 0
       ORDER BY wm.display_name`,
      [connectionId, dateFrom, dateTo]
    );

    if (summaryResult.rows.length === 0) {
      return { contributors: [], dateFrom, dateTo };
    }

    const projectResult = await pool.query(
      `SELECT
         wm.id              AS "memberId",
         pp.id::text        AS "projectId",
         pp.name            AS "projectName",
         COUNT(wi.id)::int  AS "issues",
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY wi.cycle_time_hours)::float AS "p50Hours"
       FROM workspace_members wm
       JOIN work_items wi ON wi.assignee_id = wm.id
       JOIN plane_projects pp ON pp.id = wi.plane_project_id
       WHERE wm.workspace_connection_id = $1
         AND pp.workspace_connection_id = $1
         AND wi.completed_at_plane >= $2
         AND wi.completed_at_plane <= $3
         AND wi.cycle_time_hours IS NOT NULL
       GROUP BY wm.id, pp.id, pp.name
       ORDER BY wm.id, issues DESC`,
      [connectionId, dateFrom, dateTo]
    );

    const projectsByMember = new Map<string, ContributorProjectBreakdown[]>();
    for (const row of projectResult.rows) {
      const existing = projectsByMember.get(row.memberId) ?? [];
      existing.push({
        projectId:   row.projectId,
        projectName: row.projectName,
        issues:      row.issues,
        p50Hours:    row.p50Hours !== null && row.p50Hours !== undefined ? Number(row.p50Hours) : null,
      });
      projectsByMember.set(row.memberId, existing);
    }

    const contributors: ContributorProfile[] = summaryResult.rows.map((r) => ({
      memberId:     r.memberId,
      displayName:  r.displayName,
      totalIssues:  r.totalIssues,
      projectCount: r.projectCount,
      p50Hours:     r.p50Hours !== null && r.p50Hours !== undefined ? Number(r.p50Hours) : null,
      p85Hours:     r.p85Hours !== null && r.p85Hours !== undefined ? Number(r.p85Hours) : null,
      avgHours:     r.avgHours !== null && r.avgHours !== undefined ? Number(r.avgHours) : null,
      projects:     projectsByMember.get(r.memberId) ?? [],
    }));

    return { contributors, dateFrom, dateTo };
  },

  async getSprintComparison(
    projectId: string,
    limit: number
  ): Promise<SprintComparisonResult> {
    const result = await pool.query(
      `SELECT
         pc.id::text                                                              AS "cycleId",
         pc.name                                                                  AS "cycleName",
         pc.start_date::text                                                      AS "startDate",
         pc.end_date::text                                                        AS "endDate",
         (pc.end_date - pc.start_date + 1)::int                                  AS "durationDays",
         pc.status,
         COUNT(wi.id)::int                                                        AS "itemsCompleted",
         PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY wi.cycle_time_hours)::float AS "p50Hours",
         PERCENTILE_CONT(0.85) WITHIN GROUP (ORDER BY wi.cycle_time_hours)::float AS "p85Hours",
         AVG(wi.cycle_time_hours)::float                                          AS "avgHours"
       FROM plane_cycles pc
       LEFT JOIN work_items wi
         ON wi.plane_project_id = pc.plane_project_id
        AND wi.completed_at_plane::date BETWEEN pc.start_date AND pc.end_date
        AND wi.cycle_time_hours IS NOT NULL
       WHERE pc.plane_project_id = $1
         AND pc.start_date IS NOT NULL
       GROUP BY pc.id, pc.name, pc.start_date, pc.end_date, pc.status
       ORDER BY pc.start_date DESC
       LIMIT $2`,
      [projectId, limit]
    );

    const sprints: SprintMetrics[] = result.rows.map((r) => ({
      cycleId:        r.cycleId,
      cycleName:      r.cycleName,
      startDate:      r.startDate,
      endDate:        r.endDate,
      durationDays:   r.durationDays ?? 0,
      status:         r.status ?? '',
      itemsCompleted: r.itemsCompleted ?? 0,
      p50Hours:       r.p50Hours !== null && r.p50Hours !== undefined ? Number(r.p50Hours) : null,
      p85Hours:       r.p85Hours !== null && r.p85Hours !== undefined ? Number(r.p85Hours) : null,
      avgHours:       r.avgHours !== null && r.avgHours !== undefined ? Number(r.avgHours) : null,
    }));

    // Return oldest-first so charts render chronologically
    return { sprints: sprints.reverse() };
  },

  async getForecast(
    projectId: string,
    backlogSize: number,
    historyWeeks: number
  ): Promise<ForecastResult> {
    // Fetch weekly throughput with 0-fill for weeks with no completions
    const result = await pool.query(
      `WITH week_series AS (
         SELECT generate_series(
           DATE_TRUNC('week', NOW() - (INTERVAL '1 week' * $2::int)),
           DATE_TRUNC('week', NOW()),
           '1 week'::interval
         )::date AS week_start
       ),
       weekly_completions AS (
         SELECT
           DATE_TRUNC('week', completed_at_plane)::date AS week_start,
           COUNT(*)::int                                AS items_completed
         FROM work_items
         WHERE plane_project_id = $1
           AND completed_at_plane IS NOT NULL
           AND completed_at_plane >= DATE_TRUNC('week', NOW() - (INTERVAL '1 week' * $2::int))
         GROUP BY DATE_TRUNC('week', completed_at_plane)::date
       )
       SELECT
         ws.week_start::text                      AS week,
         COALESCE(wc.items_completed, 0)::int     AS items_completed
       FROM week_series ws
       LEFT JOIN weekly_completions wc ON wc.week_start = ws.week_start
       ORDER BY ws.week_start`,
      [projectId, historyWeeks]
    );

    const weeklyThroughputs: number[] = result.rows.map((r) => Number(r.items_completed));
    const sum = weeklyThroughputs.reduce((s, v) => s + v, 0);
    const avg = Math.round((sum / (weeklyThroughputs.length || 1)) * 10) / 10;
    const nonZeroWeeks = weeklyThroughputs.filter((v) => v > 0).length;

    if (nonZeroWeeks < 2) {
      return {
        backlogSize,
        historicalWeeks: historyWeeks,
        weeklyThroughputs,
        avgWeeklyThroughput: avg,
        simulations: 0,
        p50Weeks: 0,
        p85Weeks: 0,
        p95Weeks: 0,
        p50Date: '',
        p85Date: '',
        p95Date: '',
        histogram: [],
        insufficient: true,
      };
    }

    // Monte Carlo: 10,000 simulations sampling random historical weeks
    const SIMULATIONS = 10_000;
    const MAX_WEEKS   = 104;
    const n           = weeklyThroughputs.length;
    const weekCounts: number[] = new Array(MAX_WEEKS + 1).fill(0);

    for (let s = 0; s < SIMULATIONS; s++) {
      let remaining = backlogSize;
      let weeks     = 0;
      while (remaining > 0 && weeks < MAX_WEEKS) {
        const idx = Math.floor(Math.random() * n);
        remaining -= weeklyThroughputs[idx]!;
        weeks++;
      }
      weekCounts[Math.min(weeks, MAX_WEEKS)]!++;
    }

    // Build cumulative histogram; stop at P99
    const histogram: ForecastHistogramPoint[] = [];
    let cumCount = 0;
    let p50Weeks = 1, p85Weeks = 1, p95Weeks = 1;
    let p50Found = false, p85Found = false, p95Found = false;

    for (let w = 1; w <= MAX_WEEKS; w++) {
      const cnt    = weekCounts[w] ?? 0;
      cumCount    += cnt;
      const pct    = (cnt    / SIMULATIONS) * 100;
      const cumPct = (cumCount / SIMULATIONS) * 100;

      if (cumPct > 0 || w <= 2) {
        histogram.push({ week: w, count: cnt, pct, cumPct });
      }
      if (!p50Found && cumPct >= 50) { p50Weeks = w; p50Found = true; }
      if (!p85Found && cumPct >= 85) { p85Weeks = w; p85Found = true; }
      if (!p95Found && cumPct >= 95) { p95Weeks = w; p95Found = true; }
      if (cumPct >= 99) break;
    }

    function addWeeksToNow(weeks: number): string {
      const d = new Date();
      d.setDate(d.getDate() + weeks * 7);
      return d.toISOString().slice(0, 10);
    }

    return {
      backlogSize,
      historicalWeeks: historyWeeks,
      weeklyThroughputs,
      avgWeeklyThroughput: avg,
      simulations: SIMULATIONS,
      p50Weeks,
      p85Weeks,
      p95Weeks,
      p50Date: addWeeksToNow(p50Weeks),
      p85Date: addWeeksToNow(p85Weeks),
      p95Date: addWeeksToNow(p95Weeks),
      histogram,
      insufficient: false,
    };
  },

  async getFlowEfficiency(
    projectId: string,
    filters: DashboardFilters
  ): Promise<FlowEfficiencyReport> {
    const { clauses, params } = buildFilterClauses(filters);
    const whereExtra = clauses.length ? `AND ${clauses.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT
         wi.id::text                  AS "workItemId",
         wi.sequence_id               AS "sequenceId",
         wi.title,
         wi.lead_time_hours           AS "leadTimeHours",
         wi.completed_at_plane        AS "completedAt",
         COALESCE(SUM(tis.duration_hours) FILTER (
           WHERE ps.flow_category IN ('in_progress', 'review')
             AND tis.exited_at IS NOT NULL
         ), 0)::float                 AS "activeHours",
         COALESCE(SUM(tis.duration_hours) FILTER (
           WHERE ps.flow_category IN ('backlog', 'todo')
             AND tis.exited_at IS NOT NULL
         ), 0)::float                 AS "waitingHours"
       FROM work_items wi
       JOIN time_in_state tis ON tis.work_item_id = wi.id
       JOIN plane_states ps   ON ps.id = tis.state_id
       WHERE wi.plane_project_id = $1
         AND wi.completed_at_plane IS NOT NULL
         AND wi.lead_time_hours IS NOT NULL
         AND wi.lead_time_hours > 0
         ${whereExtra}
       GROUP BY wi.id, wi.sequence_id, wi.title, wi.lead_time_hours, wi.completed_at_plane
       ORDER BY wi.completed_at_plane DESC`,
      [projectId, ...params]
    );

    const items: FlowEfficiencyItem[] = result.rows.map((r) => {
      const active  = Number(r.activeHours);
      const waiting = Number(r.waitingHours);
      const lead    = Number(r.leadTimeHours);
      return {
        workItemId:    r.workItemId,
        sequenceId:    Number(r.sequenceId),
        title:         r.title,
        leadTimeHours: lead,
        activeHours:   active,
        waitingHours:  waiting,
        efficiencyPct: Math.min(lead > 0 ? (active / lead) * 100 : 0, 100),
        completedAt:   r.completedAt ? String(r.completedAt) : null,
      };
    });

    const efficiencies = items.map((i) => i.efficiencyPct).sort((a, b) => a - b);
    const median = efficiencies.length > 0
      ? (efficiencies[Math.floor(efficiencies.length / 2)] ?? 0)
      : 0;
    const avg = efficiencies.length > 0
      ? efficiencies.reduce((s, v) => s + v, 0) / efficiencies.length
      : 0;

    return {
      items,
      medianEfficiencyPct:  Math.round(median * 10) / 10,
      avgEfficiencyPct:     Math.round(avg * 10) / 10,
      industryBenchmarkPct: 15,
      totalActiveHours:     items.reduce((s, i) => s + i.activeHours, 0),
      totalWaitingHours:    items.reduce((s, i) => s + i.waitingHours, 0),
    };
  },

  async getScopeCreep(
    projectId: string,
    limit: number
  ): Promise<ScopeCreepResult> {
    const result = await pool.query(
      `SELECT
         pc.id::text                    AS "cycleId",
         pc.name                        AS "cycleName",
         pc.start_date::text            AS "startDate",
         pc.end_date::text              AS "endDate",
         pc.status,
         COUNT(wi.id)::int              AS "totalItems",
         COUNT(wi.id) FILTER (
           WHERE wi.created_at_plane < pc.start_date::timestamptz
         )::int                         AS "committedItems",
         COUNT(wi.id) FILTER (
           WHERE wi.created_at_plane >= pc.start_date::timestamptz
         )::int                         AS "addedDuringItems",
         COALESCE(
           ROUND(
             COUNT(wi.id) FILTER (
               WHERE wi.created_at_plane >= pc.start_date::timestamptz
             )::numeric / NULLIF(COUNT(wi.id), 0) * 100,
             1
           )::float,
           0
         )                              AS "scopeCreepPct",
         COUNT(wi.id) FILTER (
           WHERE wi.completed_at_plane IS NOT NULL
         )::int                         AS "completedItems"
       FROM plane_cycles pc
       LEFT JOIN work_items wi
         ON wi.plane_project_id = pc.plane_project_id
        AND wi.completed_at_plane::date BETWEEN pc.start_date AND pc.end_date
       WHERE pc.plane_project_id = $1
         AND pc.start_date IS NOT NULL
       GROUP BY pc.id, pc.name, pc.start_date, pc.end_date, pc.status
       ORDER BY pc.start_date DESC
       LIMIT $2`,
      [projectId, limit]
    );

    const sprints: ScopeSprint[] = result.rows.map((r) => ({
      cycleId:          r.cycleId,
      cycleName:        r.cycleName,
      startDate:        r.startDate,
      endDate:          r.endDate,
      status:           r.status ?? '',
      totalItems:       Number(r.totalItems) || 0,
      committedItems:   Number(r.committedItems) || 0,
      addedDuringItems: Number(r.addedDuringItems) || 0,
      scopeCreepPct:    Number(r.scopeCreepPct) || 0,
      completedItems:   Number(r.completedItems) || 0,
    })).reverse(); // oldest-first for charts

    const withItems = sprints.filter((s) => s.totalItems > 0);
    const avgScopeCreepPct = withItems.length
      ? Math.round(withItems.reduce((s, v) => s + v.scopeCreepPct, 0) / withItems.length * 10) / 10
      : 0;
    const highCreepCount = withItems.filter((s) => s.scopeCreepPct > 30).length;

    return { sprints, avgScopeCreepPct, highCreepCount };
  },

  async getFlowHealthScore(projectId: string): Promise<FlowHealthScore> {
    const result = await pool.query(
      `WITH ct_recent AS (
         SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cycle_time_hours)::float AS p50
         FROM work_items
         WHERE plane_project_id = $1
           AND completed_at_plane >= NOW() - INTERVAL '30 days'
           AND cycle_time_hours IS NOT NULL
       ),
       ct_prior AS (
         SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cycle_time_hours)::float AS p50
         FROM work_items
         WHERE plane_project_id = $1
           AND completed_at_plane BETWEEN NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '30 days'
           AND cycle_time_hours IS NOT NULL
       ),
       current_wip AS (
         SELECT COUNT(DISTINCT tis.work_item_id)::int AS wip
         FROM time_in_state tis
         JOIN work_items wi ON wi.id = tis.work_item_id
         JOIN plane_states ps ON ps.id = tis.state_id
         WHERE wi.plane_project_id = $1
           AND tis.exited_at IS NULL
           AND ps.flow_category IN ('in_progress', 'review')
       ),
       weekly_recent AS (
         SELECT COUNT(*)::float / 4.0 AS avg_per_week
         FROM work_items
         WHERE plane_project_id = $1
           AND completed_at_plane >= NOW() - INTERVAL '4 weeks'
           AND completed_at_plane IS NOT NULL
       ),
       weekly_prior AS (
         SELECT COUNT(*)::float / 4.0 AS avg_per_week
         FROM work_items
         WHERE plane_project_id = $1
           AND completed_at_plane BETWEEN NOW() - INTERVAL '8 weeks' AND NOW() - INTERVAL '4 weeks'
           AND completed_at_plane IS NOT NULL
       ),
       reactivation AS (
         SELECT
           COUNT(*)::float                                         AS total,
           COUNT(*) FILTER (WHERE is_reactivated = true)::float   AS reactivated
         FROM work_items
         WHERE plane_project_id = $1
           AND completed_at_plane >= NOW() - INTERVAL '30 days'
       )
       SELECT
         ctr.p50          AS ct_recent_p50,
         ctp.p50          AS ct_prior_p50,
         cw.wip           AS current_wip,
         wr.avg_per_week  AS throughput_recent,
         wp.avg_per_week  AS throughput_prior,
         re.total         AS total_completed,
         re.reactivated   AS reactivated_count
       FROM ct_recent ctr, ct_prior ctp, current_wip cw,
            weekly_recent wr, weekly_prior wp, reactivation re`,
      [projectId]
    );

    const row = result.rows[0];
    const totalCompleted = row ? Number(row.total_completed) : 0;
    if (!row || totalCompleted === 0) {
      return { overall: 0, grade: 'F', signals: [], insufficient: true };
    }

    function clamp(v: number): number { return Math.max(0, Math.min(100, v)); }
    function fmtH(hours: number): string {
      if (hours < 1)  return `${Math.round(hours * 60)}m`;
      if (hours < 24) return `${Math.round(hours)}h`;
      return `${(hours / 24).toFixed(1)}d`;
    }

    // 1. Cycle time trend (lower = better, 30% weight)
    const ctRecent = row.ct_recent_p50 != null ? Number(row.ct_recent_p50) : null;
    const ctPrior  = row.ct_prior_p50  != null ? Number(row.ct_prior_p50)  : null;
    let ctScore = 50;
    let ctContext = 'No prior period data';
    if (ctRecent !== null && ctPrior !== null && ctPrior > 0) {
      const improvement = (ctPrior - ctRecent) / ctPrior;
      ctScore = clamp(((improvement + 0.2) / 0.4) * 100);
      const pct = Math.abs(improvement * 100).toFixed(0);
      ctContext = improvement >= 0
        ? `${pct}% faster than prior 30d`
        : `${pct}% slower than prior 30d`;
    }

    // 2. WIP / throughput ratio (lower = better, 25% weight)
    const wip              = Number(row.current_wip) || 0;
    const throughputRecent = Number(row.throughput_recent) || 0;
    const wipRatio         = throughputRecent > 0 ? wip / throughputRecent : (wip > 0 ? 5 : 1);
    const wipScore         = clamp(((5 - wipRatio) / 4) * 100);
    const wipContext       = `${wip} in-progress, ${throughputRecent.toFixed(1)}/wk throughput`;

    // 3. Reactivation rate (lower = better, 20% weight)
    const reactivated       = Number(row.reactivated_count) || 0;
    const reactivationRate  = totalCompleted > 0 ? reactivated / totalCompleted : 0;
    const reactivationScore = clamp(((0.25 - reactivationRate) / 0.25) * 100);
    const reactivationPct   = (reactivationRate * 100).toFixed(0);
    const reactivationCtx   = reactivated === 0
      ? 'No reactivated issues'
      : `${reactivated} of ${totalCompleted} completed issues`;

    // 4. Throughput trend (higher = better, 25% weight)
    const tpPrior = Number(row.throughput_prior) || 0;
    let tpScore   = 50;
    let tpContext = 'No prior period data';
    if (tpPrior > 0) {
      const tpImprovement = (throughputRecent - tpPrior) / tpPrior;
      tpScore   = clamp(((tpImprovement + 0.2) / 0.4) * 100);
      const pct = Math.abs(tpImprovement * 100).toFixed(0);
      tpContext = tpImprovement >= 0
        ? `${pct}% more than prior 4wk`
        : `${pct}% less than prior 4wk`;
    }

    const overall = Math.round(
      ctScore * 0.30 + wipScore * 0.25 + reactivationScore * 0.20 + tpScore * 0.25
    );
    const grade: FlowGrade = overall >= 85 ? 'A' : overall >= 70 ? 'B' : overall >= 55 ? 'C' : overall >= 40 ? 'D' : 'F';

    const signals: FlowHealthSignal[] = [
      { key: 'cycle_time',   label: 'Cycle time trend',   score: Math.round(ctScore),          value: ctRecent !== null ? fmtH(ctRecent) : '—', context: ctContext,        goodDir: 'down' },
      { key: 'wip_ratio',    label: 'WIP balance',         score: Math.round(wipScore),         value: `${wipRatio.toFixed(1)}x`,                 context: wipContext,       goodDir: 'down' },
      { key: 'reactivation', label: 'Reactivation rate',   score: Math.round(reactivationScore),value: `${reactivationPct}%`,                     context: reactivationCtx,  goodDir: 'down' },
      { key: 'throughput',   label: 'Throughput trend',    score: Math.round(tpScore),          value: `${throughputRecent.toFixed(1)}/wk`,        context: tpContext,        goodDir: 'up'   },
    ];

    return { overall, grade, signals, insufficient: false };
  },

  async getAtRiskIssues(projectId: string): Promise<AtRiskResult> {
    const result = await pool.query(
      `WITH current_in_progress AS (
         SELECT
           tis.work_item_id,
           tis.state_id,
           EXTRACT(EPOCH FROM (NOW() - tis.entered_at)) / 3600 AS hours_in_state
         FROM time_in_state tis
         JOIN work_items wi  ON wi.id  = tis.work_item_id
         JOIN plane_states ps ON ps.id = tis.state_id
         WHERE wi.plane_project_id = $1
           AND tis.exited_at IS NULL
           AND ps.flow_category IN ('in_progress', 'review')
       ),
       state_p85s AS (
         SELECT
           tis.state_id,
           PERCENTILE_CONT(0.85) WITHIN GROUP (ORDER BY tis.duration_hours)::float AS p85_hours
         FROM time_in_state tis
         JOIN work_items wi ON wi.id = tis.work_item_id
         WHERE wi.plane_project_id = $1
           AND tis.exited_at IS NOT NULL
           AND tis.duration_hours IS NOT NULL
           AND tis.duration_hours > 0
         GROUP BY tis.state_id
         HAVING COUNT(*) >= 3
       ),
       project_p85 AS (
         SELECT PERCENTILE_CONT(0.85) WITHIN GROUP (ORDER BY cycle_time_hours)::float AS p85_hours
         FROM work_items
         WHERE plane_project_id = $1
           AND cycle_time_hours IS NOT NULL
       )
       SELECT
         wi.id::text                                               AS "workItemId",
         wi.sequence_id                                            AS "sequenceId",
         wi.title,
         ps.name                                                   AS "currentState",
         ps.flow_category                                          AS "flowCategory",
         cip.hours_in_state                                        AS "hoursInCurrentState",
         sp.p85_hours                                              AS "p85ForState",
         (cip.hours_in_state - sp.p85_hours)                       AS "overageHours",
         ((cip.hours_in_state / sp.p85_hours) - 1.0) * 100        AS "overagePct",
         wm.display_name                                           AS "assigneeName",
         pp85.p85_hours                                            AS "projectP85"
       FROM current_in_progress cip
       JOIN work_items wi    ON wi.id  = cip.work_item_id
       JOIN plane_states ps  ON ps.id  = cip.state_id
       LEFT JOIN workspace_members wm ON wm.id = wi.assignee_id
       JOIN state_p85s sp    ON sp.state_id = cip.state_id
       CROSS JOIN project_p85 pp85
       WHERE cip.hours_in_state > sp.p85_hours
       ORDER BY "overagePct" DESC`,
      [projectId]
    );

    const projectP85Row = result.rows[0];
    const projectP85 = projectP85Row?.projectP85 != null ? Number(projectP85Row.projectP85) : null;

    const issues: AtRiskIssue[] = result.rows.map((r) => ({
      workItemId:          r.workItemId,
      sequenceId:          Number(r.sequenceId),
      title:               r.title,
      currentState:        r.currentState,
      flowCategory:        r.flowCategory,
      hoursInCurrentState: Number(r.hoursInCurrentState),
      p85ForState:         Number(r.p85ForState),
      overageHours:        Number(r.overageHours),
      overagePct:          Number(r.overagePct),
      assigneeName:        r.assigneeName ?? null,
      projectP85:          r.projectP85 != null ? Number(r.projectP85) : null,
    }));

    return { issues, projectP85 };
  },

  async getLeadTimeSummary(
    projectId: string,
    filters: DashboardFilters
  ): Promise<LeadTimeSummary> {
    const { clauses, params } = buildFilterClauses(filters);
    const whereExtra = clauses.length ? `AND ${clauses.join(' AND ')}` : '';

    const [itemsResult, statsResult, priorResult] = await Promise.all([
      pool.query(
        `SELECT
           wi.id::text           AS "workItemId",
           wi.sequence_id        AS "sequenceId",
           wi.title,
           wi.cycle_time_hours   AS "cycleTimeHours",
           wi.lead_time_hours    AS "leadTimeHours",
           wi.completed_at_plane AS "completedAt",
           wi.priority,
           wi.assignee_id::text  AS "assigneeId",
           wi.cycle_id::text     AS "cycleId",
           wi.is_reactivated     AS "isReactivated"
         FROM work_items wi
         WHERE wi.plane_project_id = $1
           AND wi.completed_at_plane IS NOT NULL
           AND wi.lead_time_hours IS NOT NULL
           AND wi.lead_time_hours > 0
           ${whereExtra}
         ORDER BY wi.completed_at_plane DESC`,
        [projectId, ...params]
      ),
      pool.query(
        `SELECT
           COALESCE(PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY wi.lead_time_hours)::float, 0) AS "p50Hours",
           COALESCE(PERCENTILE_CONT(0.85) WITHIN GROUP (ORDER BY wi.lead_time_hours)::float, 0) AS "p85Hours",
           COALESCE(AVG(wi.lead_time_hours)::float, 0)                                          AS "avgHours",
           COUNT(*)::int                                                                          AS count
         FROM work_items wi
         WHERE wi.plane_project_id = $1
           AND wi.completed_at_plane IS NOT NULL
           AND wi.lead_time_hours IS NOT NULL
           AND wi.lead_time_hours > 0
           ${whereExtra}`,
        [projectId, ...params]
      ),
      pool.query(
        `SELECT
           COALESCE(PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY lead_time_hours)::float, 0) AS "p50Hours",
           COALESCE(PERCENTILE_CONT(0.85) WITHIN GROUP (ORDER BY lead_time_hours)::float, 0) AS "p85Hours",
           COALESCE(AVG(lead_time_hours)::float, 0)                                          AS "avgHours",
           COUNT(*)::int                                                                       AS count
         FROM work_items
         WHERE plane_project_id = $1
           AND completed_at_plane IS NOT NULL
           AND lead_time_hours IS NOT NULL
           AND lead_time_hours > 0
           AND completed_at_plane >= NOW() - INTERVAL '60 days'
           AND completed_at_plane <  NOW() - INTERVAL '30 days'`,
        [projectId]
      ),
    ]);

    const items = itemsResult.rows.map((r) => ({
      workItemId:     r.workItemId,
      sequenceId:     Number(r.sequenceId),
      title:          r.title,
      cycleTimeHours: r.cycleTimeHours !== null ? Number(r.cycleTimeHours) : null,
      leadTimeHours:  r.leadTimeHours  !== null ? Number(r.leadTimeHours)  : null,
      completedAt:    r.completedAt ? String(r.completedAt) : null,
      priority:       r.priority ?? 'none',
      assigneeId:     r.assigneeId ?? null,
      cycleId:        r.cycleId ?? null,
      isReactivated:  Boolean(r.isReactivated),
    }));

    const sr = statsResult.rows[0];
    const stats = sr
      ? { p50Hours: Number(sr.p50Hours), p85Hours: Number(sr.p85Hours), avgHours: Number(sr.avgHours), count: Number(sr.count) }
      : { p50Hours: 0, p85Hours: 0, avgHours: 0, count: 0 };

    const pr = priorResult.rows[0];
    const prior = pr && Number(pr.count) > 0
      ? { p50Hours: Number(pr.p50Hours), p85Hours: Number(pr.p85Hours), avgHours: Number(pr.avgHours), count: Number(pr.count) }
      : null;

    return { items, stats, prior };
  },

  async getProjectSummary(projectId: string): Promise<ProjectSummary> {
    function fmtH(hours: number): string {
      if (hours < 1)  return `${Math.round(hours * 60)}m`;
      if (hours < 24) return `${Math.round(hours)}h`;
      return `${(hours / 24).toFixed(1)}d`;
    }

    const [atRiskRes, ctRes, bottleneckRes] = await Promise.all([
      pool.query(
        `WITH state_p85s AS (
           SELECT tis.state_id,
             PERCENTILE_CONT(0.85) WITHIN GROUP (ORDER BY tis.duration_hours)::float AS p85
           FROM time_in_state tis
           JOIN work_items wi ON wi.id = tis.work_item_id
           WHERE wi.plane_project_id = $1
             AND tis.exited_at IS NOT NULL AND tis.duration_hours > 0
           GROUP BY tis.state_id HAVING COUNT(*) >= 3
         )
         SELECT
           COUNT(*)::int AS count,
           COUNT(*) FILTER (
             WHERE (EXTRACT(EPOCH FROM (NOW() - tis.entered_at)) / 3600) > sp.p85 * 2
           )::int AS critical
         FROM time_in_state tis
         JOIN work_items wi ON wi.id = tis.work_item_id
         JOIN plane_states ps ON ps.id = tis.state_id
         JOIN state_p85s sp ON sp.state_id = tis.state_id
         WHERE wi.plane_project_id = $1
           AND tis.exited_at IS NULL
           AND ps.flow_category IN ('in_progress', 'review')
           AND (EXTRACT(EPOCH FROM (NOW() - tis.entered_at)) / 3600) > sp.p85`,
        [projectId]
      ),
      pool.query(
        `SELECT
           PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cycle_time_hours) FILTER (
             WHERE completed_at_plane >= NOW() - INTERVAL '30 days'
           )::float AS current_p50,
           PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cycle_time_hours) FILTER (
             WHERE completed_at_plane BETWEEN NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '30 days'
           )::float AS prior_p50
         FROM work_items
         WHERE plane_project_id = $1
           AND completed_at_plane >= NOW() - INTERVAL '60 days'
           AND cycle_time_hours IS NOT NULL`,
        [projectId]
      ),
      pool.query(
        `WITH period_analysis AS (
           SELECT
             CASE
               WHEN tis.exited_at >= NOW() - INTERVAL '30 days' THEN 'p1'
               WHEN tis.exited_at >= NOW() - INTERVAL '60 days' THEN 'p2'
               ELSE 'p3'
             END AS period,
             tis.state_id,
             ps.name AS state_name,
             ps.flow_category,
             PERCENTILE_CONT(0.85) WITHIN GROUP (ORDER BY tis.duration_hours)::float AS p85,
             AVG(tis.duration_hours)::float AS avg_hours
           FROM time_in_state tis
           JOIN plane_states ps ON ps.id = tis.state_id
           JOIN work_items wi ON wi.id = tis.work_item_id
           WHERE wi.plane_project_id = $1
             AND tis.exited_at >= NOW() - INTERVAL '90 days'
             AND tis.duration_hours > 0
             AND ps.flow_category NOT IN ('done', 'cancelled')
           GROUP BY period, tis.state_id, ps.name, ps.flow_category
           HAVING COUNT(*) >= 3
         ),
         ranked AS (
           SELECT *, ROW_NUMBER() OVER (PARTITION BY period ORDER BY p85 DESC) AS rn
           FROM period_analysis
         ),
         top_per_period AS (
           SELECT period, state_id, state_name, flow_category, avg_hours FROM ranked WHERE rn = 1
         )
         SELECT
           curr.state_id::text AS "stateId",
           curr.state_name AS "stateName",
           curr.flow_category AS "flowCategory",
           curr.avg_hours AS "avgHours",
           (SELECT COUNT(*) FROM top_per_period all_p WHERE all_p.state_id = curr.state_id)::int AS "persistencePeriods"
         FROM top_per_period curr
         WHERE curr.period = 'p1'`,
        [projectId]
      ),
    ]);

    const signals: SummarySignal[] = [];

    const atRiskCount    = Number(atRiskRes.rows[0]?.count    ?? 0);
    const atRiskCritical = Number(atRiskRes.rows[0]?.critical ?? 0);
    if (atRiskCount > 0) {
      signals.push({
        key:      'at_risk',
        severity: (atRiskCritical > 0 ? 'critical' : 'warning') satisfies SummarySignalSeverity,
        title:    atRiskCritical > 0
          ? `${atRiskCritical} critical, ${atRiskCount - atRiskCritical} warning`
          : `${atRiskCount} issues overdue`,
        metric:   `${atRiskCount} at risk`,
        detail:   atRiskCritical > 0 ? `${atRiskCritical} exceed 2× state P85` : 'All in warning range',
        tabKey:   'at-risk',
      });
    }

    const ctCurrent = ctRes.rows[0]?.current_p50 != null ? Number(ctRes.rows[0].current_p50) : null;
    const ctPrior   = ctRes.rows[0]?.prior_p50   != null ? Number(ctRes.rows[0].prior_p50)   : null;
    if (ctCurrent !== null && ctPrior !== null && ctPrior > 0) {
      const pct = Math.round(((ctCurrent - ctPrior) / ctPrior) * 100);
      if (Math.abs(pct) >= 5) {
        const improved = pct < 0;
        signals.push({
          key:      'cycle_time',
          severity: (improved ? 'good' : 'warning') satisfies SummarySignalSeverity,
          title:    improved ? 'Cycle time improving' : 'Cycle time slowing',
          metric:   improved ? `${Math.abs(pct)}% faster` : `${pct}% slower`,
          detail:   `P50 ${fmtH(ctCurrent)} vs ${fmtH(ctPrior)} prior 30d`,
          tabKey:   'cycle-time',
        });
      }
    }

    const bn = bottleneckRes.rows[0] as { stateId: string; stateName: string; flowCategory: string; avgHours: number; persistencePeriods: number } | undefined;
    if (bn) {
      const periods = Number(bn.persistencePeriods);
      signals.push({
        key:      'bottleneck',
        severity: (periods >= 2 ? 'warning' : 'info') satisfies SummarySignalSeverity,
        title:    `${String(bn.stateName)} bottleneck`,
        metric:   fmtH(Number(bn.avgHours)),
        detail:   periods >= 2 ? `Persisted ${periods} consecutive 30d windows` : 'Avg wait in this stage',
        tabKey:   'bottleneck',
      });
    }

    const severityOrder: Record<SummarySignalSeverity, number> = { critical: 0, warning: 1, good: 2, info: 3 };
    signals.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return { signals: signals.slice(0, 4) };
  },

  async getAssigneeHealth(projectId: string): Promise<AssigneeHealthResult> {
    const result = await pool.query(
      `WITH
       current_wip AS (
         SELECT wi.assignee_id, COUNT(*)::int AS wip
         FROM time_in_state tis
         JOIN work_items wi ON wi.id = tis.work_item_id
         JOIN plane_states ps ON ps.id = tis.state_id
         WHERE wi.plane_project_id = $1
           AND tis.exited_at IS NULL
           AND ps.flow_category IN ('in_progress', 'review')
           AND wi.assignee_id IS NOT NULL
         GROUP BY wi.assignee_id
       ),
       reactivation_stats AS (
         SELECT assignee_id,
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE is_reactivated = true)::int AS reactivated
         FROM work_items
         WHERE plane_project_id = $1
           AND completed_at_plane >= NOW() - INTERVAL '60 days'
           AND assignee_id IS NOT NULL
         GROUP BY assignee_id
       ),
       assignee_p85s AS (
         SELECT assignee_id,
           PERCENTILE_CONT(0.85) WITHIN GROUP (ORDER BY cycle_time_hours)::float AS p85
         FROM work_items
         WHERE plane_project_id = $1
           AND completed_at_plane >= NOW() - INTERVAL '90 days'
           AND cycle_time_hours IS NOT NULL
           AND assignee_id IS NOT NULL
         GROUP BY assignee_id
         HAVING COUNT(*) >= 3
       ),
       team_p85 AS (
         SELECT PERCENTILE_CONT(0.85) WITHIN GROUP (ORDER BY cycle_time_hours)::float AS p85
         FROM work_items
         WHERE plane_project_id = $1
           AND completed_at_plane >= NOW() - INTERVAL '90 days'
           AND cycle_time_hours IS NOT NULL
       ),
       total_active_wip AS (
         SELECT
           COUNT(*)::int AS total_wip,
           COUNT(DISTINCT wi.assignee_id)::int AS active_members
         FROM time_in_state tis
         JOIN work_items wi ON wi.id = tis.work_item_id
         JOIN plane_states ps ON ps.id = tis.state_id
         WHERE wi.plane_project_id = $1
           AND tis.exited_at IS NULL
           AND ps.flow_category IN ('in_progress', 'review')
           AND wi.assignee_id IS NOT NULL
       )
       SELECT
         wm.id::text AS "assigneeId",
         wm.display_name AS "displayName",
         COALESCE(cw.wip, 0)::int AS "currentWip",
         COALESCE(rs.total, 0)::int AS "totalCompleted",
         COALESCE(rs.reactivated, 0)::int AS "reactivatedCount",
         ap.p85 AS "p85Hours",
         tp.p85 AS "teamP85",
         CASE WHEN taw.active_members > 0
           THEN taw.total_wip::float / taw.active_members
           ELSE 0
         END AS "teamAvgWip"
       FROM workspace_members wm
       JOIN (
         SELECT DISTINCT assignee_id
         FROM work_items
         WHERE plane_project_id = $1 AND assignee_id IS NOT NULL
       ) active_assignees ON active_assignees.assignee_id = wm.id
       LEFT JOIN current_wip cw ON cw.assignee_id = wm.id
       LEFT JOIN reactivation_stats rs ON rs.assignee_id = wm.id
       LEFT JOIN assignee_p85s ap ON ap.assignee_id = wm.id
       CROSS JOIN team_p85 tp
       CROSS JOIN total_active_wip taw
       WHERE COALESCE(cw.wip, 0) > 0 OR COALESCE(rs.total, 0) > 0
       ORDER BY COALESCE(cw.wip, 0) DESC, COALESCE(rs.total, 0) DESC`,
      [projectId]
    );

    const teamP85    = result.rows[0]?.teamP85   != null ? Number(result.rows[0].teamP85)    : null;
    const teamAvgWip = result.rows[0]             != null ? Number(result.rows[0].teamAvgWip) : 0;

    const entries: AssigneeHealthEntry[] = result.rows.map((r) => {
      const currentWip       = Number(r.currentWip);
      const totalCompleted   = Number(r.totalCompleted);
      const reactivatedCount = Number(r.reactivatedCount);
      const p85Hours         = r.p85Hours != null ? Number(r.p85Hours) : null;
      const reactivationRate = totalCompleted > 0 ? (reactivatedCount / totalCompleted) * 100 : 0;
      return {
        assigneeId:          r.assigneeId,
        displayName:         r.displayName,
        currentWip,
        totalCompleted,
        reactivatedCount,
        reactivationRate:    Math.round(reactivationRate * 10) / 10,
        p85Hours,
        teamP85,
        teamAvgWip,
        isOverloaded:        currentWip > Math.max(4, teamAvgWip * 2),
        isSlow:              p85Hours !== null && teamP85 !== null && p85Hours > teamP85 * 1.5,
        hasHighReactivation: totalCompleted >= 3 && reactivationRate > 20,
      };
    });

    return {
      entries,
      teamP85,
      teamAvgWip,
      flaggedCount: entries.filter(
        (e) => e.isOverloaded || e.isSlow || e.hasHighReactivation
      ).length,
    };
  },

  async getIssueJourney(workItemId: string): Promise<IssueJourney | null> {
    const result = await pool.query(
      `SELECT
         wi.id                  AS "workItemId",
         wi.sequence_id         AS "sequenceId",
         wi.title,
         wi.priority,
         wi.is_reactivated      AS "isReactivated",
         wi.created_at_plane    AS "createdAt",
         wi.completed_at_plane  AS "completedAt",
         wi.cycle_time_hours    AS "cycleTimeHours",
         wi.lead_time_hours     AS "leadTimeHours",
         wm.display_name        AS "assigneeName",
         wi.assignee_id         AS "assigneeId",
         tis.state_id           AS "stateId",
         ps.name                AS "stateName",
         ps.flow_category       AS "flowCategory",
         ps.color               AS "stateColor",
         tis.entered_at         AS "enteredAt",
         tis.exited_at          AS "exitedAt",
         tis.duration_hours     AS "durationHours"
       FROM work_items wi
       LEFT JOIN workspace_members wm ON wm.id = wi.assignee_id
       JOIN time_in_state tis ON tis.work_item_id = wi.id
       JOIN plane_states ps   ON ps.id = tis.state_id
       WHERE wi.id = $1
       ORDER BY tis.entered_at ASC`,
      [workItemId]
    );

    if (result.rows.length === 0) return null;

    const first = result.rows[0];
    return {
      workItemId:     first.workItemId,
      sequenceId:     first.sequenceId,
      title:          first.title,
      priority:       first.priority,
      isReactivated:  first.isReactivated,
      createdAt:      first.createdAt,
      completedAt:    first.completedAt,
      cycleTimeHours: first.cycleTimeHours !== null ? Number(first.cycleTimeHours) : null,
      leadTimeHours:  first.leadTimeHours  !== null ? Number(first.leadTimeHours)  : null,
      assigneeName:   first.assigneeName,
      assigneeId:     first.assigneeId,
      states: result.rows.map((r) => ({
        stateId:       r.stateId,
        stateName:     r.stateName,
        flowCategory:  r.flowCategory,
        stateColor:    r.stateColor,
        enteredAt:     r.enteredAt,
        exitedAt:      r.exitedAt,
        durationHours: r.durationHours !== null ? Number(r.durationHours) : null,
      })),
    };
  },
};

function percentileFromSorted(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, rank)] ?? 0;
}
