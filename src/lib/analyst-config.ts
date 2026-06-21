import type { AnalystKey } from "@/types/analysis";

export const ANALYST_CONFIG: Record<AnalystKey, { name: string; weight: number; focus: string }> = {
  business: {
    name: "Business Analyst",
    weight: 0.25,
    focus: "business model, revenue durability, customers, growth quality, unit economics, and execution",
  },
  market: {
    name: "Market Analyst",
    weight: 0.2,
    focus: "market size, category growth, structural tailwinds, competition, and positioning",
  },
  product: {
    name: "Product & Moat Analyst",
    weight: 0.2,
    focus: "product quality, differentiation, innovation, defensibility, switching costs, and technology",
  },
  sentiment: {
    name: "Sentiment Analyst",
    weight: 0.15,
    focus: "recent news, customer and industry perception, leadership signals, momentum, and controversies",
  },
  risk: {
    name: "Risk Analyst",
    weight: 0.2,
    focus: "regulatory, competitive, financial, operational, concentration, governance, and execution risks. A high score means low risk",
  },
};
