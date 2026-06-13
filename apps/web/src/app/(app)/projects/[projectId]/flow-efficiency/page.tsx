'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { analyticsService } from '@/services/analyticsService';
import type { FlowEfficiencyReport, FlowEfficiencyItem } from '@flow-analytics/shared';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts';
import { Zap, Info } from 'lucide-react';

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(hours: number): string {
  if (hours < 1)   return `${Math.round(hours * 60)}m`;
  if (hours < 24)  return `${Math.round(hours)}h`;
  if (hours < 168) return `${(hours / 24).toFixed(1)}d`;
  return `${(hours / 168).toFixed(1)}w`;
}

function effColor(pct: number): string {
  if (pct >= 25) return '#22c55e';
  if (pct >= 10) return '#f59e0b';
  return '#ef4444';
}

// Build histogram buckets
const BUCKETS = [
  { label: '0–5%',   min: 0,   max: 5   },
  { label: '5–10%',  min: 5,   max: 10  },
  { label: '10–15%', min: 10,  max: 15  },
  { label: '15–25%', min: 15,  max: 25  },
  { label: '25–40%', min: 25,  max: 40  },
  { label: '40–60%', min: 40,  max: 60  },
  { label: '60%+',   min: 60,  max: 101 },
];

function buildHistogram(items: FlowEfficiencyItem[]) {
  return BUCKETS.map((b) => ({
    label: b.label,
    count: items.filter((i) => i.efficiencyPct >= b.min && i.efficiencyPct < b.max).length,
    min:   b.min,
  }));
}

// ─── stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label:  string;
  value:  string;
  sub?:   string;
  accent?: string;
}) {
  return (
    <div
      style={{
        padding:      '16px 20px',
        borderRadius:  13,
        background:   'var(--surface)',
        border:       `1px solid ${accent ? `${accent}44` : 'var(--border)'}`,
        flex:          1,
        minWidth:      130,
      }}
    >
      <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: accent ?? 'var(--fg-subtle)', margin: '0 0 6px' }}>
        {label}
      </p>
      <p style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', color: accent ?? 'var(--fg)', margin: 0, lineHeight: 1 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 11, color: 'var(--fg-subtle)', margin: '4px 0 0' }}>{sub}</p>}
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function FlowEfficiencyPage() {
  const params    = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [data,    setData]    = useState<FlowEfficiencyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setLoading(true);
    analyticsService
      .getFlowEfficiency(projectId)
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectId]);

  const histogram = data ? buildHistogram(data.items) : [];
  const gap       = data ? data.medianEfficiencyPct - data.industryBenchmarkPct : 0;
  const items     = data?.items ?? [];
  const sorted    = [...items].sort((a, b) => b.efficiencyPct - a.efficiencyPct);
  const displayed = showAll ? sorted : sorted.slice(0, 20);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <h2
          style={{
            fontSize:      20,
            fontWeight:    800,
            color:        'var(--fg)',
            letterSpacing: '-0.02em',
            margin:         0,
            display:       'flex',
            alignItems:    'center',
            gap:            8,
          }}
        >
          <Zap size={18} style={{ color: '#f59e0b' }} />
          Flow Efficiency
        </h2>
        <p style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 5 }}>
          What % of each issue&apos;s total lifetime was spent actively being worked on
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 90, flex: 1, borderRadius: 13 }} />)}
          </div>
          <div className="skeleton" style={{ height: 220, borderRadius: 14 }} />
        </div>
      )}

      {!loading && data && data.items.length === 0 && (
        <div
          style={{
            padding:      '48px 24px',
            borderRadius:  14,
            border:       '1px solid var(--border)',
            background:   'var(--surface)',
            textAlign:    'center',
          }}
        >
          <Zap size={28} style={{ color: 'var(--fg-subtle)', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)', margin: '0 0 6px' }}>
            Not enough data yet
          </p>
          <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: 0 }}>
            Flow efficiency requires completed issues with full state history. Keep shipping!
          </p>
        </div>
      )}

      {!loading && data && data.items.length > 0 && (
        <>
          {/* Summary stats */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <StatCard
              label="Your median efficiency"
              value={`${data.medianEfficiencyPct.toFixed(1)}%`}
              sub={`${data.items.length} issues analysed`}
              accent={effColor(data.medianEfficiencyPct)}
            />
            <StatCard
              label="Industry average"
              value={`${data.industryBenchmarkPct}%`}
              sub="Most teams are at ~15%"
            />
            <StatCard
              label={gap >= 0 ? 'Above benchmark' : 'Below benchmark'}
              value={`${gap >= 0 ? '+' : ''}${gap.toFixed(1)}%`}
              sub={gap >= 0 ? 'Better than average' : 'Room for improvement'}
              accent={gap >= 0 ? '#22c55e' : '#ef4444'}
            />
            <StatCard
              label="Total active time"
              value={fmt(data.totalActiveHours)}
              sub={`vs ${fmt(data.totalWaitingHours)} waiting`}
            />
          </div>

          {/* Context callout */}
          <div
            style={{
              display:    'flex',
              gap:         10,
              padding:    '14px 18px',
              borderRadius: 12,
              background: 'rgba(99,102,241,0.07)',
              border:     '1px solid rgba(99,102,241,0.2)',
            }}
          >
            <Info size={15} style={{ color: 'var(--accent-light)', flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: 0, lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--fg)' }}>What is flow efficiency?</strong>
              {' '}For each issue: active time (in-progress + review) ÷ total lead time.
              The industry average is ~15%, meaning 85% of an issue&apos;s life is spent waiting —
              in backlog, todo, or queued for review. This is the metric that makes teams rethink their process.
            </p>
          </div>

          {/* Histogram */}
          <div className="card">
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', margin: '0 0 4px' }}>
              Efficiency distribution
            </p>
            <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '0 0 20px' }}>
              How your issues cluster across efficiency ranges
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={histogram} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} stroke="var(--border)" />
                <YAxis tick={{ fontSize: 10, fill: 'var(--fg-subtle)' }} stroke="var(--border)" width={28} allowDecimals={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.[0]) return null;
                    return (
                      <div style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)', margin: '0 0 2px' }}>{label}</p>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-light)', margin: 0 }}>
                          {payload[0].value as number} issues
                        </p>
                      </div>
                    );
                  }}
                />
                <ReferenceLine
                  x="10–15%"
                  stroke="#6366f1"
                  strokeDasharray="4 3"
                  label={{ value: 'Industry avg', fill: '#818cf8', fontSize: 10, position: 'insideTopRight' }}
                />
                <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                  {histogram.map((b) => (
                    <Cell key={b.label} fill={effColor(b.min + 1)} fillOpacity={0.75} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Issue table */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', margin: 0 }}>
                Per-issue breakdown
              </p>
              <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>Sorted: highest efficiency first</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Issue', 'Efficiency', 'Active time', 'Waiting time', 'Lead time', 'Efficiency bar'].map((col) => (
                      <th
                        key={col}
                        style={{
                          textAlign: 'left',
                          padding: '6px 12px',
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.07em',
                          color: 'var(--fg-subtle)',
                          borderBottom: '1px solid var(--border)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((item) => {
                    const color = effColor(item.efficiencyPct);
                    return (
                      <tr key={item.workItemId}>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', maxWidth: 240 }}>
                          <span style={{ fontSize: 10, color: 'var(--fg-subtle)', fontFamily: 'monospace', marginRight: 6 }}>#{item.sequenceId}</span>
                          <span style={{ color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: 180 }}>
                            {item.title}
                          </span>
                        </td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', fontWeight: 700, color }}>
                          {item.efficiencyPct.toFixed(1)}%
                        </td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', color: '#22c55e', fontWeight: 500 }}>
                          {fmt(item.activeHours)}
                        </td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', color: '#94a3b8', fontWeight: 500 }}>
                          {fmt(item.waitingHours)}
                        </td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', color: 'var(--fg-muted)' }}>
                          {fmt(item.leadTimeHours)}
                        </td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', minWidth: 120 }}>
                          <div style={{ height: 5, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${item.efficiencyPct}%`, borderRadius: 99, background: color, transition: 'width 400ms ease' }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {sorted.length > 20 && (
              <button
                onClick={() => setShowAll((s) => !s)}
                style={{
                  marginTop: 14,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 9,
                  color: 'var(--fg-muted)',
                  fontSize: 12,
                  fontWeight: 500,
                  padding: '8px 18px',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                {showAll ? 'Show fewer' : `Show all ${sorted.length} issues`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
