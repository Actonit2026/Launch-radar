import { formatDateTime } from "@/lib/format";
import type { ScanDebugLogView } from "@/lib/scan-debug";

type ScanDebugPanelProps = {
  logs: ScanDebugLogView[];
};

const runTypeLabels: Record<ScanDebugLogView["runType"], string> = {
  initial_setup: "Initial setup",
  manual_analysis: "Manual analysis",
  manual_scan: "Manual scan",
};

function statusClassName(status: ScanDebugLogView["status"]) {
  switch (status) {
    case "success":
      return "bg-moss/10 text-moss";
    case "partial":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-coral/10 text-coral";
  }
}

function prettyPayload(payload: unknown) {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return "{}";
  }
}

export function ScanDebugPanel({ logs }: ScanDebugPanelProps) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-lg font-semibold text-ink">Scan debug</h2>
          <p className="mt-1 text-sm leading-6 text-ink/55">
            Developer trace for recent scans, extraction, summaries, warnings,
            and errors.
          </p>
        </div>
        <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink/55">
          {logs.length} recent
        </span>
      </div>

      {logs.length ? (
        <div className="mt-5 space-y-3">
          {logs.map((log) => (
            <details
              key={log.id}
              className="rounded-md border border-ink/10 p-4"
            >
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {runTypeLabels[log.runType]}
                    </p>
                    <p className="mt-1 text-xs text-ink/45">
                      {formatDateTime(log.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClassName(
                      log.status,
                    )}`}
                  >
                    {log.status}
                  </span>
                </div>
              </summary>

              <div className="mt-4 space-y-4 border-t border-ink/10 pt-4">
                <div className="grid gap-3 text-sm leading-6 text-ink/65 md:grid-cols-2">
                  <p>
                    <span className="font-semibold text-ink">
                      Normalized URL:
                    </span>{" "}
                    {log.normalizedUrl ?? "Unknown"}
                  </p>
                  <p>
                    <span className="font-semibold text-ink">
                      Submitted URL:
                    </span>{" "}
                    {log.submittedUrl ?? "None"}
                  </p>
                </div>

                {log.warnings.length ? (
                  <div>
                    <h3 className="text-sm font-semibold text-ink">
                      Warnings
                    </h3>
                    <ul className="mt-2 space-y-1 text-sm leading-6 text-ink/60">
                      {log.warnings.slice(0, 8).map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {log.errors.length ? (
                  <div>
                    <h3 className="text-sm font-semibold text-ink">Errors</h3>
                    <ul className="mt-2 space-y-1 text-sm leading-6 text-coral">
                      {log.errors.slice(0, 8).map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <pre className="max-h-96 overflow-auto rounded-md bg-ink p-4 text-xs leading-5 text-white">
                  {prettyPayload(log.payload)}
                </pre>
              </div>
            </details>
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-md bg-paper p-4 text-sm leading-6 text-ink/65">
          Debug traces will appear after the next first scan, manual page
          analysis, or Scan now run.
        </p>
      )}
    </section>
  );
}
