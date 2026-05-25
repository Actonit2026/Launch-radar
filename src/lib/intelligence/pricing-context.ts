export type PricingContextClassification =
  | "product_pricing"
  | "pricing_table"
  | "plan_card"
  | "upgrade_modal"
  | "billing_toggle"
  | "checkout_section"
  | "example_content"
  | "proposal_sample"
  | "generated_sample"
  | "testimonial"
  | "case_study"
  | "job_budget"
  | "project_budget"
  | "article_budget"
  | "customer_quote"
  | "blog_content"
  | "FAQ"
  | "unknown";

const acceptedClassifications = new Set<PricingContextClassification>([
  "product_pricing",
  "pricing_table",
  "plan_card",
  "upgrade_modal",
  "billing_toggle",
  "checkout_section",
]);

const pricingLanguagePattern =
  /\b(?:pricing|price|prices|plans?|packages?|tiers?|subscription|billing|billed|paid|monthly|annual|annually|yearly|upgrade|checkout|seat|per user|usage|pageviews?|requests?|events?|visits?|choose plan|buy now|get plus|get pro|get business|start free)\b/i;
const planLabelPattern =
  /\b(?:free|starter|basic|plus|pro|premium|team|business|enterprise|custom|agency|creator|personal|core)\b/i;
const tablePattern = /\b(?:pricing table|compare plans|plan comparison|included in)\b/i;
const modalPattern = /\b(?:upgrade modal|pricing modal|checkout modal|dialog|subscribe)\b/i;
const billingTogglePattern = /\b(?:monthly|yearly|annual|annually|billed monthly|billed annually)\b/i;
const checkoutPattern = /\b(?:checkout|subscribe|buy now|choose plan|start plan|upgrade)\b/i;

const generatedSamplePattern =
  /\b(?:generated output|generated proposal|generic ai proposal|sample output)\b/i;
const proposalSamplePattern =
  /\b(?:proposal sample|sample proposal|same job post|same brief|client brief|proposal example)\b/i;
const examplePattern = /\b(?:example|sample|template|demo content|mock)\b/i;
const testimonialPattern =
  /\b(?:testimonial|review|quote|customer story|customer quote|what customers say|rated|stars?)\b/i;
const caseStudyPattern = /\b(?:case study|case-study|success story)\b/i;
const jobBudgetPattern =
  /\b(?:job|salary|budget|freelance|freelancer|contractor|hiring|developer role|manager role|upwork|\/\s?hr|\bhr\b|per hour|hourly)\b/i;
const projectBudgetPattern =
  /\b(?:project budget|client project|per project|same brief|skincare brand|seo-first)\b/i;
const articleBudgetPattern =
  /\b(?:article budget|per article|\/\s?article|blog post|copywriting|content budget)\b/i;
const blogPattern = /\b(?:blog|article|news|guide|tutorial)\b/i;
const faqPattern = /\b(?:faq|frequently asked|question|answer)\b/i;

export function normalizePricingText(value: string) {
  return value
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function parsePriceAmount(value: string) {
  const compact = value.replace(/\s/g, "");

  if (/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(compact)) {
    return Number(compact.replace(/,/g, ""));
  }

  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(compact)) {
    return Number(compact.replace(/\./g, "").replace(",", "."));
  }

  if (/^\d+,\d{1,2}$/.test(compact)) {
    return Number(compact.replace(",", "."));
  }

  return Number(compact.replace(/,/g, ""));
}

export function hasReliablePricingPlanLabel(value: string | null | undefined) {
  if (!value) return false;

  const normalized = normalizePricingText(value);

  if (
    !normalized ||
    /^plan\s+\d+$/i.test(normalized) ||
    /^(?:plan|public pricing|public price|visible price|usage tier|pricing option)$/i.test(normalized)
  ) {
    return false;
  }

  if (/^(?:start|growth)$/i.test(normalized)) {
    return false;
  }

  return normalized.length <= 56 && !/[.!?]{2,}/.test(normalized);
}

export function classifyPricingContext({
  text,
  domContext = "",
  section = "unknown",
  pageType = "unknown",
}: {
  text: string;
  domContext?: string;
  section?: string;
  pageType?: string;
}) {
  const normalized = normalizePricingText(`${domContext} ${text}`);
  const lower = normalized.toLowerCase();
  const verifiedByDom =
    /\b(?:pricing|price|plans?|tier|billing|checkout|upgrade|subscription|modal|dialog)\b/i.test(
      domContext,
    );
  const verifiedBySection =
    section === "pricing" ||
    pageType === "pricing" ||
    (pricingLanguagePattern.test(normalized) && planLabelPattern.test(normalized));
  const verifiedStructure =
    tablePattern.test(normalized) ||
    modalPattern.test(normalized) ||
    checkoutPattern.test(normalized) ||
    (billingTogglePattern.test(normalized) && pricingLanguagePattern.test(normalized));

  let classification: PricingContextClassification = "unknown";

  if (generatedSamplePattern.test(lower)) classification = "generated_sample";
  else if (proposalSamplePattern.test(lower)) classification = "proposal_sample";
  else if (projectBudgetPattern.test(lower)) classification = "project_budget";
  else if (articleBudgetPattern.test(lower)) classification = "article_budget";
  else if (jobBudgetPattern.test(lower)) classification = "job_budget";
  else if (testimonialPattern.test(lower)) classification = "testimonial";
  else if (caseStudyPattern.test(lower)) classification = "case_study";
  else if (examplePattern.test(lower)) classification = "example_content";
  else if (blogPattern.test(lower)) classification = "blog_content";
  else if (faqPattern.test(lower)) classification = "FAQ";

  if (classification !== "unknown" && !verifiedByDom) {
    return {
      classification,
      accepted: false,
      rejectionReason: `non_product_pricing_${classification}`,
    };
  }

  if (/table|row|cell/.test(domContext) || tablePattern.test(normalized)) {
    classification = "pricing_table";
  } else if (/modal|dialog/.test(domContext) || modalPattern.test(normalized)) {
    classification = "upgrade_modal";
  } else if (/checkout|subscribe/.test(domContext) || checkoutPattern.test(normalized)) {
    classification = "checkout_section";
  } else if (/toggle|billing/.test(domContext) || billingTogglePattern.test(normalized)) {
    classification = "billing_toggle";
  } else if (/card|plan|tier|price|pricing/.test(domContext) || verifiedBySection) {
    classification = "plan_card";
  } else if (verifiedStructure || pricingLanguagePattern.test(normalized)) {
    classification = "product_pricing";
  }

  const accepted = acceptedClassifications.has(classification);

  return {
    classification,
    accepted,
    rejectionReason: accepted
      ? null
      : `non_product_pricing_${classification}`,
  };
}
