import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ChatGroq } from "@langchain/groq";
import { z } from "zod";
import { ANALYST_CONFIG } from "./analyst-config";
import { collectResearch } from "./research";
import { scoreAnalysis } from "./scoring";
import {
  ANALYST_KEYS,
  type AnalystKey,
  type AnalystResult,
  type ProgressEvent,
  type Source,
} from "@/types/analysis";

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const flagSchema = z.object({
  code: z
    .string()
    .describe(
      "UPPER_SNAKE_CASE risk code, e.g. HIGH_COMPETITION, REGULATORY_RISK, EXECUTION_RISK",
    ),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  rationale: z.string().describe("One sentence explaining why this flag was raised"),
});

const analystSchema = z.object({
  score: z
    .number()
    .min(0)
    .max(10)
    .describe("Score from 0–10. 10 = exceptional, 5 = average, 0 = disqualifying"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "Confidence in your score. Reduce when evidence is sparse, old, indirect, or contradictory",
    ),
  summary: z
    .string()
    .describe(
      "100–150 word analytical summary. State your thesis, evidence, and the key variable that most determines your score",
    ),
  strengths: z
    .array(z.string())
    .min(1)
    .max(6)
    .describe("Specific, evidence-grounded strengths (not generic platitudes)"),
  weaknesses: z
    .array(z.string())
    .min(1)
    .max(6)
    .describe("Specific, evidence-grounded weaknesses or gaps"),
  evidenceIds: z
    .array(z.string())
    .min(1)
    .max(12)
    .describe("IDs of sources that directly support your conclusions, e.g. ['S1', 'S4']"),
  flags: z
    .array(flagSchema)
    .max(5)
    .describe(
      "Raise a HIGH flag only for potentially thesis-breaking risks. MEDIUM for notable concerns. Leave empty if no material risks",
    ),
});

const committeeSchema = z.object({
  committeeSummary: z
    .string()
    .describe(
      "120–180 word synthesis. Identify agreements, disagreements, and the 2–3 decisive variables. Do NOT state the verdict or recalculate scores",
    ),
});

// ─── Types ───────────────────────────────────────────────────────────────────

type Reporter = (event: ProgressEvent) => void | Promise<void>;

// ─── Rate-limit helpers ──────────────────────────────────────────────────────

/** Pause execution for `ms` milliseconds. */
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Parse the retry-after seconds from a Groq 429 error message.
 * e.g. "Please try again in 7.914999999s"
 */
function parseRetryAfterMs(message: string): number {
  const match = message.match(/try again in ([\d.]+)s/);
  if (match) {
    return Math.ceil(parseFloat(match[1]) * 1000) + 500; // +500 ms buffer
  }
  return 15_000; // default 15 s if we can't parse
}

/**
 * Invoke `fn` with automatic retry on Groq 429 rate-limit errors.
 * Reads the exact wait time from the error body so we don't over-wait.
 */
async function retryOnRateLimit<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const is429 = message.includes("429") || message.includes("rate_limit_exceeded");
      if (is429 && attempt < maxRetries) {
        const waitMs = parseRetryAfterMs(message);
        console.warn(
          `[Market Atlas] Rate limit hit — waiting ${waitMs}ms before retry ${attempt + 1}/${maxRetries}`,
        );
        await sleep(waitMs);
        attempt++;
        continue;
      }
      throw err;
    }
  }
}

// ─── System prompts ──────────────────────────────────────────────────────────

function buildAnalystSystemPrompt(key: AnalystKey): string {
  const config = ANALYST_CONFIG[key];
  const base = `You are the ${config.name} on a professional investment committee.

Your sole job: evaluate **${config.focus}** for the company under review.

Rules you must follow without exception:
1. Ground every score, strength, weakness, and flag in specific evidence from the supplied sources.
2. Cite source IDs (e.g. S1, S4) in your evidenceIds array — do not cite IDs that don't appear in the evidence.
3. Never invent metrics, quotes, valuations, or facts. If a fact isn't in the sources, say so.
4. Calibrate confidence honestly: low evidence → lower confidence. Do not fake certainty.
5. A HIGH flag must represent a potentially thesis-breaking risk — not a generic concern.
6. Scores must be defensible. A score of 8+ requires strong positive evidence, not absence of negatives.
7. Write analytically. Avoid filler phrases like "it is worth noting" or "it's important to consider".`;

  if (key === "risk") {
    return (
      base +
      "\n\nIMPORTANT for Risk: Your score is INVERSE — 10 = lowest risk, 0 = highest risk. A score of 8 means you found strong evidence that risks are well-managed and manageable. A score of 2 means the risk profile is severe and may be disqualifying."
    );
  }

  return base;
}

const COMMITTEE_SYSTEM = `You chair an investment committee reviewing analyst reports.

Your job: synthesise the findings into a coherent committee view.

Rules:
1. Identify where analysts agree and where they diverge.
2. Name the 2–3 variables that are most decisive for the investment case.
3. Reflect the weight of evidence — do not average or summarise mechanically.
4. Write in 120–180 words. Be direct and specific.
5. Do NOT state BUY/WATCH/PASS. Do NOT recalculate or restate individual scores.
6. The deterministic scoring engine will determine the final verdict — your job is synthesis, not decision-making.`;

// ─── Graph ───────────────────────────────────────────────────────────────────

export async function runLiveAnalysis(
  company: string,
  report: Reporter,
  modelOverride?: string,
) {
  if (!process.env.GROQ_API_KEY || !process.env.TAVILY_API_KEY) {
    throw new Error("Live mode requires GROQ_API_KEY and TAVILY_API_KEY");
  }

  const modelName =
    modelOverride ?? process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

  const State = Annotation.Root({
    company: Annotation<string>(),
    sources: Annotation<Source[]>({
      reducer: (_, update) => update,
      default: () => [],
    }),
    analystResults: Annotation<AnalystResult[]>({
      reducer: (current, update) => [...current, ...update],
      default: () => [],
    }),
    committeeSummary: Annotation<string>(),
  });

  const model = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: modelName,
    temperature: 0.1,
    maxRetries: 2,
  });

  // ── Research node ──────────────────────────────────────────────────────────

  const researchNode = async (state: typeof State.State) => {
    await report({
      type: "progress",
      step: "research",
      message: "Searching and deduplicating evidence across 5 dimensions",
      status: "running",
    });

    const sources = await collectResearch(state.company);

    if (sources.length < 5) {
      throw new Error(
        `Insufficient research evidence returned (${sources.length} sources). ` +
          "Try a more widely-covered company name.",
      );
    }

    await report({
      type: "progress",
      step: "research",
      message: `${sources.length} sources collected and ranked`,
      status: "complete",
    });

    return { sources };
  };

  // ── Analyst node factory ───────────────────────────────────────────────────

  /**
   * @param key        Which analyst dimension to run
   * @param staggerMs  Initial delay before the first LLM call — staggers
   *                   parallel nodes so they don't all hit the API at once.
   */
  const analystNode =
    (key: AnalystKey, staggerMs = 0) =>
    async (state: typeof State.State) => {
      const config = ANALYST_CONFIG[key];

      // Stagger parallel analysts to avoid simultaneous token bursts
      if (staggerMs > 0) await sleep(staggerMs);

      await report({
        type: "progress",
        step: key,
        message: `${config.name} reviewing ${state.sources.length} sources`,
        status: "running",
      });

      const evidence = state.sources
        .map((s) => `[${s.id}] ${s.title}\n${s.snippet}${s.url ? `\nURL: ${s.url}` : ""}`)
        .join("\n\n---\n\n");

      const structured = model.withStructuredOutput(analystSchema, {
        name: `${key}_analysis`,
      });

      let output;
      try {
        output = await retryOnRateLimit(() =>
          structured.invoke([
            ["system", buildAnalystSystemPrompt(key)],
            [
              "human",
              `Company under review: **${state.company}**\n\nEvidence repository (${state.sources.length} sources):\n\n${evidence}\n\nProvide your full analyst report now.`,
            ],
          ]),
        );
      } catch (err) {
        throw new Error(
          `${config.name} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      const result: AnalystResult = { key, name: config.name, ...output };

      await report({
        type: "progress",
        step: key,
        message: `${config.name} complete — score: ${output.score.toFixed(1)}/10`,
        status: "complete",
      });

      return { analystResults: [result] };
    };

  // ── Committee node ─────────────────────────────────────────────────────────

  const committeeNode = async (state: typeof State.State) => {
    await report({
      type: "progress",
      step: "committee",
      message: "Reconciling analyst views and resolving conflicts",
      status: "running",
    });

    const analystDigest = state.analystResults
      .map(
        (r) =>
          `${r.name} — Score: ${r.score}/10, Confidence: ${Math.round(r.confidence * 100)}%\n` +
          `Summary: ${r.summary}\n` +
          `Flags: ${r.flags.map((f) => `${f.severity}: ${f.code}`).join(", ") || "None"}`,
      )
      .join("\n\n");

    const structured = model.withStructuredOutput(committeeSchema, {
      name: "committee_summary",
    });

    let output;
    try {
      output = await structured.invoke([
        ["system", COMMITTEE_SYSTEM],
        [
          "human",
          `Company: **${state.company}**\n\nAnalyst reports:\n\n${analystDigest}`,
        ],
      ]);
    } catch (err) {
      throw new Error(
        `Committee synthesis failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    await report({
      type: "progress",
      step: "committee",
      message: "Committee synthesis complete",
      status: "complete",
    });

    return output;
  };

  // ── Build and run graph ────────────────────────────────────────────────────

  // Stagger each analyst by 3 s so parallel nodes don't all burst tokens at once.
  // Even on Groq's free tier (12k TPM) this keeps each 60-s window under budget.
  const STAGGER_MS = 3_000;
  const graph = new StateGraph(State)
    .addNode("research", researchNode)
    .addNode("business", analystNode("business", 0 * STAGGER_MS))
    .addNode("market",   analystNode("market",   1 * STAGGER_MS))
    .addNode("product",  analystNode("product",  2 * STAGGER_MS))
    .addNode("sentiment",analystNode("sentiment",3 * STAGGER_MS))
    .addNode("risk",     analystNode("risk",     4 * STAGGER_MS))
    .addNode("committee", committeeNode)
    .addEdge(START, "research")
    .addEdge("research", "business")
    .addEdge("research", "market")
    .addEdge("research", "product")
    .addEdge("research", "sentiment")
    .addEdge("research", "risk")
    .addEdge(["business", "market", "product", "sentiment", "risk"], "committee")
    .addEdge("committee", END)
    .compile();

  const finalState = await graph.invoke({ company });

  // Validate all analysts returned results
  const analysts = Object.fromEntries(
    finalState.analystResults.map((r) => [r.key, r]),
  ) as Record<AnalystKey, AnalystResult>;

  for (const key of ANALYST_KEYS) {
    if (!analysts[key]) throw new Error(`Missing ${key} analyst result`);
  }

  await report({
    type: "progress",
    step: "scoring",
    message: "Applying confidence weights, thresholds, and override rules",
    status: "running",
  });

  const result = scoreAnalysis({
    company,
    sources: finalState.sources,
    analysts,
    committeeSummary: finalState.committeeSummary,
    mode: "live",
  });

  await report({
    type: "progress",
    step: "scoring",
    message: `Deterministic verdict locked: ${result.verdict} (${result.finalScore.toFixed(1)}/100)`,
    status: "complete",
  });

  return result;
}
