"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";

import { HeroBackground } from "@/components/landing/hero-background";
import {
  DemoPreviewSection,
  FailureVizSection,
  ProblemSection,
} from "@/components/landing/scroll-sections";
import { SiteHeader } from "@/components/layout/site-header";
import { api } from "@/lib/api";

export function LandingContent() {
  const { data } = useQuery({
    queryKey: ["demos"],
    queryFn: async () => (await api.listProjects()).demos,
  });

  return (
    <div className="relative min-h-screen overflow-hidden">
      <HeroBackground />
      <SiteHeader />
      <main className="relative mx-auto max-w-7xl px-6 pt-32 pb-24">
        <section className="mx-auto max-w-4xl text-center">
          <p className="mb-4 inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1 text-xs font-medium tracking-wide text-cyan-300 uppercase">
            Autonomous resilience intelligence
          </p>
          <h1 className="text-5xl font-semibold tracking-tight text-white md:text-7xl">
            Simulate Real-World Chaos Before Production Does.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
            AI-driven autonomous failure simulation for resilient software systems.
          </p>
          <Link
            href="/analyze"
            className="mt-10 inline-flex h-11 items-center gap-2 rounded-xl bg-cyan-500 px-6 text-sm font-semibold text-black transition hover:bg-cyan-400"
          >
            Start Analysis
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        <ProblemSection />
        <FailureVizSection />
        <DemoPreviewSection demos={data ?? []} />
      </main>
    </div>
  );
}
