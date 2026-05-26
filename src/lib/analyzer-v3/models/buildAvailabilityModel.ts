import type { AvailabilityModelV3, PageBundle } from "@/lib/analyzer-v3/types";

export function buildAvailabilityModel(bundle: PageBundle): AvailabilityModelV3 {
  const homepage = bundle.homepage?.page ?? null;

  if (!homepage) {
    return {
      status: "unavailable",
      http_status: null,
      final_url: null,
      evidence: [],
      confidence: "low",
    };
  }

  const status =
    homepage.blocked
      ? "blocked"
      : homepage.timed_out
        ? "timeout"
        : homepage.status_code === 404 || homepage.status_code === 410
          ? "missing"
          : homepage.status_code !== null && homepage.status_code >= 400
            ? "unavailable"
            : homepage.redirected
              ? "redirected"
              : "live";

  return {
    status,
    http_status: homepage.status_code,
    final_url: homepage.final_url,
    evidence: [
      {
        source_url: homepage.final_url,
        evidence_text: status === "live" || status === "redirected"
          ? `Homepage fetched with HTTP ${homepage.status_code ?? "unknown"}.`
          : homepage.error ?? `Homepage status ${homepage.status_code ?? "unknown"}.`,
        confidence: homepage.status_code === null ? "medium" : "high",
      },
    ],
    confidence: homepage.status_code === null ? "medium" : "high",
  };
}
