"use client";

import { useState } from "react";
import { deleteCompetitorAction } from "@/app/dashboard/actions";

type DeleteCompetitorButtonProps = {
  competitorId: string;
  redirectTo?: string;
};

export function DeleteCompetitorButton({
  competitorId,
  redirectTo = "/dashboard",
}: DeleteCompetitorButtonProps) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex h-10 items-center justify-center rounded-md border border-coral/30 bg-white px-4 text-sm font-semibold text-coral transition hover:bg-coral/10"
      >
        Delete
      </button>
    );
  }

  return (
    <form action={deleteCompetitorAction} className="flex flex-wrap gap-2">
      <input type="hidden" name="competitorId" value={competitorId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <button
        type="submit"
        className="inline-flex h-10 items-center justify-center rounded-md bg-coral px-4 text-sm font-semibold text-white transition hover:bg-coral/90"
      >
        Confirm delete
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="inline-flex h-10 items-center justify-center rounded-md border border-ink/15 bg-white px-4 text-sm font-semibold text-ink transition hover:border-ink/35"
      >
        Cancel
      </button>
    </form>
  );
}
