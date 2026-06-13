'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { workspaceService } from '@/services/workspaceService';
import { Key, Globe, ShieldCheck, ArrowRight, Link, CheckCircle2, RefreshCw, AlertCircle, Plus } from 'lucide-react';

type Connection = { id: string; plane_workspace_slug: string; sync_status: string; last_full_sync_at: string | null };

type Tab = 'apikey' | 'oauth';

function parsePlaneUrl(raw: string): { baseUrl: string; workspaceSlug: string } | null {
  const s = raw.trim();
  if (!s) return null;

  // Looks like just a workspace slug (letters, numbers, hyphens only)
  if (/^[a-z0-9][a-z0-9-]*$/i.test(s)) {
    return { baseUrl: 'https://api.plane.so', workspaceSlug: s };
  }

  // Add https:// if missing a scheme (e.g. "app.plane.so/my-workspace")
  const normalized = s.includes('://') ? s : `https://${s}`;

  try {
    const url = new URL(normalized);
    // Extract slug: first non-empty path segment
    const slug = url.pathname.split('/').filter(Boolean)[0];
    if (!slug) return null;

    // Cloud: app.plane.so → api.plane.so
    let apiHost = url.hostname;
    if (apiHost === 'app.plane.so') apiHost = 'api.plane.so';

    return {
      baseUrl: `${url.protocol}//${apiHost}`,
      workspaceSlug: slug,
    };
  } catch {
    return null;
  }
}

function urlHint(raw: string): string | null {
  if (!raw.trim()) return null;
  if (raw.includes('@')) return 'Enter your Plane workspace URL, not your email — e.g. https://app.plane.so/my-workspace';
  if (parsePlaneUrl(raw)) return null;
  return 'Paste the URL from your Plane browser tab, e.g. https://app.plane.so/my-workspace';
}

function syncStatusBadge(status: string): { icon: React.ReactNode; label: string; color: string; bg: string } {
  if (status === 'completed')
    return { icon: <CheckCircle2 size={11} />, label: 'Synced',   color: '#86efac', bg: 'rgba(34,197,94,0.1)'  };
  if (status === 'running' || status === 'pending')
    return { icon: <RefreshCw   size={11} style={{ animation: 'spin 1.4s linear infinite' }} />, label: 'Syncing…', color: '#93c5fd', bg: 'rgba(59,130,246,0.1)' };
  if (status === 'failed')
    return { icon: <AlertCircle size={11} />, label: 'Error',     color: '#f87171', bg: 'rgba(239,68,68,0.1)'  };
  return   { icon: <RefreshCw   size={11} />, label: status,      color: 'var(--fg-subtle)', bg: 'var(--surface-3)' };
}

export default function ConnectPage() {
  const router  = useRouter();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [showForm,    setShowForm]    = useState(false);
  const [tab,        setTab]       = useState<Tab>('apikey');
  const [planeUrl,   setPlaneUrl]  = useState('');
  const [apiKey,     setApiKey]    = useState('');
  const [error,      setError]     = useState('');
  const [loading,    setLoading]   = useState(false);

  useEffect(() => {
    workspaceService.listConnections().then((list) => {
      setConnections(list);
      setShowForm(list.length === 0);
    }).catch(() => setShowForm(true));
  }, []);

  const parsed = parsePlaneUrl(planeUrl);

  async function handleApiKeyConnect(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!parsed) {
      setError('Enter your full Plane URL including the workspace path');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { connectionId } = await workspaceService.connectApiKey(
        parsed.baseUrl,
        apiKey,
        parsed.workspaceSlug,
      );
      router.push(`/setup/state-mapping?connectionId=${connectionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuthConnect() {
    setLoading(true);
    setError('');
    try {
      const { authUrl } = await workspaceService.getOAuthUrl();
      window.location.href = authUrl;
    } catch {
      setError('OAuth not configured. Use API key instead.');
      setLoading(false);
    }
  }

  return (
    <div className="max-w-[520px] space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--fg)' }}>
          Workspace connections
        </h1>
        <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
          Cadence only reads data — no write access is requested.
        </p>
      </div>

      {/* Existing connections */}
      {connections.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--fg-subtle)', margin: 0 }}>
            Connected
          </p>
          {connections.map((c) => {
            const badge = syncStatusBadge(c.sync_status);
            const lastSync = c.last_full_sync_at
              ? new Date(c.last_full_sync_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
              : null;
            return (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'rgba(99,102,241,0.15)',
                    border: '1px solid rgba(99,102,241,0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--accent-light)',
                    flexShrink: 0,
                  }}
                >
                  {c.plane_workspace_slug[0]?.toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.plane_workspace_slug}
                  </p>
                  {lastSync && (
                    <p style={{ fontSize: 11, color: 'var(--fg-subtle)', margin: '2px 0 0' }}>
                      Last synced {lastSync}
                    </p>
                  )}
                </div>

                {/* Status badge */}
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 11,
                    fontWeight: 600,
                    color: badge.color,
                    background: badge.bg,
                    padding: '4px 9px',
                    borderRadius: 7,
                    flexShrink: 0,
                  }}
                >
                  {badge.icon}
                  {badge.label}
                </span>
              </div>
            );
          })}

          {/* Add another workspace button */}
          <button
            onClick={() => setShowForm((f) => !f)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--fg-muted)',
              background: 'none',
              border: '1px dashed var(--border)',
              borderRadius: 10,
              padding: '10px 16px',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <Plus size={13} />
            {showForm ? 'Cancel' : 'Add another workspace'}
          </button>
        </div>
      )}

      {/* Connect form — hidden when connections exist unless user clicks add */}
      {showForm && <div>
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--fg-subtle)', margin: '0 0 12px' }}>
        {connections.length > 0 ? 'Add workspace' : 'Connect a workspace'}
      </p>

      {/* Tab switcher */}
      <div
        className="flex gap-1 p-1 rounded-xl w-fit"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
      >
        {([
          { id: 'apikey', label: 'API Key', icon: Key   },
          { id: 'oauth',  label: 'OAuth',   icon: Globe },
        ] as { id: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setTab(id); setError(''); }}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all"
            style={{
              background: tab === id ? 'var(--surface-3)' : 'transparent',
              color:      tab === id ? 'var(--fg)'        : 'var(--fg-muted)',
            }}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Card */}
      <div className="card">
        {error && (
          <div
            className="text-sm rounded-lg px-3 py-2.5 mb-5"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            {error}
          </div>
        )}

        {tab === 'apikey' ? (
          <form onSubmit={handleApiKeyConnect} className="space-y-5">

            {/* Plane URL field */}
            <div>
              <label className="label">Your Plane URL</label>
              <input
                type="text"
                value={planeUrl}
                onChange={(e) => setPlaneUrl(e.target.value)}
                required
                className="input"
                placeholder="https://app.plane.so/my-workspace/"
                autoFocus
              />
              {/* Live parse preview */}
              {planeUrl && (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  {parsed ? (
                    <>
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-md font-medium"
                        style={{ background: 'rgba(34,197,94,0.1)', color: '#86efac', border: '1px solid rgba(34,197,94,0.2)' }}
                      >
                        ✓ workspace: {parsed.workspaceSlug}
                      </span>
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-md"
                        style={{ background: 'var(--surface-3)', color: 'var(--fg-subtle)' }}
                      >
                        api: {parsed.baseUrl}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs" style={{ color: '#fca5a5' }}>
                      {urlHint(planeUrl) ?? 'Could not parse workspace slug from URL'}
                    </span>
                  )}
                </div>
              )}
              <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--fg-subtle)' }}>
                Paste the URL from your browser. Works with cloud (<code style={{ color: 'var(--fg-muted)' }}>app.plane.so</code>) and self-hosted instances.
              </p>
            </div>

            {/* API Key field */}
            <div>
              <label className="label">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
                className="input font-mono"
                placeholder="plane_api_xxxxxxxxxxxxxxxx"
              />
              <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: 'var(--fg-subtle)' }}>
                <Link size={10} />
                Plane → Profile → API tokens → Create token
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !parsed}
              className="btn-primary w-full justify-center"
              style={{ padding: '9px 16px' }}
            >
              {loading ? 'Connecting…' : (
                <>Connect workspace <ArrowRight size={14} /></>
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="space-y-3">
              {[
                { icon: ShieldCheck, text: 'Read-only access — we never write to your workspace' },
                { icon: Key,  text: 'Tokens are stored encrypted with AES-256-GCM' },
                { icon: Globe, text: 'Works with app.plane.so and self-hosted instances' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-start gap-3">
                  <Icon size={14} style={{ color: 'var(--accent-light)', marginTop: 1 }} />
                  <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>{text}</p>
                </div>
              ))}
            </div>

            <button
              onClick={handleOAuthConnect}
              disabled={loading}
              className="btn-primary w-full justify-center"
              style={{ padding: '9px 16px' }}
            >
              {loading ? 'Redirecting…' : (
                <>Continue with Plane <ArrowRight size={14} /></>
              )}
            </button>
          </div>
        )}
      </div>
      </div>}
    </div>
  );
}
