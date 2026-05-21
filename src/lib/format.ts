import type { DetectedChange, PageType } from "@/lib/database.types";

const pageOrder: Record<PageType, number> = {
  homepage: 0,
  pricing: 1,
  features: 2,
  product: 3,
  changelog: 4,
  docs: 5,
};

const pageLabels: Record<PageType, string> = {
  homepage: "Homepage",
  pricing: "Pricing",
  features: "Features",
  product: "Product",
  changelog: "Changelog",
  docs: "Docs",
};

export function formatPageOrder(pageType: PageType) {
  return pageOrder[pageType];
}

export function formatPageType(pageType: PageType) {
  return pageLabels[pageType];
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function severityClassName(severity: DetectedChange["severity"]) {
  switch (severity) {
    case "high":
      return "bg-coral/10 text-coral";
    case "medium":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-moss/10 text-moss";
  }
}
