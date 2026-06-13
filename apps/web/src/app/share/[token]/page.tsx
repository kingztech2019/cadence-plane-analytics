'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { resolveShareToken, publicFetch } from '@/services/shareService';
import type { CycleTimeSummary, BottleneckReport, ThroughputReport, FlowEfficiencyReport } from '@flow-analytics/shared';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';
import { CadenceMark } from '@/components/shared/CadenceLogo';
import { Shield, Link2Off } from 'lucide-react';

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(hours: number): string {
  if (hours < 1)   return `${Math.round(hours * 60)}m`;
  if (hours < 24)  return `${Math.round(hours)}h`;
  if (hours < 168) return `${(hours / 24).toFixed(1)}d`;
  return `${(hours / 168).toFixed(1)}w`;
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function SharePage() {
  const params = useParams<{ token: string }>();
  const token  = params.token;

  const [projectName, setProjectName] = useState<string | null>(null);
  const [error,       setError]       = useState(false);
  const [loading,     setLoading]     = useState(true);

  const [cycleTime,   setCycleTime]   = useState<CycleTimeSummary | null>(null);
  const [bottleneck,  setBottleneck]  = useState<BottleneckReport | null>(null);
  const [throughput,  setThroughput]  = useState<ThroughputReport | null>(null);
  const [efficiency,  setEfficiency]  = useState<FlowEfficiencyReport | null>(null);

  useEffect(() => {
    resolveShareToken(token)
      .then(({ projectName: name }) => {
        setProjectName(name);
        return Promise.allSettled([
          publicFetch<CycleTimeSummary>(token, 'cycle-time').then(setCycleTime),
          publicFetch<BottleneckReport>(token, 'bottleneck').then(setBottleneck),
          publicFetch<ThroughputReport>(token, 'throughput').then(setThroughput),
          publicFetch<FlowEfficiencyReport>(token, 'flow-efficiency').then(setEfficiency),
        ]);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  // ── Render states ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div className="skeleton" style={{ width: 200, height: 24, borderRadius: 8 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', gap: 16 }}>
        <Link2Off size={40} style={{ color: 'var(--fg-subtle)' }} />
        <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg)', margin: 0 }}>This link has expired or is invalid</p>
        <p style={{ fontSize: 13, color: 'var(--fg-muted)', margin: 0 }}>
          The person who shared this may have revoked the link.
        </p>
        <a href="/" style={{ fontSize: 12, color: 'var(--accent-light)', textDecoration: 'none', marginTop: 4 }}>
          Sign in to Cadence →
        </a>
      </div>
    );
  }

  // ── Scatter chart data ─────────────────────────────────────────────────────

  const scatterData = (cycleTime?.items ?? [])
    .filter((i) => i.cycleTimeHours !== null)
    .map((i) => ({
      x: i.completedAt ? new Date(i.completedAt).getTime() : 0,
      y: Math.round(((i.cycleTimeHours ?? 0) / 24) * 10) / 10,
      title: i.title,
    }))
    .filter((d) => d.x > 0)
    .sort((a, b) => a.x - b.x);

  const p50Days = cycleTime ? cycleTime.stats.p50Hours / 24 : 0;
  const p85Days = cycleTime ? cycleTime.stats.p85Hours / 24 : 0;

  // ── Bottleneck chart ───────────────────────────────────────────────────────

  const bottleneckData = (bottleneck?.states ?? []).map((s) => ({
    name:  s.stateName,
    avg:   Math.round(s.avgHours * 10) / 10,
    p85:   Math.round(s.p85Hours * 10) / 10,
    isBottleneck: s.stateId === bottleneck?.bottleneckStateId,
  }));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--fg)' }}>
      {/* Nav */}
      <div
        style={{
          borderBottom:   '1px solid var(--border)',
          background:     'var(--surface)',
          position:       'sticky',
          top:             0,
          zIndex:          50,
        }}
      >
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CadenceMark size={24} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)', margin: 0, letterSpacing: '-0.01em' }}>Cadence</p>
              <p style={{ fontSize: 10, color: 'var(--fg-subtle)', margin: 0 }}>Shared analytics</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: 'var(--fg-subtle)' }}>
            <Shield size={12} />
            Read-only · No login required
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* Project header */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-subtle)', margin: '0 0 6px' }}>
            Project analytics
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--fg)', margin: '0 0 4px' }}>
            {projectName}
          </h1>
        </div>

        {/* Key stats */}
        {cycleTime && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Typical delivery (P50)', value: fmt(cycleTime.stats.p50Hours), sub: 'Median cycle time' },
              { label: 'Slowest 15% (P85)',      value: fmt(cycleTime.stats.p85Hours), sub: '85th percentile'  },
              { label: 'Issues analysed',        value: cycleTime.stats.count.toString(), sub: 'Completed issues' },
              ...(efficiency ? [{ label: 'Flow efficiency', value: `${efficiency.medianEfficiencyPct.toFixed(1)}%`, sub: 'Industry avg: 15%' }] : []),
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  padding:      '14px 20px',
                  borderRadius:  12,
                  background:   'var(--surface)',
                  border:       '1px solid var(--border)',
                  flex:          1,
                  minWidth:      140,
                }}
              >
                <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--fg-subtle)', margin: '0 0 4px' }}>{s.label}</p>
                <p style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--fg)', margin: 0, lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontSize: 10, color: 'var(--fg-subtle)', margin: '3px 0 0' }}>{s.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Cycle time scatter */}
        {scatterData.length > 0 && (
          <div className="card">
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)', margin: '0 0 4px' }}>Delivery speed over time</p>
            <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '0 0 20px' }}>Each dot is a completed issue — how long it took, in days</p>
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="x" type="number" scale="time" domain={['auto', 'auto']}
                  tickFormatter={(v: number) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  tick={{ fontSize: 10, fill: 'var(--fg-subtle)' }} stroke="var(--border)"
                />
                <YAxis
                  dataKey="y" name="Days" unit="d"
                  tick={{ fontSize: 10, fill: 'var(--fg-subtle)' }} stroke="var(--border)" width={34}
                />
                <ZAxis range={[30, 30]} />
                {p50Days > 0 && <ReferenceLine y={p50Days} stroke="#818cf8" strokeDasharray="4 3" label={{ value: `P50 ${fmt(cycleTime!.stats.p50Hours)}`, fill: '#818cf8', fontSize: 10, position: 'insideTopRight' }} />}
                {p85Days > 0 && <ReferenceLine y={p85Days} stroke="#f59e0b" strokeDasharray="4 3" label={{ value: `P85 ${fmt(cycleTime!.stats.p85Hours)}`, fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }} />}
                <Scatter data={scatterData} fill="#6366f1" fillOpacity={0.55} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Bottleneck */}
        {bottleneckData.length > 0 && (
          <div className="card">
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)', margin: '0 0 4px' }}>Where issues wait longest</p>
            <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '0 0 20px' }}>Average and P85 time spent in each workflow state</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={bottleneckData} layout="vertical" margin={{ top: 5, right: 40, bottom: 5, left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--fg-subtle)' }} stroke="var(--border)" tickFormatter={(v: number) => `${v}h`} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} stroke="var(--border)" width={80} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)', margin: '0 0 6px' }}>{label}</p>
                        {payload.map((p) => (
                          <p key={p.dataKey as string} style={{ fontSize: 12, color: p.color as string, margin: '2px 0' }}>
                            {p.dataKey === 'avg' ? 'Avg' : 'P85'}: {fmt(p.value as number)}
                          </p>
                        ))}
                      </div>
                    );
                  }}
                />
                <Bar dataKey="avg" fill="#6366f1" fillOpacity={0.65} radius={[0, 4, 4, 0]} name="Avg" />
                <Bar dataKey="p85" fill="#f59e0b" fillOpacity={0.65} radius={[0, 4, 4, 0]} name="P85" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Throughput */}
        {throughput && throughput.assignees.length > 0 && (
          <div className="card">
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)', margin: '0 0 4px' }}>Team output</p>
            <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '0 0 16px' }}>Issues completed by team member in the last 90 days</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Member', 'Issues', 'Typical speed (P50)', 'Slowest 15% (P85)'].map((col) => (
                      <th key={col} style={{ textAlign: 'left', padding: '6px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--fg-subtle)', borderBottom: '1px solid var(--border)' }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {throughput.assignees.map((a) => (
                    <tr key={a.assigneeId}>
                      <td style={{ padding: '9px 12px', color: 'var(--fg)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>{a.displayName}</td>
                      <td style={{ padding: '9px 12px', color: 'var(--fg)', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>{a.itemsCompleted}</td>
                      <td style={{ padding: '9px 12px', color: 'var(--fg-muted)', borderBottom: '1px solid var(--border)' }}>
                        {a.p50CycleTimeHours !== null ? fmt(a.p50CycleTimeHours) : '—'}
                      </td>
                      <td style={{ padding: '9px 12px', color: 'var(--fg-muted)', borderBottom: '1px solid var(--border)' }}>
                        {a.p85CycleTimeHours !== null ? fmt(a.p85CycleTimeHours) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <p style={{ fontSize: 11, color: 'var(--fg-subtle)', margin: 0 }}>
            Powered by <strong style={{ color: 'var(--fg)' }}>Cadence</strong> · Delivery analytics for Plane
          </p>
          <a
            href="/signup"
            style={{
              fontSize: 12, fontWeight: 600,
              color: 'var(--accent-light)',
              textDecoration: 'none',
              padding: '6px 14px',
              borderRadius: 8,
              border: '1px solid rgba(99,102,241,0.35)',
              background: 'rgba(99,102,241,0.08)',
            }}
          >
            Get Cadence for your team →
          </a>
        </div>
      </div>
    </div>
  );
}
