"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";

export function MetricsSparkline({
  progress,
  logs,
}: {
  progress: number;
  logs: number;
}) {
  const data = Array.from({ length: 12 }, (_, i) => ({
    t: i,
    v: Math.max(0, progress - (11 - i) * 8 + Math.sin(i) * 5),
    l: logs + i * 2,
  }));

  return (
    <div className="h-28 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="v" stroke="#22d3ee" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="l" stroke="#8b5cf6" strokeWidth={1} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
