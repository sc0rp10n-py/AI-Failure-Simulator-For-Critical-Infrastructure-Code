"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

gsap.registerPlugin(ScrollTrigger);

const problems = [
  "Production outages from untested dependency chains",
  "Retry storms and missing circuit breakers",
  "No visibility into blast radius before deploy",
];

export function ProblemSection() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      gsap.from(".problem-item", {
        scrollTrigger: { trigger: ref.current, start: "top 80%" },
        opacity: 0,
        y: 24,
        stagger: 0.12,
        duration: 0.6,
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} className="mt-32">
      <h2 className="text-3xl font-semibold text-white">The resilience gap</h2>
      <ul className="mt-8 grid gap-4 md:grid-cols-3">
        {problems.map((p) => (
          <li key={p} className="problem-item rounded-2xl border border-white/10 bg-white/5 p-6 text-zinc-300">
            {p}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FailureVizSection() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const lines = ref.current.querySelectorAll(".net-line");
    const ctx = gsap.context(() => {
      gsap.to(lines, {
        strokeDashoffset: 0,
        duration: 2,
        stagger: 0.2,
        repeat: -1,
        yoyo: true,
        ease: "power1.inOut",
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section className="mt-32">
      <h2 className="text-3xl font-semibold text-white">Failure simulation</h2>
      <p className="mt-3 max-w-2xl text-zinc-400">
        Autonomous agents map dependencies, inject realistic faults, and surface cascade paths before users do.
      </p>
      <div ref={ref} className="relative mt-10 h-64 overflow-hidden rounded-2xl border border-cyan-500/20 bg-black/50">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 800 256">
          <line className="net-line" x1="80" y1="128" x2="320" y2="64" stroke="#22d3ee" strokeWidth="2" strokeDasharray="8 8" strokeDashoffset="16" />
          <line className="net-line" x1="320" y1="64" x2="560" y2="128" stroke="#8b5cf6" strokeWidth="2" strokeDasharray="8 8" strokeDashoffset="16" />
          <line className="net-line" x1="320" y1="64" x2="560" y2="192" stroke="#f43f5e" strokeWidth="2" strokeDasharray="8 8" strokeDashoffset="16" />
          <circle cx="80" cy="128" r="12" fill="#22d3ee" />
          <circle cx="320" cy="64" r="12" fill="#8b5cf6" />
          <circle cx="560" cy="128" r="12" fill="#22d3ee" opacity="0.5" />
          <circle cx="560" cy="192" r="12" fill="#f43f5e" />
        </svg>
        <p className="absolute bottom-4 left-4 text-xs text-zinc-500">Live cascade visualization during analysis</p>
      </div>
    </section>
  );
}

export function DemoPreviewSection({ demos }: { demos: Array<{ id: string; name: string; description: string; risk_level: string; available: boolean }> }) {
  return (
    <section id="demos" className="mt-32">
      <h2 className="text-3xl font-semibold text-white">Demo projects</h2>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {demos.map((d) => (
          <Card key={d.id} className={d.available ? "hover:border-cyan-500/40" : "opacity-70"}>
            <CardHeader>
              <CardTitle className="text-base">{d.name}</CardTitle>
              <CardDescription className="line-clamp-2">{d.description}</CardDescription>
              <span className="text-xs text-cyan-400">{d.risk_level}</span>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
}
