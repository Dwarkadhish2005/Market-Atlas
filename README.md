# 🗺️ Market Atlas

Market Atlas is an AI-powered financial/market research and analysis platform built with **Next.js**, **LangGraph**, and **Groq**. It automates multi-agent market research workflows, scores potential investments or trends, and provides a sleek dashboard to analyze the findings.

---

## 🚀 Getting Started

Follow these steps to get your local development environment set up and run the application.

### 📋 Prerequisites

Make sure you have the following installed on your machine:
- **Node.js** (v18.0.0 or higher)
- **npm** or **pnpm** (pnpm is recommended)

---

## 🛠️ Step-by-Step Setup

### 1. Install Dependencies
Choose your preferred package manager to install the dependencies:

```bash
# Using pnpm (recommended)
pnpm install

# Or using npm
npm install
```

### 2. Configure Environment Variables
Copy the example environment file to create your local configurations:

```bash
cp .env.example .env.local
```

Open the newly created `.env.local` file and add your credentials:
```env
# Required: Groq API key (https://console.groq.com)
GROQ_API_KEY=your_groq_api_key_here

# Required: Tavily Search API key (https://app.tavily.com)
TAVILY_API_KEY=your_tavily_api_key_here

# Optional: Override the Groq model (default: llama-3.3-70b-versatile)
GROQ_MODEL=llama-3.3-70b-versatile
```

---

## 🏃 Running the Application

### Development Server
Start the development server with Turbopack enabled for fast builds:

```bash
# Using pnpm
pnpm dev

# Or using npm
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

---

## 🧪 Testing and Quality Checks

### Run Tests
To run unit and integration tests (using Vitest):

```bash
# Using pnpm
pnpm test

# Or using npm
npm run test
```

### Run Linter
To analyze and check for code style issues:

```bash
# Using pnpm
pnpm lint

# Or using npm
npm run lint
```

### Type Checking
To verify TypeScript compilation:

```bash
# Using pnpm
pnpm typecheck

# Or using npm
npm run typecheck
```

---

## 🏗️ Project Structure

- `src/app/` — Next.js page layouts, global styles, and API route endpoints.
  - `api/analyze/` — Next.js API route handling the LangGraph research analysis.
  - `page.tsx` — Main interactive dashboard UI.
- `src/lib/` — Core business logic, multi-agent workflows, and helper scripts.
  - `workflow.ts` — The LangGraph multi-agent orchestration code.
  - `scoring.ts` — Algorithms/criteria to score market entities or reports.
  - `research.ts` — Agent tools powered by Tavily Search.
- `src/types/` — Shared TypeScript type declarations.
- `.env.example` — Template for required environment variables.
