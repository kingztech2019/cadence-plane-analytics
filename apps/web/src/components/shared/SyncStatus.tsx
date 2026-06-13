'use client';
import { useEffect, useState } from 'react';
import { workspaceService } from '@/services/workspaceService';
import { RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface SyncState {
  sync_status: string;
  total_items_synced: number | null;
  last_error: string | null;
}

const STATUS = {
  pending:   { icon: Clock,        color: 'var(--fg-subtle)',  label: 'Pending',      spin: false },
  running:   { icon: RefreshCw,    color: 'var(--warning)',    label: 'Syncing',      spin: true  },
  completed: { icon: CheckCircle2, color: 'var(--success)',    label: 'Synced',       spin: false },
  failed:    { icon: XCircle,      color: 'var(--error)',      label: 'Sync failed',  spin: false },
} as const;

export function SyncStatus({ connectionId }: { connectionId: string }) {
  const [state, setState] = useState<SyncState | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    async function poll() {
      const s = await workspaceService.getSyncStatus(connectionId);
      setState(s);
      if (s.sync_status === 'completed' || s.sync_status === 'failed') {
        clearInterval(timer);
      }
    }
    poll();
    timer = setInterval(poll, 10_000);
    return () => clearInterval(timer);
  }, [connectionId]);

  if (!state) return null;

  const cfg = STATUS[state.sync_status as keyof typeof STATUS] ?? STATUS.pending;
  const Icon = cfg.icon;

  return (
    <div className="flex items-center gap-2">
      <Icon
        size={13}
        style={{ color: cfg.color, animation: cfg.spin ? 'spin 1.2s linear infinite' : undefined }}
      />
      <span className="text-xs font-medium" style={{ color: cfg.color }}>
        {cfg.label}
      </span>
      {state.total_items_synced !== null && state.total_items_synced > 0 && (
        <span
          className="text-xs px-1.5 py-0.5 rounded"
          style={{ background: 'var(--surface-3)', color: 'var(--fg-subtle)' }}
        >
          {state.total_items_synced.toLocaleString()} items
        </span>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
