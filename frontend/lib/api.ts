const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5001";

type ApiResponse<T> = {
  success: boolean;
  data: T | null;
  error: string | null;
};

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success) {
    throw new Error(json.error ?? "Request failed");
  }
  return json.data as T;
}

export type DemoMeta = {
  id: string;
  name: string;
  framework: string;
  architecture: string;
  risk_level: string;
  dependency_count: number;
  description: string;
  available: boolean;
};

export type Project = {
  id: number;
  name: string;
  framework: string;
  source_type: string;
  demo_id?: string | null;
  dependency_count: number;
  created_at: string;
  latest_run?: {
    job_id: string;
    status: string;
    risk_score: number;
    severity: string;
    failure_count: number;
  } | null;
};

export type HistoryItem = {
  job_id: string;
  project_id: number;
  project_name: string;
  framework: string;
  status: string;
  risk_score: number;
  severity: string;
  failure_count: number;
  created_at: string;
  completed_at: string | null;
};

export type JobStatus = {
  job_id: string;
  status: string;
  stage: string;
  progress: number;
  project_id: number;
  logs: Array<{
    level: string;
    message: string;
    source: string;
    created_at: string;
  }>;
};

export type AnalysisResults = {
  job_id: string;
  project: { id: number; name: string; framework: string };
  risk_score: number;
  severity: string;
  failure_count: number;
  summary: string;
  risk: {
    framework: string;
    risks: Array<{
      id: string;
      title: string;
      severity: string;
      category: string;
      file: string;
      description: string;
    }>;
    dependencies: Array<{ nodes: unknown[]; edges: unknown[] }>;
  };
  scenarios: Array<{
    name: string;
    category: string;
    severity: string;
    target: string;
    description: string;
    injected: boolean;
    outcome: string | null;
  }>;
  telemetry: {
    metrics: Record<string, number>;
    timeline: Array<Record<string, unknown>>;
    dependency_graph: { nodes: unknown[]; edges: unknown[] };
    blast_radius: Record<string, unknown>;
  };
  ai: {
    root_cause: string;
    severity: string;
    remediation: string[];
    architecture_insights: string[];
    summary?: string;
    blast_radius?: Record<string, unknown>;
  };
};

export const api = {
  listProjects: () =>
    request<{ projects: Project[]; demos: DemoMeta[] }>("/api/projects"),
  uploadProject: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ project: Project }>("/api/upload-project", {
      method: "POST",
      body: form,
    });
  },
  analyze: (body: { project_id?: number; demo_id?: string }) =>
    request<{ job_id: string; project_id: number }>("/api/analyze", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  reanalyze: (projectId: number) =>
    request<{ job_id: string; project_id: number }>(
      `/api/reanalyze/${projectId}`,
      { method: "POST" },
    ),
  history: () =>
    request<{ history: HistoryItem[] }>("/api/analysis-history"),
  status: (jobId: string) =>
    request<JobStatus>(`/api/status/${jobId}`),
  results: (jobId: string) =>
    request<AnalysisResults>(`/api/results/${jobId}`),
  logs: (jobId: string) =>
    request<{ logs: JobStatus["logs"] }>(`/api/logs/${jobId}`),
};
