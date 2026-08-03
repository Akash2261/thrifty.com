import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function TextField({ label, id, className, ...props }: TextFieldProps) {
  const inputId = id ?? props.name;
  return (
    <label className="flex flex-col gap-1.5" htmlFor={inputId}>
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">{label}</span>
      <input
        id={inputId}
        className={cn(
          "rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-border-strong",
          className,
        )}
        {...props}
      />
    </label>
  );
}
