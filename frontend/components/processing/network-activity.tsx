"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

export function NetworkActivity({ nodeCount = 6 }: { nodeCount?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    const nodes = Array.from({ length: nodeCount }, (_, i) => ({
      x: 40 + (i * 70) % 280,
      y: 30 + (i * 37) % 100,
      pulse: Math.random(),
    }));

    const id = requestAnimationFrame(function tick() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      nodes.forEach((n, i) => {
        n.pulse += 0.02;
        const r = 4 + Math.sin(n.pulse) * 2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = i % 2 ? "#22d3ee" : "#8b5cf6";
        ctx.fill();
        if (i > 0) {
          ctx.strokeStyle = "rgba(34,211,238,0.3)";
          ctx.beginPath();
          ctx.moveTo(nodes[i - 1].x, nodes[i - 1].y);
          ctx.lineTo(n.x, n.y);
          ctx.stroke();
        }
      });
      frame++;
      if (frame < 600) requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, [nodeCount]);

  return (
    <canvas ref={canvasRef} width={320} height={140} className="w-full rounded-lg bg-black/50" />
  );
}

export function PulsingLoader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-zinc-400">
      <motion.span
        className="h-2 w-2 rounded-full bg-cyan-400"
        animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
        transition={{ repeat: Infinity, duration: 1.2 }}
      />
      {label}
    </div>
  );
}
