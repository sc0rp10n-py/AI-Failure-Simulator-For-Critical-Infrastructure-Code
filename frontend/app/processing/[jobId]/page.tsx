"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import { MetricsSparkline } from "@/components/processing/metrics-sparkline";
import { NetworkActivity, PulsingLoader } from "@/components/processing/network-activity";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useSentinelStore } from "@/lib/store";
import { streamJobLogs, type LogEvent } from "@/lib/sse";

const STAGE_LABELS: Record<string, string> = {
  queued: "Queued",
  upload_complete: "Scanning codebase",
  extraction_complete: "Extracting project",
  dependency_scan_complete: "Mapping dependencies",
  risk_analysis_complete: "Detecting risks",
  failure_generation_complete: "Generating failure scenarios",
  simulation_complete: "Injecting failures",
  telemetry_complete: "Capturing telemetry",
  ai_analysis_complete: "Generating AI analysis",
};

const ORDER = [
  "upload_complete",
  "extraction_complete",
  "dependency_scan_complete",
  "risk_analysis_complete",
  "failure_generation_complete",
  "simulation_complete",
  "telemetry_complete",
  "ai_analysis_complete",
];

export default function ProcessingPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const setActiveJob = useSentinelStore((s) => s.setActiveJob);
  const setJobStatus = useSentinelStore((s) => s.setJobStatus);
  const [streamLogs, setStreamLogs] = useState<LogEvent[]>([]);

  const { data } = useQuery({
    queryKey: ["status", jobId],
    queryFn: () => api.status(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "completed" || status === "failed" ? false : 800;
    },
  });

  useEffect(() => {
    setActiveJob(jobId);
    if (data) setJobStatus(data);
  }, [jobId, data, setActiveJob, setJobStatus]);

  useEffect(() => {
    const stop = streamJobLogs(jobId, (event) => {
      if (event.done) return;
      if (event.message) setStreamLogs((prev) => [...prev.slice(-40), event]);
    });
    return stop;
  }, [jobId]);

  useEffect(() => {
    if (data?.status === "completed") {
      router.replace(`/dashboard/${jobId}`);
    }
  }, [data?.status, jobId, router]);

  const currentIdx = ORDER.indexOf(data?.stage ?? "");
  const allLogs = [
    ...(data?.logs ?? []),
    ...streamLogs.map((l) => ({
      level: l.level ?? "INFO",
      message: l.message ?? "",
      source: l.source ?? "stream",
      created_at: l.created_at ?? "",
    })),
  ];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 pt-28 pb-20">
        <h1 className="text-3xl font-semibold text-white">Autonomous analysis pipeline</h1>
        <PulsingLoader label={STAGE_LABELS[data?.stage ?? "queued"] ?? "Orchestrating…"} />

        <motion.div className="mt-8">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-zinc-400">{STAGE_LABELS[data?.stage ?? "queued"]}</span>
            <span className="text-cyan-300">{Math.round(data?.progress ?? 0)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-500 to-violet-500"
              initial={{ width: 0 }}
              animate={{ width: `${data?.progress ?? 0}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
          <MetricsSparkline progress={data?.progress ?? 0} logs={allLogs.length} />
        </motion.div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Pipeline stages</CardTitle>
            </CardHeader>
            <ul className="space-y-2 text-sm">
              {ORDER.map((stage, idx) => {
                const done = currentIdx >= idx;
                const active = data?.stage === stage;
                return (
                  <li
                    key={stage}
                    className={`flex items-center gap-2 ${done ? "text-cyan-300" : "text-zinc-500"}`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${active ? "animate-pulse bg-cyan-400" : done ? "bg-cyan-500" : "bg-zinc-600"}`}
                    />
                    {STAGE_LABELS[stage]}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Network activity</CardTitle>
            </CardHeader>
            <NetworkActivity nodeCount={6 + currentIdx} />
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Live terminal</CardTitle>
            </CardHeader>
            <div className="max-h-80 overflow-y-auto rounded-lg bg-black/60 p-3 font-mono text-xs text-emerald-300/90">
              {allLogs.map((log, i) => (
                <div key={`${log.created_at}-${i}`} className="mb-1">
                  <span className="text-zinc-500">[{log.level}]</span> {log.message}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
