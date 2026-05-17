import Link from "next/link";
import { ArrowRight, BrainCircuit, Network, Zap } from "lucide-react";

import { HeroBackground } from "@/components/landing/hero-background";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const steps = [
  {
    title: "Scan architecture",
    description: "AST + heuristic analysis maps dependencies, APIs, and weak points.",
    icon: Network,
  },
  {
    title: "Generate failures",
    description: "Autonomous strategy engine picks realistic chaos scenarios from your risks.",
    icon: Zap,
  },
  {
    title: "Explain blast radius",
    description: "Telemetry + AI reasoning surfaces root cause and remediation paths.",
    icon: BrainCircuit,
  },
];

export default function LandingPage() {
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
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/analyze"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-cyan-500 px-6 text-sm font-semibold text-black transition hover:bg-cyan-400"
            >
              Start Analysis
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Button variant="outline" className="h-11 border-white/15 bg-white/5 text-white">
              <a href="#how">See how it works</a>
            </Button>
          </div>
        </section>

        <section id="how" className="mt-32 grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <Card key={step.title} className="transition hover:border-cyan-500/30">
              <CardHeader>
                <step.icon className="mb-2 h-8 w-8 text-cyan-400" />
                <CardTitle>{step.title}</CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>

        <section id="demos" className="mt-32">
          <h2 className="text-3xl font-semibold text-white">Upload or analyze projects</h2>
          <p className="mt-3 max-w-2xl text-zinc-400">
            Ship demo ZIPs from your team, or point at bundled samples when available. Every
            dashboard metric is generated from real scans, simulations, and telemetry — never
            hardcoded placeholders.
          </p>
          <div className="mt-8">
            <Link
              href="/analyze"
              className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-2 text-sm font-medium"
            >
              Open analysis console <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
