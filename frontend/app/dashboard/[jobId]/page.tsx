"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { api } from "@/lib/api";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  const { jobId } = useParams<{ jobId: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["results", jobId],
    queryFn: () => api.results(jobId),
    retry: 3,
    retryDelay: 1500,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-400">
        Loading resilience dashboard…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-300">
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

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 pt-28 pb-20">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-cyan-400">{data.project.framework}</p>
            <h1 className="text-3xl font-semibold text-white">{data.project.name}</h1>
            <p className="mt-2 max-w-2xl text-zinc-400">{data.summary}</p>
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
              <CardDescription>Latency per injected scenario from simulation telemetry</CardDescription>
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
              <li>Requests: {metrics.requests_total ?? 0}</li>
              <li>Failed: {metrics.requests_failed ?? 0}</li>
              <li>Error rate: {((metrics.error_rate ?? 0) * 100).toFixed(1)}%</li>
              <li>p95: {metrics.p95_ms ?? 0} ms</li>
              <li>Scenarios: {data.failure_count}</li>
            </ul>
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
              <CardTitle>AI findings</CardTitle>
            </CardHeader>
            <p className="text-sm text-zinc-300">{data.ai?.root_cause}</p>
            <h3 className="mt-4 text-sm font-medium text-white">Remediation</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-400">
              {(data.ai?.remediation ?? []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Blast radius</CardTitle>
            </CardHeader>
            <p className="text-sm text-zinc-400">
              Origin: {String(blast.origin ?? "—")}
            </p>
            <p className="mt-2 text-sm text-zinc-300">
              Impacted: {((blast.impacted_services as string[]) ?? []).join(", ") || "—"}
            </p>
            <p className="mt-2 text-sm text-cyan-300">
              Cascade probability: {String(blast.cascade_probability ?? "—")}
            </p>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dependency map</CardTitle>
              <CardDescription>{graph.nodes?.length ?? 0} nodes · {graph.edges?.length ?? 0} edges</CardDescription>
            </CardHeader>
            <div className="flex flex-wrap gap-2">
              {(graph.nodes as { id: string; label: string; kind: string }[]).map((n) => (
                <span
                  key={n.id}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300"
                >
                  {n.label} ({n.kind})
                </span>
              ))}
            </div>
            <div className="mt-4 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={(graph.edges as { from: string; to: string }[]).map((e) => ({
                    name: `${e.from}→${e.to}`,
                    weight: 1,
                  }))}
                >
                  <XAxis dataKey="name" hide />
                  <YAxis hide />
                  <Bar dataKey="weight" fill="#8b5cf6" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Injected failure scenarios</CardTitle>
          </CardHeader>
          <div className="grid gap-3 md:grid-cols-2">
            {data.scenarios.map((s) => (
              <div
                key={s.name}
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
      </main>
    </div>
  );
}
