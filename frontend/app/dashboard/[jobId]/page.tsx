"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
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
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useSentinelStore } from "@/lib/store";

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
      <div className="flex min-h-screen items-center justify-center text-zinc-400">
        Loading resilience dashboard…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-red-300">
        {error instanceof Error ? error.message : "Results unavailable"}
      </div>
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
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 pt-28 pb-20">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-cyan-400">{data.project.framework}</p>
            <h1 className="text-3xl font-semibold text-white">{data.project.name}</h1>
            <p className="mt-2 max-w-2xl text-zinc-400">{data.summary}</p>
            {data.correlation_id ? (
              <p className="mt-1 font-mono text-xs text-zinc-600">
                trace {data.correlation_id}
              </p>
            ) : null}
          </div>
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-6 py-4 text-center">
            <p className="text-xs uppercase tracking-wide text-cyan-300">Risk score</p>
            <p className="text-4xl font-bold text-white">{data.risk_score.toFixed(0)}</p>
            <p className="text-sm text-zinc-400">{data.severity}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Failure timeline</CardTitle>
              <CardDescription>Per-scenario latency from simulation telemetry</CardDescription>
            </CardHeader>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline}>
                  <CartesianGrid stroke="#333" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip contentStyle={{ background: "#111", border: "1px solid #333" }} />
                  <Line type="monotone" dataKey="latency" stroke="#22d3ee" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Metrics</CardTitle>
            </CardHeader>
            <ul className="space-y-2 text-sm text-zinc-300">
              <li>Requests: {String(metrics.requests_total ?? 0)}</li>
              <li>Failed: {String(metrics.requests_failed ?? 0)}</li>
              <li>Error rate: {((Number(metrics.error_rate) || 0) * 100).toFixed(1)}%</li>
              <li>p95: {String(metrics.p95_ms ?? 0)} ms</li>
              <li>Live probes: {String(metrics.live_probes ?? 0)}</li>
              <li>Scenarios: {data.failure_count}</li>
            </ul>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Risk heatmap</CardTitle>
            </CardHeader>
            <RiskHeatmap cells={heatmap} />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Live logs</CardTitle>
            </CardHeader>
            <LiveLogs jobId={jobId} />
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Detected risks</CardTitle>
            </CardHeader>
            <ul className="max-h-72 space-y-3 overflow-y-auto text-sm">
              {(data.risk?.risks ?? []).map((risk) => (
                <li key={risk.id} className="rounded-lg border border-white/10 bg-black/30 p-3">
                  <p className="font-medium text-white">{risk.title}</p>
                  <p className="text-xs text-zinc-500">
                    {risk.severity} · {risk.file}
                  </p>
                  <p className="mt-1 text-zinc-400">{risk.description}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI findings & suggested fixes</CardTitle>
            </CardHeader>
            <p className="text-sm text-zinc-300">{data.ai?.root_cause}</p>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-zinc-400">
              {(data.ai?.remediation ?? []).map((item, index) => (
                <li key={`remediation-${index}`}>{item}</li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Blast radius</CardTitle>
            </CardHeader>
            <p className="text-sm text-zinc-400">Origin: {String(blast.origin ?? "—")}</p>
            <p className="mt-2 text-sm text-zinc-300">
              Impacted: {((blast.impacted_services as string[]) ?? []).join(", ") || "—"}
            </p>
            <p className="mt-2 text-sm text-cyan-300">
              Cascade probability: {String(blast.cascade_probability ?? "—")}
            </p>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Service dependency map</CardTitle>
              <CardDescription>
                {graph.nodes?.length ?? 0} nodes · {graph.edges?.length ?? 0} edges
              </CardDescription>
            </CardHeader>
            <DependencyGraph
              nodes={graph.nodes as { id: string; label: string; kind: string }[]}
              edges={graph.edges as { from: string; to: string; critical?: boolean }[]}
            />
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Failure replay</CardTitle>
            </CardHeader>
            <FailureReplay timeline={data.telemetry?.timeline ?? []} />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Injected failure scenarios</CardTitle>
            </CardHeader>
            <div className="max-h-80 space-y-3 overflow-y-auto">
              {data.scenarios.map((s, index) => (
                <div
                  key={`${s.name}-${index}`}
                  className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm"
                >
                  <p className="font-medium text-white">{s.name}</p>
                  <p className="text-xs text-zinc-500">
                    {s.severity} · {s.target} · {s.outcome}
                  </p>
                  <p className="mt-2 text-zinc-400">{s.description}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
