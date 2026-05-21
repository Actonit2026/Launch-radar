"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  signInAction,
  signUpAction,
  type AuthState,
} from "@/app/auth/actions";

type AuthFormProps = {
  mode: "signin" | "signup";
  notice?: string;
};

export function AuthForm({ mode, notice }: AuthFormProps) {
  const isSignIn = mode === "signin";
  const action = isSignIn ? signInAction : signUpAction;
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    action,
    {},
  );

  return (
    <main className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-md items-center px-6 py-12">
      <section className="w-full rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-moss">
          LaunchRadar
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">
          {isSignIn ? "Sign in" : "Create account"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink/60">
          {isSignIn
            ? "Welcome back. Sign in to review tracked competitors and verified changes."
            : "Start free with competitor baselines and verified public-page intelligence."}
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

          <label className="block">
            <span className="text-sm font-medium text-ink/75">Password</span>
            <div className="mt-2 flex rounded-md border border-ink/15 bg-white transition focus-within:border-moss">
              <input
                required
                minLength={6}
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={isSignIn ? "current-password" : "new-password"}
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

          <div aria-live="polite" className="min-h-6">
            {notice ? (
              <p className="text-sm font-medium text-moss">{notice}</p>
            ) : null}
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
            {isPending
              ? "Working..."
              : isSignIn
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        {isSignIn ? (
          <p className="mt-4 text-center text-sm">
            <Link
              href="/forgot-password"
              className="font-semibold text-moss hover:text-moss/80"
            >
              Forgot password?
            </Link>
          </p>
        ) : (
          <p className="mt-4 text-sm leading-6 text-ink/55">
            If email confirmation is enabled, we will send a confirmation link.
            If it is disabled, you will go straight to your dashboard.
          </p>
        )}

        <p className="mt-6 text-center text-sm text-ink/65">
          {isSignIn ? "Don't have an account?" : "Already have an account?"}{" "}
          <Link
            href={isSignIn ? "/signup" : "/login"}
            className="font-semibold text-moss hover:text-moss/80"
          >
            {isSignIn ? "Create one" : "Sign in"}
          </Link>
        </p>
      </section>
    </main>
  );
}
