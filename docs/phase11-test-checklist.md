# Phase 11 Test Checklist

Run command:

```bash
npm run test:phase11
```

Automated coverage:

- `example.com`, `https://example.com`, `www.example.com`, and subpage URL normalization.
- Tracking parameter stripping and manual same-domain page validation.
- Pricing extraction for `/pricing`, homepage-visible pricing, contact-sales-only pricing, `EUR`, `USD`, monthly, annual, and per-user pricing.
- Anti-false-positive pricing checks for customer counts, uptime percentages, support hours, integrations, and founding years.
- Page discovery for homepage links, sitemap links, pricing linked as `Packages`, changelog linked as `Release notes`, and one failed fallback page.
- Changelog detection versus generic blog content.
- Evidence requirements for extracted facts.
- Structured-fact-only deterministic summary fallback, including the limited-data message.

Manual smoke coverage already exercised during Phase 7-10:

- First competitor scan creates baseline snapshots and an intelligence snapshot.
- First scan does not create `detected_changes` rows or send alerts.
- Dashboard shows `Baseline created`, `Snapshot ready`, pages analyzed, and evidence-backed intelligence.
- Manual page override adds/replaces a page and re-runs analysis.
- Debug trace view shows selected pages, extraction facts, AI input/output, warnings, and errors.

Pre-deploy checks:

```bash
npm run typecheck
npm run lint
npm run build
```
