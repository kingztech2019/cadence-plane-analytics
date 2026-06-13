'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { analyticsService } from '@/services/analyticsService';
import { BottleneckBar } from '@/components/charts/BottleneckBar';
import { FilterBar } from '@/components/shared/FilterBar';
import type { BottleneckReport, DashboardFilters, FlowCategory } from '@flow-analytics/shared';
import { AlertTriangle, CheckCircle2, Lightbulb } from 'lucide-react';

function fmt(hours: number): string {
  if (hours < 1)   return `${Math.round(hours * 60)} min`;
  if (hours < 24)  return `${Math.round(hours)} hours`;
  return `${(hours / 24).toFixed(1)} days`;
}

function getRecommendations(flowCategory: FlowCategory, stateName: string): string[] {
  switch (flowCategory) {
    case 'in_progress':
      return [
        'Check for blocked issues — teams often have invisible dependencies stalling active work.',
        'Review WIP limits — more than 2–3 items per person at once increases context switching.',
        'Look for issues with no recent activity; they may be stuck waiting on a decision.',
      ];
    case 'review':
      return [
        'Increase review frequency — same-day reviews prevent PR queues from building up.',
        'Reduce batch size — smaller pull requests get reviewed faster and with higher quality.',
        'Consider pairing on complex reviews; two reviewers often unblock each other faster.',
      ];
    case 'todo':
      return [
        'Improve ticket definition before moving to todo — unclear acceptance criteria cause pick-up delays.',
        'Limit the "ready to start" queue — a shorter, clearer queue gets picked up sooner.',
        'Check for hidden blockers; todo items often stall while waiting for design or specs.',
      ];
    case 'backlog':
      return [
        'Prioritise and trim the backlog regularly — a smaller, well-ordered backlog is more actionable.',
        'Add detail to high-priority items so they can move to todo without extra refinement.',
        'Check if items are waiting on external decisions or dependencies before they can be pulled.',
      ];
    case 'done':
      return [
        'Issues are piling up after completion — ensure finished work is deployed or released promptly.',
        'If items sit in Done for more than a day, add an automated release gate or deployment step.',
        'Check if final acceptance or sign-off is creating a bottleneck at the end of the workflow.',
      ];
    default:
      return [
        `Issues spend disproportionate time in "${stateName}" — investigate what causes the delay.`,
        'Look for handoff friction: unclear owners, missing notifications, or dependency on external teams.',
        'Consider adding a WIP limit or time-box to surface stalls earlier.',
      ];
  }
}

export default function BottleneckPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [data,    setData]    = useState<BottleneckReport | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    analyticsService.getBottleneck(projectId, filters).then((d) => { setData(d); setLoading(false); });
  }, [projectId, filters]);

  const bottleneck = data?.states.find((s) => s.stateId === data.bottleneckStateId);

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
            Where are issues getting stuck?
          </h2>
          <p style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 5 }}>
            The stage where issues wait the longest before moving forward
          </p>
        </div>
        <FilterBar filters={filters} onChange={setFilters} projectId={projectId} />
      </div>

      {/* Bottleneck callout */}
      {!loading && bottleneck ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Alert strip */}
          <div
            style={{
              padding: '14px 18px',
              borderRadius: 12,
              background: data!.persistencePeriods >= 3
                ? 'rgba(239,68,68,0.07)'
                : 'rgba(245,158,11,0.07)',
              border: data!.persistencePeriods >= 3
                ? '1px solid rgba(239,68,68,0.25)'
                : '1px solid rgba(245,158,11,0.22)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
              <AlertTriangle
                size={15}
                style={{
                  color: data!.persistencePeriods >= 3 ? '#f87171' : '#fcd34d',
                  flexShrink: 0,
                  marginTop: 1,
                }}
              />
              <div>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: data!.persistencePeriods >= 3 ? '#f87171' : '#fcd34d',
                    margin: 0,
                  }}
                >
                  {data!.persistencePeriods >= 3
                    ? <>Critical: <strong>{bottleneck.stateName}</strong> has been the bottleneck for {data!.persistencePeriods} consecutive 30-day periods — average wait {fmt(bottleneck.avgHours)}</>
                    : data!.persistencePeriods === 2
                    ? <>Issues have been stuck in <strong>{bottleneck.stateName}</strong> for 2 consecutive 30-day windows — average wait {fmt(bottleneck.avgHours)}</>
                    : <>Issues are getting stuck in <strong>{bottleneck.stateName}</strong> — average wait {fmt(bottleneck.avgHours)}</>
                  }
                </p>
                {data!.persistencePeriods >= 2 && (
                  <p style={{ fontSize: 11, color: 'var(--fg-subtle)', margin: '4px 0 0' }}>
                    This pattern has persisted across multiple measurement windows — consider a structural fix.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div
            style={{
              padding: '14px 18px',
              borderRadius: 12,
              background: 'var(--surface)',
              border: data!.persistencePeriods >= 3
                ? '1px solid rgba(239,68,68,0.18)'
                : '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              <Lightbulb
                size={13}
                style={{ color: data!.persistencePeriods >= 3 ? '#f87171' : '#a78bfa', flexShrink: 0 }}
              />
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--fg-subtle)', margin: 0 }}>
                {data!.persistencePeriods >= 3 ? 'Urgent actions — persistent bottleneck' : 'Suggested actions'}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {getRecommendations(bottleneck.flowCategory, bottleneck.stateName).map((rec, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div
                    style={{
                      width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                      background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 800, color: '#a78bfa', marginTop: 1,
                    }}
                  >
                    {i + 1}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: 0, lineHeight: 1.55 }}>
                    {rec}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : !loading && data?.states.length ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '12px 18px',
            borderRadius: 12,
            background: 'rgba(34,197,94,0.07)',
            border: '1px solid rgba(34,197,94,0.2)',
          }}
        >
          <CheckCircle2 size={15} style={{ color: '#86efac' }} />
          <p style={{ fontSize: 13, color: '#86efac', margin: 0 }}>
            No major bottlenecks detected — work is flowing evenly across all stages.
          </p>
        </div>
      ) : null}

      {/* Chart */}
      <div className="card">
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: 'var(--fg-subtle)',
            marginBottom: 4,
          }}
        >
          Wait time per stage
        </p>
        <p style={{ fontSize: 12, color: 'var(--fg-subtle)', marginBottom: 20 }}>
          The highlighted bar is where issues wait the longest before moving on
        </p>
        {loading ? (
          <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>Loading…</p>
          </div>
        ) : data && data.states.length > 0 ? (
          <BottleneckBar states={data.states} bottleneckId={data.bottleneckStateId} />
        ) : (
          <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>No data yet</p>
          </div>
        )}
      </div>

      {/* Stage breakdown */}
      {!loading && data && data.states.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: 'var(--fg-subtle)',
              marginBottom: 10,
            }}
          >
            Stage breakdown
          </p>
          {data.states.map((s) => {
            const worst = s.stateId === data.bottleneckStateId;
            return (
              <div
                key={s.stateId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  borderRadius: 10,
                  background: worst ? 'rgba(245,158,11,0.06)' : 'var(--surface-2)',
                  border: `1px solid ${worst ? 'rgba(245,158,11,0.2)' : 'var(--border-muted)'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {worst && <AlertTriangle size={12} style={{ color: '#fcd34d' }} />}
                  <span style={{ fontSize: 13, fontWeight: 500, color: worst ? '#fcd34d' : 'var(--fg)' }}>
                    {s.stateName}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 13, color: 'var(--fg-muted)' }}>
                  <span>avg <strong style={{ color: 'var(--fg)' }}>{fmt(s.avgHours)}</strong></span>
                  <span>
                    slowest <strong style={{ color: worst ? '#fcd34d' : 'var(--fg)' }}>{fmt(s.p85Hours)}</strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
