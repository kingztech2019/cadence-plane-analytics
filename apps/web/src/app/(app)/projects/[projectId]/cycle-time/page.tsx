'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { analyticsService } from '@/services/analyticsService';
import { CycleTimeScatter } from '@/components/charts/CycleTimeScatter';
import { IssueJourneyPanel } from '@/components/shared/IssueJourneyPanel';
import { FilterBar } from '@/components/shared/FilterBar';
import type { CycleTimeSummary, DashboardFilters } from '@flow-analytics/shared';
import { CheckCircle2, AlertCircle, Zap } from 'lucide-react';

function fmt(hours: number): string {
  if (hours < 1)   return `${Math.round(hours * 60)}m`;
  if (hours < 24)  return `${Math.round(hours)}h`;
  if (hours < 168) return `${(hours / 24).toFixed(1)}d`;
  return `${(hours / 168).toFixed(1)}w`;
}

function fmtFull(hours: number): string {
  if (hours < 1)   return `${Math.round(hours * 60)} minutes`;
  if (hours < 24)  return `${Math.round(hours)} hours`;
  if (hours < 168) return `${(hours / 24).toFixed(1)} days`;
  return `${(hours / 168).toFixed(1)} weeks`;
}

function insight(p50: number, p85: number) {
  const tone  = p50 < 48 ? 'good' : p50 < 120 ? 'ok' : 'warn';
  const headline =
    tone === 'good' ? `Your team is shipping fast — typical issue done in ${fmtFull(p50)}` :
    tone === 'ok'   ? `Typical issue takes ${fmtFull(p50)} — room to improve` :
    `Issues are taking a long time — median is ${fmtFull(p50)}`;
  const detail =
    `The slowest 15% of issues take longer than ${fmtFull(p85)}. Those are worth a closer look.`;
  return { tone: tone as 'good' | 'ok' | 'warn', headline, detail };
}

const TONE = {
  good: { bg: 'rgba(34,197,94,0.07)',  border: 'rgba(34,197,94,0.2)',  color: '#86efac', Icon: CheckCircle2 },
  ok:   { bg: 'rgba(99,102,241,0.07)', border: 'rgba(99,102,241,0.2)', color: 'var(--accent-light)', Icon: Zap },
  warn: { bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.2)', color: '#fcd34d', Icon: AlertCircle },
};

export default function CycleTimePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [data,           setData]           = useState<CycleTimeSummary | null>(null);
  const [filters,        setFilters]        = useState<DashboardFilters>({});
  const [loading,        setLoading]        = useState(true);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    analyticsService.getCycleTime(projectId, filters).then((d) => { setData(d); setLoading(false); });
  }, [projectId, filters]);

  const ins  = data && data.stats.count > 0 ? insight(data.stats.p50Hours, data.stats.p85Hours) : null;
  const tone = TONE[ins?.tone ?? 'ok'];

  return (
    <>
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
            How fast is your team shipping?
          </h2>
          <p style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 5 }}>
            Time from when work starts on an issue to when it&apos;s marked done
          </p>
        </div>
        <FilterBar filters={filters} onChange={setFilters} projectId={projectId} />
      </div>

      {/* Insight callout */}
      {!loading && ins && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '14px 18px',
            borderRadius: 12,
            background: tone.bg,
            border: `1px solid ${tone.border}`,
          }}
        >
          <tone.Icon size={15} style={{ color: tone.color, marginTop: 1, flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: tone.color, margin: 0 }}>{ins.headline}</p>
            <p style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 4 }}>{ins.detail}</p>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          {
            label: 'Typical issue takes',
            value: loading ? null : (data?.stats.count ? fmt(data.stats.p50Hours) : '—'),
            sub:   'half finish faster than this',
            highlight: true,
          },
          {
            label: 'Slowest 15% take longer than',
            value: loading ? null : (data?.stats.count ? fmt(data.stats.p85Hours) : '—'),
            sub:   'worth investigating',
            highlight: false,
          },
          {
            label: 'Issues completed',
            value: loading ? null : (data?.stats.count ?? '—'),
            sub:   'in selected period',
            highlight: false,
          },
        ].map((s) => (
          <div
            key={s.label}
            className="card-sm"
            style={s.highlight ? { borderColor: 'rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.04)' } : {}}
          >
            <p className="stat-label" style={{ marginBottom: 8 }}>{s.label}</p>
            {s.value === null ? (
              <div className="skeleton" style={{ width: 80, height: 44, borderRadius: 8 }} />
            ) : (
              <p className="stat-number">{s.value}</p>
            )}
            <p style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 6 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="card">
        <p style={{ fontSize: 12, color: 'var(--fg-subtle)', marginBottom: 16 }}>
          Each dot is one issue — dots above the dashed line are slower than 85% of issues
        </p>
        {loading ? (
          <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>Loading…</p>
          </div>
        ) : data && data.stats.count > 0 ? (
          <CycleTimeScatter
            items={data.items}
            p50={data.stats.p50Hours}
            p85={data.stats.p85Hours}
            onSelect={setSelectedItemId}
          />
        ) : (
          <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>No completed issues yet</p>
          </div>
        )}
      </div>
    </div>

      {selectedItemId && (
        <IssueJourneyPanel
          workItemId={selectedItemId}
          projectId={projectId}
          onClose={() => setSelectedItemId(null)}
        />
      )}
    </>
  );
}
