"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

import { MetricsSparkline } from "@/components/processing/metrics-sparkline";
import { NetworkActivity } from "@/components/processing/network-activity";
import { PageShell } from "@/components/layout/page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { GlassPanel } from "@/components/ui/glass-panel";
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
  sandbox_ready: "Starting sandbox & live targets",
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
  "sandbox_ready",
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
  const progress = data?.progress ?? 0;
  const stageLabel = STAGE_LABELS[data?.stage ?? "queued"] ?? "Orchestrating";

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
    <PageShell>
      <SiteHeader />
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 pt-28 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 text-center"
        >
          <p className="text-sm tracking-[0.3em] text-cyan-400 uppercase">Autonomous pipeline</p>
          <h1 className="mt-3 text-4xl font-semibold text-white md:text-5xl">
            {stageLabel}
          </h1>
          <p className="mt-2 text-lg text-zinc-500">Job {jobId.slice(0, 8)}…</p>
        </motion.div>

        <GlassPanel strong className="mb-8 p-8">
          <div className="mb-3 flex justify-between text-base">
            <span className="text-zinc-300">{stageLabel}</span>
            <span className="font-semibold text-cyan-300">{Math.round(progress)}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-cyan-300 to-violet-500 shadow-[0_0_20px_rgba(34,211,238,0.5)]"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          <div className="mt-6">
            <MetricsSparkline progress={progress} logs={allLogs.length} />
          </div>
          <div className="mt-6 flex justify-center">
            <div className="relative h-20 w-20">
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-cyan-400/20"
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="absolute inset-2 rounded-full border-2 border-violet-400/50 border-t-cyan-400"
                animate={{ rotate: -360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              />
            </div>
          </div>
        </GlassPanel>

        <div className="grid flex-1 gap-6 lg:grid-cols-3">
          <GlassPanel className="p-6 lg:col-span-1">
            <h2 className="mb-4 text-xl font-semibold text-white">Stages</h2>
            <ul className="space-y-3">
              {ORDER.map((stage, idx) => {
                const done = currentIdx >= idx;
                const active = data?.stage === stage;
                return (
                  <motion.li
                    key={stage}
                    initial={false}
                    animate={{
                      opacity: done ? 1 : 0.45,
                      x: active ? 4 : 0,
                    }}
                    className={`flex items-center gap-3 text-base ${done ? "text-cyan-200" : "text-zinc-500"}`}
                  >
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                        active
                          ? "animate-pulse bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]"
                          : done
                            ? "bg-cyan-500"
                            : "bg-zinc-600"
                      }`}
                    />
                    {STAGE_LABELS[stage]}
                  </motion.li>
                );
              })}
            </ul>
          </GlassPanel>

          <GlassPanel className="p-6 lg:col-span-1">
            <h2 className="mb-4 text-xl font-semibold text-white">Network</h2>
            <NetworkActivity nodeCount={6 + Math.max(0, currentIdx)} />
          </GlassPanel>

          <GlassPanel className="flex flex-col p-6 lg:col-span-1">
            <h2 className="mb-4 text-xl font-semibold text-white">Live terminal</h2>
            <div className="min-h-[280px] flex-1 overflow-y-auto rounded-2xl border border-white/5 bg-black/50 p-4 font-mono text-xs">
              <AnimatePresence mode="popLayout">
                {allLogs.map((log, i) => (
                  <motion.div
                    key={`${log.created_at}-${i}-${log.message?.slice(0, 20)}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="mb-2 border-l-2 border-cyan-500/40 pl-2"
                  >
                    <span className="text-zinc-500">[{log.level}]</span>{" "}
                    <span
                      className={
                        log.level === "ERROR" ? "text-red-300" : "text-emerald-300/90"
                      }
                    >
                      {log.message}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {data?.status === "failed" && (
                <p className="mt-4 text-red-400">Pipeline failed. Check backend logs.</p>
              )}
            </div>
          </GlassPanel>
        </div>
      </main>
    </PageShell>
  );
}
