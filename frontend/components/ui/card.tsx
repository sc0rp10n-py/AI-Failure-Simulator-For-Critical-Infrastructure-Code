import * as React from "react";

import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mb-4 flex flex-col gap-1", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3 className={cn("text-lg font-semibold tracking-tight text-white", className)} {...props} />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-zinc-400", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription };
