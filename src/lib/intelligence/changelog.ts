import type { PageType } from "@/lib/database.types";
import type { ScrapedPage } from "@/lib/crawler/scraper";
import type {
  ChangelogAnalysis,
  Confidence,
  StructuredFact,
} from "@/lib/intelligence/types";
import {
  makeFact,
  sentenceCaseKey,
  textLines,
  uniqueBy,
} from "@/lib/intelligence/text";

const changelogUrlPattern =
  /(?:changelog|updates|release-notes|releases)(?:\/|$|-|_)?/i;
const updateLanguagePattern =
  /\b(?:new|improved|fixed|shipped|released|release|update|updates|version|v\d+(?:\.\d+){0,2}|beta|launched|introducing)\b/i;
const datePattern =
  /\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/i;

function confidenceForChangelog({
  pageType,
  url,
  title,
  signalCount,
  dateCount,
}: {
  pageType: PageType;
  url: string;
  title: string;
  signalCount: number;
  dateCount: number;
}): { confidence: Confidence; score: number } {
  const urlSignal = changelogUrlPattern.test(url);
  const titleSignal = changelogUrlPattern.test(title);

  if ((pageType === "changelog" || urlSignal || titleSignal) && signalCount >= 2) {
    return { confidence: "high", score: 0.9 };
  }

  if (signalCount >= 3 && dateCount >= 1) {
    return { confidence: "medium", score: 0.72 };
  }

  if (signalCount >= 2) {
    return { confidence: "low", score: 0.48 };
  }

  return { confidence: "low", score: 0.28 };
}

function updateTitleFacts({
  lines,
  sourceUrl,
}: {
  lines: string[];
  sourceUrl: string;
}) {
  const facts: StructuredFact[] = [];

  for (const line of lines) {
    if (
      line.length < 6 ||
      line.length > 140 ||
      !updateLanguagePattern.test(line)
    ) {
      continue;
    }

    facts.push(
      makeFact({
        field: "recent_update_title",
        value: line,
        confidence: datePattern.test(line) ? "high" : "medium",
        confidenceScore: datePattern.test(line) ? 0.82 : 0.64,
        sourceUrl,
        evidenceText: line,
        extractionMethod: "deterministic_keyword",
      }),
    );
  }

  return uniqueBy(facts, (fact) => sentenceCaseKey(fact.value)).slice(0, 5);
}

export function analyzeChangelog(
  scrape: ScrapedPage,
  pageType: PageType,
): ChangelogAnalysis {
  const lines = textLines(scrape);
  const signalLines = lines.filter((line) => updateLanguagePattern.test(line));
  const dateLines = lines.filter((line) => datePattern.test(line));
  const confidence = confidenceForChangelog({
    pageType,
    url: scrape.finalUrl,
    title: scrape.title,
    signalCount: signalLines.length,
    dateCount: dateLines.length,
  });
  const detected =
    confidence.score >= 0.7 ||
    (pageType === "changelog" && confidence.score >= 0.48);

  if (!detected) {
    return {
      status: "unavailable",
      changelogDetected: null,
      changelogUrl: null,
      lastVisibleUpdateDate: null,
      recentUpdateTitles: [],
      confidence: "low",
      evidenceText: null,
      warnings: ["No changelog/update page detected."],
    };
  }

  const evidenceText = signalLines[0] ?? dateLines[0] ?? scrape.title;
  const changelogDetected = makeFact<boolean>({
    field: "changelog_detected",
    value: "Changelog/update page detected",
    normalizedValue: true,
    confidence: confidence.confidence,
    confidenceScore: confidence.score,
    sourceUrl: scrape.finalUrl,
    evidenceText,
    extractionMethod: "deterministic_keyword",
  });
  const lastVisibleUpdateDate = dateLines[0]
    ? makeFact({
        field: "last_visible_update_date",
        value: dateLines[0],
        confidence: "medium",
        confidenceScore: 0.68,
        sourceUrl: scrape.finalUrl,
        evidenceText: dateLines[0],
        extractionMethod: "deterministic_regex",
      })
    : null;

  return {
    status: "found",
    changelogDetected,
    changelogUrl: scrape.finalUrl,
    lastVisibleUpdateDate,
    recentUpdateTitles: updateTitleFacts({
      lines,
      sourceUrl: scrape.finalUrl,
    }),
    confidence: confidence.confidence,
    evidenceText,
    warnings: [],
  };
}
