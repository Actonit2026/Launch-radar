import type { FetchPageResult } from "@/lib/analyzer-v3/types";

function tokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 3),
  );
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) {
    return 0;
  }

  let intersection = 0;
  a.forEach((token) => {
    if (b.has(token)) {
      intersection += 1;
    }
  });

  return intersection / (a.size + b.size - intersection);
}

export function duplicatePageScore(
  page: Pick<FetchPageResult, "text_hash" | "text" | "final_url">,
  homepage?: Pick<FetchPageResult, "text_hash" | "text" | "final_url"> | null,
) {
  if (!homepage) {
    return 0;
  }

  if (page.text_hash && page.text_hash === homepage.text_hash) {
    return 1;
  }

  if (page.final_url === homepage.final_url) {
    return 0.98;
  }

  return jaccard(tokens(page.text), tokens(homepage.text));
}

export function isDuplicateHomepage(
  page: Pick<FetchPageResult, "text_hash" | "text" | "final_url">,
  homepage?: Pick<FetchPageResult, "text_hash" | "text" | "final_url"> | null,
) {
  return duplicatePageScore(page, homepage) >= 0.92;
}
