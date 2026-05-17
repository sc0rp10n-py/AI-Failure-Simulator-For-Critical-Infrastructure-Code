const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5001";

export type LogEvent = {
  level?: string;
  message?: string;
  source?: string;
  created_at?: string;
  payload?: Record<string, unknown>;
  done?: boolean;
  status?: string;
  error?: string;
};

export function streamJobLogs(
  jobId: string,
  onEvent: (event: LogEvent) => void,
  onError?: (err: Event) => void,
): () => void {
  const source = new EventSource(`${API_BASE}/api/stream/logs/${jobId}`, {
    withCredentials: true,
  });
  source.onmessage = (msg) => {
    try {
      onEvent(JSON.parse(msg.data) as LogEvent);
    } catch {
      /* ignore parse errors */
    }
  };
  source.onerror = (err) => {
    onError?.(err);
  };
  return () => source.close();
}
