'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { projectService } from '@/services/projectService';
import { ArrowRight, MapPin } from 'lucide-react';

type FlowCategory = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled';

interface State {
  id: string;
  name: string;
  color: string;
  plane_group: string;
  flow_category: FlowCategory;
}

const FLOW_OPTIONS: { value: FlowCategory; label: string }[] = [
  { value: 'backlog',     label: 'Backlog'      },
  { value: 'todo',        label: 'To Do'        },
  { value: 'in_progress', label: 'In Progress'  },
  { value: 'review',      label: 'In Review'    },
  { value: 'done',        label: 'Done'         },
  { value: 'cancelled',   label: 'Cancelled'    },
];

const GROUP_BADGE: Record<string, string> = {
  backlog:   '#6366f1',
  unstarted: '#94a3b8',
  started:   '#f59e0b',
  completed: '#22c55e',
  cancelled: '#71717a',
};

function StateMappingContent() {
  const router   = useRouter();
  const params   = useSearchParams();
  const projectId = params.get('projectId');

  const [states,  setStates]  = useState<State[]>([]);
  const [mappings, setMappings] = useState<Record<string, FlowCategory>>({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    if (!projectId) return;
    projectService.listStates(projectId).then((s) => {
      const typed = s as State[];
      setStates(typed);
      const initial: Record<string, FlowCategory> = {};
      typed.forEach((state) => { initial[state.id] = state.flow_category; });
      setMappings(initial);
      setLoading(false);
    });
  }, [projectId]);

  async function handleSave() {
    if (!projectId) return;
    setSaving(true);
    const updates = Object.entries(mappings).map(([stateId, flowCategory]) => ({
      stateId,
      flowCategory,
    }));
    await projectService.updateStateMappings(projectId, updates);
    router.push(`/projects/${projectId}/cycle-time`);
  }

  if (!projectId) {
    return (
      <div className="max-w-2xl space-y-3">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>State Mapping</h1>
        <p style={{ color: 'var(--fg-muted)' }}>Select a project to configure state mappings.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)' }}
        >
          <MapPin size={16} style={{ color: 'var(--accent-light)' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--fg)' }}>
            Map states to flow categories
          </h1>
          <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
            Cadence uses these mappings to compute cycle time and lead time.
            Defaults are set from Plane&apos;s state groups — adjust only if needed.
          </p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card space-y-3">
          {[1,2,3,4].map((n) => (
            <div key={n} className="flex items-center gap-3">
              <div className="skeleton w-3 h-3 rounded-full" />
              <div className="skeleton h-4 w-32 rounded" />
              <div className="skeleton h-4 w-16 rounded ml-auto" />
            </div>
          ))}
        </div>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--border)' }}
        >
          <div
            className="grid px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider"
            style={{
              gridTemplateColumns: '1fr 100px 160px',
              background: 'var(--surface-3)',
              borderBottom: '1px solid var(--border)',
              color: 'var(--fg-subtle)',
            }}
          >
            <span>State</span>
            <span>Group</span>
            <span>Flow Category</span>
          </div>

          {states.map((state, i) => (
            <div
              key={state.id}
              className="grid items-center px-5 py-3"
              style={{
                gridTemplateColumns: '1fr 100px 160px',
                borderTop: i > 0 ? '1px solid var(--border-muted)' : undefined,
                background: 'var(--surface-2)',
              }}
            >
              {/* State name */}
              <div className="flex items-center gap-2.5">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: state.color }}
                />
                <span className="text-sm font-medium" style={{ color: 'var(--fg)' }}>
                  {state.name}
                </span>
              </div>

              {/* Group badge */}
              <span
                className="text-[11px] font-medium px-2 py-0.5 rounded-md w-fit"
                style={{
                  background: `${GROUP_BADGE[state.plane_group] ?? '#6b7280'}18`,
                  color: GROUP_BADGE[state.plane_group] ?? '#6b7280',
                }}
              >
                {state.plane_group}
              </span>

              {/* Flow category select */}
              <select
                value={mappings[state.id] ?? state.flow_category}
                onChange={(e) =>
                  setMappings((m) => ({ ...m, [state.id]: e.target.value as FlowCategory }))
                }
                className="input text-xs"
                style={{ padding: '5px 10px' }}
              >
                {FLOW_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/dashboard')}
          className="btn-ghost"
        >
          Skip for now
        </button>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="btn-primary"
        >
          {saving ? 'Saving…' : (
            <>Save &amp; start sync <ArrowRight size={14} /></>
          )}
        </button>
      </div>
    </div>
  );
}

export default function StateMappingPage() {
  return (
    <Suspense fallback={<p style={{ color: 'var(--fg-muted)' }}>Loading…</p>}>
      <StateMappingContent />
    </Suspense>
  );
}
