'use client';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { CfdSeries } from '@flow-analytics/shared';

interface Props {
  data: CfdSeries;
}

export function CumulativeFlowChart({ data }: Props) {
  // Pivot series data into Recharts row format: [{date, stateName: count, ...}]
  const chartData = data.dates.map((date, i) => {
    const row: Record<string, string | number> = { date };
    data.series.forEach((s) => {
      row[s.stateName] = s.data[i] ?? 0;
    });
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={360}>
      <AreaChart data={chartData} margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis
          dataKey="date"
          stroke="#64748b"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: string) =>
            new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          }
        />
        <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={{ background: 'var(--card)', border: '1px solid var(--card-border)', fontSize: 12 }}
          labelStyle={{ color: 'var(--muted)' }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
          formatter={(value) => <span style={{ color: 'var(--foreground)' }}>{value}</span>}
        />
        {[...data.series].reverse().map((s) => (
          <Area
            key={s.stateName}
            type="monotone"
            dataKey={s.stateName}
            stackId="1"
            stroke={s.color}
            fill={s.color}
            fillOpacity={0.7}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
