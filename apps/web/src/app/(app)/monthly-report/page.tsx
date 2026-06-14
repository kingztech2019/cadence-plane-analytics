'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { workspaceService } from '@/services/workspaceService';
import { Sparkles, Printer, ChevronDown, Loader2, CheckCircle2 } from 'lucide-react';

// ─── types ────────────────────────────────────────────────────────────────────

type StateGroup = {
  state_name: string;
  state_color: string | null;
  flow_category: string;
  sequence_order: number;
  items: Array<{ sequence_id: number; title: string; priority: string }>;
};

type ProjectSection = {
  id: string;
  name: string;
  identifier: string;
  totalItems: number;
  itemsByState: StateGroup[];
  entry: { goal_text: string; activities_text: string; projections_text: string } | null;
};

type EntryDraft = { goal_text: string; activities_text: string; projections_text: string };

// ─── helpers ──────────────────────────────────────────────────────────────────

function monthLabel(month: string) {
  return new Date(`${month}-15`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function nextMonthLabel(month: string) {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const next = m === 12
    ? `${y + 1}-01`
    : `${y}-${String(m + 1).padStart(2, '0')}`;
  return monthLabel(next);
}

const FLOW_COLOR: Record<string, string> = {
  done:        '#22c55e',
  review:      '#f59e0b',
  in_progress: '#6366f1',
  todo:        '#94a3b8',
};

function stateColor(group: StateGroup): string {
  return group.state_color ?? FLOW_COLOR[group.flow_category] ?? '#94a3b8';
}

// ─── sub-components ───────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 20,
      background: `${color}18`, border: `1px solid ${color}44`,
      fontSize: 12, fontWeight: 600, color,
    }}>
      <span style={{ fontWeight: 700 }}>{value}</span>
      <span style={{ fontWeight: 400, opacity: 0.85 }}>{label}</span>
    </div>
  );
}

function AutoTextarea({
  value,
  onChange,
  placeholder,
  minRows = 3,
  printOnly = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  minRows?: number;
  printOnly?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, [value]);

  return (
    <>
      {/* Screen */}
      <textarea
        ref={ref}
        className={printOnly ? 'no-print' : 'report-textarea'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={minRows}
        style={{
          width: '100%',
          padding: '8px 10px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--surface-2)',
          color: 'var(--fg)',
          fontSize: 13,
          lineHeight: 1.6,
          resize: 'none',
          outline: 'none',
          fontFamily: 'inherit',
          overflowY: 'hidden',
          boxSizing: 'border-box',
        }}
        onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
        onBlur={(e)  => { e.target.style.borderColor = 'var(--border)'; }}
      />
      {/* Print */}
      <div className="print-text-block" style={{ display: 'none' }}>
        {value || <span style={{ color: '#999' }}>{placeholder}</span>}
      </div>
    </>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function MonthlyReportPage() {
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const [month,        setMonth]        = useState(defaultMonth);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [projects,     setProjects]     = useState<ProjectSection[]>([]);
  const [entries,      setEntries]      = useState<Record<string, EntryDraft>>({});
  const [loading,      setLoading]      = useState(false);
  const [loaded,       setLoaded]       = useState(false);
  const [draftingFor,             setDraftingFor]             = useState<string | null>(null);
  const [draftingProjectionsFor,  setDraftingProjectionsFor]  = useState<string | null>(null);
  const [savedFor,     setSavedFor]     = useState<Record<string, boolean>>({});
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Load connection id once
  useEffect(() => {
    workspaceService.listConnections().then((conns) => {
      if (conns[0]) setConnectionId(conns[0].id);
    }).catch(() => {});
  }, []);

  const loadReport = useCallback(async (cid: string, m: string) => {
    setLoading(true);
    setLoaded(false);
    try {
      const data = await workspaceService.getMonthlyReport(cid, m);
      setProjects(data.projects);
      const map: Record<string, EntryDraft> = {};
      for (const p of data.projects) {
        map[p.id] = p.entry ?? { goal_text: '', activities_text: '', projections_text: '' };
      }
      setEntries(map);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (connectionId) loadReport(connectionId, month);
  }, [connectionId, month, loadReport]);

  // Debounced auto-save
  function updateEntry(projectId: string, field: keyof EntryDraft, value: string) {
    setEntries((prev) => {
      const updated = { ...(prev[projectId] ?? { goal_text: '', activities_text: '', projections_text: '' }), [field]: value };
      return { ...prev, [projectId]: updated };
    });
    setSavedFor((prev) => ({ ...prev, [projectId]: false }));

    clearTimeout(saveTimers.current[projectId]);
    saveTimers.current[projectId] = setTimeout(() => {
      if (!connectionId) return;
      setEntries((current) => {
        const e = current[projectId];
        if (!e) return current;
        workspaceService.saveMonthlyEntry(connectionId, projectId, month, e)
          .then(() => setSavedFor((prev) => ({ ...prev, [projectId]: true })))
          .catch(() => {});
        return current;
      });
    }, 1500);
  }

  async function draftActivities(projectId: string) {
    if (!connectionId) return;
    setDraftingFor(projectId);
    try {
      const { draft } = await workspaceService.aiDraftActivities(connectionId, projectId, month);
      updateEntry(projectId, 'activities_text', draft);
    } catch (err) {
      console.error('AI activities draft failed:', err);
    } finally {
      setDraftingFor(null);
    }
  }

  async function draftProjections(projectId: string) {
    if (!connectionId) return;
    setDraftingProjectionsFor(projectId);
    try {
      const { draft } = await workspaceService.aiDraftProjections(connectionId, projectId, month);
      updateEntry(projectId, 'projections_text', draft);
    } catch (err) {
      console.error('AI projections draft failed:', err);
    } finally {
      setDraftingProjectionsFor(null);
    }
  }

  function handlePrint() {
    window.print();
  }

  // ── render ────────────────────────────────────────────────────────────────

  const label     = monthLabel(month);
  const nextLabel = nextMonthLabel(month);

  const totalItems = projects.reduce((s, p) => s + p.totalItems, 0);
  const totalDone  = projects.reduce((s, p) => s + p.itemsByState.filter(g => g.flow_category === 'done').reduce((ss, g) => ss + g.items.length, 0), 0);
  const totalReview = projects.reduce((s, p) => s + p.itemsByState.filter(g => g.flow_category === 'review').reduce((ss, g) => ss + g.items.length, 0), 0);

  return (
    <>
      <style>{`
        /* ── Print overrides ── */
        @media print {
          body { background: #fff !important; }
          aside, .report-filters, .report-screen-hdr, .report-print-btn,
          .no-print { display: none !important; }

          /* ── Unlock the layout — target Tailwind classes that clip height ── */
          html, body {
            height: auto !important;
            overflow: visible !important;
          }
          /* Tailwind h-screen clips to one viewport; reset it */
          .h-screen { height: auto !important; }
          /* Tailwind overflow-hidden on the outer shell clips all children */
          .overflow-hidden { overflow: visible !important; }
          /* Tailwind overflow-y-auto on <main> clips overflow in print */
          .overflow-y-auto { overflow: visible !important; }
          /* Inner padding wrapper — let it grow with content */
          .min-h-full { min-height: unset !important; height: auto !important; }
          /* Flex containers must be block so height:auto works */
          .flex { display: block !important; }

          /* force light mode */
          :root {
            --bg: #ffffff; --surface: #ffffff; --surface-2: #f8f8f8;
            --fg: #111; --fg-muted: #444; --fg-subtle: #666;
            --border: #ddd; --accent: #6366f1;
          }

          .print-header { display: block !important; margin-bottom: 24px; }
          .report-textarea { display: none !important; }
          .print-text-block {
            display: block !important;
            white-space: pre-wrap;
            font-size: 13px;
            line-height: 1.7;
            color: #222;
            padding: 4px 0;
          }
          /* Hide empty placeholder text in print */
          .print-text-block span { display: none !important; }

          .project-card {
            break-inside: avoid;
            page-break-inside: avoid;
            border: 1px solid #e5e7eb !important;
            box-shadow: none !important;
            margin-bottom: 28px !important;
            padding: 18px 20px !important;
          }

          .project-card-header { padding-bottom: 10px; margin-bottom: 14px; border-bottom: 2px solid #e5e7eb; }
          .ai-draft-btn { display: none !important; }
          .save-indicator { display: none !important; }
          .field-label { color: #555 !important; }
        }

        .print-header { display: none; }

        .project-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 20px 22px;
          margin-bottom: 20px;
        }

        .field-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: var(--fg-subtle);
          margin: 0 0 5px;
        }

        .ai-draft-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 7px;
          border: 1px solid var(--accent);
          background: var(--accent-dim, rgba(99,102,241,0.08));
          color: var(--accent);
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 120ms;
        }
        .ai-draft-btn:disabled { opacity: 0.5; cursor: default; }

        .save-indicator {
          font-size: 11px;
          color: var(--fg-subtle);
          display: flex;
          align-items: center;
          gap: 4px;
        }
      `}</style>

      {/* ── Print header (only visible when printing) ── */}
      <div className="print-header" style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 2px', color: '#111' }}>
          Monthly Performance Review — {label}
        </h1>
        <p style={{ fontSize: 13, color: '#555', margin: 0 }}>
          {totalItems} items tracked · {totalDone} production · {totalReview} staging/QA · {projects.length} projects
        </p>
      </div>

      {/* ── Screen header + filters — sticky bar ── */}
      <div className="report-screen-hdr" style={{
        position: 'sticky', top: -28, zIndex: 10,
        background: 'var(--bg)',
        marginLeft: -32, marginRight: -32, paddingLeft: 32, paddingRight: 32,
        paddingTop: 20,
        borderBottom: '1px solid var(--border)',
        marginTop: -28,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--fg)', letterSpacing: '-0.015em' }}>
              Monthly Report
            </h1>
            <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '2px 0 0' }}>
              Monthly Performance Review — auto-populated from Plane
            </p>
          </div>
          <button
            className="report-print-btn"
            onClick={handlePrint}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 16px', borderRadius: 9,
              background: 'var(--accent)', color: '#fff',
              border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
            }}
          >
            <Printer size={14} />
            Print / Export
          </button>
        </div>

        {/* ── Filters ── */}
        <div className="report-filters" style={{
          display: 'flex', alignItems: 'center', gap: 12,
          paddingBottom: 12,
        }}>
        {/* Month picker */}
        <div style={{ position: 'relative' }}>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={{
              padding: '6px 32px 6px 10px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              color: 'var(--fg)',
              fontSize: 13,
              appearance: 'none',
              cursor: 'pointer',
            }}
          />
          <ChevronDown size={13} style={{
            position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--fg-subtle)', pointerEvents: 'none',
          }} />
        </div>

        {loaded && (
          <div style={{ display: 'flex', gap: 8 }}>
            <StatPill label="total items" value={totalItems} color="#94a3b8" />
            {totalDone > 0   && <StatPill label="production" value={totalDone}   color="#22c55e" />}
            {totalReview > 0 && <StatPill label="staging/QA"  value={totalReview} color="#f59e0b" />}
            <StatPill label="projects" value={projects.length} color="#6366f1" />
          </div>
        )}

        {loading && <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>Loading…</span>}
        </div>{/* end filters */}
      </div>{/* end sticky bar */}

      {/* ── Content area — no inner scroll; parent main already scrolls ── */}
      <div style={{ paddingTop: 24, paddingBottom: 40 }}>

        {loaded && projects.length === 0 && (
          <p style={{ color: 'var(--fg-subtle)', fontSize: 14 }}>
            No projects found. Connect a Plane workspace first.
          </p>
        )}

        {loaded && projects.map((project) => {
          const entry = entries[project.id] ?? { goal_text: '', activities_text: '', projections_text: '' };
          const isDrafting           = draftingFor === project.id;
          const isDraftingProjections = draftingProjectionsFor === project.id;
          const anyDrafting           = draftingFor !== null || draftingProjectionsFor !== null;
          const isSaved    = savedFor[project.id] === true;
          const hasUnsaved = savedFor[project.id] === false;

          return (
            <div key={project.id} className="project-card">
              {/* Project header */}
              <div className="project-card-header" style={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                marginBottom: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 9,
                    background: 'var(--accent-dim, rgba(99,102,241,0.1))',
                    border: '1px solid var(--accent-glow, rgba(99,102,241,0.25))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800, color: 'var(--accent)',
                    flexShrink: 0,
                  }}>
                    {project.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--fg)' }}>
                      {project.name}
                    </h2>
                    <p style={{ fontSize: 11, color: 'var(--fg-subtle)', margin: '2px 0 0' }}>
                      {project.identifier}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {project.itemsByState.slice(0, 4).map((g) => (
                    <StatPill key={g.state_name} label={g.state_name} value={g.items.length} color={stateColor(g)} />
                  ))}
                  <div className="save-indicator">
                    {(isDrafting || isDraftingProjections) && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
                    {isSaved && <CheckCircle2 size={12} style={{ color: '#22c55e' }} />}
                    {isDrafting && <span>Drafting activities…</span>}
                    {isDraftingProjections && <span>Drafting projections…</span>}
                    {isSaved && !isDrafting && !isDraftingProjections && <span>Saved</span>}
                    {hasUnsaved && !isDrafting && !isDraftingProjections && <span>Saving…</span>}
                  </div>
                </div>
              </div>

              {/* Items grouped by state (collapsed on screen) */}
              {project.totalItems > 0 && (
                <div className="no-print" style={{ marginBottom: 14 }}>
                  <details>
                    <summary style={{
                      fontSize: 11, fontWeight: 600, color: 'var(--fg-subtle)',
                      cursor: 'pointer', userSelect: 'none', letterSpacing: '0.05em',
                      textTransform: 'uppercase', listStyle: 'none',
                    }}>
                      {project.totalItems} item{project.totalItems !== 1 ? 's' : ''} this month ↓
                    </summary>
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {project.itemsByState.map((group) => {
                        const color = stateColor(group);
                        return (
                          <div key={group.state_name}>
                            {/* State header */}
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
                            }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                              <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: '0.04em' }}>
                                {group.state_name}
                              </span>
                              <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>
                                ({group.items.length})
                              </span>
                            </div>
                            {/* Items */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {group.items.map((item) => (
                                <div key={item.sequence_id} style={{
                                  fontSize: 12, color: 'var(--fg-muted)',
                                  padding: '3px 0 3px 14px',
                                  borderLeft: `2px solid ${color}44`,
                                }}>
                                  {item.title}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                </div>
              )}

              {/* Fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Goal */}
                <div>
                  <p className="field-label">Goal for {label}</p>
                  <AutoTextarea
                    value={entry.goal_text}
                    onChange={(v) => updateEntry(project.id, 'goal_text', v)}
                    placeholder={`What was the primary goal for ${project.name} this month?`}
                    minRows={2}
                  />
                </div>

                {/* Activities */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <p className="field-label" style={{ margin: 0 }}>Activities during {label}</p>
                    <button
                      className="ai-draft-btn"
                      onClick={() => draftActivities(project.id)}
                      disabled={anyDrafting}
                    >
                      {isDrafting
                        ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Drafting…</>
                        : <><Sparkles size={11} /> AI Draft</>
                      }
                    </button>
                  </div>
                  <AutoTextarea
                    value={entry.activities_text}
                    onChange={(v) => updateEntry(project.id, 'activities_text', v)}
                    placeholder={`What did the ${project.name} team accomplish? (or use AI Draft to generate from Plane data)`}
                    minRows={3}
                  />
                </div>

                {/* Projections */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <p className="field-label" style={{ margin: 0 }}>Projected activities for {nextLabel}</p>
                    <button
                      className="ai-draft-btn"
                      onClick={() => draftProjections(project.id)}
                      disabled={anyDrafting}
                    >
                      {isDraftingProjections
                        ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Drafting…</>
                        : <><Sparkles size={11} /> AI Draft</>
                      }
                    </button>
                  </div>
                  <AutoTextarea
                    value={entry.projections_text}
                    onChange={(v) => updateEntry(project.id, 'projections_text', v)}
                    placeholder={`What is planned for ${project.name} next month? (or use AI Draft to generate from current in-progress items)`}
                    minRows={2}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
