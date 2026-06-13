'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { analyticsService } from '@/services/analyticsService';
import type { SprintMetrics } from '@flow-analytics/shared';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Trophy, Zap, AlertCircle, Sparkles } from 'lucide-react';

// ─── formatting helpers ───────────────────────────────────────────────────────

function fmt(hours: number): string {
  if (hours < 1)   return `${Math.round(hours * 60)}m`;
  if (hours < 24)  return `${Math.round(hours)}h`;
  if (hours < 168) return `${(hours / 24).toFixed(1)}d`;
  return `${(hours / 168).toFixed(1)}w`;
}

function fmtDateRange(start: string, end: string): string {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const s = new Date(sy!, sm! - 1, sd!);
  const e = new Date(ey!, em! - 1, ed!);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const startStr = s.toLocaleDateString('en-US', opts);
  const endStr   = e.toLocaleDateString('en-US', {
    ...opts,
    ...(sy !== ey ? { year: 'numeric' } : {}),
  });
  return `${startStr} – ${endStr}`;
}

function shortName(name: string, maxLen = 10): string {
  return name.length > maxLen ? name.slice(0, maxLen - 1) + '…' : name;
}

function trendPct(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// ─── sprint trend indicator ───────────────────────────────────────────────────

function TrendBadge({
  pct,
  lowerIsBetter = false,
}: {
  pct: number | null;
  lowerIsBetter?: boolean;
}) {
  if (pct === null) return null;
  const good    = lowerIsBetter ? pct < 0 : pct > 0;
  const neutral = pct === 0;
  const color   = neutral ? 'var(--fg-subtle)' : good ? '#22c55e' : '#ef4444';
  const Icon    = neutral ? Minus : good ? TrendingUp : TrendingDown;
  const sign    = pct > 0 ? '+' : '';
  return (
    <span
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        gap:           3,
        fontSize:      10,
        fontWeight:    600,
        color,
        background:    neutral
          ? 'rgba(148,163,184,0.1)'
          : good
          ? 'rgba(34,197,94,0.1)'
          : 'rgba(239,68,68,0.1)',
        padding:       '2px 6px',
        borderRadius:  5,
      }}
    >
      <Icon size={9} />
      {sign}{pct}%
    </span>
  );
}

// ─── sprint card ──────────────────────────────────────────────────────────────

interface CardProps {
  sprint:   SprintMetrics;
  prev:     SprintMetrics | null;
  isLatest: boolean;
}

function SprintCard({ sprint, prev, isLatest }: CardProps) {
  const throughputDelta = prev ? trendPct(sprint.itemsCompleted, prev.itemsCompleted) : null;
  const p50Delta        = (prev?.p50Hours && sprint.p50Hours)
    ? trendPct(sprint.p50Hours, prev.p50Hours)
    : null;
  const p85Delta        = (prev?.p85Hours && sprint.p85Hours)
    ? trendPct(sprint.p85Hours, prev.p85Hours)
    : null;

  const isActive = sprint.status === 'started' || sprint.status === 'in_progress';

  return (
    <div
      style={{
        padding:      '16px 18px',
        borderRadius:  14,
        border:        isLatest
          ? '1px solid rgba(99,102,241,0.4)'
          : '1px solid var(--border)',
        background:    isLatest
          ? 'linear-gradient(135deg, rgba(99,102,241,0.07) 0%, rgba(167,139,250,0.03) 100%)'
          : 'var(--surface)',
        boxShadow:     isLatest
          ? '0 0 20px rgba(99,102,241,0.08), 0 2px 8px rgba(0,0,0,0.15)'
          : '0 1px 4px rgba(0,0,0,0.12)',
        minWidth:      0,
        display:       'flex',
        flexDirection: 'column',
        gap:            10,
        position:      'relative',
      }}
    >
      {/* Status badges */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              fontSize:      12,
              fontWeight:    700,
              color:         isLatest ? 'var(--accent-light)' : 'var(--fg)',
              margin:        0,
              overflow:      'hidden',
              textOverflow:  'ellipsis',
              whiteSpace:    'nowrap',
            }}
          >
            {sprint.cycleName}
          </p>
          <p style={{ fontSize: 10, color: 'var(--fg-subtle)', margin: '2px 0 0' }}>
            {fmtDateRange(sprint.startDate, sprint.endDate)}
            <span style={{ marginLeft: 5, opacity: 0.7 }}>· {sprint.durationDays}d</span>
          </p>
        </div>
        {isActive && (
          <span
            style={{
              fontSize:      9,
              fontWeight:    700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding:       '2px 7px',
              borderRadius:  5,
              background:    'rgba(245,158,11,0.15)',
              color:         '#fcd34d',
              flexShrink:    0,
            }}
          >
            Live
          </span>
        )}
        {isLatest && !isActive && (
          <span
            style={{
              fontSize:      9,
              fontWeight:    700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding:       '2px 7px',
              borderRadius:  5,
              background:    'rgba(99,102,241,0.15)',
              color:         'var(--accent-light)',
              flexShrink:    0,
            }}
          >
            Latest
          </span>
        )}
      </div>

      {/* Throughput — big number */}
      <div
        style={{
          padding:    '10px 12px',
          background: 'var(--surface-2)',
          borderRadius: 10,
          border:     '1px solid var(--border)',
        }}
      >
        <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--fg-subtle)', margin: '0 0 4px' }}>
          Issues shipped
        </p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--fg)', lineHeight: 1 }}>
            {sprint.itemsCompleted}
          </span>
          <TrendBadge pct={throughputDelta} lowerIsBetter={false} />
        </div>
      </div>

      {/* Cycle time metrics */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>Typical (P50)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)' }}>
              {sprint.p50Hours !== null ? fmt(sprint.p50Hours) : '—'}
            </span>
            <TrendBadge pct={p50Delta} lowerIsBetter={true} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>Slowest 15% (P85)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)' }}>
              {sprint.p85Hours !== null ? fmt(sprint.p85Hours) : '—'}
            </span>
            <TrendBadge pct={p85Delta} lowerIsBetter={true} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── insights banner ─────────────────────────────────────────────────────────

function InsightsBanner({ sprints }: { sprints: SprintMetrics[] }) {
  if (sprints.length < 2) return null;

  const byThroughput = [...sprints].sort((a, b) => b.itemsCompleted - a.itemsCompleted);
  const bySpeed      = [...sprints]
    .filter((s) => s.p50Hours !== null)
    .sort((a, b) => (a.p50Hours ?? Infinity) - (b.p50Hours ?? Infinity));

  const best    = byThroughput[0];
  const fastest = bySpeed[0];
  const last    = sprints[sprints.length - 1]!;
  const prev    = sprints[sprints.length - 2]!;

  const latestTrend = (last.p50Hours && prev.p50Hours)
    ? trendPct(last.p50Hours, prev.p50Hours)
    : null;

  const insights: Array<{ icon: React.ReactNode; text: React.ReactNode }> = [];

  if (best) {
    insights.push({
      icon: <Trophy size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />,
      text: (
        <>Best throughput: <strong style={{ color: 'var(--fg)' }}>{best.cycleName}</strong>
        &nbsp;—&nbsp;{best.itemsCompleted} issues shipped</>
      ),
    });
  }

  if (fastest && fastest.p50Hours !== null) {
    insights.push({
      icon: <Zap size={13} style={{ color: '#a78bfa', flexShrink: 0 }} />,
      text: (
        <>Fastest sprint: <strong style={{ color: 'var(--fg)' }}>{fastest.cycleName}</strong>
        &nbsp;—&nbsp;P50 {fmt(fastest.p50Hours)}</>
      ),
    });
  }

  if (latestTrend !== null) {
    const faster = latestTrend < 0;
    insights.push({
      icon: faster
        ? <TrendingUp size={13} style={{ color: '#22c55e', flexShrink: 0 }} />
        : <TrendingDown size={13} style={{ color: '#ef4444', flexShrink: 0 }} />,
      text: (
        <>
          Latest sprint is{' '}
          <strong style={{ color: faster ? '#22c55e' : '#ef4444' }}>
            {Math.abs(latestTrend)}% {faster ? 'faster' : 'slower'}
          </strong>
          &nbsp;than the previous one (P50)
        </>
      ),
    });
  }

  if (insights.length === 0) return null;

  return (
    <div
      style={{
        padding:      '14px 18px',
        borderRadius:  12,
        background:   'var(--surface-2)',
        border:       '1px solid var(--border)',
        display:      'flex',
        flexDirection: 'column',
        gap:           8,
      }}
    >
      {insights.map((ins, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {ins.icon}
          <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: 0 }}>{ins.text}</p>
        </div>
      ))}
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

const LIMIT_OPTIONS = [
  { label: 'Last 3 sprints',  value: 3  },
  { label: 'Last 6 sprints',  value: 6  },
  { label: 'Last 10 sprints', value: 10 },
  { label: 'All sprints',     value: 50 },
];

export default function SprintsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [sprints,       setSprints]       = useState<SprintMetrics[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [limit,         setLimit]         = useState(6);

  // AI retrospective state
  const [retroIdx,      setRetroIdx]      = useState<number>(0); // index into sprints (latest by default)
  const [retroText,     setRetroText]     = useState<string | null>(null);
  const [retroLoading,  setRetroLoading]  = useState(false);
  const [retroError,    setRetroError]    = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    analyticsService
      .getSprintComparison(projectId, limit)
      .then((d) => {
        setSprints(d.sprints);
        setRetroIdx(Math.max(0, d.sprints.length - 1)); // default to latest
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectId, limit]);

  async function handleGenerateRetro() {
    const sprint = sprints[retroIdx];
    if (!sprint) return;
    const prev = retroIdx > 0 ? sprints[retroIdx - 1]! : null;
    setRetroLoading(true);
    setRetroError(null);
    setRetroText(null);
    try {
      const result = await analyticsService.generateSprintRetro(projectId, sprint, prev);
      setRetroText(result.narrative);
    } catch (e) {
      setRetroError(e instanceof Error ? e.message : 'Failed to generate retrospective');
    } finally {
      setRetroLoading(false);
    }
  }

  // Chart data — already chronological from API
  const chartData = sprints.map((s) => ({
    name:           shortName(s.cycleName),
    throughput:     s.itemsCompleted,
    p50:            s.p50Hours !== null ? Math.round((s.p50Hours / 24) * 10) / 10 : null,
    p85:            s.p85Hours !== null ? Math.round((s.p85Hours / 24) * 10) / 10 : null,
  }));

  const avgThroughput = sprints.length
    ? Math.round(sprints.reduce((s, v) => s + v.itemsCompleted, 0) / sprints.length)
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2
            style={{
              fontSize:      20,
              fontWeight:    800,
              color:         'var(--fg)',
              letterSpacing: '-0.02em',
              margin:        0,
            }}
          >
            Sprint comparison
          </h2>
          <p style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 5 }}>
            Throughput, cycle time, and velocity trends — one sprint at a time
          </p>
        </div>

        <select
          value={limit}
          onChange={(e) => setLimit(parseInt(e.target.value, 10))}
          style={{
            background:   'var(--surface-2)',
            border:       '1px solid var(--border)',
            borderRadius:  9,
            color:        'var(--fg)',
            fontSize:     12,
            fontWeight:   500,
            padding:      '7px 12px',
            appearance:   'none',
            cursor:       'pointer',
          }}
        >
          {LIMIT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="skeleton" style={{ height: 64, borderRadius: 12 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton" style={{ height: 160, borderRadius: 14 }} />
            ))}
          </div>
          <div className="skeleton" style={{ height: 220, borderRadius: 14 }} />
          <div className="skeleton" style={{ height: 220, borderRadius: 14 }} />
        </div>
      )}

      {/* Empty state */}
      {!loading && sprints.length === 0 && (
        <div
          style={{
            padding:      '48px 24px',
            borderRadius:  14,
            border:       '1px solid var(--border)',
            background:   'var(--surface)',
            textAlign:    'center',
          }}
        >
          <AlertCircle size={28} style={{ color: 'var(--fg-subtle)', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)', margin: '0 0 6px' }}>
            No sprints found
          </p>
          <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: 0 }}>
            Create and complete sprints (cycles) in Plane to see comparisons here.
            Data syncs automatically.
          </p>
        </div>
      )}

      {!loading && sprints.length > 0 && (
        <>
          {/* Insights */}
          <InsightsBanner sprints={sprints} />

          {/* Sprint cards */}
          <div
            style={{
              display:             'grid',
              gridTemplateColumns: `repeat(${Math.min(sprints.length, 4)}, 1fr)`,
              gap:                  12,
            }}
          >
            {sprints.map((sprint, i) => (
              <SprintCard
                key={sprint.cycleId}
                sprint={sprint}
                prev={i > 0 ? sprints[i - 1]! : null}
                isLatest={i === sprints.length - 1}
              />
            ))}
          </div>

          {/* AI Sprint Retrospective */}
          <div
            style={{
              borderRadius: 14,
              border: '1px solid rgba(167,139,250,0.25)',
              background: 'linear-gradient(135deg, rgba(167,139,250,0.06) 0%, rgba(99,102,241,0.04) 100%)',
              overflow: 'hidden',
            }}
          >
            {/* Controls row — always visible */}
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12, flexWrap: 'wrap', padding: '14px 18px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={14} style={{ color: '#a78bfa', flexShrink: 0 }} />
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', margin: 0 }}>
                  AI Sprint Retrospective
                </p>
                <span
                  style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                    padding: '2px 7px', borderRadius: 5,
                    background: 'rgba(167,139,250,0.14)', border: '1px solid rgba(167,139,250,0.3)',
                    color: '#a78bfa',
                  }}
                >
                  OpenRouter
                </span>
                <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: 0 }}>
                  · data-driven narrative from sprint metrics
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                <select
                  value={retroIdx}
                  onChange={(e) => {
                    setRetroIdx(Number(e.target.value));
                    setRetroText(null);
                    setRetroError(null);
                  }}
                  style={{
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: 9, color: 'var(--fg)', fontSize: 12, fontWeight: 500,
                    padding: '7px 12px', appearance: 'none', cursor: 'pointer',
                  }}
                >
                  {sprints.map((s, i) => (
                    <option key={s.cycleId} value={i}>{s.cycleName}</option>
                  ))}
                </select>
                <button
                  onClick={() => { void handleGenerateRetro(); }}
                  disabled={retroLoading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 9, cursor: retroLoading ? 'wait' : 'pointer',
                    background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.35)',
                    color: '#c4b5fd', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                  }}
                >
                  <Sparkles size={12} />
                  {retroLoading ? 'Generating…' : 'Generate'}
                </button>
              </div>
            </div>

            {/* Narrative / error */}
            {(retroText || retroError) && (
              <div
                style={{
                  borderTop: '1px solid rgba(167,139,250,0.18)',
                  padding: '16px 18px',
                }}
              >
                {retroText && (
                  <p style={{ fontSize: 13, color: 'var(--fg)', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap' }}>
                    {retroText}
                  </p>
                )}
                {retroError && (
                  <p style={{ fontSize: 12, color: '#f87171', margin: 0 }}>
                    {retroError}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Throughput bar chart */}
          <div className="card">
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', margin: '0 0 4px' }}>
              Issues shipped per sprint
            </p>
            <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '0 0 20px' }}>
              How much value the team delivered each sprint
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }}
                  stroke="var(--border)"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--fg-subtle)' }}
                  stroke="var(--border)"
                  allowDecimals={false}
                  width={28}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.[0]) return null;
                    return (
                      <div
                        style={{
                          background:   'var(--surface-3)',
                          border:       '1px solid var(--border)',
                          borderRadius:  10,
                          padding:      '10px 14px',
                          boxShadow:    'var(--shadow-md)',
                        }}
                      >
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)', margin: '0 0 4px' }}>{label}</p>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#818cf8', margin: 0 }}>
                          {payload[0].value as number} issues shipped
                        </p>
                      </div>
                    );
                  }}
                />
                {avgThroughput > 0 && (
                  <ReferenceLine
                    y={avgThroughput}
                    stroke="#6366f1"
                    strokeDasharray="4 3"
                    strokeWidth={1.5}
                    label={{
                      value:    `avg ${avgThroughput}`,
                      fill:     '#818cf8',
                      fontSize: 10,
                      position: 'insideRight',
                    }}
                  />
                )}
                <Bar
                  dataKey="throughput"
                  fill="#6366f1"
                  fillOpacity={0.75}
                  radius={[4, 4, 0, 0]}
                  label={{
                    position:  'top',
                    fontSize:  11,
                    fontWeight: 700,
                    fill:      'var(--fg-muted)',
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Cycle time trend */}
          <div className="card">
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', margin: '0 0 4px' }}>
              Cycle time trend
            </p>
            <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '0 0 20px' }}>
              How fast issues moved through the workflow each sprint — in days
            </p>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
              {[
                { color: '#818cf8', label: 'P50 — typical issue' },
                { color: '#f59e0b', label: 'P85 — slowest 15%'   },
              ].map((l) => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 18, height: 2, background: l.color, borderRadius: 2 }} />
                  <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{l.label}</span>
                </div>
              ))}
            </div>

            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }}
                  stroke="var(--border)"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--fg-subtle)' }}
                  stroke="var(--border)"
                  tickFormatter={(v: number) => `${v}d`}
                  width={34}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div
                        style={{
                          background:   'var(--surface-3)',
                          border:       '1px solid var(--border)',
                          borderRadius:  10,
                          padding:      '10px 14px',
                          boxShadow:    'var(--shadow-md)',
                        }}
                      >
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)', margin: '0 0 6px' }}>{label}</p>
                        {payload.map((p) => (
                          <p key={p.dataKey as string} style={{ fontSize: 12, color: p.color as string, margin: '2px 0 0' }}>
                            {p.dataKey === 'p50' ? 'Typical (P50)' : 'Slowest 15% (P85)'}:&nbsp;
                            <strong>{p.value !== null ? `${p.value}d` : '—'}</strong>
                          </p>
                        ))}
                      </div>
                    );
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="p50"
                  stroke="#818cf8"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#818cf8', strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="p85"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={{ r: 4, fill: '#f59e0b', strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Comparison table */}
          <div className="card">
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', margin: '0 0 16px' }}>
              Full comparison
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Sprint', 'Dates', 'Duration', 'Shipped', 'P50', 'P85', 'vs prev (throughput)'].map((col) => (
                      <th
                        key={col}
                        style={{
                          textAlign:     'left',
                          padding:       '6px 12px',
                          fontSize:      10,
                          fontWeight:    700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.07em',
                          color:         'var(--fg-subtle)',
                          borderBottom:  '1px solid var(--border)',
                          whiteSpace:    'nowrap',
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sprints.map((sprint, i) => {
                    const prev    = i > 0 ? sprints[i - 1]! : null;
                    const delta   = prev ? trendPct(sprint.itemsCompleted, prev.itemsCompleted) : null;
                    const isLast  = i === sprints.length - 1;
                    return (
                      <tr
                        key={sprint.cycleId}
                        style={{
                          background: isLast ? 'rgba(99,102,241,0.04)' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '9px 12px', color: 'var(--fg)', fontWeight: isLast ? 600 : 400, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                          {sprint.cycleName}
                          {isLast && (
                            <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent-light)', fontWeight: 600 }}>Latest</span>
                          )}
                        </td>
                        <td style={{ padding: '9px 12px', color: 'var(--fg-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                          {fmtDateRange(sprint.startDate, sprint.endDate)}
                        </td>
                        <td style={{ padding: '9px 12px', color: 'var(--fg-muted)', borderBottom: '1px solid var(--border)' }}>
                          {sprint.durationDays}d
                        </td>
                        <td style={{ padding: '9px 12px', color: 'var(--fg)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>
                          {sprint.itemsCompleted}
                        </td>
                        <td style={{ padding: '9px 12px', color: 'var(--fg-muted)', borderBottom: '1px solid var(--border)' }}>
                          {sprint.p50Hours !== null ? fmt(sprint.p50Hours) : '—'}
                        </td>
                        <td style={{ padding: '9px 12px', color: 'var(--fg-muted)', borderBottom: '1px solid var(--border)' }}>
                          {sprint.p85Hours !== null ? fmt(sprint.p85Hours) : '—'}
                        </td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)' }}>
                          <TrendBadge pct={delta} lowerIsBetter={false} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </>
      )}
    </div>
  );
}
