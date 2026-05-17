"use client";

const SEVERITIES = ["Critical", "High", "Medium", "Low"];

export function RiskHeatmap({
  cells,
}: {
  cells: Array<{ category: string; severity: string; weight: number }>;
}) {
  const categories = [...new Set(cells.map((c) => c.category))];
  const max = Math.max(...cells.map((c) => c.weight), 1);

  function weight(cat: string, sev: string) {
    return cells.find((c) => c.category === cat && c.severity === sev)?.weight ?? 0;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="p-2 text-left text-zinc-500">Category</th>
            {SEVERITIES.map((s) => (
              <th key={s} className="p-2 text-zinc-500">
                {s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => (
            <tr key={cat}>
              <td className="p-2 text-zinc-300">{cat}</td>
              {SEVERITIES.map((sev) => {
                const w = weight(cat, sev);
                const intensity = w / max;
                return (
                  <td key={sev} className="p-1">
                    <div
                      className="flex h-10 items-center justify-center rounded-md font-medium text-white"
                      style={{
                        background: `rgba(34, 211, 238, ${0.08 + intensity * 0.72})`,
                      }}
                      title={`${w} events`}
                    >
                      {w || "·"}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

