'use client';
import { useEffect, useState, useCallback } from 'react';
import { X, User, AlertCircle, RefreshCw } from 'lucide-react';
import { analyticsService } from '@/services/analyticsService';
import type { IssueJourney, IssueStateSegment } from '@flow-analytics/shared';

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtDuration(hours: number | null): string {
  if (hours === null || hours === undefined) return '—';
  if (hours < 1)   return `${Math.round(hours * 60)} min`;
  if (hours < 24)  return `${hours.toFixed(1)} h`;
  if (hours < 168) return `${(hours / 24).toFixed(1)} days`;
  return `${(hours / 168).toFixed(1)} wks`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en', {
    month: 'short',
    day:   'numeric',
    hour:  '2-digit',
    minute:'2-digit',
  });
}

function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

// ── Design tokens ────────────────────────────────────────────────────────────

const FLOW_COLORS: Record<string, { bg: string; border: string; dot: string; text: string }> = {
  backlog:     { bg: 'rgba(148,163,184,0.12)', border: '#94a3b8', dot: '#94a3b8', text: '#94a3b8' },
  todo:        { bg: 'rgba(96,165,250,0.12)',  border: '#60a5fa', dot: '#60a5fa', text: '#60a5fa' },
  in_progress: { bg: 'rgba(245,158,11,0.12)',  border: '#f59e0b', dot: '#f59e0b', text: '#f59e0b' },
  review:      { bg: 'rgba(167,139,250,0.12)', border: '#a78bfa', dot: '#a78bfa', text: '#a78bfa' },
  done:        { bg: 'rgba(52,211,153,0.12)',  border: '#34d399', dot: '#34d399', text: '#34d399' },
  cancelled:   { bg: 'rgba(248,113,113,0.12)', border: '#f87171', dot: '#f87171', text: '#f87171' },
};

const PRIORITY_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  urgent: { label: 'Urgent', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  high:   { label: 'High',   color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  medium: { label: 'Medium', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  low:    { label: 'Low',    color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  none:   { label: 'No priority', color: 'var(--fg-subtle)', bg: 'var(--surface-3)' },
};

function flowColor(category: string) {
  return FLOW_COLORS[category] ?? FLOW_COLORS.backlog!;
}

// ── Proportional journey bar ─────────────────────────────────────────────────

function JourneyBar({ states }: { states: IssueStateSegment[] }) {
  const totalHours = states.reduce((sum, s) => sum + (s.durationHours ?? 4), 0) || 1;
  const MIN_PCT = 4; // minimum visible width %

  return (
    <div style={{ display: 'flex', height: 40, borderRadius: 10, overflow: 'hidden', gap: 2 }}>
      {states.map((s, i) => {
        const pct = Math.max(MIN_PCT, ((s.durationHours ?? 4) / totalHours) * 100);
        const c = flowColor(s.flowCategory);
        const isLast = i === states.length - 1;
        const isCurrent = s.exitedAt === null;

        return (
          <div
            key={`${s.stateId}-${i}`}
            title={`${s.stateName}: ${fmtDuration(s.durationHours)}`}
            style={{
              flex: pct,
              background: c.bg,
              borderTop: `3px solid ${c.border}`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              padding: '0 6px 4px',
              minWidth: 0,
              position: 'relative',
              overflow: 'hidden',
              borderRadius: i === 0 ? '8px 0 0 8px' : isLast ? '0 8px 8px 0' : 0,
              // Subtle pulse for current (in-progress) state
              animation: isCurrent ? 'journey-pulse 2.4s ease-in-out infinite' : undefined,
            }}
          >
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: c.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
              }}
            >
              {s.stateName}
            </span>
            <span style={{ fontSize: 9, color: 'var(--fg-subtle)', whiteSpace: 'nowrap' }}>
              {s.durationHours !== null ? fmtDuration(s.durationHours) : 'now'}
            </span>
          </div>
        );
      })}
      <style>{`
        @keyframes journey-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.65; }
        }
      `}</style>
    </div>
  );
}

// ── Vertical timeline ────────────────────────────────────────────────────────

function TimelineRow({
  segment,
  isLast,
}: {
  segment: IssueStateSegment;
  isLast: boolean;
}) {
  const c = flowColor(segment.flowCategory);
  const isCurrent = segment.exitedAt === null;

  return (
    <div style={{ display: 'flex', gap: 14 }}>
      {/* Left track: dot + connector */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: c.dot,
            flexShrink: 0,
            boxShadow: isCurrent ? `0 0 0 3px ${c.bg}` : undefined,
            marginTop: 3,
          }}
        />
        {!isLast && (
          <div
            style={{
              width: 2,
              flex: 1,
              background: 'var(--border)',
              minHeight: 28,
              marginTop: 4,
            }}
          />
        )}
      </div>

      {/* Right content */}
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : 20, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: isCurrent ? c.text : 'var(--fg)',
            }}
          >
            {segment.stateName}
            {isCurrent && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  marginLeft: 8,
                  color: c.text,
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                  borderRadius: 5,
                  padding: '1px 6px',
                  verticalAlign: 'middle',
                }}
              >
                now
              </span>
            )}
          </span>
          <span style={{ fontSize: 11, color: 'var(--fg-subtle)', whiteSpace: 'nowrap' }}>
            {fmtDate(segment.enteredAt)}
          </span>
        </div>

        {segment.durationHours !== null && (
          <div
            style={{
              marginTop: 5,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {/* Duration bar */}
            <div
              style={{
                height: 3,
                width: Math.min(120, Math.max(16, (segment.durationHours / 168) * 120)),
                background: c.border,
                borderRadius: 2,
                opacity: 0.5,
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
              {fmtDuration(segment.durationHours)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        background: accent ? 'rgba(99,102,241,0.05)' : 'var(--surface-3)',
        border: `1px solid ${accent ? 'rgba(99,102,241,0.25)' : 'var(--border)'}`,
        borderRadius: 10,
        padding: '10px 14px',
      }}
    >
      <p
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: 'var(--fg-subtle)',
          margin: '0 0 6px',
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: '1.6rem',
          fontWeight: 800,
          letterSpacing: '-0.025em',
          color: accent ? 'var(--accent-light)' : 'var(--fg)',
          margin: 0,
          lineHeight: 1,
        }}
      >
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 10, color: 'var(--fg-subtle)', margin: '4px 0 0' }}>{sub}</p>
      )}
    </div>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────

interface Props {
  workItemId: string;
  projectId: string;
  onClose: () => void;
}

export function IssueJourneyPanel({ workItemId, projectId, onClose }: Props) {
  const [journey, setJourney] = useState<IssueJourney | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setJourney(null);
    analyticsService
      .getIssueJourney(projectId, workItemId)
      .then((j) => { setJourney(j); setLoading(false); })
      .catch(() => { setError('Could not load issue data'); setLoading(false); });
  }, [projectId, workItemId]);

  // Close on Escape
  const handleKey = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); },
    [onClose]
  );
  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const priority = PRIORITY_STYLE[journey?.priority ?? 'none'] ?? PRIORITY_STYLE.none!;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(7,7,16,0.6)',
          backdropFilter: 'blur(2px)',
          zIndex: 40,
          animation: 'fade-in 180ms ease',
        }}
      />

      {/* Panel */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 460,
          maxWidth: '95vw',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slide-in 260ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Brand stripe */}
        <div style={{ height: 2, background: 'linear-gradient(90deg,#6366f1,#a78bfa)', flexShrink: 0 }} />

        {/* Header bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: 'var(--fg-subtle)',
              margin: 0,
            }}
          >
            Issue Journey
          </p>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--fg-subtle)',
              padding: 4,
              borderRadius: 7,
              display: 'flex',
              alignItems: 'center',
            }}
            title="Close (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {loading && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: 320,
                gap: 12,
              }}
            >
              <RefreshCw
                size={20}
                style={{ color: 'var(--accent-light)', animation: 'spin 1.2s linear infinite' }}
              />
              <p style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>Loading issue…</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 16px',
                background: 'var(--error-dim)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 10,
                color: '#fca5a5',
                fontSize: 13,
              }}
            >
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          {!loading && !error && journey && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              {/* Issue identity */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span className="badge">#{journey.sequenceId}</span>
                  {journey.priority !== 'none' && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: priority!.color,
                        background: priority!.bg,
                        padding: '2px 8px',
                        borderRadius: 6,
                        letterSpacing: '0.03em',
                      }}
                    >
                      {priority!.label}
                    </span>
                  )}
                  {journey.isReactivated && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: '#f59e0b',
                        background: 'rgba(245,158,11,0.1)',
                        padding: '2px 8px',
                        borderRadius: 6,
                      }}
                    >
                      Re-opened
                    </span>
                  )}
                </div>
                <h2
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: 'var(--fg)',
                    margin: '0 0 8px',
                    lineHeight: 1.35,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {journey.title}
                </h2>
                {journey.assigneeName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <User size={12} style={{ color: 'var(--fg-subtle)' }} />
                    <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
                      {journey.assigneeName}
                    </span>
                  </div>
                )}
              </div>

              {/* Metric cards */}
              <div style={{ display: 'flex', gap: 10 }}>
                <MetricCard
                  label="Cycle time"
                  value={fmtDuration(journey.cycleTimeHours)}
                  sub="start → done"
                  accent
                />
                <MetricCard
                  label="Lead time"
                  value={fmtDuration(journey.leadTimeHours)}
                  sub="created → done"
                />
                <MetricCard
                  label="Stages"
                  value={String(journey.states.length)}
                  sub={`${fmtDateShort(journey.createdAt)} → ${journey.completedAt ? fmtDateShort(journey.completedAt) : 'open'}`}
                />
              </div>

              {/* Proportional bar */}
              <div>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    color: 'var(--fg-subtle)',
                    margin: '0 0 8px',
                  }}
                >
                  Time distribution
                </p>
                <JourneyBar states={journey.states} />
                <p style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 6 }}>
                  Width of each band = proportion of total time spent there
                </p>
              </div>

              {/* Vertical timeline */}
              <div>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    color: 'var(--fg-subtle)',
                    margin: '0 0 14px',
                  }}
                >
                  Step-by-step journey
                </p>
                <div>
                  {journey.states.map((seg, i) => (
                    <TimelineRow
                      key={`${seg.stateId}-${i}`}
                      segment={seg}
                      isLast={i === journey.states.length - 1}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      <style>{`
        @keyframes fade-in  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slide-in { from { transform: translateX(100%) } to { transform: translateX(0) } }
      `}</style>
    </>
  );
}
