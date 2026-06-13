'use client';
import { useEffect, useState, useMemo } from 'react';
import { analyticsService } from '@/services/analyticsService';
import { workspaceService } from '@/services/workspaceService';
import type { ContributorProfile } from '@flow-analytics/shared';
import { Users, AlertCircle } from 'lucide-react';

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(hours: number): string {
  if (hours < 1)   return `${Math.round(hours * 60)}m`;
  if (hours < 24)  return `${Math.round(hours)}h`;
  if (hours < 168) return `${(hours / 24).toFixed(1)}d`;
  return `${(hours / 168).toFixed(1)}w`;
}

function isoDate(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

const PROJECT_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#22c55e'];
function projectColor(id: string): string {
  const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PROJECT_COLORS[hash % PROJECT_COLORS.length]!;
}

function initials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── time window options ──────────────────────────────────────────────────────

const WINDOWS = [
  { label: 'Last 30 days',   from: () => isoDate(30),  to: () => isoDate(0) },
  { label: 'Last 90 days',   from: () => isoDate(90),  to: () => isoDate(0) },
  { label: 'Last 6 months',  from: () => isoDate(180), to: () => isoDate(0) },
  { label: 'All time',       from: () => '2020-01-01', to: () => isoDate(0) },
] as const;

type WindowIdx = 0 | 1 | 2 | 3;

const SORTS = [
  { label: 'Name (A–Z)',          key: 'name'   },
  { label: 'By volume',           key: 'volume' },
  { label: 'By speed',            key: 'speed'  },
  { label: 'By project spread',   key: 'spread' },
] as const;

type SortKey = 'name' | 'volume' | 'speed' | 'spread';

// ─── contributor card ─────────────────────────────────────────────────────────

function ContributorCard({
  contributor,
  maxIssues,
}: {
  contributor: ContributorProfile;
  maxIssues:   number;
}) {
  const barWidth = maxIssues > 0 ? (contributor.totalIssues / maxIssues) * 100 : 0;

  return (
    <div
      style={{
        padding:       '20px 22px',
        borderRadius:   14,
        border:        '1px solid var(--border)',
        background:    'var(--surface)',
        boxShadow:     '0 1px 4px rgba(0,0,0,0.12)',
        display:       'flex',
        flexDirection: 'column',
        gap:            16,
        transition:    'border-color 140ms ease, box-shadow 140ms ease',
      }}
      className="card-hover"
    >
      {/* Profile header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width:          40,
            height:         40,
            borderRadius:   '50%',
            background:     'linear-gradient(135deg, #6366f1, #a78bfa)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       13,
            fontWeight:     700,
            color:          '#fff',
            flexShrink:     0,
            letterSpacing:  '0.03em',
          }}
        >
          {initials(contributor.displayName)}
        </div>
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              fontSize:     13,
              fontWeight:   700,
              color:        'var(--fg)',
              margin:       0,
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}
          >
            {contributor.displayName}
          </p>
          <p style={{ fontSize: 11, color: 'var(--fg-subtle)', margin: '2px 0 0' }}>
            {contributor.projectCount === 1
              ? '1 project'
              : `${contributor.projectCount} projects`}
          </p>
        </div>
      </div>

      {/* Activity bar + issue count */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--fg-subtle)' }}>
            Issues completed
          </span>
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--fg)', lineHeight: 1 }}>
            {contributor.totalIssues}
          </span>
        </div>
        {/* Relative activity bar — no axis, no ranking */}
        <div
          style={{
            height:       4,
            borderRadius: 99,
            background:   'var(--surface-3)',
            overflow:     'hidden',
          }}
        >
          <div
            style={{
              height:       '100%',
              width:        `${barWidth}%`,
              borderRadius: 99,
              background:   'linear-gradient(90deg, #6366f1, #a78bfa)',
              transition:   'width 400ms ease',
            }}
          />
        </div>
      </div>

      {/* Speed metrics */}
      <div
        style={{
          display:      'grid',
          gridTemplateColumns: '1fr 1fr',
          gap:           8,
        }}
      >
        {[
          { label: 'Typical speed (P50)', value: contributor.p50Hours },
          { label: 'Slowest 15% (P85)',   value: contributor.p85Hours },
        ].map((m) => (
          <div
            key={m.label}
            style={{
              padding:      '10px 12px',
              background:   'var(--surface-2)',
              borderRadius:  9,
              border:       '1px solid var(--border)',
            }}
          >
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-subtle)', margin: '0 0 4px' }}>
              {m.label}
            </p>
            <p style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--fg)', margin: 0 }}>
              {m.value !== null ? fmt(m.value) : '—'}
            </p>
          </div>
        ))}
      </div>

      {/* Project spread */}
      {contributor.projects.length > 0 && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--fg-subtle)', margin: '0 0 8px' }}>
            Active in
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {contributor.projects.map((p) => {
              const color = projectColor(p.projectId);
              return (
                <div
                  key={p.projectId}
                  style={{
                    display:       'flex',
                    alignItems:    'center',
                    gap:            5,
                    padding:       '4px 10px',
                    borderRadius:   8,
                    background:    `${color}14`,
                    border:        `1px solid ${color}33`,
                    fontSize:       11,
                    fontWeight:     500,
                    color:         'var(--fg-muted)',
                    whiteSpace:    'nowrap',
                  }}
                >
                  <div
                    style={{
                      width:        6,
                      height:       6,
                      borderRadius: '50%',
                      background:   color,
                      flexShrink:   0,
                    }}
                  />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>
                    {p.projectName}
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--fg)', marginLeft: 2 }}>
                    {p.issues}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ContributorsPage() {
  const [connectionId,  setConnectionId]  = useState<string | null>(null);
  const [contributors,  setContributors]  = useState<ContributorProfile[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [windowIdx,     setWindowIdx]     = useState<WindowIdx>(1); // 90 days default
  const [sortKey,       setSortKey]       = useState<SortKey>('name');
  const [totalIssues,   setTotalIssues]   = useState(0);

  // Step 1: resolve connection ID
  useEffect(() => {
    workspaceService.listConnections().then((conns) => {
      if (conns[0]) setConnectionId(conns[0].id);
      else          setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Step 2: fetch contributors when connectionId or window changes
  useEffect(() => {
    if (!connectionId) return;
    const win = WINDOWS[windowIdx];
    setLoading(true);
    analyticsService
      .getContributors(connectionId, win.from(), win.to())
      .then((d) => {
        setContributors(d.contributors);
        setTotalIssues(d.contributors.reduce((s, c) => s + c.totalIssues, 0));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [connectionId, windowIdx]);

  const sorted = useMemo(() => {
    const list = [...contributors];
    switch (sortKey) {
      case 'volume': return list.sort((a, b) => b.totalIssues - a.totalIssues);
      case 'speed':  return list.sort((a, b) => {
        if (a.p50Hours === null) return 1;
        if (b.p50Hours === null) return -1;
        return a.p50Hours - b.p50Hours;
      });
      case 'spread': return list.sort((a, b) => b.projectCount - a.projectCount);
      default:       return list.sort((a, b) => a.displayName.localeCompare(b.displayName));
    }
  }, [contributors, sortKey]);

  const maxIssues = useMemo(
    () => Math.max(1, ...contributors.map((c) => c.totalIssues)),
    [contributors]
  );

  const selectStyle: React.CSSProperties = {
    background:   'var(--surface-2)',
    border:       '1px solid var(--border)',
    borderRadius:  9,
    color:        'var(--fg)',
    fontSize:     12,
    fontWeight:   500,
    padding:      '7px 12px',
    appearance:   'none',
    cursor:       'pointer',
  };

  return (
    <div style={{ maxWidth: 980, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2
            style={{
              fontSize:      20,
              fontWeight:    800,
              color:         'var(--fg)',
              letterSpacing: '-0.02em',
              margin:        0,
            }}
          >
            Team contributions
          </h2>
          <p style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 5 }}>
            Who is shipping what — across every project, without any ranking
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={windowIdx}
            onChange={(e) => setWindowIdx(parseInt(e.target.value, 10) as WindowIdx)}
            style={selectStyle}
          >
            {WINDOWS.map((w, i) => (
              <option key={i} value={i}>{w.label}</option>
            ))}
          </select>

          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            style={selectStyle}
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary strip */}
      {!loading && contributors.length > 0 && (
        <div
          style={{
            display:    'flex',
            gap:         12,
            flexWrap:   'wrap',
          }}
        >
          {[
            { label: 'Contributors',      value: contributors.length  },
            { label: 'Issues completed',  value: totalIssues          },
            { label: 'Projects covered',  value: new Set(contributors.flatMap(c => c.projects.map(p => p.projectId))).size },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                padding:    '12px 20px',
                borderRadius: 12,
                background: 'var(--surface)',
                border:     '1px solid var(--border)',
                flex:       1,
                minWidth:   130,
              }}
            >
              <p className="stat-label" style={{ marginBottom: 4 }}>{s.label}</p>
              <p className="stat-number" style={{ fontSize: '1.8rem' }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton" style={{ height: 260, borderRadius: 14 }} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && contributors.length === 0 && (
        <div
          style={{
            padding:      '56px 24px',
            borderRadius:  14,
            border:       '1px solid var(--border)',
            background:   'var(--surface)',
            textAlign:    'center',
          }}
        >
          <Users size={32} style={{ color: 'var(--fg-subtle)', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)', margin: '0 0 6px' }}>
            No contributor data yet
          </p>
          <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: '0 auto', maxWidth: 360 }}>
            Once issues are completed and assigned to team members, their contributions
            will appear here. Try expanding the time window above.
          </p>
        </div>
      )}

      {/* Cards grid */}
      {!loading && sorted.length > 0 && (
        <div
          style={{
            display:             'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap:                  16,
          }}
        >
          {sorted.map((contributor) => (
            <ContributorCard
              key={contributor.memberId}
              contributor={contributor}
              maxIssues={maxIssues}
            />
          ))}
        </div>
      )}

      {/* Context note */}
      {!loading && sorted.length > 0 && (
        <p
          style={{
            fontSize:   11,
            color:      'var(--fg-subtle)',
            textAlign:  'center',
            margin:     0,
            lineHeight: 1.6,
          }}
        >
          The activity bar shows relative volume within the selected period — not a ranking.
          Sorting reorders cards; no positions are assigned.
        </p>
      )}
    </div>
  );
}
