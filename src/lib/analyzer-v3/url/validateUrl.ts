import { normalizeAnalyzerUrl } from "@/lib/analyzer-v3/url/normalizeUrl";
import type { SafeUrlResult } from "@/lib/analyzer-v3/types";

const blockedHostnames = new Set([
  "localhost",
  "metadata.google.internal",
  "169.254.169.254",
]);

const blockedPrivateHostPattern =
  /^(?:0\.|10\.|127\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.|::1$|::$|::ffff:127\.|fc[0-9a-f]{2}:|fd[0-9a-f]{2}:|fe80:|ff[0-9a-f]{2}:)/i;

const blockedPathPattern =
  /\/(?:login|log-in|signin|sign-in|signup|sign-up|auth|account|checkout|cart|billing-portal|admin|dashboard)(?:\/|$)/i;

function localUrlsAllowedForTests() {
  return process.env.LAUNCHRADAR_ALLOW_LOCAL_TEST_URLS === "1";
}

export function isBlockedAnalyzerPath(url: string) {
  try {
    return blockedPathPattern.test(new URL(url).pathname);
  } catch {
    return true;
  }
}

export function validateAnalyzerUrl(input: string): SafeUrlResult {
  const normalized = normalizeAnalyzerUrl(input);
  const url = new URL(normalized.canonical_url);
  const hostname = url.hostname.toLowerCase();
  const unbracketed = hostname.replace(/^\[|\]$/g, "");

  if (url.protocol !== "https:" && !localUrlsAllowedForTests()) {
    throw new Error("Analyzer V3 only scans public HTTPS URLs.");
  }

  if (url.username || url.password || !hostname) {
    throw new Error("Enter a valid public website URL.");
  }

  if (
    !localUrlsAllowedForTests() &&
    (blockedHostnames.has(hostname) ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      blockedPrivateHostPattern.test(unbracketed))
  ) {
    throw new Error("Analyzer V3 cannot scan private or internal hosts.");
  }

  if (isBlockedAnalyzerPath(normalized.canonical_url)) {
    throw new Error("Analyzer V3 scans public marketing, product, pricing, docs, or update pages only.");
  }

  return normalized;
}
