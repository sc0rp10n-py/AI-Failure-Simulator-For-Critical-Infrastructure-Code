import Link from "next/link";
import { Shield } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#030306]/60 backdrop-blur-2xl">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-semibold tracking-tight text-white"
        >
          <Shield className="h-6 w-6 text-cyan-400" />
          SentinelAI
        </Link>
        <nav className="hidden items-center gap-10 text-base text-zinc-400 md:flex">
          <a href="/#how" className="transition hover:text-cyan-200">
            How it works
          </a>
          <a href="/#demos" className="transition hover:text-cyan-200">
            Projects
          </a>
        </nav>
        <Link
          href="/analyze"
          className="inline-flex h-10 items-center rounded-full border border-cyan-400/40 bg-cyan-400/15 px-5 text-sm font-semibold text-cyan-100 backdrop-blur-md transition hover:bg-cyan-400/25"
        >
          Start Analysis
        </Link>
      </div>
    </header>
  );
}
