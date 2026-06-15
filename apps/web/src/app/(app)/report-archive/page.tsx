'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { workspaceService } from '@/services/workspaceService';
import { Calendar, TrendingUp, FileText, ArrowRight, Columns2, X } from 'lucide-react';

type ArchiveMonth = {
  month: string;
  projects_count: number;
  filled_count: number;
  shipped_count: number;
};

type MonthData = {
  month: string;
  projects_count: number;
  filled_count: number;
  shipped_count: number;
};

function monthLabel(m: string) {
  return new Date(`${m}-15`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function quarterOf(m: string): string {
  const mo = parseInt(m.split('-')[1]!, 10);
  return `Q${Math.ceil(mo / 3)}`;
}

const QUARTER_COLORS: Record<string, string> = {
  Q1: '#6366f1', Q2: '#22c55e', Q3: '#f59e0b', Q4: '#ec4899',
};

// ── Comparison view ────────────────────────────────────────────────────────────

function CompareView({
  months,
  connectionId,
  onClose,
}: {
  months: [string, string];
  connectionId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<Array<{
    month: string;
    projects: Array<{
      id: string; name: string; identifier: string; totalItems: number;
      itemsByState: Array<{ state_name: string; state_color: string | null; flow_category: string; sequence_order: number; items: Array<{ sequence_id: number; title: string; priority: string }> }>;
      entry: { goal_text: string; activities_text: string; projections_text: string } | null;
    }>;
  } | null>>([null, null]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      workspaceService.getMonthlyReport(connectionId, months[0]),
      workspaceService.getMonthlyReport(connectionId, months[1]),
    ]).then(([a, b]) => {
      setData([{ month: months[0], projects: a.projects }, { month: months[1], projects: b.projects }]);
    }).finally(() => setLoading(false));
  }, [connectionId, months[0], months[1]]);

  // Collect all project ids across both months
  const allProjectIds = Array.from(new Set([
    ...(data[0]?.projects.map(p => p.id) ?? []),
    ...(data[1]?.projects.map(p => p.id) ?? []),
  ]));

  const projectName = (id: string) =>
    data[0]?.projects.find(p => p.id === id)?.name ??
    data[1]?.projects.find(p => p.id === id)?.name ?? id;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'var(--bg)', overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--bg)', borderBottom: '1px solid var(--border)',
        padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Columns2 size={16} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--fg)' }}>
            Comparing {monthLabel(months[0])} vs {monthLabel(months[1])}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-subtle)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}
        >
          <X size={14} /> Close
        </button>
      </div>

      {loading && (
        <p style={{ padding: '24px 28px', color: 'var(--fg-subtle)', fontSize: 13 }}>Loading…</p>
      )}

      {!loading && (
        <div style={{ padding: '24px 28px 48px' }}>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr', gap: 16, marginBottom: 8 }}>
            <div />
            {months.map((m) => (
              <div key={m} style={{
                fontSize: 13, fontWeight: 700, color: 'var(--fg)',
                padding: '8px 14px', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 10,
              }}>
                {monthLabel(m)}
              </div>
            ))}
          </div>

          {allProjectIds.map((pid) => {
            const rows = months.map((m, mi) => data[mi]?.projects.find(p => p.id === pid));
            return (
              <div key={pid} style={{
                display: 'grid', gridTemplateColumns: '180px 1fr 1fr', gap: 16,
                marginBottom: 16,
              }}>
                {/* Project label */}
                <div style={{ display: 'flex', alignItems: 'flex-start', paddingTop: 14 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: 'var(--fg)',
                    background: 'var(--accent-dim, rgba(99,102,241,0.1))',
                    border: '1px solid var(--accent-glow, rgba(99,102,241,0.25))',
                    padding: '4px 10px', borderRadius: 8,
                  }}>
                    {projectName(pid)}
                  </span>
                </div>
                {/* Two month columns */}
                {rows.map((row, i) => (
                  <div key={i} style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '14px 16px',
                  }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}>
                        {row?.itemsByState.reduce((s, g) => s + g.items.length, 0) ?? 0} items
                      </span>
                    </div>
                    {row?.entry?.goal_text ? (
                      <div style={{ marginBottom: 8 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-subtle)', margin: '0 0 3px' }}>Goal</p>
                        <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: 0, lineHeight: 1.5 }}>{row.entry.goal_text}</p>
                      </div>
                    ) : null}
                    {row?.entry?.activities_text ? (
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-subtle)', margin: '0 0 3px' }}>Activities</p>
                        <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{row.entry.activities_text}</p>
                      </div>
                    ) : (
                      <p style={{ fontSize: 12, color: 'var(--fg-subtle)', fontStyle: 'italic', margin: 0 }}>No entries for this month</p>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ReportArchivePage() {
  const router = useRouter();

  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [months, setMonths] = useState<ArchiveMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [comparing, setComparing] = useState<[string, string] | null>(null);

  useEffect(() => {
    workspaceService.listConnections().then((conns) => {
      if (!conns[0]) return;
      setConnectionId(conns[0].id);
      workspaceService.getReportArchive(conns[0].id)
        .then(setMonths)
        .finally(() => setLoading(false));
    }).catch(() => setLoading(false));
  }, []);

  function toggleSelect(m: string) {
    setSelected((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : prev.length < 2 ? [...prev, m] : [prev[1]!, m]
    );
  }

  function startCompare() {
    if (selected.length === 2 && connectionId) {
      setComparing(selected as [string, string]);
    }
  }

  // Group months by year
  const byYear: Record<string, ArchiveMonth[]> = {};
  for (const m of months) {
    const y = m.month.split('-')[0]!;
    if (!byYear[y]) byYear[y] = [];
    byYear[y]!.push(m);
  }

  const totalShipped = months.reduce((s, m) => s + m.shipped_count, 0);

  return (
    <>
      {comparing && connectionId && (
        <CompareView
          months={comparing}
          connectionId={connectionId}
          onClose={() => setComparing(null)}
        />
      )}

      {/* Header */}
      <div style={{
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
            Report Archive
          </h1>
          <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '2px 0 0' }}>
            {months.length} months saved · {totalShipped} total items shipped
          </p>
        </div>
        {selected.length === 2 && (
          <button
            onClick={startCompare}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 16px', borderRadius: 9,
              background: 'var(--accent)', color: '#fff',
              border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
            }}
          >
            <Columns2 size={14} />
            Compare {monthLabel(selected[0]!)} vs {monthLabel(selected[1]!)}
          </button>
        )}
        {selected.length === 1 && (
          <p style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>Select one more month to compare</p>
        )}
      </div>

      <div style={{ paddingTop: 24, paddingBottom: 48 }}>
        {loading && <p style={{ color: 'var(--fg-subtle)', fontSize: 13 }}>Loading…</p>}

        {!loading && months.length === 0 && (
          <p style={{ color: 'var(--fg-subtle)', fontSize: 13 }}>
            No saved monthly reports yet. Fill in a Monthly Report to start building your archive.
          </p>
        )}

        {Object.entries(byYear)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([year, yearMonths]) => (
            <div key={year} style={{ marginBottom: 36 }}>
              <p style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.09em',
                textTransform: 'uppercase', color: 'var(--fg-subtle)',
                margin: '0 0 14px',
              }}>
                {year}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                {yearMonths.map((m) => {
                  const q = quarterOf(m.month);
                  const color = QUARTER_COLORS[q] ?? '#6366f1';
                  const isSelected = selected.includes(m.month);
                  return (
                    <div
                      key={m.month}
                      onClick={() => toggleSelect(m.month)}
                      style={{
                        background: 'var(--surface)',
                        border: `2px solid ${isSelected ? color : 'var(--border)'}`,
                        borderRadius: 12, padding: '16px 18px',
                        cursor: 'pointer',
                        transition: 'all 120ms ease',
                        boxShadow: isSelected ? `0 0 0 3px ${color}22` : 'none',
                      }}
                    >
                      {/* Quarter badge + month */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 7px',
                          borderRadius: 6, background: `${color}22`, color,
                          letterSpacing: '0.05em',
                        }}>
                          {q}
                        </span>
                        {isSelected && (
                          <span style={{ fontSize: 10, color, fontWeight: 700 }}>✓ Selected</span>
                        )}
                      </div>

                      <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)', margin: '0 0 10px' }}>
                        {monthLabel(m.month)}
                      </p>

                      {/* Stats */}
                      <div style={{ display: 'flex', gap: 14, marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <TrendingUp size={12} style={{ color: '#22c55e' }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#22c55e' }}>{m.shipped_count}</span>
                          <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>shipped</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <FileText size={12} style={{ color: 'var(--fg-subtle)' }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)' }}>{m.filled_count}/{m.projects_count}</span>
                          <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>written</span>
                        </div>
                      </div>

                      {/* View button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/monthly-report?month=${m.month}`); }}
                        style={{
                          width: '100%', padding: '6px 0',
                          borderRadius: 7,
                          border: '1px solid var(--border)',
                          background: 'var(--surface-2)',
                          color: 'var(--fg-muted)', fontSize: 12, fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                        }}
                      >
                        View Report <ArrowRight size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
    </>
  );
}
