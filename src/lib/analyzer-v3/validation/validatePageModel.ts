import type { PageBundlePage } from "@/lib/analyzer-v3/types";

export function validatePageModel(page: PageBundlePage) {
  const reasons: string[] = [];

  if (!page.page_type_result.extraction_allowed) reasons.push("extraction_not_allowed");
  if (page.page_type_result.detected_page_type === "duplicate_homepage") reasons.push("duplicate_homepage");
  if (page.page.blocked) reasons.push("blocked");
  if (page.page.status_code !== null && page.page.status_code >= 400) reasons.push(`http_${page.page.status_code}`);

  return {
    valid: reasons.length === 0,
    reasons,
  };
}
