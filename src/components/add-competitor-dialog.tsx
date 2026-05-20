"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createCompetitorAction,
  type CompetitorFormState,
} from "@/app/dashboard/actions";

export function AddCompetitorDialog() {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState<
    CompetitorFormState,
    FormData
  >(createCompetitorAction, {});

  useEffect(() => {
    if (state.message) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state.message]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center justify-center rounded-md bg-moss px-5 text-sm font-semibold text-white transition hover:bg-moss/90"
      >
        Add competitor
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 px-4 py-6">
          <section
            aria-modal="true"
            role="dialog"
            aria-labelledby="add-competitor-title"
            className="w-full max-w-lg rounded-lg border border-ink/10 bg-white p-6 shadow-soft"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-moss">
                  New tracker
                </p>
                <h2
                  id="add-competitor-title"
                  className="mt-2 text-2xl font-semibold text-ink"
                >
                  Add competitor
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-semibold text-ink/60 transition hover:bg-paper hover:text-ink"
              >
                Close
              </button>
            </div>

            <form ref={formRef} action={formAction} className="mt-6 space-y-5">
              <label className="block">
                <span className="text-sm font-medium text-ink/75">Name</span>
                <input
                  name="name"
                  type="text"
                  placeholder="Acme Analytics"
                  className="mt-2 h-12 w-full rounded-md border border-ink/15 bg-white px-3 text-base text-ink transition placeholder:text-ink/35 focus:border-moss"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-ink/75">
                  Competitor URL
                </span>
                <input
                  required
                  name="baseUrl"
                  type="text"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="example.com or example.com/pricing"
                  className="mt-2 h-12 w-full rounded-md border border-ink/15 bg-white px-3 text-base text-ink transition placeholder:text-ink/35 focus:border-moss"
                />
              </label>

              <div aria-live="polite" className="min-h-6">
                {state.error ? (
                  <p className="text-sm font-medium text-coral">
                    {state.error}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-11 items-center justify-center rounded-md border border-ink/15 bg-white px-5 text-sm font-semibold text-ink transition hover:border-ink/35"
                >
                  Cancel
                </button>
                <button
                  disabled={isPending}
                  className="inline-flex h-11 items-center justify-center rounded-md bg-ink px-5 text-sm font-semibold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? "Adding..." : "Track pages"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
