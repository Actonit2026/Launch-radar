"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import {
  addManualPageAction,
  rerunCompetitorIntelligenceAction,
  type ManualPageFormState,
} from "@/app/dashboard/actions";
import { manualPageTypes } from "@/lib/urls";
import { formatPageType } from "@/lib/format";

type ManualPageOverrideFormProps = {
  competitorId: string;
};

export function ManualPageOverrideForm({
  competitorId,
}: ManualPageOverrideFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [addState, addAction, addPending] = useActionState<
    ManualPageFormState,
    FormData
  >(addManualPageAction, {});
  const [rerunState, rerunAction, rerunPending] = useActionState<
    ManualPageFormState,
    FormData
  >(rerunCompetitorIntelligenceAction, {});

  useEffect(() => {
    if (addState.message) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [addState.message, router]);

  useEffect(() => {
    if (rerunState.message) {
      router.refresh();
    }
  }, [rerunState.message, router]);

  return (
    <div className="space-y-5">
      <form ref={formRef} action={addAction} className="space-y-4">
        <input type="hidden" name="competitorId" value={competitorId} />
        <div className="grid gap-3 md:grid-cols-[0.75fr_1.25fr]">
          <label className="block">
            <span className="text-sm font-medium text-ink/75">Page type</span>
            <select
              name="pageType"
              defaultValue="pricing"
              className="mt-2 h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink transition focus:border-moss"
            >
              {manualPageTypes.map((pageType) => (
                <option key={pageType} value={pageType}>
                  {formatPageType(pageType)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-ink/75">Page URL</span>
            <input
              required
              name="pageUrl"
              type="text"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="/pricing or example.com/pricing"
              className="mt-2 h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink transition placeholder:text-ink/35 focus:border-moss"
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div aria-live="polite" className="min-h-5 text-sm">
            {addState.error ? (
              <p className="font-medium text-coral">{addState.error}</p>
            ) : addState.message ? (
              <p className="font-medium text-moss">{addState.message}</p>
            ) : null}
          </div>
          <button
            disabled={addPending}
            className="inline-flex h-11 items-center justify-center rounded-md bg-moss px-5 text-sm font-semibold text-white transition hover:bg-moss/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {addPending ? "Analyzing..." : "Add page and re-run"}
          </button>
        </div>
      </form>

      <form action={rerunAction} className="border-t border-ink/10 pt-4">
        <input type="hidden" name="competitorId" value={competitorId} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div aria-live="polite" className="min-h-5 text-sm">
            {rerunState.error ? (
              <p className="font-medium text-coral">{rerunState.error}</p>
            ) : rerunState.message ? (
              <p className="font-medium text-moss">{rerunState.message}</p>
            ) : null}
          </div>
          <button
            disabled={rerunPending}
            className="inline-flex h-11 items-center justify-center rounded-md border border-ink/15 bg-white px-5 text-sm font-semibold text-ink transition hover:border-ink/35 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {rerunPending ? "Re-running..." : "Re-run analysis"}
          </button>
        </div>
      </form>
    </div>
  );
}
