"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  GitBranch,
  Radio,
  ShieldAlert,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DependencyGraph } from "@/components/dashboard/dependency-graph";
import { FailureReplay } from "@/components/dashboard/failure-replay";
import { LiveLogs } from "@/components/dashboard/live-logs";
import { RiskHeatmap } from "@/components/dashboard/risk-heatmap";
import { PageShell } from "@/components/layout/page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { LoadingScreen } from "@/components/shared/loading-screen";
import { GlassPanel } from "@/components/ui/glass-panel";
import { api } from "@/lib/api";
import { useSentinelStore } from "@/lib/store";

function severityColor(severity: string) {
  if (severity === "Critical") return "text-red-400 border-red-400/30 bg-red-400/10";
  if (severity === "High") return "text-amber-300 border-amber-400/30 bg-amber-400/10";
  if (severity === "Medium") return "text-yellow-200 border-yellow-400/20 bg-yellow-400/10";
  return "text-zinc-300 border-zinc-400/20 bg-zinc-400/10";
}

export default function DashboardPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const setActiveJob = useSentinelStore((s) => s.setActiveJob);
  const setResults = useSentinelStore((s) => s.setResults);

  const { data, isLoading, error } = useQuery({
    queryKey: ["results", jobId],
    queryFn: () => api.results(jobId),
    retry: 3,
    retryDelay: 1500,
  });

  useEffect(() => {
    setActiveJob(jobId);
    if (data) setResults(data);
  }, [jobId, data, setActiveJob, setResults]);

  if (isLoading) {
    return (
      <PageShell>
        <LoadingScreen
          title="Composing resilience report"
          subtitle="Aggregating risks, telemetry, and AI findings…"
        />
      </PageShell>
    );
  }

  if (error || !data) {
    return (
      <PageShell>
        <div className="flex min-h-screen items-center justify-center text-xl text-red-300">
          {error instanceof Error ? error.message : "Results unavailable"}
        </div>
      </PageShell>
    );
  }

  const metrics = data.telemetry?.metrics ?? {};
  const timeline = (data.telemetry?.timeline ?? []).map((e, i) => ({
    name: `T${i + 1}`,
    latency: Number(e.latency_ms ?? 0),
    failed: e.failed ? 1 : 0,
  }));
  const blast = data.telemetry?.blast_radius ?? data.ai?.blast_radius ?? {};
  const graph = data.telemetry?.dependency_graph ?? { nodes: [], edges: [] };
  const heatmap =
    data.heatmap ??
    (metrics.heatmap as Array<{ category: string; severity: string; weight: number }>) ??
    [];

  return (
    <PageShell>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 pt-28 pb-24">
        {/* Hero strip */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 grid gap-6 lg:grid-cols-[1fr_auto]"
        >
          <GlassPanel strong className="p-8 lg:p-10">
            <p className="text-sm tracking-[0.25em] text-cyan-400 uppercase">
              {data.project.framework} · resilience report
            </p>
            <h1 className="mt-3 text-4xl font-semibold text-white md:text-5xl">
              {data.project.name}
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-relaxed text-zinc-400">
              {data.summary}
            </p>
            {data.correlation_id ? (
              <p className="mt-3 font-mono text-xs text-zinc-600">
                trace {data.correlation_id}
              </p>
            ) : null}
          </GlassPanel>

          <GlassPanel
            strong
            className="flex min-w-[200px] flex-col items-center justify-center p-8 text-center"
          >
            <ShieldAlert className="mb-2 h-8 w-8 text-cyan-400" />
            <p className="text-xs tracking-[0.2em] text-zinc-500 uppercase">Risk score</p>
            <p className="mt-2 text-6xl font-semibold leading-none text-white text-glow">
              {data.risk_score.toFixed(0)}
            </p>
            <span
              className={`mt-4 rounded-full border px-4 py-1 text-sm font-medium ${severityColor(data.severity)}`}
            >
              {data.severity}
            </span>
            <p className="mt-3 text-sm text-zinc-500">{data.failure_count} scenarios</p>
          </GlassPanel>
        </motion.div>

        {/* Metric pills */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { icon: Activity, label: "Requests", value: String(metrics.requests_total ?? 0) },
            { icon: AlertTriangle, label: "Failed", value: String(metrics.requests_failed ?? 0) },
            {
              icon: Radio,
              label: "Error rate",
              value: `${((Number(metrics.error_rate) || 0) * 100).toFixed(1)}%`,
            },
            { icon: GitBranch, label: "p95 latency", value: `${metrics.p95_ms ?? 0} ms` },
          ].map((m) => (
            <GlassPanel key={m.label} className="flex items-center gap-4 p-5">
              <m.icon className="h-8 w-8 shrink-0 text-cyan-400/80" />
              <div>
                <p className="text-xs tracking-wide text-zinc-500 uppercase">{m.label}</p>
                <p className="text-2xl font-semibold text-white">{m.value}</p>
              </div>
            </GlassPanel>
          ))}
        </div>

        {/* Charts row */}
        <div className="mb-8 grid gap-6 lg:grid-cols-3">
          <GlassPanel className="p-6 lg:col-span-2">
            <h2 className="text-2xl font-semibold text-white">Failure timeline</h2>
            <p className="mt-1 text-sm text-zinc-500">Latency per injected scenario</p>
            <div className="mt-6 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                  <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#71717a" tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(10,10,15,0.9)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      fontFamily: "var(--font-cormorant)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="latency"
                    stroke="#22d3ee"
                    strokeWidth={2.5}
                    dot={{ fill: "#22d3ee", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlassPanel>

          <GlassPanel className="p-6">
            <h2 className="text-2xl font-semibold text-white">Risk heatmap</h2>
            <div className="mt-4">
              <RiskHeatmap cells={heatmap} />
            </div>
          </GlassPanel>
        </div>

        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <GlassPanel className="p-6">
            <h2 className="text-2xl font-semibold text-white">Live logs</h2>
            <div className="mt-4">
              <LiveLogs jobId={jobId} />
            </div>
          </GlassPanel>

          <GlassPanel className="p-6">
            <h2 className="text-2xl font-semibold text-white">Failure replay</h2>
            <div className="mt-4">
              <FailureReplay timeline={data.telemetry?.timeline ?? []} />
            </div>
          </GlassPanel>
        </div>

        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <GlassPanel className="p-6">
            <h2 className="text-2xl font-semibold text-white">Detected risks</h2>
            <ul className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
              {(data.risk?.risks ?? []).map((risk) => (
                <li
                  key={risk.id}
                  className="rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:border-cyan-400/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-white">{risk.title}</p>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${severityColor(risk.severity)}`}
                    >
                      {risk.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{risk.file}</p>
                  <p className="mt-2 text-sm text-zinc-400">{risk.description}</p>
                </li>
              ))}
            </ul>
          </GlassPanel>

          <GlassPanel className="p-6">
            <h2 className="text-2xl font-semibold text-white">AI findings</h2>
            <p className="mt-4 text-base leading-relaxed text-zinc-300">{data.ai?.root_cause}</p>
            <h3 className="mt-6 text-lg font-medium text-cyan-200">Suggested fixes</h3>
            <ul className="mt-3 space-y-2">
              {(data.ai?.remediation ?? []).map((item, index) => (
                <li
                  key={`remediation-${index}`}
                  className="flex gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-sm text-zinc-400"
                >
                  <span className="text-cyan-500">→</span>
                  {item}
                </li>
              ))}
            </ul>
          </GlassPanel>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <GlassPanel className="p-6">
            <h2 className="text-2xl font-semibold text-white">Blast radius</h2>
            <dl className="mt-4 space-y-4 text-base">
              <div>
                <dt className="text-xs tracking-wide text-zinc-500 uppercase">Origin</dt>
                <dd className="mt-1 text-zinc-200">{String(blast.origin ?? "—")}</dd>
              </div>
              <div>
                <dt className="text-xs tracking-wide text-zinc-500 uppercase">Impacted</dt>
                <dd className="mt-1 text-zinc-300">
                  {((blast.impacted_services as string[]) ?? []).join(", ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs tracking-wide text-zinc-500 uppercase">
                  Cascade probability
                </dt>
                <dd className="mt-1 text-cyan-300">
                  {String(blast.cascade_probability ?? "—")}
                </dd>
              </div>
            </dl>
          </GlassPanel>

          <GlassPanel className="p-6">
            <h2 className="text-2xl font-semibold text-white">Dependency map</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {graph.nodes?.length ?? 0} nodes · {graph.edges?.length ?? 0} edges
            </p>
            <div className="mt-4">
              <DependencyGraph
                nodes={graph.nodes as { id: string; label: string; kind: string }[]}
                edges={graph.edges as { from: string; to: string; critical?: boolean }[]}
              />
            </div>
          </GlassPanel>
        </div>

        <GlassPanel className="mt-8 p-6">
          <h2 className="text-2xl font-semibold text-white">Injected scenarios</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {data.scenarios.map((s, index) => (
              <div
                key={`${s.name}-${index}`}
                className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-5"
              >
                <p className="text-lg font-medium text-white">{s.name}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {s.severity} · {s.target} · {s.outcome}
                </p>
                <p className="mt-3 text-sm text-zinc-400">{s.description}</p>
              </div>
            ))}
          </div>
        </GlassPanel>
      </main>
    </PageShell>
  );
}
