'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { analyticsService } from '@/services/analyticsService';
import { FilterBar } from '@/components/shared/FilterBar';
import type { ThroughputReport, DashboardFilters, AssigneeHealthResult } from '@flow-analytics/shared';
import { Trophy, AlertTriangle, Zap, RefreshCw } from 'lucide-react';

function fmt(hours: number | null): string {
  if (hours === null || hours === undefined) return '—';
  if (hours < 1)   return `${Math.round(hours * 60)}m`;
  if (hours < 24)  return `${Math.round(hours)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function Initials({ name }: { name: string }) {
  const letters = name.split(/[s._-]/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const hue = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: '50%',
        background: `hsl(${hue},45%,35%)`,
        border: `2px solid hsl(${hue},40%,45%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 700,
        color: '#fff',
        flexShrink: 0,
        letterSpacing: '0.02em',
      }}
    >
      {letters}
    </div>
  );
}

function speedBadge(p50: number | null): { label: string; color: string; bg: string } {
  if (p50 === null) return { label: 'no data', color: 'var(--fg-subtle)', bg: 'var(--surface-3)' };
  if (p50 < 8)   return { label: 'very fast', color: '#86efac', bg: 'rgba(34,197,94,0.1)' };
  if (p50 < 24)  return { label: 'fast',      color: '#86efac', bg: 'rgba(34,197,94,0.1)' };
  if (p50 < 72)  return { label: 'moderate',  color: 'var(--fg-muted)', bg: 'var(--surface-3)' };
  return           { label: 'slow',            color: '#fcd34d', bg: 'rgba(245,158,11,0.1)' };
}

function fmtH(hours: number): string {
  if (hours < 1)  return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export default function ThroughputPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [data,    setData]    = useState<ThroughputReport | null>(null);
  const [health,  setHealth]  = useState<AssigneeHealthResult | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      analyticsService.getThroughput(projectId, filters),
      analyticsService.getAssigneeHealth(projectId),
    ]).then(([d, h]) => {
      setData(d);
      setHealth(h);
      setLoading(false);
    });
  }, [projectId, filters]);

  const totalDone  = data?.assignees.reduce((s, a) => s + a.itemsCompleted, 0) ?? 0;
  const topPerson  = data?.assignees.length
    ? data.assignees.reduce((best, a) => a.itemsCompleted > best.itemsCompleted ? a : best)
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: 'var(--fg)',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            How is each team member doing?
          </h2>
          <p style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 5 }}>
            Issues completed and how long they typically take per person
          </p>
        </div>
        <FilterBar filters={filters} onChange={setFilters} projectId={projectId} />
      </div>

      {/* Summary cards */}
      {!loading && data && data.assignees.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <div className="card-sm">
            <p className="stat-label" style={{ marginBottom: 8 }}>Total issues completed</p>
            <p className="stat-number">{totalDone}</p>
            <p style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 6 }}>
              across {data.assignees.length} team member{data.assignees.length !== 1 ? 's' : ''}
            </p>
          </div>
          {topPerson && (
            <div
              className="card-sm"
              style={{ borderColor: 'rgba(252,211,77,0.25)', background: 'rgba(245,158,11,0.04)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Trophy size={12} style={{ color: '#fcd34d' }} />
                <p className="stat-label" style={{ margin: 0 }}>Most issues completed</p>
              </div>
              <p
                className="stat-number"
                style={{
                  fontSize: '1.5rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {topPerson.displayName}
              </p>
              <p style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 6 }}>
                {topPerson.itemsCompleted} issues done
              </p>
            </div>
          )}
        </div>
      )}

      {/* Team Health Flags */}
      {!loading && health && health.flaggedCount > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: 'var(--fg-subtle)',
              margin: 0,
            }}
          >
            Team health flags
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {health.entries
              .filter((e) => e.isOverloaded || e.isSlow || e.hasHighReactivation)
              .map((entry) => (
                <div
                  key={entry.assigneeId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    flexWrap: 'wrap',
                  }}
                >
                  <Initials name={entry.displayName} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', minWidth: 100, flex: 1 }}>
                    {entry.displayName}
                  </span>

                  {/* Flag badges */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {entry.isOverloaded && (
                      <span
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          fontSize: 11, fontWeight: 600,
                          color: '#f87171', background: 'rgba(239,68,68,0.1)',
                          border: '1px solid rgba(239,68,68,0.25)',
                          padding: '3px 9px', borderRadius: 6,
                        }}
                      >
                        <AlertTriangle size={10} />
                        Overloaded · {entry.currentWip} in progress
                      </span>
                    )}
                    {entry.isSlow && entry.p85Hours !== null && (
                      <span
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          fontSize: 11, fontWeight: 600,
                          color: '#fcd34d', background: 'rgba(245,158,11,0.1)',
                          border: '1px solid rgba(245,158,11,0.25)',
                          padding: '3px 9px', borderRadius: 6,
                        }}
                      >
                        <Zap size={10} />
                        Slow · P85 {fmtH(entry.p85Hours)}
                        {entry.teamP85 !== null && <span style={{ opacity: 0.75 }}> vs {fmtH(entry.teamP85)} team</span>}
                      </span>
                    )}
                    {entry.hasHighReactivation && (
                      <span
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          fontSize: 11, fontWeight: 600,
                          color: '#a78bfa', background: 'rgba(167,139,250,0.1)',
                          border: '1px solid rgba(167,139,250,0.25)',
                          padding: '3px 9px', borderRadius: 6,
                        }}
                      >
                        <RefreshCw size={10} />
                        High reactivation · {entry.reactivationRate.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* Table */}
      <div
        className="card"
        style={{ padding: 0, overflow: 'hidden' }}
      >
        {/* Header row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 72px 110px 100px',
            alignItems: 'center',
            padding: '10px 20px',
            background: 'var(--surface-3)',
            borderBottom: '1px solid var(--border)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: 'var(--fg-subtle)',
          }}
        >
          <span>Team member</span>
          <span style={{ textAlign: 'right' }}>Done</span>
          <span style={{ textAlign: 'right' }}>Typical time</span>
          <span style={{ textAlign: 'right' }}>Speed</span>
        </div>

        {loading ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>Loading…</p>
          </div>
        ) : !data?.assignees.length ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>No completed issues yet</p>
          </div>
        ) : (
          data.assignees
            .slice()
            .sort((a, b) => b.itemsCompleted - a.itemsCompleted)
            .map((a, i) => {
              const speed = speedBadge(a.p50CycleTimeHours);
              return (
                <div
                  key={a.assigneeId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 72px 110px 100px',
                    alignItems: 'center',
                    padding: '11px 20px',
                    borderTop: i > 0 ? '1px solid var(--border-muted)' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <Initials name={a.displayName} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>
                      {a.displayName}
                    </span>
                  </div>
                  <span
                    style={{
                      textAlign: 'right',
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--fg)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {a.itemsCompleted}
                  </span>
                  <span
                    style={{
                      textAlign: 'right',
                      fontSize: 13,
                      color: 'var(--fg-muted)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {fmt(a.p50CycleTimeHours)}
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: speed.color,
                        background: speed.bg,
                        padding: '3px 9px',
                        borderRadius: 6,
                        letterSpacing: '0.03em',
                      }}
                    >
                      {speed.label}
                    </span>
                  </div>
                </div>
              );
            })
        )}
      </div>

      {/* Legend */}
      <p style={{ fontSize: 12, color: 'var(--fg-subtle)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--fg)' }}>Typical time</strong> is the median — half that person&apos;s issues close faster than this number.{' '}
        <strong style={{ color: 'var(--fg)' }}>Speed</strong>: under 8h = very fast, 8–24h = fast, 24–72h = moderate, 72h+ = slow.
      </p>
    </div>
  );
}
