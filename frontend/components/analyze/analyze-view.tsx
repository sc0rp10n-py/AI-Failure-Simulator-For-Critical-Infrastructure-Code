"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, History, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { api, type DemoMeta, type HistoryItem } from "@/lib/api";
import { useSentinelStore } from "@/lib/store";
import { PageShell } from "@/components/layout/page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function AnalyzeView() {
  const router = useRouter();
  const setActiveJob = useSentinelStore((s) => s.setActiveJob);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [forceNew, setForceNew] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.listProjects(),
  });

  const analyzeMutation = useMutation({
    mutationFn: (body: { project_id?: number; demo_id?: string }) =>
      api.analyze({ ...body, use_cache: !forceNew, force: forceNew }),
    onSuccess: (res) => {
      setActiveJob(res.job_id);
      if (res.cached) router.push(`/dashboard/${res.job_id}`);
      else router.push(`/processing/${res.job_id}`);
    },
    onError: (err: Error) => setError(err.message),
  });

  async function onUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const { project } = await api.uploadProject(file);
      const run = await api.analyze({
        project_id: project.id,
        use_cache: !forceNew,
        force: forceNew,
      });
      setActiveJob(run.job_id);
      if (run.cached) router.push(`/dashboard/${run.job_id}`);
      else router.push(`/processing/${run.job_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <PageShell>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 pt-28 pb-20">
        <div className="mb-10">
          <h1 className="text-4xl font-semibold text-white md:text-5xl">Start Analysis</h1>
          <p className="mt-3 text-lg text-zinc-400">
            Upload a project ZIP or select a catalog demo when its folder is available on the server.
          </p>
        </div>

        {error ? (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}

        <label className="mb-6 flex items-center gap-2 text-base text-zinc-400">
          <input
            type="checkbox"
            checked={forceNew}
            onChange={(e) => setForceNew(e.target.checked)}
            className="rounded border-white/20"
          />
          Force fresh analysis (skip cache)
        </label>

        <GlassPanel className="mb-10 border-dashed border-cyan-500/40 p-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Upload className="h-5 w-5 text-cyan-400" />
              Upload project ZIP
            </CardTitle>
            <CardDescription className="text-base">
              Express, Flask, FastAPI, or generic backend archives.
            </CardDescription>
          </CardHeader>
          <input
            ref={fileRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onUpload(file);
            }}
          />
          <Button
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="bg-cyan-400 text-black hover:bg-cyan-300"
          >
            {uploading ? "Uploading…" : "Choose ZIP file"}
          </Button>
        </GlassPanel>

        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-semibold text-white">Demo catalog</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {(data?.demos ?? []).map((demo) => (
              <DemoCard
                key={demo.id}
                demo={demo}
                loading={analyzeMutation.isPending}
                onAnalyze={() => analyzeMutation.mutate({ demo_id: demo.id })}
              />
            ))}
          </div>
          {isLoading ? <p className="text-zinc-500">Loading catalog…</p> : null}
        </section>

        <section>
          <h2 className="mb-6 flex items-center gap-2 text-2xl font-semibold text-white">
            <History className="h-6 w-6 text-cyan-400" />
            Previous analyses
          </h2>
          <HistorySection
            onReopen={(jobId) => router.push(`/dashboard/${jobId}`)}
            onReanalyze={async (projectId) => {
              const run = await api.reanalyze(projectId);
              router.push(`/processing/${run.job_id}`);
            }}
          />
        </section>
      </main>
    </PageShell>
  );
}

function DemoCard({
  demo,
  onAnalyze,
  loading,
}: {
  demo: DemoMeta;
  onAnalyze: () => void;
  loading: boolean;
}) {
  return (
    <Card className={!demo.available ? "opacity-60" : ""}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl">{demo.name}</CardTitle>
            <CardDescription>{demo.description}</CardDescription>
          </div>
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-zinc-400">
            {demo.risk_level}
          </span>
        </div>
        <p className="text-xs text-zinc-500">
          {demo.framework} · {demo.architecture} · {demo.dependency_count} deps
        </p>
        {!demo.available ? (
          <p className="text-xs text-amber-400/90">Upload ZIP — folder not on server yet</p>
        ) : null}
      </CardHeader>
      <Button
        disabled={loading || !demo.available}
        onClick={onAnalyze}
        variant="outline"
        className="border-white/15 text-white"
      >
        Analyze demo
      </Button>
    </Card>
  );
}

function HistorySection({
  onReopen,
  onReanalyze,
}: {
  onReopen: (jobId: string) => void;
  onReanalyze: (projectId: number) => Promise<void>;
}) {
  const { data: historyData } = useQuery({
    queryKey: ["history"],
    queryFn: () => api.history(),
  });
  const history = historyData?.history ?? [];

  if (!history.length) {
    return <p className="text-zinc-500">No analyses yet. Upload a ZIP to begin.</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {history.map((item: HistoryItem) => (
        <Card key={item.job_id}>
          <CardHeader>
            <CardTitle>{item.project_name}</CardTitle>
            <CardDescription>
              {item.framework} · {new Date(item.created_at).toLocaleString()}
            </CardDescription>
            <div className="flex gap-4 text-sm">
              <span className="text-cyan-300">Risk {item.risk_score.toFixed(0)}</span>
              <span className="text-zinc-400">{item.severity}</span>
              <span className="text-zinc-400">{item.failure_count} failures</span>
            </div>
          </CardHeader>
          <div className="flex gap-2">
            {item.status === "completed" ? (
              <Button
                variant="outline"
                className="border-white/15 text-white"
                onClick={() => onReopen(item.job_id)}
              >
                Reopen dashboard
              </Button>
            ) : null}
            <Button
              variant="ghost"
              className="text-zinc-300"
              onClick={() => void onReanalyze(item.project_id)}
            >
              Re-run
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
