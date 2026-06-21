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

/**
 * Deterministic scoring engine.
 *
 * This function performs all final verdict computation using pure arithmetic
 * and explicit business rules. It does NOT call any LLM. All analyst inputs
 * are fixed before this function is called.
 *
 * Scoring formula:
 *   effective_score = analyst.score × analyst.confidence
 *   contribution    = effective_score × dimension_weight × 10
 *   final_score     = Σ contribution  (range: 0–100)
 *
 * Verdict thresholds:
 *   ≥ 75 → BUY
 *   ≥ 50 → WATCH
 *   < 50 → PASS
 *
 * Override rule:
 *   If 3+ HIGH-severity flags exist, verdict is capped at WATCH.
 */
export function scoreAnalysis(input: ScoringInput): AnalysisResult {
  // ── Step 1: Per-dimension contribution ──────────────────────────────────────
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

  // ── Step 2: Aggregate final score ───────────────────────────────────────────
  const finalScore = round(
    scoreBreakdown.reduce((sum, item) => sum + item.contribution, 0),
  );

  // ── Step 3: Aggregate confidence (weighted average) ─────────────────────────
  const confidence = round(
    ANALYST_KEYS.reduce(
      (sum, key) =>
        sum + clamp(input.analysts[key].confidence, 0, 1) * ANALYST_CONFIG[key].weight,
      0,
    ),
  );

  // ── Step 4: Collect all flags ────────────────────────────────────────────────
  const allFlags = ANALYST_KEYS.flatMap((key) => input.analysts[key].flags);
  const highFlags = allFlags.filter((flag) => flag.severity === "HIGH");

  // ── Step 5: Initial verdict ──────────────────────────────────────────────────
  let verdict: AnalysisResult["verdict"] =
    finalScore >= 75 ? "BUY" : finalScore >= 50 ? "WATCH" : "PASS";

  // ── Step 6: Override rule ────────────────────────────────────────────────────
  const overrideApplied = highFlags.length >= 3 && verdict === "BUY";
  if (overrideApplied) verdict = "WATCH";

  // ── Step 7: Risk level from risk analyst ────────────────────────────────────
  const riskEffective =
    clamp(input.analysts.risk.score, 0, 10) *
    clamp(input.analysts.risk.confidence, 0, 1);
  const riskLevel: AnalysisResult["riskLevel"] =
    riskEffective >= 7 ? "Low" : riskEffective >= 4 ? "Moderate" : "High";

  // ── Step 8: Investment horizon ───────────────────────────────────────────────
  const investmentHorizon =
    riskLevel === "High"
      ? "12–18 months; reassess quarterly"
      : riskLevel === "Moderate"
        ? "2–3 years; semi-annual review recommended"
        : "3–5 years; conviction hold";

  // ── Step 9: Aggregate key strengths and risks ────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Remove near-duplicate strings (same first 40 chars) */
function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.trim().toLowerCase().slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
