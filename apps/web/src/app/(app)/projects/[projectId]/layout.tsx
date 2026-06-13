'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { Clock, TrendingDown, Layers, Users, Target, BarChart2, AlertTriangle, Zap, GitMerge, Timer, Share2, Copy, Check, Trash2 } from 'lucide-react';
import { analyticsService } from '@/services/analyticsService';
import { shareService } from '@/services/shareService';
import type { FlowHealthScore, FlowHealthSignal, ProjectSummary, SummarySignalSeverity } from '@flow-analytics/shared';
import { useRef } from 'react';

const NAV_TABS = [
  { key: 'cycle-time',      label: 'Cycle Time',      icon: Clock,          danger: false },
  { key: 'lead-time',       label: 'Lead Time',       icon: Timer,          danger: false },
  { key: 'bottleneck',      label: 'Bottlenecks',     icon: TrendingDown,   danger: false },
  { key: 'cfd',             label: 'WIP',             icon: Layers,         danger: false },
  { key: 'throughput',      label: 'Throughput',      icon: Users,          danger: false },
  { key: 'sprints',         label: 'Sprints',         icon: BarChart2,      danger: false },
  { key: 'flow-efficiency', label: 'Efficiency',      icon: Zap,            danger: false },
  { key: 'scope-creep',     label: 'Scope Creep',     icon: GitMerge,       danger: false },
  { key: 'forecast',        label: 'Forecast',        icon: Target,         danger: false },
  { key: 'at-risk',         label: 'At-Risk',         icon: AlertTriangle,  danger: true  },
];

// ─── Project Pulse (summary strip) ───────────────────────────────────────────

const SEVERITY_STYLES: Record<SummarySignalSeverity, { dot: string; bg: string; border: string; text: string; label: string }> = {
  critical: { dot: '#ef4444', bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.22)',   text: '#f87171', label: '#ef4444' },
  warning:  { dot: '#f59e0b', bg: 'rgba(245,158,11,0.07)',  border: 'rgba(245,158,11,0.22)',  text: '#fcd34d', label: '#f59e0b' },
  good:     { dot: '#22c55e', bg: 'rgba(34,197,94,0.07)',   border: 'rgba(34,197,94,0.22)',   text: '#86efac', label: '#22c55e' },
  info:     { dot: '#6366f1', bg: 'rgba(99,102,241,0.07)',  border: 'rgba(99,102,241,0.22)',  text: '#a5b4fc', label: '#6366f1' },
};

function ProjectPulse({ projectId }: { projectId: string }) {
  const [summary, setSummary] = useState<ProjectSummary | null>(null);

  useEffect(() => {
    analyticsService.getProjectSummary(projectId).then(setSummary).catch(() => {});
  }, [projectId]);

  if (!summary || summary.signals.length === 0) return null;

  return (
    <div
      style={{
        display:    'flex',
        flexWrap:   'wrap',
        gap:         8,
        marginBottom: 16,
        padding:    '10px 14px',
        borderRadius: 12,
        background: 'var(--surface-2)',
        border:     '1px solid var(--border)',
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--fg-subtle)',
          alignSelf: 'center',
          marginRight: 4,
          flexShrink: 0,
        }}
      >
        Pulse
      </span>
      {summary.signals.map((signal) => {
        const styles = SEVERITY_STYLES[signal.severity];
        return (
          <Link
            key={signal.key}
            href={`/projects/${projectId}/${signal.tabKey}`}
            style={{
              display:     'flex',
              alignItems:  'center',
              gap:          6,
              padding:     '5px 10px',
              borderRadius: 8,
              background:   styles.bg,
              border:      `1px solid ${styles.border}`,
              textDecoration: 'none',
              flexShrink:  0,
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: styles.dot,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 12, fontWeight: 600, color: styles.text }}>
              {signal.title}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: styles.label,
                background: `${styles.dot}22`,
                padding: '1px 6px',
                borderRadius: 5,
              }}
            >
              {signal.metric}
            </span>
            <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>
              {signal.detail}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

// ─── Health badge ─────────────────────────────────────────────────────────────

function scoreColor(s: number): string {
  return s >= 75 ? '#22c55e' : s >= 55 ? '#f59e0b' : '#ef4444';
}

function SignalRow({ signal }: { signal: FlowHealthSignal }) {
  const color = scoreColor(signal.score);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)' }}>
          {signal.label}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 28, textAlign: 'right' }}>
          {signal.score}
        </span>
      </div>
      <div style={{ height: 4, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${signal.score}%`,
            borderRadius: 99,
            background: color,
            transition: 'width 400ms ease',
          }}
        />
      </div>
      <p style={{ fontSize: 10, color: 'var(--fg-subtle)', margin: 0 }}>
        {signal.value} · {signal.context}
      </p>
    </div>
  );
}

// ─── Share widget ──────────────────────────────────────────────────────────────

function ShareWidget({ projectId }: { projectId: string }) {
  const [token,    setToken]    = useState<string | null>(null);
  const [open,     setOpen]     = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [copied,   setCopied]   = useState(false);
  const [popupPos, setPopupPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    shareService.getShare(projectId).then(setToken).catch(() => {});
  }, [projectId]);

  useEffect(() => {
    if (!open) return;
    function handleClick() { setOpen(false); }
    document.addEventListener('click', handleClick, { capture: true });
    return () => document.removeEventListener('click', handleClick, { capture: true });
  }, [open]);

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPopupPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    setOpen((o) => !o);
  }

  async function handleCreate(e: React.MouseEvent) {
    e.stopPropagation();
    setLoading(true);
    try {
      const t = await shareService.createShare(projectId);
      setToken(t);
    } finally { setLoading(false); }
  }

  async function handleRevoke(e: React.MouseEvent) {
    e.stopPropagation();
    if (!token) return;
    await shareService.revokeShare(token);
    setToken(null);
    setOpen(false);
  }

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    if (!token) return;
    const url = `${window.location.origin}/share/${token}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const shareUrl = token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${token}` : null;

  return (
    <div style={{ flexShrink: 0 }}>
      <button
        ref={btnRef}
        onClick={handleToggle}
        style={{
          display:    'flex',
          alignItems: 'center',
          gap:         6,
          padding:    '7px 13px',
          borderRadius: 10,
          background: 'var(--surface)',
          border:     '1px solid var(--border)',
          cursor:     'pointer',
          fontSize:    12,
          fontWeight:  600,
          color:      'var(--fg-muted)',
          whiteSpace: 'nowrap',
          transition: 'all 140ms ease',
        }}
      >
        <Share2 size={13} />
        Share
        {token && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />}
      </button>

      {open && popupPos && (
        <div
          style={{
            position:      'fixed',
            top:            popupPos.top,
            right:          popupPos.right,
            width:          300,
            background:    'var(--surface)',
            border:        '1px solid var(--border)',
            borderRadius:   14,
            boxShadow:     '0 8px 32px rgba(0,0,0,0.28)',
            padding:        20,
            zIndex:         9999,
            display:       'flex',
            flexDirection: 'column',
            gap:            14,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg)', margin: '0 0 4px' }}>Share analytics</p>
            <p style={{ fontSize: 11, color: 'var(--fg-subtle)', margin: 0 }}>
              Anyone with the link can view this project&apos;s analytics read-only. No login required.
            </p>
          </div>

          {!token ? (
            <button
              onClick={(e) => { void handleCreate(e); }}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                padding: '9px 14px', borderRadius: 9, cursor: loading ? 'wait' : 'pointer',
                background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                color: 'var(--accent-light)', fontSize: 12, fontWeight: 600,
              }}
            >
              <Share2 size={13} />
              {loading ? 'Creating…' : 'Create share link'}
            </button>
          ) : (
            <>
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--fg-subtle)', margin: '0 0 6px' }}>
                  Share link
                </p>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 10px',
                    background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9,
                  }}
                >
                  <span style={{ flex: 1, fontSize: 11, color: 'var(--fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {shareUrl}
                  </span>
                  <button
                    onClick={handleCopy}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: copied ? '#22c55e' : 'var(--fg-subtle)',
                      padding: 4, borderRadius: 5, display: 'flex', alignItems: 'center', flexShrink: 0,
                    }}
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              </div>

              <button
                onClick={(e) => { void handleRevoke(e); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'none', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '7px 12px', cursor: 'pointer',
                  fontSize: 11, fontWeight: 500, color: '#f87171',
                }}
              >
                <Trash2 size={12} />
                Revoke link
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function FlowHealthWidget({ projectId }: { projectId: string }) {
  const [health,  setHealth]  = useState<FlowHealthScore | null>(null);
  const [open,    setOpen]    = useState(false);
  const [popupPos, setPopupPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    analyticsService.getFlowHealthScore(projectId).then(setHealth).catch(() => {});
  }, [projectId]);

  useEffect(() => {
    if (!open) return;
    function handleClick() { setOpen(false); }
    document.addEventListener('click', handleClick, { capture: true });
    return () => document.removeEventListener('click', handleClick, { capture: true });
  }, [open]);

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPopupPos({
        top:   rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen((o) => !o);
  }

  if (!health || health.insufficient) return null;

  const color = scoreColor(health.overall);
  const gradeColor: Record<string, string> = {
    A: '#22c55e', B: '#84cc16', C: '#f59e0b', D: '#f97316', F: '#ef4444',
  };
  const gc = gradeColor[health.grade] ?? color;

  return (
    <div style={{ flexShrink: 0 }}>
      <button
        ref={btnRef}
        onClick={handleToggle}
        style={{
          display:    'flex',
          alignItems: 'center',
          gap:         7,
          padding:    '7px 13px',
          borderRadius: 10,
          background: 'var(--surface)',
          border:     `1px solid ${color}44`,
          cursor:     'pointer',
          fontSize:    12,
          fontWeight:  600,
          color:      'var(--fg)',
          whiteSpace: 'nowrap',
          boxShadow:  `0 0 0 2px ${color}18`,
          transition: 'all 140ms ease',
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        Flow Health
        <span
          style={{
            display:        'inline-flex',
            alignItems:     'center',
            justifyContent: 'center',
            width:           20,
            height:          20,
            borderRadius:    6,
            background:     `${gc}22`,
            border:         `1px solid ${gc}44`,
            fontSize:        11,
            fontWeight:      800,
            color:           gc,
          }}
        >
          {health.grade}
        </span>
        <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.03em', color }}>
          {health.overall}
        </span>
      </button>

      {open && popupPos && (
        <div
          style={{
            position:      'fixed',
            top:            popupPos.top,
            right:          popupPos.right,
            width:          280,
            background:    'var(--surface)',
            border:        '1px solid var(--border)',
            borderRadius:   14,
            boxShadow:     '0 8px 32px rgba(0,0,0,0.28)',
            padding:        20,
            zIndex:         9999,
            display:       'flex',
            flexDirection: 'column',
            gap:            14,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg)', margin: 0 }}>
              Flow Health Breakdown
            </p>
            <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>Last 30d</span>
          </div>
          {health.signals.map((s) => <SignalRow key={s.key} signal={s} />)}
          <p style={{ fontSize: 10, color: 'var(--fg-subtle)', margin: 0, lineHeight: 1.5 }}>
            Weighted composite: cycle time (30%), WIP balance (25%), reactivation (20%), throughput (25%)
          </p>
        </div>
      )}
    </div>
  );
}

// ─── layout ───────────────────────────────────────────────────────────────────

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const pathname = usePathname();

  return (
    <div style={{ maxWidth: 980 }}>
      {/* Pulse strip — top-level signals across all metrics */}
      <ProjectPulse projectId={projectId} />

      {/* Tab bar + health badge */}
      <div
        style={{
          display:     'flex',
          alignItems:  'center',
          gap:          12,
          marginBottom: 24,
          flexWrap:    'wrap',
        }}
      >
        <div
          style={{
            display:    'flex',
            gap:         4,
            padding:     5,
            borderRadius: 14,
            background: 'var(--surface-2)',
            border:     '1px solid var(--border)',
            flexWrap:   'wrap',
          }}
        >
          {NAV_TABS.map(({ key, label, icon: Icon, danger }) => {
            const href   = `/projects/${projectId}/${key}`;
            const active = pathname === href;
            return (
              <Link
                key={key}
                href={href}
                style={{
                  display:       'flex',
                  alignItems:    'center',
                  gap:            7,
                  padding:       '7px 12px',
                  borderRadius:   10,
                  fontSize:       12,
                  fontWeight:    active ? 600 : 500,
                  textDecoration: 'none',
                  background:    active
                    ? danger
                      ? 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(249,115,22,0.14) 100%)'
                      : 'linear-gradient(135deg, rgba(99,102,241,0.22) 0%, rgba(167,139,250,0.16) 100%)'
                    : 'transparent',
                  color: active
                    ? danger ? '#f87171' : 'var(--accent-light)'
                    : 'var(--fg-muted)',
                  border:    active
                    ? danger ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(99,102,241,0.25)'
                    : '1px solid transparent',
                  boxShadow: active ? '0 1px 4px rgba(99,102,241,0.12)' : 'none',
                  transition: 'all 140ms ease',
                }}
              >
                <Icon
                  size={12}
                  style={{
                    color: active
                      ? danger ? '#f87171' : 'var(--accent-light)'
                      : 'var(--fg-subtle)',
                    flexShrink: 0,
                  }}
                />
                {label}
              </Link>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <ShareWidget projectId={projectId} />
          <FlowHealthWidget projectId={projectId} />
        </div>
      </div>

      {children}
    </div>
  );
}
