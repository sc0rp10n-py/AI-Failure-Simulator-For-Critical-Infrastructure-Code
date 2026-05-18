"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

export function HeroBackground() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.to(".hero-orb-a", {
        x: 40,
        y: -30,
        duration: 6,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
      gsap.to(".hero-orb-b", {
        x: -50,
        y: 20,
        duration: 8,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
      gsap.to(".hero-grid", {
        backgroundPosition: "128px 128px",
        duration: 24,
        repeat: -1,
        ease: "none",
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="hero-grid absolute inset-0 opacity-[0.35] ambient-grid" />
      <div className="hero-orb-a absolute -left-32 top-16 h-96 w-96 rounded-full bg-cyan-500/20 blur-[130px]" />
      <div className="hero-orb-b absolute -right-24 bottom-0 h-[28rem] w-[28rem] rounded-full bg-violet-600/15 blur-[140px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#030306]/50 to-[#030306]" />
    </div>
  );
}
