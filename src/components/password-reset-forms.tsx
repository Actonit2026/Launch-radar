"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  requestPasswordResetAction,
  resetPasswordAction,
  type AuthState,
} from "@/app/auth/actions";

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    requestPasswordResetAction,
    {},
  );

  return (
    <main className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-md items-center px-6 py-12">
      <section className="w-full rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-moss">
          LaunchRadar
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">
          Reset password
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink/60">
          Enter your account email and we will send a secure reset link.
        </p>

        <form action={formAction} className="mt-8 space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-ink/75">Email</span>
            <input
              required
              name="email"
              type="email"
              autoComplete="email"
              className="mt-2 h-12 w-full rounded-md border border-ink/15 bg-white px-3 text-base text-ink transition focus:border-moss"
            />
          </label>

          <div aria-live="polite" className="min-h-6">
            {state.error ? (
              <p className="text-sm font-medium text-coral">{state.error}</p>
            ) : null}
            {state.message ? (
              <p className="text-sm font-medium text-moss">{state.message}</p>
            ) : null}
          </div>

          <button
            disabled={isPending}
            className="inline-flex h-12 w-full items-center justify-center rounded-md bg-ink px-5 text-sm font-semibold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink/65">
          Remembered it?{" "}
          <Link
            href="/login"
            className="font-semibold text-moss hover:text-moss/80"
          >
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}

export function ResetPasswordForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    resetPasswordAction,
    {},
  );

  return (
    <main className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-md items-center px-6 py-12">
      <section className="w-full rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-moss">
          LaunchRadar
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">
          Choose a new password
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink/60">
          Use the reset link from your email, then set a new password here.
        </p>

        <form action={formAction} className="mt-8 space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-ink/75">
              New password
            </span>
            <div className="mt-2 flex rounded-md border border-ink/15 bg-white transition focus-within:border-moss">
              <input
                required
                minLength={6}
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                className="h-12 min-w-0 flex-1 rounded-md bg-transparent px-3 text-base text-ink outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="px-3 text-sm font-semibold text-ink/55 transition hover:text-ink"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-ink/75">
              Confirm password
            </span>
            <input
              required
              minLength={6}
              name="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className="mt-2 h-12 w-full rounded-md border border-ink/15 bg-white px-3 text-base text-ink transition focus:border-moss"
            />
          </label>

          <div aria-live="polite" className="min-h-6">
            {state.error ? (
              <p className="text-sm font-medium text-coral">{state.error}</p>
            ) : null}
            {state.message ? (
              <p className="text-sm font-medium text-moss">{state.message}</p>
            ) : null}
          </div>

          <button
            disabled={isPending}
            className="inline-flex h-12 w-full items-center justify-center rounded-md bg-ink px-5 text-sm font-semibold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Saving..." : "Save new password"}
          </button>
        </form>
      </section>
    </main>
  );
}
