import { create } from "zustand";

import type { AnalysisResults, JobStatus } from "./api";

type SentinelStore = {
  activeJobId: string | null;
  jobStatus: JobStatus | null;
  results: AnalysisResults | null;
  setActiveJob: (jobId: string | null) => void;
  setJobStatus: (status: JobStatus | null) => void;
  setResults: (results: AnalysisResults | null) => void;
};

export const useSentinelStore = create<SentinelStore>((set) => ({
  activeJobId: null,
  jobStatus: null,
  results: null,
  setActiveJob: (activeJobId) => set({ activeJobId }),
  setJobStatus: (jobStatus) => set({ jobStatus }),
  setResults: (results) => set({ results }),
}));
