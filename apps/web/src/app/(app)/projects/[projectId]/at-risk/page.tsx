'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { analyticsService } from '@/services/analyticsService';
import type { AtRiskIssue, AtRiskResult } from '@flow-analytics/shared';
import { AlertTriangle, CheckCircle2, Clock, User } from 'lucide-react';

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(hours: number): string {
  if (hours < 1)   return `${Math.round(hours * 60)}m`;
  if (hours < 24)  return `${Math.round(hours)}h`;
  if (hours < 168) return `${(hours / 24).toFixed(1)}d`;
  return `${(hours / 168).toFixed(1)}w`;
}

function severity(overagePct: number): { color: string; bg: string; label: string } {
  if (overagePct >= 200) return { color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  label: 'Critical' };
  if (overagePct >= 100) return { color: '#f97316', bg: 'rgba(249,115,22,0.10)', label: 'High'     };
  return                        { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', label: 'Warning'  };
}

// ─── issue card ───────────────────────────────────────────────────────────────

function AtRiskCard({ issue }: { issue: AtRiskIssue }) {
  const sev     = severity(issue.overagePct);
  const multi   = ((issue.hoursInCurrentState / issue.p85ForState)).toFixed(1);
  // progress bar: capped at 3× P85 so bar doesn't overflow meaninglessly
  const cap     = issue.p85ForState * 3;
  const fillPct = Math.min((issue.hoursInCurrentState / cap) * 100, 100);
  const p85Pct  = (1 / 3) * 100; // P85 marker is always at 33% of the capped bar

  return (
    <div
      style={{
        display:    'flex',
        gap:         0,
        borderRadius: 13,
        border:     `1px solid ${sev.color}44`,
        background: 'var(--surface)',
        overflow:   'hidden',
        boxShadow:  '0 1px 4px rgba(0,0,0,0.10)',
        transition: 'border-color 140ms ease',
      }}
    >
      {/* Severity stripe */}
      <div style={{ width: 4, flexShrink: 0, background: sev.color }} />

      <div style={{ flex: 1, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span
                style={{
                  fontSize:   10,
                  fontWeight: 700,
                  color:      'var(--fg-subtle)',
                  fontFamily: 'monospace',
                  letterSpacing: '0.04em',
                  flexShrink: 0,
                }}
              >
                #{issue.sequenceId}
              </span>
              <span
                style={{
                  display:      'inline-block',
                  padding:      '2px 8px',
                  borderRadius:  6,
                  fontSize:      10,
                  fontWeight:    600,
                  background:    sev.bg,
                  color:         sev.color,
                  border:       `1px solid ${sev.color}44`,
                  flexShrink:    0,
                }}
              >
                {sev.label}
              </span>
            </div>
            <p
              style={{
                fontSize:     14,
                fontWeight:   600,
                color:        'var(--fg)',
                margin:        0,
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
                maxWidth:      480,
              }}
            >
              {issue.title}
            </p>
          </div>

          {/* Multiplier badge */}
          <div
            style={{
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              flexShrink:      0,
              padding:        '8px 14px',
              borderRadius:    10,
              background:      sev.bg,
              border:         `1px solid ${sev.color}33`,
            }}
          >
            <span style={{ fontSize: 20, fontWeight: 800, color: sev.color, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {multi}×
            </span>
            <span style={{ fontSize: 9, fontWeight: 600, color: sev.color, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 2 }}>
              over P85
            </span>
          </div>
        </div>

        {/* State + time info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:           5,
              padding:      '4px 10px',
              borderRadius:  7,
              background:   'var(--surface-2)',
              border:       '1px solid var(--border)',
              fontSize:      11,
              fontWeight:    500,
              color:        'var(--fg-muted)',
            }}
          >
            <div
              style={{
                width:        6,
                height:       6,
                borderRadius: '50%',
                background:   sev.color,
                flexShrink:   0,
              }}
            />
            {issue.currentState}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--fg-muted)' }}>
            <Clock size={11} style={{ color: 'var(--fg-subtle)', flexShrink: 0 }} />
            <span style={{ fontWeight: 700, color: sev.color }}>{fmt(issue.hoursInCurrentState)}</span>
            <span>in this state · P85 is</span>
            <span style={{ fontWeight: 600, color: 'var(--fg)' }}>{fmt(issue.p85ForState)}</span>
          </div>

          {issue.assigneeName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--fg-subtle)', marginLeft: 'auto' }}>
              <User size={11} style={{ flexShrink: 0 }} />
              {issue.assigneeName}
            </div>
          )}
        </div>

        {/* Time bar */}
        <div>
          <div
            style={{
              position:     'relative',
              height:        6,
              borderRadius:  99,
              background:   'var(--surface-3)',
              overflow:     'hidden',
            }}
          >
            <div
              style={{
                height:       '100%',
                width:        `${fillPct}%`,
                borderRadius:  99,
                background:   `linear-gradient(90deg, ${sev.color}88, ${sev.color})`,
                transition:   'width 500ms ease',
              }}
            />
          </div>
          {/* P85 marker */}
          <div
            style={{
              position:    'relative',
              height:       0,
            }}
          >
            <div
              style={{
                position:   'absolute',
                left:       `${p85Pct}%`,
                top:        -8,
                width:       1,
                height:      8,
                background: 'var(--fg-subtle)',
                opacity:    0.5,
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
            <span style={{ fontSize: 10, color: 'var(--fg-subtle)' }}>0</span>
            <span style={{ fontSize: 10, color: 'var(--fg-subtle)', marginLeft: `calc(${p85Pct}% - 16px)` }}>
              P85 {fmt(issue.p85ForState)}
            </span>
            <span style={{ fontSize: 10, color: 'var(--fg-subtle)' }}>3× P85</span>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function AtRiskPage() {
  const params    = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [data,    setData]    = useState<AtRiskResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsService
      .getAtRiskIssues(projectId)
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectId]);

  const critical = (data?.issues ?? []).filter((i) => i.overagePct >= 200).length;
  const high     = (data?.issues ?? []).filter((i) => i.overagePct >= 100 && i.overagePct < 200).length;
  const warning  = (data?.issues ?? []).filter((i) => i.overagePct < 100).length;

  return (
    <div style={{ maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div>
        <h2
          style={{
            fontSize:      20,
            fontWeight:    800,
            color:        'var(--fg)',
            letterSpacing: '-0.02em',
            margin:         0,
            display:       'flex',
            alignItems:    'center',
            gap:            8,
          }}
        >
          <AlertTriangle size={18} style={{ color: '#f59e0b' }} />
          At-Risk Radar
        </h2>
        <p style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 5 }}>
          Issues currently in progress that have exceeded their P85 time threshold
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 160, borderRadius: 13 }} />
          ))}
        </div>
      )}

      {/* All clear */}
      {!loading && data?.issues.length === 0 && (
        <div
          style={{
            padding:      '56px 24px',
            borderRadius:  14,
            border:       '1px solid #22c55e44',
            background:   'rgba(34,197,94,0.06)',
            textAlign:    'center',
          }}
        >
          <CheckCircle2 size={36} style={{ color: '#22c55e', margin: '0 auto 14px' }} />
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)', margin: '0 0 6px' }}>
            All clear — no at-risk issues
          </p>
          <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: '0 auto', maxWidth: 360 }}>
            Every issue currently in progress is within its historical P85 time range. Keep shipping.
          </p>
        </div>
      )}

      {/* Summary + list */}
      {!loading && data && data.issues.length > 0 && (
        <>
          {/* Summary strip */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'Total at risk',  value: data.issues.length, color: '#f59e0b' },
              { label: 'Critical (>3×)', value: critical,           color: '#ef4444' },
              { label: 'High (2–3×)',    value: high,               color: '#f97316' },
              { label: 'Warning (1–2×)', value: warning,            color: '#f59e0b' },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  padding:    '12px 18px',
                  borderRadius: 12,
                  background: 'var(--surface)',
                  border:     `1px solid ${s.color}33`,
                  flex:        1,
                  minWidth:    110,
                }}
              >
                <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: s.color, margin: '0 0 4px' }}>
                  {s.label}
                </p>
                <p style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--fg)', margin: 0, lineHeight: 1 }}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          {/* P85 reference */}
          {data.projectP85 !== null && (
            <p style={{ fontSize: 11, color: 'var(--fg-subtle)', margin: 0 }}>
              Project P85 cycle time: <strong style={{ color: 'var(--fg)' }}>{fmt(data.projectP85)}</strong>
              {' '}— each issue below is compared against the P85 for its specific current state.
            </p>
          )}

          {/* Issue list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.issues.map((issue) => (
              <AtRiskCard key={issue.workItemId} issue={issue} />
            ))}
          </div>

          {/* Footer note */}
          <p style={{ fontSize: 11, color: 'var(--fg-subtle)', margin: 0, lineHeight: 1.6 }}>
            Issues are flagged when time in current state exceeds the P85 for that state (minimum 3 historical data points).
            The multiplier shows how far past the threshold the issue is.
          </p>
        </>
      )}
    </div>
  );
}
