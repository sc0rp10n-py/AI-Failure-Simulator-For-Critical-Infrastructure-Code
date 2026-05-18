"use client";

import Link from "next/link";
import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion } from "framer-motion";
import { ArrowRight, Brain, Network, Shield, Zap } from "lucide-react";

import { HeroBackground } from "@/components/landing/hero-background";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { GlassPanel } from "@/components/ui/glass-panel";
import { api } from "@/lib/api";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const HOW_STEPS = [
  {
    icon: Network,
    title: "Architectural scan",
    body: "AST and heuristics map dependencies, external APIs, and weak points in your uploaded codebase.",
  },
  {
    icon: Zap,
    title: "Autonomous chaos",
    body: "Sandboxed execution with live HTTP injection — latency, faults, and cascade scenarios chosen from real risks.",
  },
  {
    icon: Brain,
    title: "AI post-mortem",
    body: "Root cause, blast radius, and remediation paths generated from telemetry — not static templates.",
  },
];

const STATS = [
  { label: "Frameworks", value: "4+" },
  { label: "Failure modes", value: "12+" },
  { label: "Pipeline stages", value: "9" },
];

export function LandingContent() {
  const rootRef = useRef<HTMLDivElement>(null);
  const { data: demos } = useQuery({
    queryKey: ["demos"],
    queryFn: async () => (await api.listProjects()).demos,
  });

  useGSAP(
    () => {
      gsap.from(".reveal-up", {
        scrollTrigger: { trigger: ".reveal-up", start: "top 85%" },
        y: 48,
        opacity: 0,
        duration: 0.9,
        stagger: 0.12,
        ease: "power3.out",
      });
      gsap.from(".reveal-scale", {
        scrollTrigger: { trigger: ".reveal-scale", start: "top 80%" },
        scale: 0.92,
        opacity: 0,
        duration: 1,
        ease: "power2.out",
      });
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className="relative min-h-[320vh] overflow-hidden bg-[#030306]">
      <HeroBackground />
      <SiteHeader />

      {/* Hero */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-24 text-center">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-5 py-2 text-sm tracking-[0.2em] text-cyan-200 uppercase backdrop-blur-md"
        >
          <Shield className="h-4 w-4" />
          Autonomous resilience intelligence
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="max-w-5xl text-3xl leading-[1.05] font-semibold tracking-tight text-white md:text-5xl lg:text-6xl text-glow"
        >
          Simulate Real-World Chaos Before Production Does.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mx-auto mt-8 max-w-2xl text-xl text-zinc-400 md:text-2xl"
        >
          AI-driven autonomous failure simulation for resilient software systems.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 flex flex-wrap justify-center gap-4"
        >
          <Link
            href="/analyze"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-cyan-400 px-8 text-base font-semibold text-black shadow-[0_0_40px_rgba(34,211,238,0.35)] transition hover:bg-cyan-300"
          >
            Start Analysis
            <ArrowRight className="h-5 w-5" />
          </Link>
          <a
            href="#how"
            className="inline-flex h-12 items-center rounded-full border border-white/20 bg-white/5 px-8 text-base text-white backdrop-blur-md transition hover:bg-white/10"
          >
            How it works
          </a>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 1 }}
          className="mt-20 grid w-full max-w-3xl grid-cols-3 gap-6"
        >
          {STATS.map((s) => (
            <GlassPanel key={s.label} className="py-6">
              <p className="text-3xl font-semibold text-cyan-300">{s.value}</p>
              <p className="mt-1 text-sm tracking-wide text-zinc-500 uppercase">{s.label}</p>
            </GlassPanel>
          ))}
        </motion.div>
      </section>

      {/* Problem */}
      <section className="relative mx-auto max-w-7xl px-6 py-32">
        <div className="reveal-up mb-16 max-w-3xl">
          <p className="text-sm tracking-[0.25em] text-cyan-400 uppercase">The problem</p>
          <h2 className="mt-4 text-4xl font-semibold text-white md:text-5xl">
            Production is the first place most teams learn their architecture breaks.
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            "Untested dependency chains fail under real latency and partial outages.",
            "Retry storms and missing circuit breakers amplify small faults into cascades.",
            "No visibility into blast radius until customers are already impacted.",
          ].map((text) => (
            <GlassPanel key={text} className="reveal-up p-8">
              <p className="text-lg leading-relaxed text-zinc-300">{text}</p>
            </GlassPanel>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="relative mx-auto max-w-7xl px-6 py-32">
        <div className="reveal-up mb-16 text-center">
          <p className="text-sm tracking-[0.25em] text-cyan-400 uppercase">How it works</p>
          <h2 className="mt-4 text-4xl font-semibold text-white md:text-5xl">
            An autonomous pipeline from ZIP to resilience report
          </h2>
        </div>
        <div className="grid gap-8 lg:grid-cols-3">
          {HOW_STEPS.map((step, i) => (
            <GlassPanel key={step.title} strong={i === 1} className="reveal-up p-8">
              <step.icon className="mb-4 h-10 w-10 text-cyan-400" />
              <h3 className="text-2xl font-semibold text-white">{step.title}</h3>
              <p className="mt-3 text-lg text-zinc-400">{step.body}</p>
            </GlassPanel>
          ))}
        </div>
      </section>

      {/* Failure viz */}
      <section className="relative mx-auto max-w-7xl px-6 py-32">
        <GlassPanel strong className="reveal-scale overflow-hidden p-0">
          <div className="grid lg:grid-cols-2">
            <div className="p-10 lg:p-14">
              <p className="text-sm tracking-[0.25em] text-violet-300 uppercase">Simulation</p>
              <h2 className="mt-4 text-3xl font-semibold text-white md:text-4xl">
                Watch failures propagate across your dependency graph
              </h2>
              <p className="mt-4 text-lg text-zinc-400">
                Live injection against sandboxed services, with heatmaps, timelines, and AI-generated
                remediation — every metric tied to your actual code.
              </p>
            </div>
            <div className="relative min-h-70 bg-black/40">
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 280">
                <motion.line
                  x1="40" y1="140" x2="160" y2="80"
                  stroke="#22d3ee" strokeWidth="2" strokeDasharray="6 4"
                  initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }}
                />
                <motion.line
                  x1="160" y1="80" x2="320" y2="140"
                  stroke="#8b5cf6" strokeWidth="2" strokeDasharray="6 4"
                  initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                />
                <motion.line
                  x1="160" y1="80" x2="320" y2="220"
                  stroke="#f43f5e" strokeWidth="2" strokeDasharray="6 4"
                  initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }}
                  transition={{ delay: 0.35 }}
                />
                {[
                  [40, 140, "#22d3ee"],
                  [160, 80, "#8b5cf6"],
                  [320, 140, "#22d3ee"],
                  [320, 220, "#f43f5e"],
                ].map(([cx, cy, fill], i) => (
                  <motion.circle
                    key={i}
                    cx={cx as number}
                    cy={cy as number}
                    r={10}
                    fill={fill as string}
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 * i }}
                  />
                ))}
              </svg>
            </div>
          </div>
        </GlassPanel>
      </section>

      {/* Demos */}
      <section id="demos" className="relative mx-auto max-w-7xl px-6 py-32">
        <div className="reveal-up mb-12">
          <p className="text-sm tracking-[0.25em] text-cyan-400 uppercase">Projects</p>
          <h2 className="mt-4 text-4xl font-semibold text-white">Upload any backend or explore demos</h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {(demos ?? []).map((d) => (
            <GlassPanel
              key={d.id}
              className={`reveal-up p-6 transition hover:border-cyan-400/30 ${!d.available ? "opacity-60" : ""}`}
            >
              <p className="text-xs tracking-wide text-cyan-400 uppercase">{d.risk_level}</p>
              <h3 className="mt-2 text-xl font-semibold text-white">{d.name}</h3>
              <p className="mt-2 line-clamp-3 text-sm text-zinc-400">{d.description}</p>
              <p className="mt-4 text-xs text-zinc-500">{d.framework}</p>
            </GlassPanel>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative mx-auto max-w-4xl px-6 py-40 text-center">
        <GlassPanel strong className="reveal-scale px-10 py-16">
          <h2 className="text-4xl font-semibold text-white md:text-5xl">
            Ready to stress-test your architecture?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-400">
            Upload a ZIP, watch the autonomous pipeline run, and open a full resilience dashboard in minutes.
          </p>
          <Link
            href="/analyze"
            className="mt-10 inline-flex h-12 items-center gap-2 rounded-full bg-cyan-400 px-10 text-base font-semibold text-black transition hover:bg-cyan-300"
          >
            Start Analysis
            <ArrowRight className="h-5 w-5" />
          </Link>
        </GlassPanel>
      </section>

      <SiteFooter />
    </div>
  );
}
