"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect } from "react";

import { api } from "@/lib/api";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

const STAGE_LABELS: Record<string, string> = {
  queued: "Queued",
  upload_complete: "Upload complete",
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

  const { data } = useQuery({
    queryKey: ["status", jobId],
    queryFn: () => api.status(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "completed" || status === "failed" ? false : 800;
    },
  });

  useEffect(() => {
    if (data?.status === "completed") {
      router.replace(`/dashboard/${jobId}`);
    }
  }, [data?.status, jobId, router]);

  const currentIdx = ORDER.indexOf(data?.stage ?? "");

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 pt-28 pb-20">
        <h1 className="text-3xl font-semibold text-white">Autonomous analysis pipeline</h1>
        <p className="mt-2 text-zinc-400">Live orchestration driven by backend progress events.</p>

        <div className="mt-8">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-zinc-400">{STAGE_LABELS[data?.stage ?? "queued"] ?? data?.stage}</span>
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
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <Card>
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

          <Card>
            <CardHeader>
              <CardTitle>Live terminal</CardTitle>
            </CardHeader>
            <div className="max-h-80 overflow-y-auto rounded-lg bg-black/60 p-3 font-mono text-xs text-emerald-300/90">
              {(data?.logs ?? []).map((log, i) => (
                <div key={`${log.created_at}-${i}`} className="mb-1">
                  <span className="text-zinc-500">[{log.level}]</span> {log.message}
                </div>
              ))}
              {data?.status === "failed" && (
                <p className="text-red-400">Pipeline failed. Check backend logs.</p>
              )}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
