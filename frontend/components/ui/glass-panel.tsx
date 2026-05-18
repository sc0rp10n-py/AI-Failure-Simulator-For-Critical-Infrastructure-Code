import { cn } from "@/lib/utils";

export function GlassPanel({
  className,
  children,
  strong,
}: {
  className?: string;
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className={cn(strong ? "glass-panel-strong" : "glass-panel", className)}>
      {children}
    </div>
  );
}
