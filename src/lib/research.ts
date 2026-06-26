import type { Source } from "@/types/analysis";

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score?: number;
  published_date?: string;
}

interface TavilyResponse {
  results?: TavilyResult[];
  error?: string;
}

const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_SOURCES = 10;
const MIN_SOURCES = 5;

function buildQueries(company: string): Array<{ query: string; topic: "general" | "news" }> {
  return [
    {
      query: `${company} business model revenue streams customers growth rate unit economics`,
      topic: "general",
    },
    {
      query: `${company} market size total addressable market TAM competitive landscape industry trends`,
      topic: "general",
    },
    {
      query: `${company} product features technology differentiation moat switching costs innovation`,
      topic: "general",
    },
    {
      query: `${company} latest news CEO leadership controversies investor sentiment 2024 2025`,
      topic: "news",
    },
    {
      query: `${company} risks regulation competition funding valuation challenges operational`,
      topic: "general",
    },
  ];
}

async function fetchTavily(
  apiKey: string,
  query: string,
  topic: "general" | "news",
): Promise<TavilyResult[]> {
  const response = await fetch(TAVILY_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "advanced",
      max_results: 4,
      include_answer: false,
      include_raw_content: false,
      topic,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Tavily search failed (HTTP ${response.status}): ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as TavilyResponse;

  if (data.error) {
    throw new Error(`Tavily API error: ${data.error}`);
  }

  return data.results ?? [];
}

export async function collectResearch(company: string): Promise<Source[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY is not configured");

  const queries = buildQueries(company);

  const results = await Promise.allSettled(
    queries.map(({ query, topic }) => fetchTavily(apiKey, query, topic)),
  );

  // Collect successful results; surface errors as warnings
  const allResults: TavilyResult[] = [];
  const errors: string[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      allResults.push(...result.value);
    } else {
      errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
    }
  }

  // All queries failed
  if (allResults.length === 0) {
    throw new Error(
      `All Tavily searches failed. Errors: ${errors.join("; ")}`,
    );
  }

  if (errors.length > 0) {
    console.warn(`[research] ${errors.length} Tavily queries failed:`, errors);
  }

  // Deduplicate by URL — keep the highest-scoring copy of each URL
  const unique = new Map<string, TavilyResult>();
  for (const result of allResults) {
    const existing = unique.get(result.url);
    if (!existing || (result.score ?? 0) > (existing.score ?? 0)) {
      unique.set(result.url, result);
    }
  }

  const sorted = [...unique.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const top = sorted.slice(0, MAX_SOURCES);

  if (top.length < MIN_SOURCES) {
    throw new Error(
      `Insufficient evidence for "${company}" — only ${top.length} unique sources found. ` +
        "Try a more specific or widely-known company name.",
    );
  }

  return top.map((result, index) => ({
    id: `S${index + 1}`,
    title: result.title,
    url: result.url,
    snippet: result.content.slice(0, 400),
    publishedDate: result.published_date,
    score: result.score,
  }));
}
