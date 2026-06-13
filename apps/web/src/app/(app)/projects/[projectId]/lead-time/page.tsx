'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { analyticsService } from '@/services/analyticsService';
import { FilterBar } from '@/components/shared/FilterBar';
import type { LeadTimeSummary, DashboardFilters } from '@flow-analytics/shared';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { Timer, TrendingDown, TrendingUp, Minus } from 'lucide-react';

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(hours: number): string {
  if (hours < 1)   return `${Math.round(hours * 60)}m`;
  if (hours < 24)  return `${Math.round(hours)}h`;
  if (hours < 168) return `${(hours / 24).toFixed(1)}d`;
  return `${(hours / 168).toFixed(1)}w`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function TrendPill({ current, prior }: { current: number; prior: number | null }) {
  if (prior === null || prior === 0) return null;
  const pct = Math.round(((current - prior) / prior) * 100);
  if (Math.abs(pct) < 2) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10, fontWeight: 600, color: 'var(--fg-subtle)', background: 'rgba(148,163,184,0.1)', padding: '2px 6px', borderRadius: 5 }}>
        <Minus size={8} /> 0%
      </span>
    );
  }
  const improved = pct < 0; // lower lead time = better
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 2,
        fontSize: 10, fontWeight: 600,
        color: improved ? '#22c55e' : '#ef4444',
        background: improved ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
        padding: '2px 6px', borderRadius: 5,
      }}
    >
      {improved ? <TrendingDown size={8} /> : <TrendingUp size={8} />}
      {improved ? '' : '+'}{pct}% vs prior 30d
    </span>
  );
}

function StatCard({
  label, value, sub, accent, trendNode,
}: {
  label: string; value: string; sub?: string; accent?: string; trendNode?: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: '16px 20px', borderRadius: 13, flex: 1, minWidth: 130,
        background: 'var(--surface)',
        border: `1px solid ${accent ? `${accent}44` : 'var(--border)'}`,
      }}
    >
      <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: accent ?? 'var(--fg-subtle)', margin: '0 0 6px' }}>
        {label}
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', color: accent ?? 'var(--fg)', margin: 0, lineHeight: 1 }}>
          {value}
        </p>
        {trendNode}
      </div>
      {sub && <p style={{ fontSize: 11, color: 'var(--fg-subtle)', margin: '4px 0 0' }}>{sub}</p>}
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

const TABLE_PAGE = 25;

export default function LeadTimePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [data,    setData]    = useState<LeadTimeSummary | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setLoading(true);
    analyticsService
      .getLeadTimeSummary(projectId, filters)
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectId, filters]);

  const items = data?.items ?? [];
  const stats = data?.stats;
  const prior = data?.prior ?? null;

  // Scatter chart data — x = completedAt (ms), y = lead time in days
  const scatterData = items
    .filter((i) => i.leadTimeHours !== null && i.completedAt !== null)
    .map((i) => ({
      x:     new Date(i.completedAt!).getTime(),
      y:     Math.round(((i.leadTimeHours ?? 0) / 24) * 10) / 10,
      title: i.title,
      seq:   i.sequenceId,
    }))
    .sort((a, b) => a.x - b.x);

  const p50d = stats ? stats.p50Hours / 24 : 0;
  const p85d = stats ? stats.p85Hours / 24 : 0;

  // Table: longest lead time first
  const sorted    = [...items].sort((a, b) => (b.leadTimeHours ?? 0) - (a.leadTimeHours ?? 0));
  const displayed = showAll ? sorted : sorted.slice(0, TABLE_PAGE);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2
            style={{
              fontSize: 20, fontWeight: 800, color: 'var(--fg)',
              letterSpacing: '-0.02em', margin: 0,
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <Timer size={18} style={{ color: '#818cf8' }} />
            Lead Time
          </h2>
          <p style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 5 }}>
            Time from issue creation to completion — the full customer-facing delivery window
          </p>
        </div>
        <FilterBar filters={filters} onChange={setFilters} projectId={projectId} />
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 90, flex: 1, borderRadius: 13 }} />
            ))}
          </div>
          <div className="skeleton" style={{ height: 260, borderRadius: 14 }} />
          <div className="skeleton" style={{ height: 200, borderRadius: 14 }} />
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div
          style={{
            padding: '48px 24px', borderRadius: 14,
            border: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'center',
          }}
        >
          <Timer size={28} style={{ color: 'var(--fg-subtle)', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)', margin: '0 0 6px' }}>
            No lead time data yet
          </p>
          <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: 0 }}>
            Lead time is calculated once issues are created and completed. Keep shipping!
          </p>
        </div>
      )}

      {!loading && items.length > 0 && stats && (
        <>
          {/* Stat cards */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <StatCard
              label="Typical lead time (P50)"
              value={fmt(stats.p50Hours)}
              sub={`Median of ${stats.count} issues`}
              accent="#818cf8"
              trendNode={<TrendPill current={stats.p50Hours} prior={prior?.p50Hours ?? null} />}
            />
            <StatCard
              label="Slowest 15% (P85)"
              value={fmt(stats.p85Hours)}
              sub="85th percentile"
              trendNode={<TrendPill current={stats.p85Hours} prior={prior?.p85Hours ?? null} />}
            />
            <StatCard
              label="Average lead time"
              value={fmt(stats.avgHours)}
              sub="Mean across all issues"
              trendNode={<TrendPill current={stats.avgHours} prior={prior?.avgHours ?? null} />}
            />
            <StatCard
              label="Issues analysed"
              value={stats.count.toString()}
              sub={prior ? `Prior 30d: ${prior.count} issues` : 'In selected period'}
            />
          </div>

          {/* Context note */}
          <div
            style={{
              padding: '12px 16px', borderRadius: 10,
              background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)',
              fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.6,
            }}
          >
            <strong style={{ color: 'var(--fg)' }}>Lead time vs cycle time:</strong> Cycle time measures how long
            active work takes (in-progress → done). Lead time measures the full customer experience
            (created → done), including backlog wait. A large gap between the two means issues wait
            a long time before anyone starts working on them.
          </div>

          {/* Scatter chart */}
          <div className="card">
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', margin: '0 0 4px' }}>
              Lead time over time
            </p>
            <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '0 0 20px' }}>
              Each dot is a completed issue — how long from creation to done, in days
            </p>
            <ResponsiveContainer width="100%" height={240}>
              <ScatterChart margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="x" type="number" scale="time" domain={['auto', 'auto']}
                  tickFormatter={(v: number) =>
                    new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  }
                  tick={{ fontSize: 10, fill: 'var(--fg-subtle)' }} stroke="var(--border)"
                />
                <YAxis
                  dataKey="y" name="Days" unit="d"
                  tick={{ fontSize: 10, fill: 'var(--fg-subtle)' }} stroke="var(--border)" width={36}
                />
                <ZAxis range={[28, 28]} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload as { title: string; seq: number; x: number; y: number };
                    return (
                      <div
                        style={{
                          background: 'var(--surface-3)', border: '1px solid var(--border)',
                          borderRadius: 10, padding: '10px 14px', maxWidth: 240,
                        }}
                      >
                        <p style={{ fontSize: 10, color: 'var(--fg-subtle)', margin: '0 0 2px', fontFamily: 'monospace' }}>#{d.seq}</p>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d.title}
                        </p>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#818cf8', margin: 0 }}>
                          {d.y}d lead time
                        </p>
                      </div>
                    );
                  }}
                />
                {p50d > 0 && (
                  <ReferenceLine
                    y={p50d}
                    stroke="#818cf8"
                    strokeDasharray="4 3"
                    label={{ value: `P50 ${fmt(stats.p50Hours)}`, fill: '#818cf8', fontSize: 10, position: 'insideTopRight' }}
                  />
                )}
                {p85d > 0 && (
                  <ReferenceLine
                    y={p85d}
                    stroke="#f59e0b"
                    strokeDasharray="4 3"
                    label={{ value: `P85 ${fmt(stats.p85Hours)}`, fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }}
                  />
                )}
                <Scatter data={scatterData} fill="#6366f1" fillOpacity={0.5} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Per-issue table */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', margin: 0 }}>
                Per-issue breakdown
              </p>
              <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>Longest lead time first</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Issue', 'Lead time', 'Cycle time', 'Completed', 'Bar'].map((col) => (
                      <th
                        key={col}
                        style={{
                          textAlign: 'left', padding: '6px 12px', fontSize: 10, fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--fg-subtle)',
                          borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((item) => {
                    const lt = item.leadTimeHours ?? 0;
                    const pct = stats.p85Hours > 0 ? Math.min((lt / stats.p85Hours) * 100, 100) : 0;
                    const barColor = lt > stats.p85Hours ? '#ef4444' : lt > stats.p50Hours ? '#f59e0b' : '#22c55e';
                    return (
                      <tr key={item.workItemId}>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', maxWidth: 260 }}>
                          <span style={{ fontSize: 10, color: 'var(--fg-subtle)', fontFamily: 'monospace', marginRight: 6 }}>
                            #{item.sequenceId}
                          </span>
                          <span style={{ color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: 200 }}>
                            {item.title}
                          </span>
                        </td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', fontWeight: 700, color: barColor, whiteSpace: 'nowrap' }}>
                          {fmt(lt)}
                        </td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>
                          {item.cycleTimeHours !== null ? fmt(item.cycleTimeHours) : '—'}
                        </td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', color: 'var(--fg-subtle)', whiteSpace: 'nowrap' }}>
                          {fmtDate(item.completedAt)}
                        </td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', minWidth: 100 }}>
                          <div style={{ height: 5, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: barColor, transition: 'width 400ms ease' }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {sorted.length > TABLE_PAGE && (
              <button
                onClick={() => setShowAll((s) => !s)}
                style={{
                  marginTop: 14, background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 9, color: 'var(--fg-muted)', fontSize: 12, fontWeight: 500,
                  padding: '8px 18px', cursor: 'pointer', width: '100%',
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
