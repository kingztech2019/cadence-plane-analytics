'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { analyticsService } from '@/services/analyticsService';
import type { ScopeCreepResult, ScopeSprint } from '@flow-analytics/shared';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell, Legend,
} from 'recharts';
import { GitMerge, AlertTriangle, CheckCircle2 } from 'lucide-react';

// ─── helpers ──────────────────────────────────────────────────────────────────

function shortName(name: string, max = 10): string {
  return name.length > max ? name.slice(0, max - 1) + '…' : name;
}

function fmtDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end   + 'T00:00:00');
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}`;
}

function creepColor(pct: number): string {
  if (pct > 30) return '#ef4444';
  if (pct > 15) return '#f59e0b';
  return '#22c55e';
}

const LIMIT_OPTIONS = [
  { label: 'Last 3 sprints',  value: 3  },
  { label: 'Last 6 sprints',  value: 6  },
  { label: 'Last 10 sprints', value: 10 },
  { label: 'All sprints',     value: 50 },
];

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ScopeCreepPage() {
  const params    = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [data,    setData]    = useState<ScopeCreepResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [limit,   setLimit]   = useState(8);

  useEffect(() => {
    setLoading(true);
    analyticsService
      .getScopeCreep(projectId, limit)
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectId, limit]);

  const sprints    = data?.sprints ?? [];
  const withItems  = sprints.filter((s) => s.totalItems > 0);

  const chartData = withItems.map((s) => ({
    name:      shortName(s.cycleName),
    committed: s.committedItems,
    added:     s.addedDuringItems,
    pct:       s.scopeCreepPct,
    total:     s.totalItems,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
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
            <GitMerge size={18} style={{ color: '#8b5cf6' }} />
            Scope Creep
          </h2>
          <p style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 5 }}>
            How much work was added mid-sprint vs committed at the start. &gt;30% is the #1 predictor of missed goals.
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
          {LIMIT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 90, flex: 1, borderRadius: 13 }} />)}
          </div>
          <div className="skeleton" style={{ height: 240, borderRadius: 14 }} />
        </div>
      )}

      {!loading && sprints.length === 0 && (
        <div style={{ padding: '48px 24px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'center' }}>
          <GitMerge size={28} style={{ color: 'var(--fg-subtle)', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)', margin: '0 0 6px' }}>No sprint data yet</p>
          <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: 0 }}>
            Create cycles in Plane and sync to see scope creep tracked per sprint.
          </p>
        </div>
      )}

      {!loading && sprints.length > 0 && withItems.length === 0 && (
        <div style={{ padding: '48px 24px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'center' }}>
          <GitMerge size={28} style={{ color: 'var(--fg-subtle)', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)', margin: '0 0 6px' }}>Sprints found — no completed items yet</p>
          <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: '0 auto', maxWidth: 380 }}>
            {sprints.length} sprint{sprints.length !== 1 ? 's' : ''} synced but none have completed work items in their date range.
            Scope creep is calculated from items completed within each sprint&apos;s start and end dates.
          </p>
        </div>
      )}

      {!loading && withItems.length > 0 && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              {
                label:  'Avg scope creep',
                value:  `${data!.avgScopeCreepPct.toFixed(1)}%`,
                sub:    'across analysed sprints',
                accent: creepColor(data!.avgScopeCreepPct),
              },
              {
                label:  'High-creep sprints',
                value:  `${data!.highCreepCount}`,
                sub:    'sprints with >30% creep',
                accent: data!.highCreepCount > 0 ? '#ef4444' : '#22c55e',
              },
              {
                label:  'Total sprints',
                value:  `${withItems.length}`,
                sub:    'analysed',
              },
              {
                label:  'Danger threshold',
                value:  '30%',
                sub:    '>30% predicts missed goals',
                accent: '#f59e0b',
              },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  padding:      '16px 20px',
                  borderRadius:  13,
                  background:   'var(--surface)',
                  border:       `1px solid ${s.accent ? `${s.accent}44` : 'var(--border)'}`,
                  flex:          1,
                  minWidth:      130,
                }}
              >
                <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: s.accent ?? 'var(--fg-subtle)', margin: '0 0 6px' }}>
                  {s.label}
                </p>
                <p style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', color: s.accent ?? 'var(--fg)', margin: 0, lineHeight: 1 }}>
                  {s.value}
                </p>
                <p style={{ fontSize: 11, color: 'var(--fg-subtle)', margin: '4px 0 0' }}>{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Stacked bar chart */}
          <div className="card">
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', margin: '0 0 4px' }}>
              Committed vs mid-sprint additions
            </p>
            <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '0 0 6px' }}>
              Blue = items present at sprint start &nbsp;·&nbsp; Orange = items added after sprint started
            </p>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              {[
                { color: '#6366f1', label: 'Committed at start' },
                { color: '#f97316', label: 'Added mid-sprint'   },
              ].map((l) => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: l.color }} />
                  <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{l.label}</span>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} stroke="var(--border)" />
                <YAxis tick={{ fontSize: 10, fill: 'var(--fg-subtle)' }} stroke="var(--border)" width={28} allowDecimals={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const row = chartData.find((d) => d.name === label);
                    return (
                      <div style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', minWidth: 180 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg)', margin: '0 0 8px' }}>{label}</p>
                        <p style={{ fontSize: 12, color: '#818cf8', margin: '2px 0' }}>Committed: {row?.committed}</p>
                        <p style={{ fontSize: 12, color: '#f97316', margin: '2px 0' }}>Added mid-sprint: {row?.added}</p>
                        <p style={{ fontSize: 12, fontWeight: 700, color: creepColor(row?.pct ?? 0), margin: '6px 0 0' }}>
                          Scope creep: {row?.pct?.toFixed(1)}%
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="committed" stackId="a" fill="#6366f1" fillOpacity={0.7} radius={[0, 0, 4, 4]} />
                <Bar dataKey="added"     stackId="a" fill="#f97316" fillOpacity={0.8} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Scope creep % line chart */}
          <div className="card">
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', margin: '0 0 4px' }}>
              Scope creep % per sprint
            </p>
            <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '0 0 20px' }}>
              The danger zone is above 30%
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} stroke="var(--border)" />
                <YAxis tick={{ fontSize: 10, fill: 'var(--fg-subtle)' }} stroke="var(--border)" tickFormatter={(v: number) => `${v}%`} width={36} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.[0]) return null;
                    const pct = payload[0].value as number;
                    return (
                      <div style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)', margin: '0 0 4px' }}>{label}</p>
                        <p style={{ fontSize: 13, fontWeight: 700, color: creepColor(pct), margin: 0 }}>
                          {pct.toFixed(1)}% scope creep
                        </p>
                      </div>
                    );
                  }}
                />
                <ReferenceLine
                  y={30}
                  stroke="#ef4444"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={{ value: 'Danger 30%', fill: '#f87171', fontSize: 10, position: 'insideTopRight' }}
                />
                <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                  {chartData.map((d) => (
                    <Cell key={d.name} fill={creepColor(d.pct)} fillOpacity={0.75} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div className="card">
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', margin: '0 0 16px' }}>Sprint detail</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Sprint', 'Dates', 'Total', 'Committed', 'Added mid-sprint', 'Scope creep', ''].map((col) => (
                      <th
                        key={col}
                        style={{
                          textAlign: 'left', padding: '6px 12px',
                          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
                          color: 'var(--fg-subtle)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...withItems].reverse().map((sprint) => {
                    const color = creepColor(sprint.scopeCreepPct);
                    const high  = sprint.scopeCreepPct > 30;
                    return (
                      <tr key={sprint.cycleId}>
                        <td style={{ padding: '9px 12px', color: 'var(--fg)', fontWeight: 500, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                          {sprint.cycleName}
                        </td>
                        <td style={{ padding: '9px 12px', color: 'var(--fg-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                          {fmtDateRange(sprint.startDate, sprint.endDate)}
                        </td>
                        <td style={{ padding: '9px 12px', color: 'var(--fg)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>
                          {sprint.totalItems}
                        </td>
                        <td style={{ padding: '9px 12px', color: '#818cf8', borderBottom: '1px solid var(--border)' }}>
                          {sprint.committedItems}
                        </td>
                        <td style={{ padding: '9px 12px', color: '#f97316', borderBottom: '1px solid var(--border)' }}>
                          {sprint.addedDuringItems}
                        </td>
                        <td style={{ padding: '9px 12px', fontWeight: 700, color, borderBottom: '1px solid var(--border)' }}>
                          {sprint.scopeCreepPct.toFixed(1)}%
                        </td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)' }}>
                          {high
                            ? <AlertTriangle size={13} style={{ color: '#ef4444' }} />
                            : <CheckCircle2 size={13} style={{ color: '#22c55e' }} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p style={{ fontSize: 11, color: 'var(--fg-subtle)', margin: 0, lineHeight: 1.6 }}>
            Items are classified as &ldquo;added mid-sprint&rdquo; when their creation date falls after the sprint start date.
            This is a proxy — items created before the sprint but added to it later are counted as committed.
          </p>
        </>
      )}
    </div>
  );
}
