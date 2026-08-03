import { twMerge } from "tailwind-merge";

// Plain string concatenation isn't enough here — components pass a base className plus a caller
// override (e.g. Card's default bg-surface vs a caller's bg-primary), and two same-specificity
// Tailwind utilities are decided by their order in the generated stylesheet, not by class-list
// order, so the "later" class in a template string can silently lose. twMerge resolves that by
// dropping the earlier conflicting utility instead.
export function cn(...classes: Array<string | false | null | undefined>): string {
  return twMerge(classes.filter(Boolean).join(" "));
}
