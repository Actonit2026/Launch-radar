export type DemoCompetitor = {
  name: string;
  url: string;
  category: string;
  expectedPageType: "homepage" | "pricing" | "features" | "product";
  active: boolean;
};

export const demoCompetitorPool: DemoCompetitor[] = [
  { name: "Carrd", url: "https://carrd.co", category: "Website builder", expectedPageType: "pricing", active: true },
  { name: "Plausible", url: "https://plausible.io", category: "Analytics", expectedPageType: "pricing", active: true },
  { name: "Fathom", url: "https://usefathom.com", category: "Analytics", expectedPageType: "pricing", active: true },
  { name: "Buttondown", url: "https://buttondown.email", category: "Newsletter", expectedPageType: "pricing", active: true },
  { name: "Tally", url: "https://tally.so", category: "Forms", expectedPageType: "pricing", active: true },
  { name: "SavvyCal", url: "https://savvycal.com", category: "Scheduling", expectedPageType: "pricing", active: true },
  { name: "Bannerbear", url: "https://www.bannerbear.com", category: "Media automation", expectedPageType: "pricing", active: true },
  { name: "Simple Analytics", url: "https://www.simpleanalytics.com", category: "Analytics", expectedPageType: "pricing", active: true },
  { name: "ScreenshotOne", url: "https://screenshotone.com", category: "Screenshot API", expectedPageType: "pricing", active: true },
  { name: "Transistor", url: "https://transistor.fm", category: "Podcast hosting", expectedPageType: "pricing", active: true },
  { name: "Senja", url: "https://senja.io", category: "Testimonials", expectedPageType: "pricing", active: true },
  { name: "Testimonial.to", url: "https://testimonial.to", category: "Testimonials", expectedPageType: "pricing", active: true },
  { name: "Loops", url: "https://loops.so", category: "Email", expectedPageType: "pricing", active: true },
  { name: "Crisp", url: "https://crisp.chat", category: "Customer support", expectedPageType: "pricing", active: true },
  { name: "Userlist", url: "https://userlist.com", category: "Lifecycle email", expectedPageType: "pricing", active: true },
  { name: "Better Uptime", url: "https://betterstack.com/better-uptime", category: "Monitoring", expectedPageType: "pricing", active: true },
  { name: "Featurebase", url: "https://www.featurebase.app", category: "Product feedback", expectedPageType: "pricing", active: true },
];
