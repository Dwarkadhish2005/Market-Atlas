# Market Atlas

🚀 **Live Demo:** [https://market-atlas-coral.vercel.app/](https://market-atlas-coral.vercel.app/)

**Market Atlas** is an AI-powered investment research agent that takes a company name as input and produces a structured, analyst-style investment report — complete with a final verdict (BUY / WATCH / PASS), a scored breakdown across five dimensions, key risks and strengths, and cited sources.

It simulates an investment committee made up of five specialized AI analysts, each reviewing live evidence fetched from the web and producing their own scored assessment. A committee chair then synthesizes the views before a deterministic scoring engine locks in the final verdict.

---

## Table of Contents

- [Overview](#overview)
- [How to Run It](#how-to-run-it)
- [How It Works](#how-it-works)
- [Key Decisions & Trade-offs](#key-decisions--trade-offs)
- [Example Runs](#example-runs)
- [What I Would Improve With More Time](#what-i-would-improve-with-more-time)

---

## Overview

Market Atlas answers the question: *"Is this company worth investing in?"*

Given any publicly known company name, it:

1. **Fetches live evidence** across five research dimensions using the Tavily Search API
2. **Runs five parallel AI analysts** (Business, Market, Product, Sentiment, Risk), each scoring the company 0–10 in their domain
3. **Convenes a committee chair** that synthesizes agreements, disagreements, and decisive variables across all analyst reports
4. **Applies a deterministic scoring engine** with confidence-weighted contributions and hard override rules
5. **Renders a full interactive report** in the browser with a verdict, score, analyst breakdowns, cited sources, and risk flags

The entire workflow is orchestrated using **LangGraph** — a state-machine framework for LLM pipelines — and powered by **Groq's LLaMA 3.3 70B** for fast structured inference.

---

## How to Run It

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ and [pnpm](https://pnpm.io/) installed
- A [Groq API key](https://console.groq.com) (free tier available)
- A [Tavily Search API key](https://app.tavily.com) (free tier available)

### 1. Clone the repository

```bash
git clone https://github.com/Dwarkadhish2005/Market-Atlas.git
cd Market-Atlas
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up environment variables

Copy the example env file and fill in your API keys:

```bash
cp .env.example .env.local
```

Then edit `.env.local`:

```env
# Required
GROQ_API_KEY=your_groq_key_here
TAVILY_API_KEY=your_tavily_key_here

# Optional — override the default model
GROQ_MODEL=llama-3.3-70b-versatile
```

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | ✅ Yes | Powers all LLM inference (analysts + committee) |
| `TAVILY_API_KEY` | ✅ Yes | Fetches live web evidence for each company |
| `GROQ_MODEL` | ❌ Optional | Override the LLM model (default: `llama-3.3-70b-versatile`) |

### 4. Run the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Analyze a company

Type any well-known company name into the search bar (e.g. *Nvidia*, *Apple*, *Stripe*) and hit **Analyze**. The agent will stream its progress live and render the full report when done.

---

## How It Works

### Architecture Overview

```
User Input (Company Name)
        │
        ▼
 ┌──────────────┐
 │  Research    │  ← Tavily Search API (5 parallel queries, up to 10 deduplicated sources)
 └──────┬───────┘
        │  sources[]
        ▼ (fan-out, staggered 3 s apart to respect rate limits)
 ┌──────────────────────────────────────────────────────┐
 │  Business  │  Market  │  Product  │  Sentiment  │ Risk │  ← 5 Analyst Nodes (LLaMA 3.3 70B)
 └──────────────────────────────────────────────────────┘
        │  analystResults[]
        ▼
 ┌──────────────┐
 │  Committee   │  ← Chair synthesizes analyst reports
 └──────┬───────┘
        │
        ▼
 ┌──────────────┐
 │  Scoring     │  ← Deterministic engine: weights, confidence, overrides, verdict
 └──────────────┘
        │
        ▼
  Final Report (BUY / WATCH / PASS)
```

### LangGraph Workflow (`src/lib/workflow.ts`)

The pipeline is implemented as a **directed acyclic graph** (DAG) using LangGraph:

- `research` → fetches and deduplicates sources
- `business`, `market`, `product`, `sentiment`, `risk` → run in parallel (fan-out from research)
- `committee` → waits for all 5 analysts to complete (fan-in), then synthesizes
- After the graph resolves, the `scoreAnalysis` function runs deterministically outside the graph

### Research Layer (`src/lib/research.ts`)

Five targeted Tavily queries are fired in parallel, each covering a different evaluation dimension:

| Query Focus | Tavily Topic |
|---|---|
| Business model, revenue, unit economics | `general` |
| Market size, TAM, competitive landscape | `general` |
| Product differentiation, moat, technology | `general` |
| Recent news, leadership, sentiment, controversies | `news` |
| Risks: regulatory, financial, operational | `general` |

Results are deduplicated by URL (keeping the highest-relevance copy), sorted by Tavily's relevance score, and capped at 10 sources. A minimum of 5 sources is required to proceed.

### Analyst Layer (`src/lib/analyst-config.ts`)

Each analyst receives the full source list and produces a **structured JSON output** (via Groq's structured output API + Zod schema validation):

| Analyst | Weight | Evaluates |
|---|---|---|
| Business Analyst | 25% | Revenue model, growth quality, unit economics |
| Market Analyst | 20% | TAM, category growth, competitive positioning |
| Product & Moat Analyst | 20% | Differentiation, switching costs, technology defensibility |
| Sentiment Analyst | 15% | News, leadership signals, public perception, momentum |
| Risk Analyst | 20% | Regulatory, competitive, operational, and governance risks |

Each analyst outputs: `score` (0–10), `confidence` (0–1), `summary`, `strengths[]`, `weaknesses[]`, `evidenceIds[]`, and `flags[]`.

> **Note on the Risk Analyst:** The score is **inverse** — a 10 means *lowest risk*, a 0 means *highest risk*. This keeps the weighting formula consistent.

### Scoring Engine (`src/lib/scoring.ts`)

The final score is deterministic — no LLM is involved. It computes:

```
effectiveScore(analyst) = score × confidence
contribution(analyst)   = effectiveScore × weight × 10
finalScore              = Σ contributions  (0–100 scale)
```

**Verdict thresholds:**

| Score | Verdict |
|---|---|
| ≥ 75 | **BUY** |
| 50–74 | **WATCH** |
| < 50 | **PASS** |

**Override rule:** If 3 or more `HIGH`-severity risk flags are detected, a `BUY` verdict is automatically downgraded to `WATCH`, and the reason is surfaced in the report.

---

## Key Decisions & Trade-offs

### ✅ What I chose and why

**LangGraph for orchestration**
A state-machine graph makes the fan-out (one research → five analysts) and fan-in (five analysts → committee) pattern explicit and auditable. It also handles shared state cleanly without custom wiring.

**Groq (LLaMA 3.3 70B) for inference**
Groq's inference speed is the fastest available for large open-weight models. An analysis that would take 30–60 seconds on other providers completes in 8–15 seconds on Groq. The free tier is also generous enough for development.

**Structured output with Zod schemas**
Every analyst and committee node uses `model.withStructuredOutput()` backed by a strict Zod schema. This eliminates prompt-engineering for JSON formatting and gives runtime-safe, typed outputs — no fragile string parsing.

**Deterministic scoring outside the LLM**
The final score and verdict are computed with pure arithmetic. This makes the verdict reproducible, auditable, and immune to LLM hallucination. Only the summaries and strengths/weaknesses are LLM-generated.

**Tavily for real-time evidence**
Using live search rather than a static knowledge base means the agent reflects current market conditions, recent news, and up-to-date financials — not a training cutoff snapshot.

**Rate-limit resilience**
Groq's free tier has tight token-per-minute limits. The implementation staggered analyst calls by 3 seconds each and added automatic retry-with-backoff on 429 errors, parsing the `retry-after` field from the error message to know exactly how long to wait.

### ❌ What I left out (and why)

**Financial statement parsing** — Pulling and parsing SEC filings or earnings transcripts would dramatically improve the Business and Risk analyst quality, but was out of scope for this project.

**Persistent caching** — Results are stored only in browser `localStorage`. A database-backed cache (Supabase is partially scaffolded) would enable cross-device history, team sharing, and incremental updates.

**Comparative analysis** — The agent scores a single company in isolation. Comparing it against peers or sector benchmarks would make the verdict much more actionable.

**Model ensembling** — Each analyst uses the same LLM. Using different models (e.g. one reasoning-focused, one retrieval-focused) per analyst role could reduce systematic bias.

---

## Example Runs

Two full example reports are included in the repository:

### 📄 [run_test_Nvidia.pdf](./run_test_Nvidia.pdf)
**Company:** NVIDIA Corporation

A detailed analysis covering NVIDIA's dominance in AI compute infrastructure, its data center segment growth, competitive moat through CUDA, geopolitical and export-control risks, and valuation concerns.

### 📄 [run_test_Amarco.pdf](./run_test_Amarco.pdf)
**Company:** Aramco (Saudi Aramco)

A detailed analysis covering Aramco's position as the world's largest oil producer, its cost-of-production advantage, energy-transition risks, geopolitical exposure, dividend sustainability, and long-term demand uncertainty for fossil fuels.

---

## What I Would Improve With More Time

1. **Structured financial data ingestion** — Integrate with a financial data API (e.g. Alpha Vantage, Polygon.io) to pull revenue, margins, P/E ratio, and cash flow directly into the analyst context. This would make the Business and Risk scores far more grounded in real numbers rather than inferred from news and articles.

2. **Sector-aware analyst prompts** — The same analyst prompts are used for every company regardless of industry. Adapting them to the sector (e.g. a SaaS company vs. a mining company vs. a biotech) would make the evaluation criteria and scoring thresholds far more relevant and precise.

3. **Peer comparison mode** — Allow users to analyze multiple companies simultaneously and see them ranked side-by-side across all five analyst dimensions, making the BUY/WATCH/PASS verdict much more actionable by providing market context.
