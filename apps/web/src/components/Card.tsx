import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-5 shadow-[0_4px_12px_rgba(11,14,31,0.08)]",
        className,
      )}
      {...props}
    />
  );
}
