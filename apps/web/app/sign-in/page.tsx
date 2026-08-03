"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/Button";
import { LinkButton } from "@/components/LinkButton";
import { TextField } from "@/components/TextField";
import { ApiError } from "@/lib/api/client";
import { login } from "@/lib/api/auth";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col gap-5">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-ink">Thrifty</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
            Track warranties. Stop paying for subscriptions you forgot.
          </p>
        </div>

        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <TextField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <Button type="submit" disabled={isSubmitting} className="mt-2 w-full">
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <LinkButton href="/phone-sign-in" variant="secondary" className="w-full">
          Continue with phone number
        </LinkButton>

        <Link href="/sign-up" className="text-center text-sm font-medium text-accent">
          Don&apos;t have an account? Sign up
        </Link>
      </div>
    </div>
  );
}
