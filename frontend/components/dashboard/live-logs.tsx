"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { streamJobLogs, type LogEvent } from "@/lib/sse";

export function LiveLogs({ jobId }: { jobId: string }) {
  const [streamed, setStreamed] = useState<LogEvent[]>([]);

  const { data } = useQuery({
    queryKey: ["logs", jobId],
    queryFn: () => api.logs(jobId),
    refetchInterval: 5000,
  });

  useEffect(() => {
    const stop = streamJobLogs(jobId, (event) => {
      if (event.done) return;
      if (event.message) setStreamed((prev) => [...prev.slice(-80), event]);
    });
    return stop;
  }, [jobId]);

  const logs = [
    ...(data?.logs ?? []).map((l) => ({
      level: l.level,
      message: l.message,
      source: l.source,
    })),
    ...streamed.map((l) => ({
      level: l.level ?? "INFO",
      message: l.message ?? "",
      source: l.source ?? "stream",
    })),
  ].slice(-60);

  return (
    <div className="max-h-64 overflow-y-auto rounded-lg bg-black/60 p-3 font-mono text-xs">
      {logs.map((log, i) => (
        <div key={`${log.message}-${i}`} className="mb-1">
          <span className="text-zinc-500">[{log.level}]</span>{" "}
          <span className="text-emerald-300/90">{log.message}</span>
        </div>
      ))}
    </div>
  );
}
