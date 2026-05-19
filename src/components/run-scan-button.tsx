"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ScanResult = {
  checked: number;
  snapshotsCreated: number;
  changed: number;
  aiSummariesCreated: number;
  aiSummariesSkipped: number;
  notificationsSent: number;
  notificationsSkipped: number;
  failed: number;
};

export function RunScanButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runScan() {
    setPending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
      });
      const payload = (await response.json()) as Partial<ScanResult> & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Scan failed.");
      }

      setMessage(
        `Checked ${payload.checked ?? 0}, saved ${
          payload.snapshotsCreated ?? 0
        } snapshots, generated ${
          payload.aiSummariesCreated ?? 0
        } AI summaries, sent ${payload.notificationsSent ?? 0} alerts.`,
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Scan failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        type="button"
        disabled={pending}
        onClick={runScan}
        className="inline-flex h-11 items-center justify-center rounded-md border border-ink/15 bg-white px-5 text-sm font-semibold text-ink transition hover:border-ink/35 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Scanning..." : "Scan now"}
      </button>
      {message ? (
        <p className="max-w-60 text-xs leading-5 text-ink/55">{message}</p>
      ) : null}
    </div>
  );
}
