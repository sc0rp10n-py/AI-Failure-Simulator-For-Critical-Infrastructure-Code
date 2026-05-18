import { SiteFooter } from "@/components/layout/site-footer";

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 ambient-grid opacity-40" />
      <div className="pointer-events-none absolute -left-40 top-0 h-125 w-125 rounded-full bg-cyan-500/10 blur-[140px]" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-105 w-105 rounded-full bg-violet-600/10 blur-[120px]" />
      <div className="relative z-10">
        {children}
        <SiteFooter />
      </div>
    </div>
  );
}
