# 🗺️ Market Atlas

Market Atlas is an AI-powered investment research assistant that simulates an investment committee. Instead of relying on a single prompt, it gathers external evidence, asks multiple specialist analysts to evaluate a company from different angles, synthesizes their findings, and then produces a deterministic verdict.

This project was built to explore a practical and explainable pattern for AI-assisted research: combine retrieval, structured reasoning, and rule-based scoring so the final decision is not purely a black-box LLM output.

---

## 1. Why this project exists

The core intuition behind Market Atlas is simple:

- A single large language model can sound insightful, but it can also be inconsistent.
- Investment-style decisions require multiple perspectives: business quality, market opportunity, product defensibility, sentiment, and risk.
- Research should be grounded in external evidence instead of just model memory.
- Final decisions should be auditable, transparent, and less dependent on prompt phrasing.

So the project was designed as a small but realistic “AI committee” system:

1. Collect fresh evidence from the web.
2. Ask multiple specialist analysts to assess the company.
3. Merge their viewpoints in a committee-style synthesis.
4. Apply deterministic scoring rules to create a final verdict.

That structure is the heart of the product.

---

## 2. What the product does

Users enter a company name, and the app:

- searches for up-to-date evidence using Tavily,
- runs a multi-step LangGraph workflow,
- generates specialist analyst reports,
- creates a committee summary,
- calculates a final BUY / WATCH / PASS score,
- and presents the results in a polished UI.

The experience is meant to feel like a research desk rather than a chatbot.

---

## 3. Product vision and design philosophy

### Core design goals

- Evidence-first reasoning
- Multi-perspective analysis
- Deterministic final scoring
- Strong UX for streaming progress
- Source traceability
- Clear separation between AI reasoning and decision logic

### Why this design matters

Many AI products fail because they mix generation, reasoning, and decision logic in one opaque flow. Market Atlas separates those concerns:

- Retrieval layer: finds evidence
- Reasoning layer: generates analysis
- Synthesis layer: integrates viewpoints
- Scoring layer: produces a structured decision
- UI layer: shows progress and results clearly

This makes the system easier to reason about, debug, and explain.

---

## 4. Architecture overview

The application is structured as a layered system:

- Frontend: Next.js client UI with a streaming analysis experience
- API layer: Next.js route that accepts company input and streams progress/results
- Workflow layer: LangGraph orchestrates multiple nodes
- Research layer: Tavily search gathers external sources
- Analyst layer: domain-specific LLM prompts produce structured reports
- Decision engine: deterministic scoring logic produces the final verdict

### End-to-end flow

1. User submits a company name.
2. The API route validates input and starts analysis.
3. The workflow launches a research node.
4. Research results are deduplicated and ranked.
5. Specialist analysts run in parallel with staggered timing to avoid API bursts.
6. A committee node synthesizes the outputs.
7. A rules-based scoring engine converts the analysis into a verdict.
8. The UI streams updates and shows the final result.

---

## 5. Intuition behind each important part

### 5.1 Research layer

The research layer exists because no serious opinion should be built from memory alone.

The system uses Tavily to collect current, relevant sources. This is important because:

- market conditions change rapidly,
- public perception shifts quickly,
- AI-generated conclusions should be anchored to recent evidence.

The design also deduplicates sources and ranks them by relevance so the later analysis does not drown in noise.

### 5.2 Specialist analyst nodes

Instead of asking one generic model to “judge the company,” the workflow creates five specialist roles:

- Business analyst
- Market analyst
- Product analyst
- Sentiment analyst
- Risk analyst

This mirrors how human investment committees work. Different lenses reduce blind spots and create a more balanced view.

### 5.3 Committee synthesis

The committee stage is inspired by the way real teams reconcile disagreements.

Its purpose is not to generate another opinion from scratch, but to identify:

- where analysts agree,
- where they disagree,
- which variables matter most,
- and what the synthesis should emphasize.

This makes the final verdict richer and more grounded.

### 5.4 Deterministic scoring engine

The scoring engine is one of the most important design choices in this project.

The reason it exists is simple: LLMs are powerful for language generation, but they are not ideal as the only source of truth for final decisions. The project therefore uses a deterministic engine for:

- weighting each analyst dimension,
- combining confidence and score,
- applying override rules,
- and producing a stable verdict.

This gives the system explainability and consistency.

### 5.5 Streaming UI

The UI is designed to feel interactive and trustworthy. Users do not want to stare at a blank screen while the system thinks. Streaming progress updates make the workflow feel observable and credible.

This is especially important for AI systems, where opacity can reduce trust.

---

## 6. Tech stack

| Layer | Technology | Why it was chosen |
|---|---|---|
| Frontend | Next.js 15 + React 19 | Modern app framework with strong server and client support |
| UI styling | CSS in the app and component-based layout | Simple and flexible for a polished demo experience |
| Backend API | Next.js route handlers | Native API support within the same app |
| Workflow orchestration | LangGraph | Good fit for multi-step, stateful agent workflows |
| LLM inference | Groq + LangChain | Fast model access with structured output support |
| Search | Tavily | High-quality external information retrieval |
| Schema validation | Zod | Enforces reliable structured LLM outputs |
| Language | TypeScript | Strong typing and maintainability |
| Testing | Vitest | Lightweight but effective unit testing |

### Why these tools were selected

- Next.js was chosen because the project is a full-stack experience with both UI and API endpoints.
- LangGraph was used because the analysis flow is inherently multi-step and stateful.
- Groq was chosen for fast LLM inference and low-latency generation.
- Tavily was used because external evidence retrieval is central to the product.
- Zod was used to ensure the model outputs stay structured and predictable.

---

## 7. Project structure

```text
src/
  app/
    api/
      analyze/route.ts
      health/route.ts
    globals.css
    layout.tsx
    page.tsx
  lib/
    analyst-config.ts
    demo.ts
    research.ts
    scoring.test.ts
    scoring.ts
    workflow.ts
  types/
    analysis.ts
```

### Key files and their purpose

- [src/app/page.tsx](src/app/page.tsx): Main UI and analysis experience
- [src/app/api/analyze/route.ts](src/app/api/analyze/route.ts): API endpoint that streams the workflow output
- [src/lib/workflow.ts](src/lib/workflow.ts): LangGraph orchestration for research, analysts, committee, and scoring
- [src/lib/research.ts](src/lib/research.ts): Tavily-based evidence gathering and source deduplication
- [src/lib/scoring.ts](src/lib/scoring.ts): Deterministic scoring and verdict logic
- [src/lib/demo.ts](src/lib/demo.ts): Demo dataset used to simulate analysis without live API calls
- [src/lib/analyst-config.ts](src/lib/analyst-config.ts): Analyst roles, weights, and focus areas
- [src/types/analysis.ts](src/types/analysis.ts): Shared type definitions for the entire system

---

## 8. How the workflow works in detail

### Step 1: Research

The application builds several targeted queries for a company, such as:

- business model and revenue quality,
- market size and competition,
- product differentiation,
- recent news and sentiment,
- risk and regulation.

These queries are sent to Tavily and the results are deduplicated by URL.

### Step 2: Analyst execution

Five analyst nodes are triggered. Each one is given the same evidence but asked to adopt a different analytical lens. They return structured outputs with:

- score,
- confidence,
- summary,
- strengths,
- weaknesses,
- evidence IDs,
- flags.

### Step 3: Committee synthesis

The committee node consolidates the analyst reports into a short synthesis that highlights consensus, disagreement, and decisive factors.

### Step 4: Scoring

The final score is computed with explicit business rules rather than a free-form model decision.

This final score is influenced by:

- analyst confidence,
- analyst weight,
- risk flags,
- and a high-risk override rule.

### Step 5: UI presentation

The frontend streams progress updates and shows the final verdict, breakdown, evidence, and analyst summaries.

---

## 9. Features of the app

### Current features

- Company-based market research
- Multi-analyst workflow
- Live streaming progress updates
- Deterministic verdict engine
- Source-backed analysis
- Local history of previous analyses
- Demo mode for fallback or testing

### User experience highlights

- The app feels like a decision-support tool rather than a generic chatbot.
- It shows achievements visually as the pipeline runs.
- It exposes the reasoning structure rather than hiding it.

---

## 10. Demo mode vs live mode

### Demo mode

Demo mode uses a built-in synthetic dataset to simulate an analysis. It is useful for:

- UI testing,
- presentation demos,
- and validating the frontend without API dependencies.

### Live mode

Live mode uses real external search and LLM analysis. It requires:

- GROQ_API_KEY
- TAVILY_API_KEY

This is the mode that makes the system truly useful.

---

## 11. Setup instructions

### Prerequisites

Make sure you have:

- Node.js 18+
- pnpm (recommended) or npm

### Install dependencies

```bash
pnpm install
```

### Configure environment variables

Create a file named .env.local in the project root with the following values:

```env
GROQ_API_KEY=your_groq_api_key
TAVILY_API_KEY=your_tavily_api_key
GROQ_MODEL=llama-3.3-70b-versatile
```

### Run the app

```bash
pnpm dev
```

Then open:

```text
http://localhost:3000
```

---

## 12. Useful commands

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm typecheck
pnpm test
```

---

## 13. Design decisions and tradeoffs

### Why not use one giant prompt?

A single prompt may be easier to write, but it makes the process less transparent and less consistent. Splitting the workflow into research, analysis, synthesis, and scoring creates better structure.

### Why use deterministic scoring?

Because the final decision should not depend entirely on model style or wording. Deterministic logic makes the output more stable and explainable.

### Why use staggered analyst execution?

The project avoids sending five LLM requests at once. Staggering reduces bursts and improves reliability on rate-limited APIs.

### Why use structured output?

Structured output prevents free-form ambiguity. It ensures the app can reliably consume the model response.

### Why keep the scoring engine separate?

Separation of concerns is an engineering principle here. The LLM handles interpretation; the code handles decision logic.

---

## 14. Strengths of the project

- Strong conceptual architecture
- Clear separation of concerns
- Good balance of AI and deterministic logic
- Easy to explain in interviews
- Good foundation for adding more agents or evaluation dimensions

---

## 15. Limitations and future improvements

The project is intentionally a strong prototype, not a full production-grade financial platform. Possible improvements include:

- better source quality filtering,
- caching of research results,
- more robust error handling,
- authentication and user accounts,
- database persistence for analyses,
- support for multiple markets and industries,
- stronger guardrails for false or misleading evidence,
- and a richer evaluation dashboard.

---

## 16. Interview questions with answers

### 1. What problem does this project solve?

It solves the problem of turning raw web research and AI language generation into a structured, evidence-backed investment-style analysis workflow. Instead of relying on one AI opinion, it uses multiple specialist agents and deterministic scoring.

### 2. Why did you choose a multi-agent architecture?

Because a single model can miss perspective diversity. Multiple roles simulate an investment committee and reduce the risk of narrow or biased analysis.

### 3. What is the purpose of the committee stage?

The committee stage reconciles analyst differences and surfaces the most important themes, similar to how a human review board would discuss a decision.

### 4. Why is the scoring engine deterministic?

Because the final verdict should be explainable and stable. Deterministic logic is easier to audit and less sensitive to minor wording changes from the LLM.

### 5. Why did you use LangGraph?

LangGraph is useful for building stateful, multi-step workflows where each stage depends on the previous one. It fits naturally with research, analysis, and synthesis.

### 6. Why use Tavily instead of just prompting the model with general knowledge?

Because the system needs current, grounded evidence. Tavily provides retrieval from the live web, which is much better for real-world research than relying on static model knowledge.

### 7. How do you reduce hallucination risk in this project?

By grounding analysis in retrieved sources, requiring evidence IDs, using structured schemas, and keeping the final decision separate from free-form model generation.

### 8. What is the role of Zod in this application?

Zod helps ensure the LLM responses conform to a known shape. That makes downstream processing safer and more reliable.

### 9. Why did you stagger the analyst nodes?

To avoid overwhelming the API with simultaneous requests. It also helps reduce rate-limit failures and improves robustness.

### 10. What is the benefit of streaming progress in the UI?

It makes the system feel transparent and trustworthy. Users can see that the app is actively researching and analyzing rather than appearing frozen.

### 11. How would you improve this system for production?

I would add authentication, data persistence, caching, stronger source quality scoring, analytics, and guardrails for hallucinations and low-quality retrieval.

### 12. What makes this project different from a basic chatbot?

This project is not just a conversational interface. It has workflow logic, structured reasoning, evidence retrieval, synthesis, and decision scoring.

### 13. What is the biggest engineering challenge in this kind of system?

The biggest challenge is balancing model creativity with reliability. The system must stay flexible enough to analyze unusual situations while being constrained enough to remain consistent and auditable.

### 14. Why are the analyst roles weighted differently?

The weights reflect the relative importance of each dimension in a typical investment evaluation. For example, business quality often carries more importance than sentiment.

### 15. What happens if the research step returns too little evidence?

The workflow throws an error because the system requires a minimum number of trustworthy sources before proceeding.

### 16. What is the purpose of the risk override rule?

It prevents a highly attractive thesis from being accepted when there are too many high-severity risks. That reflects the caution needed in real-world decision-making.

### 17. How would you scale this to many companies or many users?

I would introduce background job processing, a queue, caching, rate limiting, and a database layer for storing results and metadata.

### 18. How would you make the system more trustworthy?

I would add source-level citations in the UI, confidence explanations, retrieval provenance, prompt versioning, and evaluation datasets for testing quality.

---

## 17. Short interview pitch

If you were asked to describe this project in one minute, you could say:

“This is an AI-powered investment research assistant that combines web retrieval, multiple specialist analysts, committee-style synthesis, and deterministic scoring to produce a structured BUY, WATCH, or PASS recommendation. The main idea is to make AI research more transparent, evidence-based, and explainable than a single-prompt chatbot.”

---

## 18. Final takeaway

Market Atlas is a strong example of how to build an AI system that feels intelligent, but also remains structured and trustworthy. It is not just about generating text; it is about designing a reasoning pipeline that behaves more like a decision-support system.

If you want, I can also turn this into a more polished version with:

- a professional landing-page style README,
- a diagram of the workflow,
- or a version tailored for GitHub portfolio presentation.
