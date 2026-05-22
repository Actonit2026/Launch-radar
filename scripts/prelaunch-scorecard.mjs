import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function hasFile(file) {
  return existsSync(path.join(root, file));
}

function read(file) {
  return readFileSync(path.join(root, file), "utf8");
}

const requiredFiles = [
  "src/app/bot/page.tsx",
  "src/app/privacy/page.tsx",
  "src/app/terms/page.tsx",
  "src/app/api/health/route.ts",
  "src/app/api/weekly-digest/route.ts",
  "src/app/api/scan-worker/route.ts",
  "src/app/api/maintenance/cleanup/route.ts",
  "src/lib/retention.ts",
  "src/lib/scan-queue.ts",
  "src/lib/crawler/robots.ts",
  "docs/shareable-dossier-architecture.md",
];
const missingFiles = requiredFiles.filter((file) => !hasFile(file));
const envExample = read(".env.example");
const requiredEnv = [
  "MAX_PAGES_PER_SCAN",
  "MAX_SCANS_PER_USER_PER_DAY_FREE",
  "MAX_SCANS_PER_USER_PER_DAY_PRO",
  "MAX_AI_CALLS_PER_USER_PER_DAY",
  "MAX_AI_CALLS_GLOBAL_PER_DAY",
  "MAX_BROWSER_RENDER_PER_USER_PER_DAY",
  "MAX_BROWSER_RENDER_GLOBAL_PER_DAY",
  "MONTHLY_COST_BUDGET_EUR",
  "ASYNC_SCAN_QUEUE_ENABLED",
  "CRON_SECRET",
  "STRIPE_PRO_ANNUAL_PRICE_ID",
  "ADMIN_EMAILS",
];
const missingEnv = requiredEnv.filter((name) => !envExample.includes(`${name}=`));
const tests = read("scripts/phase11-checks.mjs");
const hasFiftyFixtureGate = /50-page deterministic SaaS fixture set/.test(tests);
const hasSpaGate = /JavaScript-heavy shells/.test(tests);
const hasSsrfGate = /rejects private hosts/.test(tests);

const blockers = [
  ...missingFiles.map((file) => `Missing required launch-hardening file: ${file}`),
  ...missingEnv.map((name) => `Missing .env.example variable: ${name}`),
  !hasFiftyFixtureGate ? "Analyzer does not include the 50-page fixture gate." : null,
  !hasSpaGate ? "SPA limited-analysis behavior is not tested." : null,
  !hasSsrfGate ? "Private-host URL rejection is not tested." : null,
  "Production auth, Stripe webhook, billing portal, and weekly digest delivery still need live verification.",
  "Supabase advisors/RLS audit must be run after applying the latest migration.",
  "Queue worker endpoint exists, but scheduled Vercel Cron configuration still needs production setup.",
].filter(Boolean);

const scores = {
  reliability: hasFiftyFixtureGate && hasSpaGate ? 91 : 80,
  security: missingFiles.length === 0 && hasSsrfGate ? 88 : 75,
  costEfficiency: missingEnv.length === 0 ? 90 : 78,
  recommendationUsefulness: hasFile("src/lib/product-recommendations.ts") ? 82 : 65,
  ux: hasFile("src/app/dashboard/onboarding/page.tsx") ? 86 : 78,
};

const ready =
  blockers.length === 0 &&
  scores.reliability >= 95 &&
  scores.security >= 90 &&
  scores.costEfficiency >= 90 &&
  scores.recommendationUsefulness >= 80 &&
  scores.ux >= 85;

console.log(ready ? "READY TO SHIP" : "NOT READY TO SHIP");
console.log(JSON.stringify({ scores, blockers }, null, 2));
