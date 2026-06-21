import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const hasGroq = Boolean(process.env.GROQ_API_KEY);
  const hasTavily = Boolean(process.env.TAVILY_API_KEY);
  const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  const ready = hasGroq && hasTavily;

  return NextResponse.json({
    status: ready ? "ready" : "degraded",
    live: ready,
    model,
    keys: { groq: hasGroq, tavily: hasTavily },
    timestamp: new Date().toISOString(),
  });
}
