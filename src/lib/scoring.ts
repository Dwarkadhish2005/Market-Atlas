import { ANALYST_CONFIG } from "./analyst-config";
import {
  ANALYST_KEYS,
  type AnalystResult,
  type AnalysisResult,
  type ScoreContribution,
} from "@/types/analysis";

type ScoringInput = Pick<
  AnalysisResult,
  "company" | "analysts" | "sources" | "committeeSummary" | "mode"
>;

export function scoreAnalysis(input: ScoringInput): AnalysisResult {
  const scoreBreakdown: ScoreContribution[] = ANALYST_KEYS.map((key) => {
    const analyst = input.analysts[key];
    const weight = ANALYST_CONFIG[key].weight;
    const effectiveScore = clamp(analyst.score, 0, 10) * clamp(analyst.confidence, 0, 1);
    return {
      key,
      rawScore: round(analyst.score),
      confidence: round(analyst.confidence),
      effectiveScore: round(effectiveScore),
      weight,
      contribution: round(effectiveScore * weight * 10),
    };
  });

  const finalScore = round(
    scoreBreakdown.reduce((sum, item) => sum + item.contribution, 0),
  );

  const confidence = round(
    ANALYST_KEYS.reduce(
      (sum, key) =>
        sum + clamp(input.analysts[key].confidence, 0, 1) * ANALYST_CONFIG[key].weight,
      0,
    ),
  );

  const allFlags = ANALYST_KEYS.flatMap((key) => input.analysts[key].flags);
  const highFlags = allFlags.filter((flag) => flag.severity === "HIGH");

  let verdict: AnalysisResult["verdict"] =
    finalScore >= 75 ? "BUY" : finalScore >= 50 ? "WATCH" : "PASS";

  const overrideApplied = highFlags.length >= 3 && verdict === "BUY";
  if (overrideApplied) verdict = "WATCH";

  const riskEffective =
    clamp(input.analysts.risk.score, 0, 10) *
    clamp(input.analysts.risk.confidence, 0, 1);
  const riskLevel: AnalysisResult["riskLevel"] =
    riskEffective >= 7 ? "Low" : riskEffective >= 4 ? "Moderate" : "High";

  const investmentHorizon =
    riskLevel === "High"
      ? "12–18 months; reassess quarterly"
      : riskLevel === "Moderate"
        ? "2–3 years; semi-annual review recommended"
        : "3–5 years; conviction hold";

  const keyStrengths = dedupe(
    ANALYST_KEYS.flatMap((key) => input.analysts[key].strengths),
  ).slice(0, 6);

  const keyRisks = dedupe(
    ANALYST_KEYS.flatMap((key) => input.analysts[key].weaknesses),
  ).slice(0, 6);

  return {
    id: crypto.randomUUID(),
    company: input.company,
    verdict,
    finalScore,
    confidence,
    riskLevel,
    investmentHorizon,
    committeeSummary: input.committeeSummary,
    keyStrengths,
    keyRisks,
    sources: input.sources,
    analysts: input.analysts,
    scoreBreakdown,
    overrideApplied,
    overrideReason: overrideApplied
      ? `${highFlags.length} high-severity flags detected (${highFlags.map((f) => f.code).join(", ")}). BUY verdict capped at WATCH per override rule.`
      : undefined,
    generatedAt: new Date().toISOString(),
    mode: input.mode,
  };
}

// Helpers

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Remove near-duplicate strings (same first 40 chars)
function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.trim().toLowerCase().slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
