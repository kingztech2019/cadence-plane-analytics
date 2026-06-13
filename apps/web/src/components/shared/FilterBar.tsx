'use client';
import type { DashboardFilters } from '@flow-analytics/shared';
import { SlidersHorizontal, Calendar } from 'lucide-react';

interface FilterBarProps {
  filters:       DashboardFilters;
  onChange:      (f: DashboardFilters) => void;
  projectId:     string;
  showDateRange?: boolean;
}

const PRESETS = [
  { label: '7d',  days: 7    },
  { label: '30d', days: 30   },
  { label: '90d', days: 90   },
  { label: '1y',  days: 365  },
  { label: 'All', days: null as number | null },
] as const;

function detectActivePreset(filters: DashboardFilters): number | null | false {
  if (!filters.dateFrom && !filters.dateTo) return null; // "All" active
  for (const p of PRESETS) {
    if (p.days === null) continue;
    const from = new Date(Date.now() - p.days * 86_400_000).toISOString().slice(0, 10);
    if (filters.dateFrom === from) return p.days;
  }
  return false; // custom range
}

const inputStyle: React.CSSProperties = {
  background:   'var(--surface-2)',
  border:       '1px solid var(--border)',
  borderRadius: 7,
  color:        'var(--fg)',
  fontSize:     12,
  padding:      '5px 10px',
  appearance:   'none',
};

export function FilterBar({ filters, onChange, showDateRange }: FilterBarProps) {
  const current = detectActivePreset(filters);

  function set(key: keyof DashboardFilters, value: string) {
    onChange({ ...filters, [key]: value || undefined });
  }

  function applyPreset(days: number | null) {
    if (days === null) {
      // Omit the keys entirely rather than setting to undefined (exactOptionalPropertyTypes)
      const { dateFrom: _df, dateTo: _dt, ...rest } = filters;
      onChange(rest);
    } else {
      const from = new Date(Date.now() - days * 86_400_000);
      const to   = new Date();
      onChange({
        ...filters,
        dateFrom: from.toISOString().slice(0, 10),
        dateTo:   to.toISOString().slice(0, 10),
      });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
      {/* Preset chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <SlidersHorizontal size={12} style={{ color: 'var(--fg-subtle)', marginRight: 4 }} />
        {PRESETS.map((p) => {
          const isActive = p.days === null ? current === null : p.days === current;
          return (
            <button
              key={p.label}
              onClick={() => applyPreset(p.days)}
              style={{
                fontSize:       11,
                fontWeight:     isActive ? 600 : 500,
                padding:        '3px 10px',
                borderRadius:   6,
                border:         isActive ? '1px solid rgba(99,102,241,0.5)' : '1px solid var(--border)',
                background:     isActive ? 'rgba(99,102,241,0.12)' : 'var(--surface-2)',
                color:          isActive ? 'var(--accent-light)' : 'var(--fg-muted)',
                cursor:         'pointer',
                transition:     'all 120ms ease',
                letterSpacing:  '0.01em',
                whiteSpace:     'nowrap',
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Date inputs + priority */}
      <div className="flex items-center gap-2 flex-wrap" style={{ justifyContent: 'flex-end' }}>
        {showDateRange && (
          <>
            <div className="flex items-center gap-1">
              <Calendar size={11} style={{ color: 'var(--fg-subtle)' }} />
              <input
                type="date"
                value={filters.dateFrom ?? ''}
                onChange={(e) => set('dateFrom', e.target.value)}
                style={inputStyle}
              />
            </div>
            <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>–</span>
            <input
              type="date"
              value={filters.dateTo ?? ''}
              onChange={(e) => set('dateTo', e.target.value)}
              style={inputStyle}
            />
          </>
        )}

        <select
          value={filters.priority ?? ''}
          onChange={(e) => set('priority', e.target.value)}
          style={inputStyle}
        >
          <option value="">All priorities</option>
          {['urgent', 'high', 'medium', 'low', 'none'].map((p) => (
            <option key={p} value={p}>{p[0]!.toUpperCase() + p.slice(1)}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
