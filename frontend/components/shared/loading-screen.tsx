"use client";

import { motion } from "framer-motion";

export function LoadingScreen({
  title = "Synchronizing intelligence",
  subtitle = "Preparing your resilience dashboard…",
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-panel-strong w-full max-w-md p-10 text-center"
      >
        <div className="relative mx-auto mb-8 h-24 w-24">
          <motion.div
            className="absolute inset-0 rounded-full border border-cyan-400/30"
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute inset-2 rounded-full border border-violet-400/40 border-t-transparent"
            animate={{ rotate: -360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              className="h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_24px_rgba(34,211,238,0.8)]"
              animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </div>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
        <p className="mt-3 text-lg text-zinc-400">{subtitle}</p>
        <div className="mt-6 flex justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-cyan-400"
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
