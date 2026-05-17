"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type TimelineEvent = Record<string, unknown>;

export function FailureReplay({ timeline }: { timeline: TimelineEvent[] }) {
  const [index, setIndex] = useState(0);
  if (!timeline.length) {
    return <p className="text-sm text-zinc-500">No simulation events to replay.</p>;
  }

  const event = timeline[index] as {
    scenario?: string;
    target?: string;
    latency_ms?: number;
    failed?: boolean;
    severity?: string;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-black/40 p-4">
        <p className="text-xs text-cyan-400">
          Step {index + 1} / {timeline.length}
        </p>
        <p className="mt-2 font-medium text-white">{event.scenario}</p>
        <p className="text-sm text-zinc-400">Target: {String(event.target)}</p>
        <p className="mt-2 text-sm">
          Latency: {event.latency_ms}ms ·{" "}
          <span className={event.failed ? "text-red-400" : "text-emerald-400"}>
            {event.failed ? "FAILED" : "DEGRADED"}
          </span>
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="border-white/15 text-white"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          className="border-white/15 text-white"
          disabled={index >= timeline.length - 1}
          onClick={() => setIndex((i) => Math.min(timeline.length - 1, i + 1))}
        >
          Next
        </Button>
        <Button
          className="bg-cyan-500 text-black hover:bg-cyan-400"
          onClick={() => setIndex(0)}
        >
          Restart
        </Button>
      </div>
    </div>
  );
}
