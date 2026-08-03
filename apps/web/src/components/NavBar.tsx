"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useSession } from "@/context/session-context";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/warranty", label: "Warranty" },
  { href: "/substop", label: "SubStop" },
  { href: "/settings", label: "Settings" },
];

export function NavBar() {
  const pathname = usePathname();
  const { user, signOut } = useSession();

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-ink">
          Thrifty
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map((link) => {
            const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive ? "bg-surface-selected text-ink-inverse" : "text-ink-secondary hover:bg-surface-alt",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-ink-secondary sm:inline">
            {user.email ?? user.phoneNumber}
          </span>
          <button
            onClick={() => void signOut()}
            className="text-sm font-semibold text-ink-secondary hover:text-danger"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
