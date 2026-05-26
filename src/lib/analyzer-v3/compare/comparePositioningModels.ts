import type { HomepageModelV3 } from "@/lib/analyzer-v3/types";

export function comparePositioningModels(previous: HomepageModelV3, next: HomepageModelV3) {
  const changes = [];

  if (previous.headline && next.headline && previous.headline !== next.headline) {
    changes.push({
      type: "positioning_changed",
      summary: `Homepage headline changed from "${previous.headline}" to "${next.headline}".`,
      confidence: 0.86,
    });
  }

  if (previous.target_customer && next.target_customer && previous.target_customer !== next.target_customer) {
    changes.push({
      type: "target_customer_changed",
      summary: `Target customer changed from "${previous.target_customer}" to "${next.target_customer}".`,
      confidence: 0.82,
    });
  }

  return changes;
}
