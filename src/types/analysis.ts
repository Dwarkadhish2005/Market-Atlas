export const ANALYST_KEYS = ["business", "market", "product", "sentiment", "risk"] as const;
export type AnalystKey = (typeof ANALYST_KEYS)[number];

export type FlagSeverity = "LOW" | "MEDIUM" | "HIGH";

export interface Source {
  id: string;
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  score?: number;
}

export interface Flag {
  code: string;
  severity: FlagSeverity;
  rationale: string;
}

export interface AnalystResult {
  key: AnalystKey;
  name: string;
  score: number;
  confidence: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  evidenceIds: string[];
  flags: Flag[];
}

export interface ScoreContribution {
  key: AnalystKey;
  rawScore: number;
  confidence: number;
  effectiveScore: number;
  weight: number;
  contribution: number;
}

export interface AnalysisResult {
  id: string;
  company: string;
  verdict: "BUY" | "WATCH" | "PASS";
  finalScore: number;
  confidence: number;
  riskLevel: "Low" | "Moderate" | "High";
  investmentHorizon: string;
  committeeSummary: string;
  keyStrengths: string[];
  keyRisks: string[];
  sources: Source[];
  analysts: Record<AnalystKey, AnalystResult>;
  scoreBreakdown: ScoreContribution[];
  overrideApplied: boolean;
  overrideReason?: string;
  generatedAt: string;
  mode: "live" | "demo";
}

export interface ProgressEvent {
  type: "progress";
  step: string;
  message: string;
  status: "running" | "complete";
}

export type AnalysisStreamEvent = ProgressEvent | { type: "result"; data: AnalysisResult } | { type: "error"; message: string };
