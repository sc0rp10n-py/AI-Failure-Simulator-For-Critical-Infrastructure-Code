"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

export function HeroBackground() {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gridRef.current) return;
    const ctx = gsap.context(() => {
      gsap.to(gridRef.current, {
        backgroundPosition: "120px 120px",
        duration: 18,
        repeat: -1,
        ease: "none",
      });
    });
    return () => ctx.revert();
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        ref={gridRef}
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.15) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <div className="absolute -left-32 top-20 h-72 w-72 rounded-full bg-cyan-500/20 blur-[120px]" />
      <div className="absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-violet-600/20 blur-[120px]" />
    </div>
  );
}
