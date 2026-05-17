import Link from "next/link";
import { Shield } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/40 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Shield className="h-5 w-5 text-cyan-400" />
          <span>SentinelAI</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
          <a href="#how" className="transition-colors hover:text-white">
            How it works
          </a>
          <a href="#demos" className="transition-colors hover:text-white">
            Projects
          </a>
        </nav>
        <Link
          href="/analyze"
          className="inline-flex h-8 items-center rounded-lg bg-cyan-500/90 px-3 text-sm font-medium text-black transition hover:bg-cyan-400"
        >
          Start Analysis
        </Link>
      </div>
    </header>
  );
}
