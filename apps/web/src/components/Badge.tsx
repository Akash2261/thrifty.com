import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "urgent" | "danger";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-surface-alt text-ink-secondary",
  accent: "bg-accent-soft text-ink",
  urgent: "bg-danger-soft text-danger",
  danger: "bg-danger text-ink-inverse",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-semibold",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
}
