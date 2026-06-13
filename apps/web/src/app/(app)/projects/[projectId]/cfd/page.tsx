'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { analyticsService } from '@/services/analyticsService';
import { CumulativeFlowChart } from '@/components/charts/CumulativeFlowChart';
import { FilterBar } from '@/components/shared/FilterBar';
import type { CfdSeries, DashboardFilters } from '@flow-analytics/shared';
import { Info } from 'lucide-react';

function cfdInsight(data: CfdSeries) {
  if (!data.dates.length || !data.series.length) return null;

  const lastIdx  = data.dates.length - 1;
  const firstIdx = 0;

  const totalLast  = data.series.reduce((sum, s) => sum + (s.data[lastIdx] ?? 0), 0);
  const totalFirst = data.series.reduce((sum, s) => sum + (s.data[firstIdx] ?? 0), 0);
  const growth = totalLast - totalFirst;

  const biggestState = data.series.reduce((best, s) =>
    (s.data[lastIdx] ?? 0) > (best.data[lastIdx] ?? 0) ? s : best
  );

  const lastDate  = new Date(data.dates[lastIdx]!).toLocaleDateString('en', { month: 'short', day: 'numeric' });
  const firstDate = new Date(data.dates[firstIdx]!).toLocaleDateString('en', { month: 'short', day: 'numeric' });

  return { totalLast, growth, biggestState, lastDate, firstDate };
}

export default function CfdPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [data,    setData]    = useState<CfdSeries | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>({
    dateFrom: new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10),
    dateTo:   new Date().toISOString().slice(0, 10),
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    analyticsService.getCfd(projectId, filters).then((d) => { setData(d); setLoading(false); });
  }, [projectId, filters]);

  const ins = data ? cfdInsight(data) : null;

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
            How is work flowing through your team?
          </h2>
          <p style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 5 }}>
            How many issues are in each stage, day by day
          </p>
        </div>
        <FilterBar filters={filters} onChange={setFilters} projectId={projectId} showDateRange />
      </div>

      {/* Stat cards */}
      {!loading && ins && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div className="card-sm">
            <p className="stat-label" style={{ marginBottom: 8 }}>Issues in system today</p>
            <p className="stat-number">{ins.totalLast}</p>
            <p style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 6 }}>across all stages</p>
          </div>
          <div className="card-sm">
            <p className="stat-label" style={{ marginBottom: 8 }}>Change since {ins.firstDate}</p>
            <p
              className="stat-number"
              style={{ color: ins.growth > 0 ? '#fcd34d' : '#86efac' }}
            >
              {ins.growth > 0 ? `+${ins.growth}` : ins.growth}
            </p>
            <p style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 6 }}>
              {ins.growth > 0 ? 'backlog is growing' : ins.growth < 0 ? 'more being closed' : 'stable'}
            </p>
          </div>
          <div className="card-sm">
            <p className="stat-label" style={{ marginBottom: 8 }}>Most issues currently in</p>
            <p
              className="stat-number"
              style={{ fontSize: '1.4rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {ins.biggestState?.stateName ?? '—'}
            </p>
            <p style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 6 }}>
              {ins.biggestState
                ? `${ins.biggestState.data[data!.dates.length - 1]} issues`
                : ''}
            </p>
          </div>
        </div>
      )}

      {/* How to read */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          padding: '12px 16px',
          borderRadius: 11,
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
        }}
      >
        <Info size={13} style={{ color: 'var(--fg-subtle)', marginTop: 1, flexShrink: 0 }} />
        <p style={{ fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.6, margin: 0 }}>
          <strong style={{ color: 'var(--fg)' }}>How to read this:</strong>{' '}
          Each coloured band is a stage in your workflow. A band that grows wider means issues are piling up there.
          Ideally the &ldquo;Done&rdquo; band should grow steadily over time.
        </p>
      </div>

      {/* Chart */}
      <div className="card">
        {loading ? (
          <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>Loading…</p>
          </div>
        ) : data && data.dates.length > 0 ? (
          <CumulativeFlowChart data={data} />
        ) : (
          <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>No data for this period</p>
          </div>
        )}
      </div>
    </div>
  );
}
