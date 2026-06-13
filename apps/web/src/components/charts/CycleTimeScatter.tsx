'use client';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { WorkItemMetric } from '@flow-analytics/shared';

interface Props {
  items: WorkItemMetric[];
  p50: number;
  p85: number;
  onSelect?: (workItemId: string) => void;
}

function formatHours(hours: number): string {
  if (hours < 24)  return `${Math.round(hours)}h`;
  if (hours < 168) return `${(hours / 24).toFixed(1)}d`;
  return `${(hours / 168).toFixed(1)}w`;
}

export function CycleTimeScatter({ items, p50, p85, onSelect }: Props) {
  const data = items
    .filter((i) => i.cycleTimeHours !== null && i.completedAt)
    .map((i) => ({
      x:          new Date(i.completedAt!).getTime(),
      y:          i.cycleTimeHours!,
      title:      i.title,
      id:         i.sequenceId,
      workItemId: i.workItemId,
    }));

  type Point = (typeof data)[number];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 16,
          fontSize: 12,
          color: 'var(--fg-subtle)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 20, borderBottom: '2px dashed #818cf8', display: 'inline-block' }} />
          Typical ({formatHours(p50)})
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 20, borderBottom: '2px dashed #f59e0b', display: 'inline-block' }} />
          Slowest 15% ({formatHours(p85)})
        </span>
        {onSelect && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-subtle)' }}>
            Click any dot to see its full journey →
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="x"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v: number) =>
              new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            }
            stroke="var(--fg-subtle)"
            tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }}
          />
          <YAxis
            dataKey="y"
            type="number"
            tickFormatter={formatHours}
            stroke="var(--fg-subtle)"
            tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }}
            label={{
              value: 'Time to close',
              angle: -90,
              position: 'insideLeft',
              fill: 'var(--fg-subtle)',
              fontSize: 11,
            }}
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3', stroke: 'var(--border)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as Point;
              return (
                <div
                  style={{
                    background: 'var(--surface-3)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '10px 14px',
                    boxShadow: 'var(--shadow-md)',
                    maxWidth: 260,
                  }}
                >
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)', margin: '0 0 4px' }}>
                    #{d.id} {d.title}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--accent-light)', margin: 0 }}>
                    {formatHours(d.y)}
                    {onSelect && (
                      <span style={{ color: 'var(--fg-subtle)', marginLeft: 8, fontSize: 11 }}>
                        · click to inspect
                      </span>
                    )}
                  </p>
                </div>
              );
            }}
          />
          <ReferenceLine y={p50} stroke="#818cf8" strokeDasharray="5 3" strokeWidth={1.5} />
          <ReferenceLine y={p85} stroke="#f59e0b" strokeDasharray="5 3" strokeWidth={1.5} />
          <Scatter
            data={data}
            fill="#6366f1"
            opacity={0.75}
            r={5}
            cursor={onSelect ? 'pointer' : 'default'}
            onClick={(point) => onSelect?.((point as unknown as Point).workItemId)}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
