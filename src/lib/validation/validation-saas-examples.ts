export type ValidationSaasExample = {
  name: string;
  url: string;
  category: string;
  competitor_urls: string[];
  expected_signals: {
    pricing_required: boolean;
    positioning_required: boolean;
    cta_required: boolean;
    features_required: boolean;
  };
};

export const validationSaasExamples: ValidationSaasExample[] = [
  {
    name: "Carrd",
    url: "https://carrd.co",
    category: "website builder",
    competitor_urls: ["https://tally.so", "https://www.bannerbear.com"],
    expected_signals: {
      pricing_required: true,
      positioning_required: true,
      cta_required: true,
      features_required: true,
    },
  },
  {
    name: "Plausible",
    url: "https://plausible.io",
    category: "analytics",
    competitor_urls: ["https://usefathom.com", "https://www.simpleanalytics.com"],
    expected_signals: {
      pricing_required: true,
      positioning_required: true,
      cta_required: true,
      features_required: true,
    },
  },
  {
    name: "Fathom",
    url: "https://usefathom.com",
    category: "analytics",
    competitor_urls: ["https://plausible.io", "https://www.simpleanalytics.com"],
    expected_signals: {
      pricing_required: true,
      positioning_required: true,
      cta_required: true,
      features_required: true,
    },
  },
  {
    name: "Tally",
    url: "https://tally.so",
    category: "forms",
    competitor_urls: ["https://carrd.co", "https://www.featurebase.app"],
    expected_signals: {
      pricing_required: true,
      positioning_required: true,
      cta_required: true,
      features_required: true,
    },
  },
  {
    name: "Buttondown",
    url: "https://buttondown.email",
    category: "newsletter",
    competitor_urls: ["https://loops.so", "https://userlist.com"],
    expected_signals: {
      pricing_required: true,
      positioning_required: true,
      cta_required: true,
      features_required: true,
    },
  },
  {
    name: "Bannerbear",
    url: "https://www.bannerbear.com",
    category: "media automation",
    competitor_urls: ["https://screenshotone.com", "https://carrd.co"],
    expected_signals: {
      pricing_required: true,
      positioning_required: true,
      cta_required: true,
      features_required: true,
    },
  },
  {
    name: "Senja",
    url: "https://senja.io",
    category: "testimonials",
    competitor_urls: ["https://testimonial.to", "https://www.featurebase.app"],
    expected_signals: {
      pricing_required: true,
      positioning_required: true,
      cta_required: true,
      features_required: true,
    },
  },
  {
    name: "Featurebase",
    url: "https://www.featurebase.app",
    category: "product feedback",
    competitor_urls: ["https://senja.io", "https://tally.so"],
    expected_signals: {
      pricing_required: true,
      positioning_required: true,
      cta_required: true,
      features_required: true,
    },
  },
  {
    name: "SavvyCal",
    url: "https://savvycal.com",
    category: "scheduling",
    competitor_urls: ["https://cal.com", "https://tally.so"],
    expected_signals: {
      pricing_required: true,
      positioning_required: true,
      cta_required: true,
      features_required: true,
    },
  },
  {
    name: "Transistor",
    url: "https://transistor.fm",
    category: "podcast hosting",
    competitor_urls: ["https://buttondown.email", "https://www.simpleanalytics.com"],
    expected_signals: {
      pricing_required: true,
      positioning_required: true,
      cta_required: true,
      features_required: true,
    },
  },
  {
    name: "Crisp",
    url: "https://crisp.chat",
    category: "customer support",
    competitor_urls: ["https://userlist.com", "https://loops.so"],
    expected_signals: {
      pricing_required: true,
      positioning_required: true,
      cta_required: true,
      features_required: true,
    },
  },
  {
    name: "Better Uptime",
    url: "https://betterstack.com/better-uptime",
    category: "monitoring",
    competitor_urls: ["https://crisp.chat", "https://plausible.io"],
    expected_signals: {
      pricing_required: false,
      positioning_required: true,
      cta_required: true,
      features_required: true,
    },
  },
];
