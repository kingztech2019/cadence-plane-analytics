'use client';

import { useState, useEffect, CSSProperties } from 'react';
import { FileText, Filter, Printer, AlertTriangle, Sparkles, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { workspaceService } from '@/services/workspaceService';

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportItem = {
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
};

type Project = { id: string; name: string; identifier: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY: Record<string, { label: string; color: string; bg: string }> = {
  urgent:  { label: 'Urgent',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
  highest: { label: 'Highest', color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
  high:    { label: 'High',    color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  medium:  { label: 'Medium',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  low:     { label: 'Low',     color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  none:    { label: 'None',    color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
};

// How many days in the same state before flagging as stale
const STALE_DAYS: Record<string, number> = {
  in_progress: 7,
  review:      7,
  todo:        14,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d.getDate()).padStart(2,'0')}/${months[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
}

function getDefaultDates() {
  const to   = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 7);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function getPrevPeriod(from: string, to: string) {
  const f    = new Date(from);
  const t    = new Date(to);
  const days = Math.round((t.getTime() - f.getTime()) / 86_400_000) + 1;
  const prevTo   = new Date(f.getTime() - 86_400_000);
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86_400_000);
  return { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) };
}

function formatRange(from: string, to: string) {
  const f = new Date(from);
  const t = new Date(to);
  const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${f.getDate()} ${m[f.getMonth()]} – ${t.getDate()} ${m[t.getMonth()]} ${t.getFullYear()}`;
}

function isStale(item: ReportItem): boolean {
  const threshold = STALE_DAYS[item.flow_category];
  return threshold !== undefined && item.days_in_current_state >= threshold;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Delta({ n, inverse = false }: { n: number; inverse?: boolean }) {
  if (n === 0) return <span style={{ fontSize: 11, color: '#6b7280' }}>no change</span>;
  const good = inverse ? n < 0 : n > 0;
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 11, fontWeight: 700,
      color: good ? '#22c55e' : '#ef4444',
      background: good ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
      padding: '2px 8px', borderRadius: 20,
    }}>
      {n > 0 ? '+' : ''}{n} vs prev week
    </span>
  );
}

function StatCard({
  label, value, sub, delta, inverseGood = false,
}: {
  label: string;
  value: number | string;
  sub?: string;
  delta?: number;
  inverseGood?: boolean;
}) {
  return (
    <div style={{
      flex: '1 1 180px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '16px 20px',
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--fg-subtle)', margin: '0 0 8px' }}>
        {label}
      </p>
      <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--fg)', margin: '0 0 6px', letterSpacing: '-0.03em', lineHeight: 1 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '0 0 8px' }}>{sub}</p>}
      {delta !== undefined && <Delta n={delta} inverse={inverseGood} />}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportPage() {
  const defaults = getDefaultDates();

  const [connectionId,     setConnectionId]     = useState('');
  const [projects,         setProjects]         = useState<Project[]>([]);
  const [selectedProject,  setSelectedProject]  = useState('');
  const [from, setFrom] = useState(defaults.from);
  const [to,   setTo]   = useState(defaults.to);
  const [items,     setItems]     = useState<ReportItem[]>([]);
  const [prevItems, setPrevItems] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [loaded,  setLoaded]  = useState(false);

  // Per-project AI summaries: { [projectId]: { summary_text, generated_at } }
  type SummaryEntry = { summary_text: string; generated_at: string };
  const [summaries,        setSummaries]        = useState<Record<string, SummaryEntry>>({});
  const [generatingFor,    setGeneratingFor]    = useState<string | null>(null);
  const [summaryError,     setSummaryError]     = useState<Record<string, string>>({});
  const [expandedSummary,  setExpandedSummary]  = useState<Record<string, boolean>>({});

  useEffect(() => {
    workspaceService.listConnections().then((conns) => {
      const conn = conns[0];
      if (!conn) return;
      setConnectionId(conn.id);
      workspaceService.listProjects(conn.id).then(setProjects);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (connectionId && !loaded) {
      doLoad(connectionId, from, to, '');
      setLoaded(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId]);

  async function doLoad(cid: string, f: string, t: string, pid: string) {
    if (!cid) return;
    setLoading(true);
    setError('');
    try {
      const prev = getPrevPeriod(f, t);
      const [current, previous, savedSummaries] = await Promise.all([
        workspaceService.getReport(cid, f, t, pid || undefined),
        workspaceService.getReport(cid, prev.from, prev.to, pid || undefined),
        workspaceService.getReportSummaries(cid, f, t),
      ]);
      setItems(current);
      setPrevItems(previous);
      setSummaries(savedSummaries ?? {});
    } catch {
      setError('Failed to load report. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function generateSummary(projectId: string) {
    if (!connectionId || generatingFor) return;
    setGeneratingFor(projectId);
    setSummaryError(prev => ({ ...prev, [projectId]: '' }));
    try {
      const result = await workspaceService.generateReportSummary(connectionId, projectId, from, to);
      setSummaries(prev => ({ ...prev, [projectId]: result }));
      setExpandedSummary(prev => ({ ...prev, [projectId]: true }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate summary';
      setSummaryError(prev => ({ ...prev, [projectId]: msg }));
    } finally {
      setGeneratingFor(null);
    }
  }

  function handleApply() { doLoad(connectionId, from, to, selectedProject); }

  // ── Computed stats ──────────────────────────────────────────────────────────

  const staleItems    = items.filter(isStale);
  const stalePrev     = prevItems.filter(isStale);
  const shippedNow    = items.filter(i => i.flow_category === 'done').length;
  const shippedPrev   = prevItems.filter(i => i.flow_category === 'done').length;
  const urgentNow     = items.filter(i => ['urgent','highest'].includes(i.priority?.toLowerCase() ?? '')).length;
  const highNow       = items.filter(i => i.priority?.toLowerCase() === 'high').length;

  const prevCountByState = prevItems.reduce<Record<string, number>>((acc, item) => {
    acc[item.state_name] = (acc[item.state_name] ?? 0) + 1;
    return acc;
  }, {});

  // ── Group items by project, then by state ──────────────────────────────────

  const projectGroups: Record<string, {
    projectId: string; projectName: string;
    states: Record<string, { color: string; order: number; items: ReportItem[] }>;
  }> = {};

  for (const item of items) {
    if (!projectGroups[item.project_id]) {
      projectGroups[item.project_id] = { projectId: item.project_id, projectName: item.project_name, states: {} };
    }
    const pg = projectGroups[item.project_id]!;
    if (!pg.states[item.state_name]) {
      pg.states[item.state_name] = { color: item.state_color ?? '#6366f1', order: item.state_order, items: [] };
    }
    pg.states[item.state_name]!.items.push(item);
  }

  const sortedProjectGroups = Object.values(projectGroups).sort((a, b) =>
    a.projectName.localeCompare(b.projectName)
  );

  // Flat state groups (for backward-compat display when one project selected)
  const groups: Record<string, { color: string; order: number; items: ReportItem[] }> = {};
  for (const item of items) {
    const g = groups[item.state_name];
    if (g) {
      g.items.push(item);
    } else {
      groups[item.state_name] = { color: item.state_color ?? '#6366f1', order: item.state_order, items: [item] };
    }
  }
  const sortedGroups = Object.entries(groups).sort((a, b) => a[1].order - b[1].order);
  const showProjectCol = !selectedProject && projects.length > 1;

  const activeProjectName = selectedProject
    ? (projects.find(p => p.id === selectedProject)?.name ?? '')
    : '';

  // ── Group items by assignee ─────────────────────────────────────────────────

  type AssigneeRow = {
    name: string;
    total: number;
    staleCount: number;
    byState: Array<{ name: string; color: string; count: number; order: number }>;
  };

  const assigneeMap: Record<string, AssigneeRow> = {};
  for (const item of items) {
    const name = item.assignee_name ?? 'Unassigned';
    if (!assigneeMap[name]) {
      assigneeMap[name] = { name, total: 0, staleCount: 0, byState: [] };
    }
    const row = assigneeMap[name]!;
    row.total++;
    if (isStale(item)) row.staleCount++;

    const existing = row.byState.find(s => s.name === item.state_name);
    if (existing) {
      existing.count++;
    } else {
      row.byState.push({ name: item.state_name, color: item.state_color ?? '#6366f1', count: 1, order: item.state_order });
    }
  }

  const assigneeRows = Object.values(assigneeMap)
    .sort((a, b) => {
      if (a.name === 'Unassigned') return 1;
      if (b.name === 'Unassigned') return -1;
      return b.total - a.total;
    })
    .map(row => ({ ...row, byState: [...row.byState].sort((a, b) => a.order - b.order) }));

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @media print {
          aside                { display: none !important; }
          .report-filters      { display: none !important; }
          .report-screen-hdr   { display: none !important; }
          .report-stats        { display: none !important; }
          .report-print-btn    { display: none !important; }

          body                 { overflow: visible !important; background: #fff !important; }
          .h-screen            { height: auto !important; overflow: visible !important; }
          .overflow-hidden     { overflow: visible !important; }
          .overflow-y-auto     { overflow: visible !important; }
          main                 { overflow: visible !important; }

          :root {
            --fg:           #111;
            --fg-muted:     #333;
            --fg-subtle:    #777;
            --bg:           #fff;
            --surface:      #fff;
            --surface-2:    #f4f4f5;
            --border:       #d4d4d8;
            --accent:       #6366f1;
            --accent-light: #6366f1;
            --error:        #ef4444;
            --success:      #22c55e;
          }

          .report-page         { padding: 0 !important; max-width: 100% !important; }
          .print-header        { display: block !important; }
          table                { page-break-inside: auto; width: 100% !important; }
          tr                   { page-break-inside: avoid; }
          thead                { display: table-header-group; }
        }
        .print-header { display: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ai-summary-block { display: block; }
        @media print { .ai-summary-block { break-inside: avoid; } }
      `}</style>

      <div className="report-page" style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>

        {/* ── Print-only header ───────────────────────────────────────────── */}
        <div className="print-header" style={{ marginBottom: 24, borderBottom: '2px solid #6366f1', paddingBottom: 12 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6366f1', margin: '0 0 4px' }}>
            Cadence — Status Report
          </p>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', color: '#111' }}>
            Week: {formatRange(from, to)}
          </h1>
          <p style={{ fontSize: 12, color: '#555', margin: 0 }}>
            {items.length} items
            {activeProjectName && <> · {activeProjectName}</>}
            {' · '}Shipped: {shippedNow} ({shippedNow - shippedPrev >= 0 ? '+' : ''}{shippedNow - shippedPrev} vs prev)
            {' · '}Stale: {staleItems.length}
            {' · '}Urgent/Highest: {urgentNow} · High: {highNow}
          </p>
        </div>

        {/* ── Screen header ───────────────────────────────────────────────── */}
        <div className="report-screen-hdr" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <FileText size={18} style={{ color: 'var(--accent-light)' }} />
              <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg)', margin: 0, letterSpacing: '-0.02em' }}>
                Status Report
              </h1>
            </div>
            <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>
              Week: {formatRange(from, to)}
              {items.length > 0 && (
                <span style={{ marginLeft: 10 }}>
                  · {items.length} item{items.length !== 1 ? 's' : ''}
                  {activeProjectName && <> · {activeProjectName}</>}
                </span>
              )}
            </p>
          </div>
          <button
            className="report-print-btn"
            onClick={() => window.print()}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              height: 36, padding: '0 16px',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 8, cursor: 'pointer',
              color: 'var(--fg-muted)', fontSize: 13, fontWeight: 500,
            }}
          >
            <Printer size={14} /> Print
          </button>
        </div>

        {/* ── Filters ─────────────────────────────────────────────────────── */}
        <div className="report-filters" style={{
          display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end',
          padding: '16px 20px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 4, alignSelf: 'center' }}>
            <Filter size={13} style={{ color: 'var(--fg-subtle)' }} />
            <span style={filterLabelStyle}>Filters</span>
          </div>

          <label style={filterGroupStyle}>
            <span style={filterLabelStyle}>From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
          </label>

          <label style={filterGroupStyle}>
            <span style={filterLabelStyle}>To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
          </label>

          {projects.length > 1 && (
            <label style={filterGroupStyle}>
              <span style={filterLabelStyle}>Project</span>
              <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} style={inputStyle}>
                <option value="">All projects</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          )}

          <button
            onClick={handleApply}
            disabled={loading || !connectionId}
            style={{
              height: 36, padding: '0 22px',
              background: 'var(--accent)', color: '#fff',
              border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              alignSelf: 'flex-end',
            }}
          >
            {loading ? 'Loading…' : 'Apply'}
          </button>
        </div>

        {/* ── Summary stats bar ───────────────────────────────────────────── */}
        {loaded && !loading && items.length > 0 && (
          <div className="report-stats" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
            <StatCard
              label="Total items"
              value={items.length}
              sub="updated this week"
            />
            <StatCard
              label="Shipped to done"
              value={shippedNow}
              sub="completed this period"
              delta={shippedNow - shippedPrev}
            />
            <StatCard
              label="Stale items"
              value={staleItems.length}
              sub={`stuck 7+ days in same state`}
              delta={staleItems.length - stalePrev.length}
              inverseGood
            />
            <StatCard
              label="High priority"
              value={urgentNow + highNow}
              sub={urgentNow > 0 ? `${urgentNow} Urgent/Highest · ${highNow} High` : `${highNow} High`}
            />
          </div>
        )}

        {/* ── Per-project AI Summaries ─────────────────────────────────────── */}
        {!loading && items.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Sparkles size={14} style={{ color: 'var(--accent)' }} />
                <span style={{
                  fontSize: 13, fontWeight: 700, color: 'var(--fg)',
                }}>
                  AI Project Summaries
                </span>
              </div>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>
                Saved once — click Generate to create or Regenerate to refresh
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {sortedProjectGroups.map(({ projectId, projectName }) => {
                const saved = summaries[projectId];
                const isGenerating = generatingFor === projectId;
                const errMsg = summaryError[projectId];
                const isExpanded = expandedSummary[projectId] ?? !!saved;

                return (
                  <div
                    key={projectId}
                    className="ai-summary-block"
                    style={{
                      background: 'var(--surface)',
                      border: saved ? '1px solid rgba(99,102,241,0.3)' : '1px solid var(--border)',
                      borderRadius: 14,
                      overflow: 'hidden',
                    }}
                  >
                    {/* Project header */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 18px',
                      borderBottom: isExpanded && (saved || isGenerating || errMsg) ? '1px solid var(--border)' : 'none',
                      background: saved ? 'rgba(99,102,241,0.06)' : 'var(--surface-2)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8,
                          background: 'var(--accent-dim, rgba(99,102,241,0.12))',
                          border: '1px solid var(--accent-glow, rgba(99,102,241,0.25))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 800, color: 'var(--accent)', flexShrink: 0,
                        }}>
                          {projectName[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)', margin: 0 }}>
                            {projectName}
                          </p>
                          {saved && (
                            <p style={{ fontSize: 10, color: 'var(--fg-subtle)', margin: '1px 0 0' }}>
                              Last generated {new Date(saved.generated_at).toLocaleDateString('en-GB', {
                                day: 'numeric', month: 'short', year: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </p>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {saved && (
                          <button
                            onClick={() => setExpandedSummary(prev => ({ ...prev, [projectId]: !isExpanded }))}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5,
                              padding: '5px 10px', borderRadius: 7,
                              background: 'transparent', border: '1px solid var(--border)',
                              color: 'var(--fg-subtle)', fontSize: 12, cursor: 'pointer',
                            }}
                          >
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            {isExpanded ? 'Collapse' : 'Expand'}
                          </button>
                        )}
                        <button
                          onClick={() => generateSummary(projectId)}
                          disabled={!!generatingFor}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 7,
                            padding: '7px 14px', borderRadius: 8,
                            background: saved ? 'var(--surface-2)' : 'var(--accent)',
                            color: saved ? 'var(--fg-muted)' : '#fff',
                            border: saved ? '1px solid var(--border)' : 'none',
                            fontSize: 12, fontWeight: 600,
                            cursor: generatingFor ? 'not-allowed' : 'pointer',
                            opacity: generatingFor && !isGenerating ? 0.5 : 1,
                            transition: 'all 120ms ease',
                          }}
                        >
                          {isGenerating
                            ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
                            : <><Sparkles size={13} /> {saved ? 'Regenerate' : 'Generate Summary'}</>
                          }
                        </button>
                      </div>
                    </div>

                    {/* Summary body */}
                    {isGenerating && (
                      <div style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                          border: '2px solid var(--accent)', borderTopColor: 'transparent',
                          animation: 'spin 0.8s linear infinite',
                        }} />
                        <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>
                          Analysing {projectName} — reading completed items, assignee contributions, stale work…
                        </p>
                      </div>
                    )}

                    {errMsg && !isGenerating && (
                      <div style={{ padding: '12px 18px', background: 'rgba(239,68,68,0.06)', borderTop: '1px solid rgba(239,68,68,0.2)' }}>
                        <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>⚠ {errMsg}</p>
                      </div>
                    )}

                    {saved && isExpanded && !isGenerating && (
                      <div style={{ padding: '18px 22px' }}>
                        <p style={{
                          fontSize: 13.5, color: 'var(--fg-muted)', lineHeight: 1.85,
                          margin: 0, whiteSpace: 'pre-wrap',
                        }}>
                          {saved.summary_text}
                        </p>
                      </div>
                    )}

                    {!saved && !isGenerating && !errMsg && (
                      <div style={{ padding: '14px 18px' }}>
                        <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: 0, fontStyle: 'italic' }}>
                          No summary yet for this period. Click "Generate Summary" to create a CTO-ready briefing from this project's activity data.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {error && <p style={{ color: 'var(--error)', fontSize: 13, marginBottom: 20 }}>{error}</p>}

        {/* ── Loading skeletons ────────────────────────────────────────────── */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 48, borderRadius: 10 }} />
            ))}
          </div>
        )}

        {/* ── Empty state ──────────────────────────────────────────────────── */}
        {!loading && loaded && items.length === 0 && !error && (
          <div style={{
            textAlign: 'center', padding: '64px 32px',
            border: '1px dashed var(--border)', borderRadius: 12,
          }}>
            <FileText size={32} style={{ color: 'var(--fg-subtle)', marginBottom: 12, opacity: 0.4 }} />
            <p style={{ fontSize: 14, color: 'var(--fg-muted)', margin: 0 }}>No items updated in this date range.</p>
            <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '6px 0 0' }}>
              Try widening the date range or selecting a different project.
            </p>
          </div>
        )}

        {/* ── Report tables ────────────────────────────────────────────────── */}
        {!loading && sortedGroups.map(([stateName, group]) => {
          const color      = group.color;
          const prevCount  = prevCountByState[stateName] ?? 0;
          const delta      = group.items.length - prevCount;
          const isDoneState = group.items[0]?.flow_category === 'done';

          return (
            <div key={stateName} style={{ marginBottom: 28 }}>

              {/* Status header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px',
                background: `${color}18`, border: `1px solid ${color}44`,
                borderBottom: 'none', borderRadius: '10px 10px 0 0',
              }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color }}>
                  {stateName}
                </span>
                {/* Item count */}
                <span style={{
                  fontSize: 11, fontWeight: 600, color, opacity: 0.8,
                  background: `${color}22`, borderRadius: 20, padding: '1px 8px',
                }}>
                  {group.items.length}
                </span>
                {/* WoW delta */}
                {prevItems.length > 0 && delta !== 0 && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, marginLeft: 4,
                    color: (isDoneState ? delta > 0 : delta < 0) ? '#22c55e' : '#f97316',
                    background: (isDoneState ? delta > 0 : delta < 0) ? 'rgba(34,197,94,0.12)' : 'rgba(249,115,22,0.12)',
                    padding: '1px 8px', borderRadius: 20,
                  }}>
                    {delta > 0 ? '+' : ''}{delta} vs prev week
                  </span>
                )}
                {/* Stale count in this group */}
                {group.items.filter(isStale).length > 0 && (
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 11, fontWeight: 600, marginLeft: 'auto',
                    color: '#f59e0b',
                  }}>
                    <AlertTriangle size={11} />
                    {group.items.filter(isStale).length} stale
                  </span>
                )}
              </div>

              {/* Table */}
              <div style={{ border: `1px solid ${color}44`, borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)' }}>
                      <th style={thStyle}>Issue</th>
                      <th style={{ ...thStyle, width: '40%' }}>Summary</th>
                      {showProjectCol && <th style={thStyle}>Project</th>}
                      <th style={thStyle}>Assignee</th>
                      <th style={thStyle}>Priority</th>
                      <th style={thStyle}>Created</th>
                      <th style={thStyle}>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item, i) => {
                      const key   = `${item.project_identifier}-${item.sequence_id}`;
                      const prio  = PRIORITY[item.priority?.toLowerCase() ?? ''] ?? PRIORITY.none!;
                      const stale = isStale(item);

                      return (
                        <tr
                          key={key}
                          style={{
                            borderTop: '1px solid var(--border)',
                            background: stale
                              ? 'rgba(245,158,11,0.06)'
                              : i % 2 === 0 ? 'transparent' : 'var(--surface)',
                          }}
                        >
                          {/* Issue key + stale flag */}
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                              <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: 'var(--accent-light)' }}>
                                {key}
                              </span>
                              {stale && (
                                <span
                                  title={`${item.days_in_current_state} days in this state`}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 3,
                                    fontSize: 10, fontWeight: 700,
                                    color: '#f59e0b',
                                    background: 'rgba(245,158,11,0.15)',
                                    border: '1px solid rgba(245,158,11,0.3)',
                                    padding: '1px 6px', borderRadius: 20,
                                  }}
                                >
                                  <AlertTriangle size={9} />
                                  {item.days_in_current_state}d
                                </span>
                              )}
                            </div>
                          </td>

                          <td style={{ ...tdStyle, maxWidth: 0 }}>
                            <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--fg)' }}>
                              {item.title}
                            </span>
                          </td>

                          {showProjectCol && (
                            <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: 'var(--fg-muted)' }}>
                              {item.project_name}
                            </td>
                          )}

                          <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                            {item.assignee_name ?? (
                              <span style={{ color: 'var(--fg-subtle)', fontStyle: 'italic' }}>Unassigned</span>
                            )}
                          </td>

                          <td style={tdStyle}>
                            <span style={{
                              display: 'inline-block', padding: '2px 9px', borderRadius: 20,
                              fontSize: 11, fontWeight: 600,
                              color: prio.color, background: prio.bg, whiteSpace: 'nowrap',
                            }}>
                              {prio.label}
                            </span>
                          </td>

                          <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: 'var(--fg-muted)' }}>
                            {fmtDate(item.created_at_plane)}
                          </td>
                          <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: 'var(--fg-muted)' }}>
                            {fmtDate(item.updated_at_plane)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
        {/* ── Assignee breakdown ──────────────────────────────────────────── */}
        {!loading && assigneeRows.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {/* Section divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{
                fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--fg-subtle)',
                whiteSpace: 'nowrap',
              }}>
                Assignee Breakdown
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)' }}>
                    <th style={thStyle}>Team member</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Total</th>
                    <th style={thStyle}>Status breakdown</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Stale</th>
                  </tr>
                </thead>
                <tbody>
                  {assigneeRows.map((row, i) => (
                    <tr
                      key={row.name}
                      style={{
                        borderTop: '1px solid var(--border)',
                        background: i % 2 === 0 ? 'transparent' : 'var(--surface)',
                      }}
                    >
                      {/* Name with initial avatar */}
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                            background: row.name === 'Unassigned'
                              ? 'var(--surface-2)'
                              : `hsl(${(row.name.charCodeAt(0) * 37) % 360},60%,50%)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, color: '#fff',
                            border: '1px solid var(--border)',
                          }}>
                            {row.name === 'Unassigned' ? '?' : row.name.slice(0, 1).toUpperCase()}
                          </div>
                          <span style={{ color: 'var(--fg)', fontWeight: row.name === 'Unassigned' ? 400 : 500 }}>
                            {row.name}
                          </span>
                        </div>
                      </td>

                      {/* Total count */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>
                          {row.total}
                        </span>
                      </td>

                      {/* Status chips */}
                      <td style={{ ...tdStyle }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {row.byState.map(s => (
                            <span
                              key={s.name}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                fontSize: 11, fontWeight: 600,
                                color: s.color,
                                background: `${s.color}18`,
                                border: `1px solid ${s.color}44`,
                                padding: '2px 9px', borderRadius: 20,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0, display: 'inline-block' }} />
                              {s.name} · {s.count}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Stale count */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {row.staleCount > 0 ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 12, fontWeight: 700, color: '#f59e0b',
                            background: 'rgba(245,158,11,0.12)',
                            padding: '2px 10px', borderRadius: 20,
                          }}>
                            <AlertTriangle size={11} />
                            {row.staleCount}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--fg-subtle)', fontSize: 11 }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </>
  );
}

// ─── Style constants ──────────────────────────────────────────────────────────

const inputStyle: CSSProperties = {
  height: 36, padding: '0 10px',
  background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--fg)',
  fontSize: 13, fontFamily: 'inherit', minWidth: 140,
};

const filterGroupStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };

const filterLabelStyle: CSSProperties = {
  fontSize: 10.5, fontWeight: 700,
  letterSpacing: '0.07em', textTransform: 'uppercase',
  color: 'var(--fg-subtle)',
};

const thStyle: CSSProperties = {
  padding: '9px 14px', textAlign: 'left',
  fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: 'var(--fg-subtle)', whiteSpace: 'nowrap',
};

const tdStyle: CSSProperties = { padding: '10px 14px', color: 'var(--fg-muted)' };
