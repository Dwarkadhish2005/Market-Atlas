import { describe, expect, it } from "vitest";
import { scoreAnalysis } from "./scoring";
import type { AnalystKey, AnalystResult } from "@/types/analysis";

const makeAnalyst = (key: AnalystKey, score = 8, confidence = 1, highFlag = false): AnalystResult => ({
  key,
  name: key,
  score,
  confidence,
  summary: "Test",
  strengths: ["Strength"],
  weaknesses: ["Risk"],
  evidenceIds: [],
  flags: highFlag ? [{ code: "TEST", severity: "HIGH", rationale: "Test flag" }] : [],
});

describe("deterministic scoring", () => {
  it("applies confidence before weighted aggregation", () => {
    const result = scoreAnalysis({
      company: "TestCo",
      sources: [],
      committeeSummary: "Test",
      mode: "demo",
      analysts: {
        business: makeAnalyst("business", 10, 0.5),
        market: makeAnalyst("market", 10, 0.5),
        product: makeAnalyst("product", 10, 0.5),
        sentiment: makeAnalyst("sentiment", 10, 0.5),
        risk: makeAnalyst("risk", 10, 0.5),
      },
    });
    expect(result.finalScore).toBe(50);
    expect(result.verdict).toBe("WATCH");
  });

  it("caps BUY at WATCH when three high flags are present", () => {
    const result = scoreAnalysis({
      company: "TestCo",
      sources: [],
      committeeSummary: "Test",
      mode: "demo",
      analysts: {
        business: makeAnalyst("business", 9, 1, true),
        market: makeAnalyst("market", 9, 1, true),
        product: makeAnalyst("product", 9, 1, true),
        sentiment: makeAnalyst("sentiment", 9, 1),
        risk: makeAnalyst("risk", 9, 1),
      },
    });
    expect(result.finalScore).toBe(90);
    expect(result.verdict).toBe("WATCH");
    expect(result.overrideApplied).toBe(true);
  });
});
