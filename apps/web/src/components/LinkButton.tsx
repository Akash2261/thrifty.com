import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-primary text-ink-inverse hover:bg-primary-pressed",
  secondary: "bg-surface-alt text-ink border border-border hover:bg-border",
  ghost: "bg-transparent text-ink-secondary hover:bg-surface-alt",
};

// A Link styled as a button — kept separate from Button (which renders a real <button>) because
// nesting a <button> inside the <a> that next/link renders is invalid HTML.
type LinkButtonProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { variant?: Variant };

export function LinkButton({ variant = "primary", className, ...props }: LinkButtonProps) {
  return (
    <Link
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-center text-sm font-semibold transition-colors",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  );
}
