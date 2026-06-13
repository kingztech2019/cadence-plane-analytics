'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { analyticsService } from '@/services/analyticsService';
import type { ForecastResult } from '@flow-analytics/shared';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';

// ─── helpers ──────────────────────────────────────────────────────────────────

function weekToDateLabel(week: number): string {
  const d = new Date();
  d.setDate(d.getDate() + week * 7);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatWeeks(weeks: number): string {
  if (weeks <= 1) return '1 week';
  if (weeks <= 8) return `${weeks} weeks`;
  return `~${Math.ceil(weeks / 4)} months`;
}

const HISTORY_OPTIONS = [
  { label: 'Last 4 weeks',  value: 4  },
  { label: 'Last 8 weeks',  value: 8  },
  { label: 'Last 12 weeks', value: 12 },
  { label: 'Last 20 weeks', value: 20 },
];

// ─── sub-components ───────────────────────────────────────────────────────────

interface ConfCardProps {
  title:     string;
  subtitle:  string;
  weeks:     number;
  date:      string;
  pct:       number;
  highlight?: boolean;
  cardStyle?: React.CSSProperties;
}

function ConfCard({ title, subtitle, weeks, date, pct, highlight, cardStyle }: ConfCardProps) {
  return (
    <div
      style={{
        padding:    '20px 22px',
        borderRadius: 14,
        border:     highlight ? '1px solid rgba(99,102,241,0.4)' : '1px solid var(--border)',
        background: highlight
          ? 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(167,139,250,0.04) 100%)'
          : 'var(--surface)',
        boxShadow:  highlight
          ? '0 0 28px rgba(99,102,241,0.12), 0 2px 8px rgba(0,0,0,0.2)'
          : '0 1px 4px rgba(0,0,0,0.15)',
        position:   'relative',
        ...cardStyle,
      }}
    >
      {highlight && (
        <div
          style={{
            position:       'absolute',
            top:            12,
            right:          12,
            fontSize:       10,
            fontWeight:     700,
            letterSpacing:  '0.06em',
            textTransform:  'uppercase',
            padding:        '2px 8px',
            borderRadius:   5,
            background:     'rgba(99,102,241,0.2)',
            color:          'var(--accent-light)',
          }}
        >
          Recommended
        </div>
      )}
      <p
        style={{
          fontSize:      11,
          fontWeight:    700,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color:         highlight ? 'var(--accent-light)' : 'var(--fg-subtle)',
          margin:        '0 0 3px',
        }}
      >
        {title}
      </p>
      <p style={{ fontSize: 11, color: 'var(--fg-subtle)', margin: '0 0 16px' }}>{subtitle}</p>
      <p
        style={{
          fontSize:      26,
          fontWeight:    800,
          letterSpacing: '-0.03em',
          color:         'var(--fg)',
          margin:        '0 0 4px',
          lineHeight:    1.1,
        }}
      >
        {formatDate(date)}
      </p>
      <p
        style={{
          fontSize:   13,
          color:      highlight ? 'var(--accent-light)' : 'var(--fg-muted)',
          margin:     '0 0 16px',
          fontWeight: 500,
        }}
      >
        {formatWeeks(weeks)} from now
      </p>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <p style={{ fontSize: 11, color: 'var(--fg-subtle)', margin: 0 }}>
          {pct}% of simulations finish by this date
        </p>
      </div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ForecastPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const [data,         setData]         = useState<ForecastResult | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [showInfo,     setShowInfo]     = useState(false);
  const [pendingSize,  setPendingSize]  = useState(10);
  const [pendingWeeks, setPendingWeeks] = useState(12);

  const runForecast = useCallback(
    async (size: number, weeks: number) => {
      setLoading(true);
      try {
        const result = await analyticsService.getForecast(projectId, size, weeks);
        setData(result);
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    runForecast(10, 12);
  }, [runForecast]);

  const chartData = (data?.histogram ?? []).map((h) => ({
    ...h,
    dateLabel: weekToDateLabel(h.week),
  }));

  const throughputData = (data?.weeklyThroughputs ?? []).map((v, i) => ({
    week:  i + 1,
    count: v,
  }));

  const p50Label = chartData.find((h) => h.week === data?.p50Weeks)?.dateLabel;
  const p85Label = chartData.find((h) => h.week === data?.p85Weeks)?.dateLabel;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
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
          When will we finish?
        </h2>
        <p style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 5 }}>
          Monte Carlo simulation — 10,000 possible futures based on your team&apos;s historical delivery rate
        </p>
      </div>

      {/* Controls */}
      <div
        className="card"
        style={{ display: 'flex', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}
      >
        <div>
          <label
            style={{
              fontSize:      11,
              fontWeight:    600,
              color:         'var(--fg-subtle)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              display:       'block',
              marginBottom:  6,
            }}
          >
            Backlog size
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="number"
              min={1}
              max={500}
              value={pendingSize}
              onChange={(e) =>
                setPendingSize(Math.max(1, parseInt(e.target.value, 10) || 1))
              }
              style={{
                width:       72,
                background:  'var(--surface-2)',
                border:      '1px solid var(--border)',
                borderRadius: 8,
                color:       'var(--fg)',
                fontSize:    18,
                fontWeight:  700,
                padding:     '7px 10px',
                textAlign:   'center',
              }}
            />
            <span style={{ fontSize: 13, color: 'var(--fg-muted)' }}>issues to complete</span>
          </div>
        </div>

        <div>
          <label
            style={{
              fontSize:      11,
              fontWeight:    600,
              color:         'var(--fg-subtle)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              display:       'block',
              marginBottom:  6,
            }}
          >
            Historical window
          </label>
          <select
            value={pendingWeeks}
            onChange={(e) => setPendingWeeks(parseInt(e.target.value, 10))}
            style={{
              background:   'var(--surface-2)',
              border:       '1px solid var(--border)',
              borderRadius:  8,
              color:        'var(--fg)',
              fontSize:     13,
              padding:      '8px 12px',
              appearance:   'none',
              cursor:       'pointer',
            }}
          >
            {HISTORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => runForecast(pendingSize, pendingWeeks)}
          disabled={loading}
          style={{
            padding:      '9px 22px',
            borderRadius:  9,
            background:   loading
              ? 'rgba(99,102,241,0.4)'
              : 'linear-gradient(135deg, #6366f1 0%, #a78bfa 100%)',
            color:        '#fff',
            fontWeight:   600,
            fontSize:     13,
            border:       'none',
            cursor:       loading ? 'not-allowed' : 'pointer',
            boxShadow:    '0 2px 12px rgba(99,102,241,0.3)',
            letterSpacing: '-0.01em',
            whiteSpace:   'nowrap',
            transition:   'opacity 140ms ease',
          }}
        >
          {loading ? 'Simulating…' : 'Run Forecast'}
        </button>

        {data && !loading && (
          <p style={{ fontSize: 12, color: 'var(--fg-subtle)', marginLeft: 'auto' }}>
            Avg throughput:{' '}
            <strong style={{ color: 'var(--fg)' }}>
              {data.avgWeeklyThroughput} issues / week
            </strong>
            &nbsp;·&nbsp;{data.simulations.toLocaleString()} simulations
          </p>
        )}
      </div>

      {/* Insufficient data warning */}
      {data?.insufficient && (
        <div
          style={{
            padding:      '16px 20px',
            borderRadius:  12,
            background:   'rgba(245,158,11,0.07)',
            border:       '1px solid rgba(245,158,11,0.2)',
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 600, color: '#fcd34d', margin: 0 }}>
            Not enough historical data
          </p>
          <p style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 4 }}>
            At least 2 weeks with completed issues are needed to run a Monte Carlo simulation.
            Complete more issues or expand the historical window.
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="skeleton" style={{ height: 130, borderRadius: 14 }} />
          <div className="skeleton" style={{ height: 290, borderRadius: 14 }} />
          <div className="skeleton" style={{ height: 180, borderRadius: 14 }} />
        </div>
      )}

      {/* Results */}
      {data && !data.insufficient && !loading && (
        <>
          {/* Confidence cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <ConfCard
              title="Most likely"
              subtitle="Median estimate — 50% confidence"
              weeks={data.p50Weeks}
              date={data.p50Date}
              pct={50}
            />
            <ConfCard
              title="Safe to commit"
              subtitle="85% confidence"
              weeks={data.p85Weeks}
              date={data.p85Date}
              pct={85}
              highlight
            />
            <ConfCard
              title="Near-certain"
              subtitle="95% confidence"
              weeks={data.p95Weeks}
              date={data.p95Date}
              pct={95}
              cardStyle={{
                borderColor: 'rgba(245,158,11,0.25)',
                background:  'rgba(245,158,11,0.03)',
              }}
            />
          </div>

          {/* Probability curve */}
          <div className="card">
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', margin: '0 0 4px' }}>
              Probability of completion by date
            </p>
            <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '0 0 20px' }}>
              Cumulative — each point shows the chance of finishing your entire backlog by that week
            </p>
            <ResponsiveContainer width="100%" height={270}>
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 40, bottom: 20, left: 0 }}

              >
                <defs>
                  <linearGradient id="probGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.38} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="dateLabel"
                  tick={{ fontSize: 10, fill: 'var(--fg-subtle)' }}
                  stroke="var(--border)"
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                  tick={{ fontSize: 10, fill: 'var(--fg-subtle)' }}
                  stroke="var(--border)"
                  width={40}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload as NonNullable<typeof chartData>[number];
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
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)', margin: '0 0 4px' }}>
                          Week {d.week} · {label}
                        </p>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#818cf8', margin: '0 0 2px' }}>
                          {d.cumPct.toFixed(1)}% chance of being done
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--fg-subtle)', margin: 0 }}>
                          {d.pct.toFixed(1)}% of simulations finish exactly this week
                        </p>
                      </div>
                    );
                  }}
                />
                {/* Horizontal confidence reference lines */}
                <ReferenceLine
                  y={50}
                  stroke="#94a3b8"
                  strokeDasharray="4 3"
                  strokeWidth={1}
                  label={{ value: 'P50', fill: '#94a3b8', fontSize: 10, position: 'insideRight' }}
                />
                <ReferenceLine
                  y={85}
                  stroke="#818cf8"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={{ value: 'P85', fill: '#818cf8', fontSize: 10, position: 'insideRight' }}
                />
                <ReferenceLine
                  y={95}
                  stroke="#f59e0b"
                  strokeDasharray="4 3"
                  strokeWidth={1}
                  label={{ value: 'P95', fill: '#f59e0b', fontSize: 10, position: 'insideRight' }}
                />
                {/* Vertical reference lines for P50/P85 dates */}
                {p50Label && (
                  <ReferenceLine
                    x={p50Label}
                    stroke="#94a3b8"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                  />
                )}
                {p85Label && (
                  <ReferenceLine
                    x={p85Label}
                    stroke="#818cf8"
                    strokeDasharray="3 3"
                    strokeWidth={1.5}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="cumPct"
                  stroke="#818cf8"
                  strokeWidth={2.5}
                  fill="url(#probGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#818cf8', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Historical throughput */}
          <div className="card">
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', margin: '0 0 4px' }}>
              Historical weekly throughput
            </p>
            <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '0 0 20px' }}>
              Issues completed per week — the raw data powering the simulation
            </p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                data={throughputData}
                margin={{ top: 5, right: 40, bottom: 5, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="week"
                  tickFormatter={(v: number) => `Wk ${v}`}
                  tick={{ fontSize: 10, fill: 'var(--fg-subtle)' }}
                  stroke="var(--border)"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--fg-subtle)' }}
                  stroke="var(--border)"
                  allowDecimals={false}
                  width={32}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    return (
                      <div
                        style={{
                          background:   'var(--surface-3)',
                          border:       '1px solid var(--border)',
                          borderRadius:  8,
                          padding:      '8px 12px',
                        }}
                      >
                        <p style={{ fontSize: 12, color: 'var(--fg)', margin: 0 }}>
                          <strong>{payload[0].value as number}</strong> issues completed
                        </p>
                      </div>
                    );
                  }}
                />
                <ReferenceLine
                  y={data.avgWeeklyThroughput}
                  stroke="#6366f1"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={{
                    value:    `avg ${data.avgWeeklyThroughput}`,
                    fill:     '#818cf8',
                    fontSize: 10,
                    position: 'insideRight',
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="#6366f1"
                  fillOpacity={0.72}
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* How it works */}
      <div className="card">
        <button
          onClick={() => setShowInfo(!showInfo)}
          style={{
            display:    'flex',
            alignItems: 'center',
            gap:        8,
            background: 'none',
            border:     'none',
            cursor:     'pointer',
            padding:    0,
            width:      '100%',
          }}
        >
          <Info size={14} style={{ color: 'var(--fg-subtle)', flexShrink: 0 }} />
          <span
            style={{
              fontSize:   13,
              fontWeight: 600,
              color:      'var(--fg-muted)',
              flex:       1,
              textAlign:  'left',
            }}
          >
            How does Monte Carlo forecasting work?
          </span>
          {showInfo
            ? <ChevronUp   size={14} style={{ color: 'var(--fg-subtle)' }} />
            : <ChevronDown size={14} style={{ color: 'var(--fg-subtle)' }} />}
        </button>

        {showInfo && (
          <div
            style={{
              marginTop:   16,
              borderTop:   '1px solid var(--border)',
              paddingTop:  16,
              display:     'flex',
              flexDirection: 'column',
              gap:         12,
            }}
          >
            <p style={{ fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.65, margin: 0 }}>
              Instead of guessing a deadline, we simulate 10,000 different futures using your
              team&apos;s actual delivery history. Each simulation randomly samples weeks from
              the past and adds them up until the backlog is finished.
            </p>
            <p style={{ fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.65, margin: 0 }}>
              After 10,000 runs, we count how often we finished by each week — giving you a
              probability distribution rather than a single point estimate. Wider curves mean
              more variability in your team&apos;s delivery; narrower curves mean more predictability.
            </p>
            <div
              style={{
                display:             'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap:                 10,
                marginTop:           4,
              }}
            >
              {[
                {
                  icon: '📊',
                  title: 'P50 — Most likely',
                  body: "The median. Half your simulations finish before this date, half after. Don't commit to stakeholders at P50 — it's only a coin flip.",
                },
                {
                  icon: '⭐',
                  title: 'P85 — Safe to commit',
                  body: 'Your recommended commitment date. 85% of simulations finish here. Industry standard for probabilistic software forecasting.',
                },
                {
                  icon: '🎯',
                  title: 'P95 — Near-certain',
                  body: 'Use this when the cost of being late is very high. You accept only a 5% chance of missing it.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  style={{
                    padding:      '12px 14px',
                    background:   'var(--surface-2)',
                    borderRadius:  10,
                    border:       '1px solid var(--border)',
                  }}
                >
                  <p style={{ fontSize: 14, margin: '0 0 6px' }}>{item.icon}</p>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)', margin: '0 0 4px' }}>
                    {item.title}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--fg-muted)', lineHeight: 1.5, margin: 0 }}>
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
