"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ScanResult = {
  queued?: boolean;
  message?: string;
  checked: number;
  snapshotsCreated: number;
  changed: number;
  aiSummariesCreated: number;
  aiSummariesSkipped: number;
  notificationsSent: number;
  notificationsSkipped: number;
  failed: number;
  deferred: number;
};

async function readScanPayload(response: Response) {
  const text = await response.text();

  if (!text) {
    return {
      error: response.ok
        ? undefined
        : "Scan failed.",
    };
  }

  try {
    return JSON.parse(text) as Partial<ScanResult> & { error?: string };
  } catch {
    return {
      error: response.ok
        ? "Scan returned an unreadable response."
        : "Scan failed.",
    };
  }
}

export function RunScanButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runScan() {
    setPending(true);
    setMessage(
      "Understanding pages... checking pricing... checking updates... comparing competitors...",
    );

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
      });
      const payload = await readScanPayload(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "Scan failed.");
      }

      if (payload.queued) {
        setMessage(
          payload.message ??
            "Scan queued. Useful results will appear first; deeper checks can finish in the background.",
        );
        router.refresh();
        return;
      }

      setMessage(
        `Useful scan complete. Checked ${payload.checked ?? 0}, saved ${
          payload.snapshotsCreated ?? 0
        } snapshots, sent ${payload.notificationsSent ?? 0} alerts, deferred ${
          payload.deferred ?? 0
        } pages due to scan cadence.`,
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
        {pending ? "Checking..." : "Scan now"}
      </button>
      {message ? (
        <p className="max-w-60 text-xs leading-5 text-ink/55">{message}</p>
      ) : null}
    </div>
  );
}
