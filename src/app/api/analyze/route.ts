import { runLiveAnalysis } from "@/lib/workflow";
import type { AnalysisStreamEvent } from "@/types/analysis";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    company?: string;
    model?: string;
  };

  const company = body.company?.trim().slice(0, 100);
  if (!company || company.length < 2) {
    return Response.json({ error: "Enter a valid company name." }, { status: 400 });
  }

  if (!process.env.GROQ_API_KEY || !process.env.TAVILY_API_KEY) {
    return Response.json(
      {
        error: "Live analysis requires GROQ_API_KEY and TAVILY_API_KEY environment variables.",
      },
      { status: 503 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AnalysisStreamEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      try {
        const result = await runLiveAnalysis(company, send, body.model);
        send({ type: "result", data: result });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Analysis failed unexpectedly";
        console.error("[Market Atlas] Analysis error:", error);
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
