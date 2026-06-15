'use client';

import { useState, useEffect, useCallback } from 'react';
import { workspaceService } from '@/services/workspaceService';
import { ChevronDown, Printer, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ─── helpers ──────────────────────────────────────────────────────────────────

function monthLabel(m: string) {
  return new Date(`${m}-15`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
function shortMonth(m: string) {
  return new Date(`${m}-15`).toLocaleDateString('en-US', { month: 'short' });
}

function currentQuarter(): string {
  const now = new Date();
  return `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;
}

function quarterMonths(q: string): string[] {
  const match = q.match(/^(\d{4})-Q([1-4])$/);
  if (!match) return [];
  const year = Number(match[1]);
  const qi   = Number(match[2]);
  const start = (qi - 1) * 3 + 1;
  return [start, start + 1, start + 2].map((m) => `${year}-${String(m).padStart(2, '0')}`);
}

function availableQuarters(): string[] {
  const now = new Date();
  const qs: string[] = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 2; y--) {
    for (let q = 4; q >= 1; q--) {
      if (y === now.getFullYear() && q > Math.ceil((now.getMonth() + 1) / 3)) continue;
      qs.push(`${y}-Q${q}`);
    }
  }
  return qs;
}

function TrendIcon({ values }: { values: number[] }) {
  if (values.length < 2) return <Minus size={12} style={{ color: '#94a3b8' }} />;
  const last  = values[values.length - 1] ?? 0;
  const first = values[0] ?? 0;
  if (last > first) return <TrendingUp  size={12} style={{ color: '#22c55e' }} />;
  if (last < first) return <TrendingDown size={12} style={{ color: '#ef4444' }} />;
  return <Minus size={12} style={{ color: '#94a3b8' }} />;
}

// ─── sub-components ───────────────────────────────────────────────────────────

function MonthCell({
  month,
  shippedCount,
  entry,
  isFirst,
}: {
  month: string;
  shippedCount: number;
  entry: { goal_text: string; activities_text: string; projections_text: string } | null;
  isFirst: boolean;
}) {
  const hasContent = entry && (entry.goal_text || entry.activities_text || entry.projections_text);

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '14px 16px',
      minHeight: 160,
    }}>
      {/* Month header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg)' }}>{shortMonth(month)}</span>
        <span style={{
          fontSize: 13, fontWeight: 800, color: shippedCount > 0 ? '#22c55e' : 'var(--fg-subtle)',
          background: shippedCount > 0 ? 'rgba(34,197,94,0.1)' : 'var(--surface-2)',
          border: `1px solid ${shippedCount > 0 ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
          padding: '2px 9px', borderRadius: 20,
        }}>
          {shippedCount} shipped
        </span>
      </div>

      {hasContent ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entry!.goal_text && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-subtle)', margin: '0 0 3px' }}>Goal</p>
              <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: 0, lineHeight: 1.5 }}>{entry!.goal_text}</p>
            </div>
          )}
          {entry!.activities_text && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-subtle)', margin: '0 0 3px' }}>Activities</p>
              <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{entry!.activities_text}</p>
            </div>
          )}
          {entry!.projections_text && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-subtle)', margin: '0 0 3px' }}>Projections → {shortMonth(month)}</p>
              <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{entry!.projections_text}</p>
            </div>
          )}
        </div>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--fg-subtle)', fontStyle: 'italic', margin: 0 }}>
          No report entries for {shortMonth(month)}
        </p>
      )}
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function QuarterlyReportPage() {
  const [quarter,      setQuarter]      = useState(currentQuarter);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [data,         setData]         = useState<{
    quarter: string;
    months: string[];
    projects: Array<{
      id: string; name: string; identifier: string;
      monthData: Array<{ month: string; shipped_count: number; entry: { goal_text: string; activities_text: string; projections_text: string } | null }>;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    workspaceService.listConnections().then((conns) => {
      if (conns[0]) setConnectionId(conns[0].id);
    }).catch(() => {});
  }, []);

  const load = useCallback(async (cid: string, q: string) => {
    setLoading(true);
    try {
      const result = await workspaceService.getQuarterlyReport(cid, q);
      setData(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (connectionId) load(connectionId, quarter);
  }, [connectionId, quarter, load]);

  const months = data?.months ?? quarterMonths(quarter);
  const totalShipped = data?.projects.reduce(
    (s, p) => s + p.monthData.reduce((ss, m) => ss + m.shipped_count, 0), 0
  ) ?? 0;

  const quarterLabel = quarter.replace('-Q', ' Q');

  return (
    <>
      <style>{`
        @media print {
          body { background: #fff !important; }
          aside, .qr-header, .no-print { display: none !important; }
          html, body { height: auto !important; overflow: visible !important; }
          .h-screen { height: auto !important; }
          .overflow-hidden { overflow: visible !important; }
          .overflow-y-auto { overflow: visible !important; }
          .min-h-full { min-height: unset !important; height: auto !important; }
          .flex { display: block !important; }
          :root {
            --bg: #fff; --surface: #fff; --surface-2: #f8f8f8;
            --fg: #111; --fg-muted: #444; --fg-subtle: #666;
            --border: #ddd;
          }
          .qr-print-header { display: block !important; }
          .project-row { break-inside: avoid; page-break-inside: avoid; margin-bottom: 32px; }
          .month-grid { display: grid !important; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        }
        .qr-print-header { display: none; }
        .month-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
      `}</style>

      {/* Print header */}
      <div className="qr-print-header" style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', color: '#111' }}>
          Quarterly Performance Review — {quarterLabel}
        </h1>
        <p style={{ fontSize: 13, color: '#555', margin: 0 }}>
          {months.map(monthLabel).join(' · ')} · {totalShipped} items shipped
        </p>
      </div>

      {/* Sticky header */}
      <div className="qr-header" style={{
        position: 'sticky', top: -28, zIndex: 10,
        background: 'var(--bg)',
        marginLeft: -32, marginRight: -32, paddingLeft: 32, paddingRight: 32,
        paddingTop: 20, paddingBottom: 14,
        borderBottom: '1px solid var(--border)',
        marginTop: -28,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--fg)', letterSpacing: '-0.015em' }}>
            Quarterly Report
          </h1>
          <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '2px 0 0' }}>
            {months.map(shortMonth).join(' · ')} · {totalShipped} items shipped
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Quarter picker */}
          <div style={{ position: 'relative' }}>
            <select
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              style={{
                padding: '7px 32px 7px 11px',
                borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--surface-2)', color: 'var(--fg)',
                fontSize: 13, appearance: 'none', cursor: 'pointer',
              }}
            >
              {availableQuarters().map((q) => (
                <option key={q} value={q}>{q.replace('-Q', ' Q')}</option>
              ))}
            </select>
            <ChevronDown size={13} style={{
              position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--fg-subtle)', pointerEvents: 'none',
            }} />
          </div>
          <button
            className="no-print"
            onClick={() => window.print()}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 16px', borderRadius: 9,
              background: 'var(--accent)', color: '#fff',
              border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
            }}
          >
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* Summary row — items shipped per project across quarter */}
      {data && data.projects.length > 0 && (
        <div style={{ paddingTop: 20, marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-subtle)', margin: '0 0 10px' }}>
            Quarterly Summary
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            {data.projects.map((p) => {
              const shipped = p.monthData.map((m) => m.shipped_count);
              const total = shipped.reduce((s, v) => s + v, 0);
              return (
                <div key={p.id} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '12px 14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, margin: 0, color: 'var(--fg)' }}>{p.name}</p>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      {shipped.map((v, i) => (
                        <span key={i} style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>
                          {shortMonth(data.months[i]!)}: <strong style={{ color: 'var(--fg-muted)' }}>{v}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--fg)' }}>{total}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                      <TrendIcon values={shipped} />
                      <span style={{ fontSize: 10, color: 'var(--fg-subtle)' }}>shipped</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Column headers */}
      {data && (
        <div className="month-grid" style={{ marginBottom: 10 }}>
          {data.months.map((m) => (
            <div key={m} style={{
              fontSize: 13, fontWeight: 700, color: 'var(--fg)',
              padding: '8px 14px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center',
            }}>
              {monthLabel(m)}
            </div>
          ))}
        </div>
      )}

      {/* Per-project rows */}
      <div style={{ paddingBottom: 48 }}>
        {loading && <p style={{ color: 'var(--fg-subtle)', fontSize: 13, paddingTop: 16 }}>Loading…</p>}

        {data && data.projects.map((project) => (
          <div key={project.id} className="project-row" style={{ marginBottom: 20 }}>
            {/* Project label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 26, height: 26, borderRadius: 7,
                background: 'var(--accent-dim, rgba(99,102,241,0.1))',
                border: '1px solid var(--accent-glow, rgba(99,102,241,0.25))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800, color: 'var(--accent)', flexShrink: 0,
              }}>
                {project.name[0]?.toUpperCase()}
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>{project.name}</span>
              <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{project.identifier}</span>
              <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>
                {project.monthData.reduce((s, m) => s + m.shipped_count, 0)} shipped this quarter
              </span>
            </div>

            {/* Three month cells */}
            <div className="month-grid">
              {project.monthData.map((md, i) => (
                <MonthCell
                  key={md.month}
                  month={md.month}
                  shippedCount={md.shipped_count}
                  entry={md.entry}
                  isFirst={i === 0}
                />
              ))}
            </div>
          </div>
        ))}

        {data && data.projects.length === 0 && (
          <p style={{ color: 'var(--fg-subtle)', fontSize: 13, paddingTop: 16 }}>
            No projects found. Connect a Plane workspace first.
          </p>
        )}
      </div>
    </>
  );
}
