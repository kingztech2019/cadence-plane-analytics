'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  LogOut,
  ChevronRight,
  Building2,
  Plug,
  GitBranch,
  HelpCircle,
  ClipboardList,
  FileBarChart2,
  Archive,
  BarChart3,
} from 'lucide-react';
import { authService } from '@/services/authService';
import { CadenceMark } from '@/components/shared/CadenceLogo';
import { useEffect, useState } from 'react';
import { workspaceService } from '@/services/workspaceService';

// ─── helpers ──────────────────────────────────────────────────────────────────

function parseJwt(token: string) {
  try {
    const b64 = token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64)) as { name?: string; email?: string };
  } catch { return null; }
}

const PROJECT_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#22c55e'];

function projectColor(id: string): string {
  const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PROJECT_COLORS[hash % PROJECT_COLORS.length]!;
}

function Initials({ name, email }: { name?: string | undefined; email?: string | undefined }) {
  const src     = name || email || '';
  const letters = src.trim()
    ? src.includes(' ')
      ? src.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
      : src.slice(0, 2).toUpperCase()
    : '?';
  return (
    <div
      style={{
        width: 30, height: 30, borderRadius: '50%',
        background: 'linear-gradient(135deg, #6366f1, #a78bfa)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: '#fff',
        flexShrink: 0, letterSpacing: '0.02em',
      }}
    >
      {letters}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.09em',
        textTransform: 'uppercase', color: 'var(--fg-subtle)',
        padding: '0 10px 5px', margin: '20px 0 0',
      }}
    >
      {children}
    </p>
  );
}

function NavLink({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active?: boolean;
}) {
  return (
    <Link href={href} className={'nav-item' + (active ? ' active' : '')}>
      <Icon size={14} />
      {label}
    </Link>
  );
}

// ─── component ────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  const [workspace,       setWorkspace]       = useState<{ id: string; slug: string } | null>(null);
  const [syncStatus,      setSyncStatus]      = useState('');
  const [user,            setUser]            = useState<{ name?: string; email?: string } | null>(null);
  const [projects,        setProjects]        = useState<Array<{ id: string; name: string; identifier: string }>>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  const activeProjectId = pathname.match(/\/projects\/([^/]+)/)?.[1];

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) setUser(parseJwt(token));

    workspaceService
      .listConnections()
      .then((conns) => {
        const conn = conns[0];
        if (!conn) { setProjectsLoading(false); return; }
        setWorkspace({ id: conn.id, slug: conn.plane_workspace_slug });
        setSyncStatus(conn.sync_status ?? '');
        return workspaceService.listProjects(conn.id).then((ps) => {
          setProjects(ps);
          setProjectsLoading(false);
        });
      })
      .catch(() => setProjectsLoading(false));
  }, []);

  function handleSignOut() {
    authService.logout();
    router.push('/login');
  }

  const statusDot: Record<string, { color: string; label: string }> = {
    completed: { color: '#22c55e',            label: 'Synced'      },
    running:   { color: '#f59e0b',            label: 'Syncing…'    },
    failed:    { color: '#ef4444',            label: 'Sync failed' },
    pending:   { color: 'var(--fg-subtle)',   label: 'Pending'     },
  };
  const dot = statusDot[syncStatus] ?? { color: 'var(--fg-subtle)', label: '' };

  return (
    <aside
      style={{
        width: 242, flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        height: '100%',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Brand gradient stripe */}
      <div style={{ height: 2, background: 'linear-gradient(90deg, #6366f1, #a78bfa)', flexShrink: 0 }} />

      {/* Brand header */}
      <div
        style={{
          height: 54, display: 'flex', alignItems: 'center',
          padding: '0 16px', borderBottom: '1px solid var(--border)',
          flexShrink: 0, gap: 10,
        }}
      >
        <CadenceMark size={26} />
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.015em', lineHeight: 1, margin: 0 }}>
            Cadence
          </p>
          <p style={{ fontSize: 10, color: 'var(--fg-subtle)', margin: '2px 0 0' }}>
            Delivery Analytics
          </p>
        </div>
      </div>

      {/* Workspace chip */}
      {workspace && (
        <div style={{ padding: '10px 10px 0' }}>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '8px 10px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 11,
            }}
          >
            <div
              style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'var(--accent-dim)',
                border: '1px solid var(--accent-glow)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Building2 size={13} style={{ color: 'var(--accent-light)' }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p
                style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--fg)', margin: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {workspace.slug}
              </p>
              {syncStatus && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: dot.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: dot.color }}>{dot.label}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scrollable nav */}
      <nav style={{ flex: 1, padding: '8px 8px 12px', overflowY: 'auto' }}>

        {/* ── MAIN ── */}
        <SectionLabel>Main</SectionLabel>
        <NavLink
          href="/dashboard"
          icon={LayoutDashboard}
          label="Dashboard"
          active={pathname === '/dashboard'}
        />
        <NavLink
          href="/contributors"
          icon={Users}
          label="Team"
          active={pathname === '/contributors'}
        />
        <NavLink
          href="/report"
          icon={ClipboardList}
          label="Status Report"
          active={pathname === '/report'}
        />
        <NavLink
          href="/monthly-report"
          icon={FileBarChart2}
          label="Monthly Report"
          active={pathname === '/monthly-report'}
        />
        <NavLink
          href="/quarterly-report"
          icon={BarChart3}
          label="Quarterly Report"
          active={pathname === '/quarterly-report'}
        />
        <NavLink
          href="/report-archive"
          icon={Archive}
          label="Report Archive"
          active={pathname === '/report-archive'}
        />

        {/* ── PROJECTS ── */}
        <SectionLabel>Projects</SectionLabel>

        {/* Loading skeletons */}
        {projectsLoading && (
          <div style={{ padding: '4px 2px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[90, 120, 72].map((w) => (
              <div key={w} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px' }}>
                <div className="skeleton" style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0 }} />
                <div className="skeleton" style={{ height: 12, width: w, borderRadius: 5 }} />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!projectsLoading && projects.length === 0 && (
          <p style={{ fontSize: 11, color: 'var(--fg-subtle)', padding: '4px 10px', margin: 0 }}>
            No projects synced yet
          </p>
        )}

        {/* Project list */}
        {projects.slice(0, 8).map((project) => {
          const active = project.id === activeProjectId;
          const color  = projectColor(project.id);
          return (
            <Link
              key={project.id}
              href={`/projects/${project.id}/cycle-time`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '6px 10px 6px 8px',
                borderRadius: 9,
                textDecoration: 'none',
                margin: '1px 0',
                borderLeft: `2px solid ${active ? color : 'transparent'}`,
                background: active ? `${color}14` : 'transparent',
                transition: 'all 120ms ease',
              }}
            >
              {/* Letter avatar */}
              <div
                style={{
                  width: 22, height: 22, borderRadius: 6,
                  background: active ? color : `${color}22`,
                  border:     `1px solid ${color}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: 10, fontWeight: 800,
                  color: active ? '#fff' : color,
                  transition: 'all 120ms ease',
                }}
              >
                {project.name[0]?.toUpperCase() ?? '?'}
              </div>

              <span
                style={{
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--fg)' : 'var(--fg-muted)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  flex: 1,
                }}
              >
                {project.name}
              </span>

              {active && (
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
              )}
            </Link>
          );
        })}

        {/* All projects link */}
        <Link
          href="/dashboard"
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 10px', marginTop: 2,
            borderRadius: 8, textDecoration: 'none',
            color: 'var(--fg-subtle)', fontSize: 11,
          }}
        >
          All projects
          <ChevronRight size={11} />
        </Link>

        {/* ── WORKSPACE ── */}
        <SectionLabel>Workspace</SectionLabel>
        <NavLink
          href="/connect"
          icon={Plug}
          label="Connections"
          active={pathname === '/connect'}
        />
        <NavLink
          href="/setup/state-mapping"
          icon={GitBranch}
          label="State mapping"
          active={pathname === '/setup/state-mapping'}
        />
      </nav>

      {/* Bottom bar */}
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)' }}>
        {/* Help */}
        <div style={{ padding: '6px 8px 4px' }}>
          <Link
            href="/dashboard"
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '7px 10px', borderRadius: 9,
              textDecoration: 'none',
              color: 'var(--fg-subtle)', fontSize: 12, fontWeight: 500,
            }}
          >
            <HelpCircle size={14} />
            Help &amp; docs
          </Link>
        </div>

        {/* User profile */}
        <div style={{ padding: '2px 8px 10px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 10 }}>
            <Initials name={user?.name} email={user?.email} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--fg)', margin: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {user?.name || user?.email || 'Account'}
              </p>
              {user?.email && user?.name && (
                <p
                  style={{
                    fontSize: 10, color: 'var(--fg-subtle)', margin: '1px 0 0',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {user.email}
                </p>
              )}
            </div>
            <button
              onClick={handleSignOut}
              title="Sign out"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--fg-subtle)', padding: 5, borderRadius: 7,
                display: 'flex', alignItems: 'center', flexShrink: 0,
              }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
