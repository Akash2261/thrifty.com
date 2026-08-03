"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { ApiError } from "@/lib/api/client";
import { sendOtp, verifyOtp } from "@/lib/api/auth";

export default function PhoneSignInPage() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await sendOtp({ phoneNumber: phoneNumber.trim() });
      setStep("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send a code. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await verifyOtp({ phoneNumber: phoneNumber.trim(), code: code.trim() });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Incorrect code. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col gap-3">
        <h1 className="text-center text-2xl font-bold text-ink">Sign in with phone</h1>

        {step === "phone" ? (
          <form className="flex flex-col gap-3" onSubmit={handleSendOtp}>
            <TextField
              label="Phone number"
              name="phoneNumber"
              type="tel"
              placeholder="+919876543210"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
            />
            <p className="text-xs text-ink-muted">
              Use full international format, e.g. +91 followed by your 10-digit number.
            </p>

            {error ? <p className="text-sm text-danger">{error}</p> : null}

            <Button type="submit" disabled={isSubmitting} className="mt-2 w-full">
              {isSubmitting ? "Sending…" : "Send code"}
            </Button>
          </form>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={handleVerifyOtp}>
            <p className="text-xs text-ink-muted">Enter the 6-digit code sent to {phoneNumber}.</p>
            <TextField
              label="Code"
              name="code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />

            {error ? <p className="text-sm text-danger">{error}</p> : null}

            <Button type="submit" disabled={isSubmitting} className="mt-2 w-full">
              {isSubmitting ? "Verifying…" : "Verify"}
            </Button>

            <button
              type="button"
              className="text-center text-sm font-medium text-accent"
              onClick={() => setStep("phone")}
            >
              Use a different number
            </button>
          </form>
        )}

        <button
          type="button"
          className="mt-2 text-center text-sm font-medium text-accent"
          onClick={() => router.back()}
        >
          Back
        </button>
      </div>
    </div>
  );
}
