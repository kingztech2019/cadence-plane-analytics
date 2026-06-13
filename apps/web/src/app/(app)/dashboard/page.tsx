'use client';
import { useEffect, useState } from 'react';
import { workspaceService } from '@/services/workspaceService';
import { SyncStatus } from '@/components/shared/SyncStatus';
import Link from 'next/link';
import { Plus, ArrowUpRight, Clock, TrendingDown, Layers, Users, BarChart2 } from 'lucide-react';

interface Connection {
  id: string;
  plane_workspace_slug: string;
  sync_status: string;
  last_full_sync_at: string | null;
}

interface Project {
  id: string;
  name: string;
  identifier: string;
}

const FEATURES = [
  { icon: Clock,        label: 'Delivery Speed' },
  { icon: TrendingDown, label: 'Bottlenecks'    },
  { icon: Layers,       label: 'Work Flow'      },
  { icon: Users,        label: 'Team Output'    },
];

function ProjectSkeleton() {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="skeleton" style={{ width: 38, height: 22 }} />
        <div className="skeleton" style={{ width: 140, height: 16 }} />
      </div>
      <div className="skeleton" style={{ width: '100%', height: 12 }} />
      <div className="skeleton" style={{ width: '75%', height: 12 }} />
    </div>
  );
}

export default function DashboardPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [projects,    setProjects]    = useState<Project[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    workspaceService.listConnections().then(async (conns) => {
      setConnections(conns);
      if (conns[0]) {
        const projs = await workspaceService.listProjects(conns[0].id);
        setProjects(projs);
      }
      setLoading(false);
    });
  }, []);

  if (!loading && connections.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '70vh',
          gap: 28,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: 'var(--accent-dim)',
            border: '1px solid var(--accent-glow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 0 8px rgba(99,102,241,0.05)',
          }}
        >
          <BarChart2 size={28} style={{ color: 'var(--accent-light)' }} />
        </div>

        <div style={{ maxWidth: 340 }}>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: 'var(--fg)',
              letterSpacing: '-0.015em',
              margin: '0 0 10px',
            }}
          >
            No workspace connected yet
          </h2>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--fg-muted)', margin: 0 }}>
            Connect your Plane workspace to start tracking cycle times,
            bottlenecks, and team delivery metrics.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <Link href="/connect" className="btn-primary">
            <Plus size={15} />
            Connect workspace
          </Link>
          <p style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>
            API key &amp; OAuth supported · Read-only access
          </p>
        </div>
      </div>
    );
  }

  const connection = connections[0];

  return (
    <div style={{ maxWidth: 980 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 28,
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: 'var(--fg)',
              letterSpacing: '-0.025em',
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            Projects
          </h1>
          {connection && (
            <p style={{ fontSize: 13, color: 'var(--fg-muted)', margin: '6px 0 0' }}>
              {connection.plane_workspace_slug}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {connection && <SyncStatus connectionId={connection.id} />}
          <Link href="/connect" className="btn-ghost">
            <Plus size={14} />
            Add workspace
          </Link>
        </div>
      </div>

      {/* Stats strip */}
      {!loading && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            marginBottom: 28,
          }}
        >
          {[
            {
              value: projects.length,
              label: 'Projects',
              sub: 'being tracked',
            },
            {
              value: connection?.sync_status === 'completed' ? 'Live' : 'Syncing',
              label: 'Data status',
              sub: connection?.sync_status === 'completed' ? 'up to date' : 'processing…',
            },
            {
              value: connection
                ? connection.last_full_sync_at
                  ? new Date(connection.last_full_sync_at).toLocaleDateString('en', {
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'In progress'
                : '—',
              label: 'Last sync',
              sub: 'full backfill',
            },
          ].map((s) => (
            <div key={s.label} className="card-sm">
              <p className="stat-label" style={{ marginBottom: 6 }}>{s.label}</p>
              <p className="stat-number" style={{ fontSize: '1.75rem' }}>{s.value}</p>
              <p style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 4 }}>{s.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Projects section header */}
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: 'var(--fg-subtle)',
          marginBottom: 14,
        }}
      >
        {loading ? 'Loading…' : `${projects.length} project${projects.length !== 1 ? 's' : ''}`}
      </p>

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {[1, 2, 3].map((n) => <ProjectSkeleton key={n} />)}
        </div>
      ) : projects.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            border: '1px dashed var(--border)',
            borderRadius: 14,
          }}
        >
          <p style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>
            No projects found — sync may still be running.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}/cycle-time`}
              className="card card-hover"
              style={{
                display: 'block',
                textDecoration: 'none',
                borderLeft: '3px solid var(--accent)',
                paddingLeft: 18,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <span className="badge">{p.identifier}</span>
                <ArrowUpRight size={15} style={{ color: 'var(--fg-subtle)', flexShrink: 0 }} />
              </div>

              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--fg)',
                  margin: '0 0 14px',
                  lineHeight: 1.4,
                }}
              >
                {p.name}
              </h3>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px 14px',
                  paddingTop: 12,
                  borderTop: '1px solid var(--border-muted)',
                }}
              >
                {FEATURES.map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      color: 'var(--fg-subtle)',
                    }}
                  >
                    <Icon size={10} />
                    {label}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
