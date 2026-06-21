import type { AnalystKey, AnalystResult, Source } from "@/types/analysis";
import { ANALYST_CONFIG } from "./analyst-config";
import { scoreAnalysis } from "./scoring";

const sources: Source[] = [
  { id: "S1", title: "Company overview and recent operating highlights", url: "https://example.com/company", snippet: "The company reports durable demand, expanding adoption, and continued investment in its core platform.", publishedDate: "2026-05-14", score: 0.94 },
  { id: "S2", title: "Industry outlook: structural growth with intense competition", url: "https://example.com/market", snippet: "Category spending is expected to grow, though incumbents and well-funded entrants are compressing differentiation windows.", publishedDate: "2026-04-28", score: 0.89 },
  { id: "S3", title: "Product review and customer adoption signals", url: "https://example.com/product", snippet: "Customers cite ease of deployment and workflow integration as strengths; enterprise switching costs are still developing.", publishedDate: "2026-06-02", score: 0.87 },
  { id: "S4", title: "News and stakeholder sentiment review", url: "https://example.com/news", snippet: "Coverage is broadly constructive, with scrutiny focused on execution pace, pricing, and the path to sustainable margins.", publishedDate: "2026-06-10", score: 0.84 },
  { id: "S5", title: "Competitive and regulatory risk landscape", url: "https://example.com/risk", snippet: "Key risks include platform dependency, new regulation, aggressive competitors, and customer concentration.", publishedDate: "2026-05-30", score: 0.82 },
];

const profiles: Record<AnalystKey, Omit<AnalystResult, "key" | "name">> = {
  business: { score: 8.2, confidence: 0.86, summary: "The business shows a credible path to durable revenue, supported by repeat usage and expanding customer value. Margin quality and concentration require monitoring.", strengths: ["Clear customer value proposition", "Recurring revenue characteristics"], weaknesses: ["Margin durability is not fully evidenced"], evidenceIds: ["S1", "S3"], flags: [] },
  market: { score: 8.6, confidence: 0.83, summary: "The category benefits from structural adoption and a large addressable market, but competitive intensity raises the cost of maintaining share.", strengths: ["Large and expanding addressable market", "Strong structural demand tailwinds"], weaknesses: ["Crowded competitive landscape"], evidenceIds: ["S2"], flags: [{ code: "HIGH_COMPETITION", severity: "MEDIUM", rationale: "The category attracts incumbents and well-funded entrants." }] },
  product: { score: 8.4, confidence: 0.82, summary: "Product adoption and workflow integration are positive signals. The moat is credible but not yet unassailable.", strengths: ["Strong workflow integration", "Positive product adoption signals"], weaknesses: ["Defensibility is still maturing"], evidenceIds: ["S3"], flags: [] },
  sentiment: { score: 7.4, confidence: 0.76, summary: "External sentiment is constructive overall, tempered by questions about pricing, profitability, and execution speed.", strengths: ["Constructive recent coverage"], weaknesses: ["Profitability narrative remains debated"], evidenceIds: ["S4"], flags: [] },
  risk: { score: 6.8, confidence: 0.81, summary: "Risk is manageable but meaningful. Competition, regulation, and concentration create a narrower margin for execution error.", strengths: ["Risks are identifiable and monitorable"], weaknesses: ["Regulatory and platform dependency exposure", "Customer concentration deserves monitoring"], evidenceIds: ["S5", "S2"], flags: [{ code: "EXECUTION_RISK", severity: "MEDIUM", rationale: "Growth requires sustained product and go-to-market execution." }] },
};

export function createDemoAnalysis(company: string) {
  const analysts = Object.fromEntries(
    Object.entries(profiles).map(([key, value]) => [key, { key, name: ANALYST_CONFIG[key as AnalystKey].name, ...value }]),
  ) as Record<AnalystKey, AnalystResult>;

  return scoreAnalysis({
    company,
    analysts,
    sources,
    committeeSummary: `${company} presents an attractive long-term opportunity with strong market and product signals. The committee agrees that execution quality is the deciding variable: upside depends on converting adoption into durable economics while protecting differentiation. Evidence supports a constructive stance, but confidence is moderated by competition and incomplete financial visibility.`,
    mode: "demo",
  });
}
