'use client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from 'recharts';
import type { StateBottleneck } from '@flow-analytics/shared';

interface Props {
  states: StateBottleneck[];
  bottleneckId: string | null;
}

function formatHours(hours: number): string {
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export function BottleneckBar({ states, bottleneckId }: Props) {
  const data = states.map((s) => ({
    name: s.stateName,
    avg: parseFloat(s.avgHours.toFixed(1)),
    p85: parseFloat(s.p85Hours.toFixed(1)),
    items: s.itemCount,
    isBottleneck: s.stateId === bottleneckId,
  }));

  return (
    <div>
      <div className="flex items-center gap-4 mb-4 text-xs" style={{ color: 'var(--muted)' }}>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#6366f1' }} /> Avg
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#f59e0b' }} /> P85
        </span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
          <YAxis
            tickFormatter={formatHours}
            stroke="#64748b"
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div
                  className="text-xs p-3 rounded-lg space-y-1"
                  style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
                >
                  <p className="font-medium mb-1">{label}</p>
                  <p>Avg: {formatHours(payload[0]?.value as number)}</p>
                  <p>P85: {formatHours(payload[1]?.value as number)}</p>
                  <p style={{ color: 'var(--muted)' }}>{payload[0]?.payload.items} items</p>
                </div>
              );
            }}
          />
          <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.isBottleneck ? '#ef4444' : '#6366f1'} />
            ))}
          </Bar>
          <Bar dataKey="p85" fill="#f59e0b" radius={[4, 4, 0, 0]} opacity={0.7} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
