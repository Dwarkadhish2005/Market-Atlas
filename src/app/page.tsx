"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  Building2,
  Check,
  ChevronRight,
  Circle,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Globe2,
  History,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  PanelLeftClose,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import { ANALYST_CONFIG } from "@/lib/analyst-config";
import {
  ANALYST_KEYS,
  type AnalysisResult,
  type AnalysisStreamEvent,
  type AnalystKey,
  type ProgressEvent,
} from "@/types/analysis";

const ANALYSIS_STEPS = [
  { key: "research", label: "Evidence collection", icon: Globe2 },
  { key: "business", label: "Business quality", icon: Building2 },
  { key: "market", label: "Market opportunity", icon: TrendingUp },
  { key: "product", label: "Product & moat", icon: Sparkles },
  { key: "sentiment", label: "Market sentiment", icon: BarChart3 },
  { key: "risk", label: "Risk assessment", icon: ShieldAlert },
  { key: "committee", label: "Committee synthesis", icon: BrainCircuit },
  { key: "scoring", label: "Decision engine", icon: Target },
];

const EXAMPLE_COMPANIES = ["Stripe", "NVIDIA", "Zerodha", "Anthropic", "Reliance Industries"];

const CLIENT_TIMEOUT_MS = 105_000; // 105s — just under server's 120s limit

type Tab = "overview" | "analysts" | "evidence" | "memo";

export default function Home() {
  const [company, setCompany] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [progress, setProgress] = useState<Record<string, ProgressEvent>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem("market-atlas-history") ?? "[]"));
    } catch {
      /* ignore corrupted local data */
    }
  }, []);

  // Timer while loading
  useEffect(() => {
    if (loading) {
      setElapsedSecs(0);
      timerRef.current = setInterval(() => setElapsedSecs((s) => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading]);

  function cancelAnalysis() {
    abortRef.current?.abort();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setLoading(false);
    setError("Analysis cancelled.");
  }

  async function analyze(name = company) {
    const cleaned = name.trim();
    if (cleaned.length < 2 || loading) return;

    setCompany(cleaned);
    setLoading(true);
    setError("");
    setResult(null);
    setProgress({});
    setTab("overview");

    const abort = new AbortController();
    abortRef.current = abort;

    // Client-side timeout guard
    timeoutRef.current = setTimeout(() => {
      abort.abort();
      setLoading(false);
      setError(
        "Analysis timed out after 105 seconds. The AI pipeline may be under load — please try again.",
      );
    }, CLIENT_TIMEOUT_MS);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: cleaned }),
        signal: abort.signal,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Server error (${response.status})`);
      }

      if (!response.body) throw new Error("No response stream received");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;

          let event: AnalysisStreamEvent;
          try {
            event = JSON.parse(line) as AnalysisStreamEvent;
          } catch {
            continue; // skip malformed lines
          }

          if (event.type === "progress") {
            setProgress((current) => ({ ...current, [event.step]: event }));
          } else if (event.type === "error") {
            throw new Error(event.message);
          } else if (event.type === "result") {
            setResult(event.data);
            setHistory((current) => {
              const next = [
                event.data,
                ...current.filter(
                  (item) => item.company.toLowerCase() !== event.data.company.toLowerCase(),
                ),
              ].slice(0, 8);
              localStorage.setItem("market-atlas-history", JSON.stringify(next));
              return next;
            });
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // Already handled by timeout or cancel
        return;
      }
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setLoading(false);
    }
  }

  function openHistory(item: AnalysisResult) {
    setResult(item);
    setCompany(item.company);
    setHistoryOpen(false);
    setTab("overview");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <span />
          </div>
          <span>MARKET ATLAS</span>
        </div>

        <nav className="main-nav" aria-label="Primary navigation">
          <button className="nav-item active">
            <LayoutDashboard size={16} /> Research
          </button>
          <button className="nav-item" onClick={() => setHistoryOpen(true)}>
            <History size={16} /> History{" "}
            {history.length > 0 && <span className="nav-count">{history.length}</span>}
          </button>
        </nav>

        <div className="topbar-right">
          <span className="system-live">
            <i /> SYSTEM ONLINE
          </span>
          <button className="icon-btn mobile-only" aria-label="Open menu">
            <Menu size={19} />
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className={`hero ${result || loading ? "hero-compact" : ""}`}>
        <div className="eyebrow">
          <span>AI INVESTMENT COMMITTEE</span>
          <i />
        </div>
        <h1>
          Research the company.<br />
          <em>Pressure-test the thesis.</em>
        </h1>
        <p>
          Five specialist agents investigate the evidence. One transparent engine makes the call.
        </p>

        <form
          className="search-form"
          onSubmit={(e) => {
            e.preventDefault();
            analyze();
          }}
        >
          <Search size={20} aria-hidden />
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Enter any company — public, private, or startup"
            aria-label="Company name"
            disabled={loading}
          />
          {loading ? (
            <button type="button" className="cancel-btn" onClick={cancelAnalysis}>
              <X size={16} /> Cancel
            </button>
          ) : (
            <button type="submit" disabled={company.trim().length < 2}>
              Run analysis <ArrowUpRight size={17} />
            </button>
          )}
        </form>

        {!result && !loading && (
          <div className="suggestions">
            <span>TRY AN EXAMPLE</span>
            {EXAMPLE_COMPANIES.map((name) => (
              <button key={name} onClick={() => analyze(name)}>
                {name}
                <ChevronRight size={13} />
              </button>
            ))}
          </div>
        )}

        <div className="trust-row">
          <span>
            <Check size={13} /> Source-cited
          </span>
          <span>
            <Check size={13} /> Confidence-adjusted
          </span>
          <span>
            <Check size={13} /> Rules-based verdict
          </span>
        </div>
      </section>

      {/* Error banner */}
      {error && (
        <div className="error-banner" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <div className="error-actions">
            {company && (
              <button className="retry-btn" onClick={() => { setError(""); analyze(); }}>
                <RefreshCw size={14} /> Retry
              </button>
            )}
            <button className="icon-btn" onClick={() => setError("")} aria-label="Dismiss error">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <AnalysisLoading
          company={company}
          progress={progress}
          elapsed={elapsedSecs}
          onCancel={cancelAnalysis}
        />
      )}

      {/* Results */}
      {result && !loading && (
        <ResultWorkspace result={result} tab={tab} setTab={setTab} onRerun={() => analyze(result.company)} />
      )}

      {/* Method strip — shown on empty state */}
      {!result && !loading && (
        <section className="method-strip">
          <div>
            <span className="method-number">01</span>
            <Globe2 />
            <h3>Research</h3>
            <p>Tavily gathers current, diverse evidence with source-level traceability.</p>
          </div>
          <div>
            <span className="method-number">02</span>
            <BrainCircuit />
            <h3>Challenge</h3>
            <p>Five independent analysts test the opportunity from different angles.</p>
          </div>
          <div>
            <span className="method-number">03</span>
            <Target />
            <h3>Decide</h3>
            <p>Confidence weights and explicit risk rules produce an auditable verdict.</p>
          </div>
        </section>
      )}

      <footer>
        <span>MARKET ATLAS / DECISION INTELLIGENCE</span>
        <span>Evidence over instinct.</span>
      </footer>

      {/* History panel */}
      {historyOpen && (
        <div className="modal-backdrop" onClick={() => setHistoryOpen(false)}>
          <aside className="history-panel" onClick={(e) => e.stopPropagation()}>
            <div className="history-head">
              <div>
                <span className="kicker">LOCAL WORKSPACE</span>
                <h2>Analysis history</h2>
              </div>
              <button className="icon-btn" onClick={() => setHistoryOpen(false)} aria-label="Close history">
                <PanelLeftClose size={19} />
              </button>
            </div>
            {history.length === 0 ? (
              <div className="empty-history">
                <History size={28} />
                <p>Your completed analyses will appear here.</p>
              </div>
            ) : (
              history.map((item) => (
                <button
                  className="history-item"
                  key={item.id}
                  onClick={() => openHistory(item)}
                >
                  <span className={`mini-verdict ${item.verdict.toLowerCase()}`}>
                    {item.verdict}
                  </span>
                  <span>
                    <strong>{item.company}</strong>
                    <small>
                      {new Date(item.generatedAt).toLocaleDateString()} ·{" "}
                      {item.finalScore.toFixed(1)}/100
                    </small>
                  </span>
                  <ChevronRight size={16} />
                </button>
              ))
            )}
          </aside>
        </div>
      )}
    </main>
  );
}

// ─── Analysis loading ─────────────────────────────────────────────────────────

function AnalysisLoading({
  company,
  progress,
  elapsed,
  onCancel,
}: {
  company: string;
  progress: Record<string, ProgressEvent>;
  elapsed: number;
  onCancel: () => void;
}) {
  const complete = Object.values(progress).filter((p) => p.status === "complete").length;
  const pct = Math.round((complete / ANALYSIS_STEPS.length) * 100);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return (
    <section className="analysis-loading">
      <div className="loading-header">
        <div>
          <span className="kicker">LIVE WORKFLOW</span>
          <h2>Building the case on {company}</h2>
        </div>
        <div className="loading-meta">
          <span className="loading-time">
            <Clock size={13} /> {timeStr}
          </span>
          <span className="loading-percent">{pct}%</span>
        </div>
      </div>

      <div className="progress-track">
        <span style={{ width: `${pct}%` }} />
      </div>

      <div className="agent-grid">
        {ANALYSIS_STEPS.map(({ key, label, icon: Icon }) => {
          const event = progress[key];
          const state = event?.status ?? "pending";
          return (
            <div className={`agent-step ${state}`} key={key}>
              <div className="step-icon">
                {state === "complete" ? (
                  <Check size={17} />
                ) : state === "running" ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <Icon size={17} />
                )}
              </div>
              <div>
                <strong>{label}</strong>
                <span>{event?.message ?? "Waiting for evidence"}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="loading-footer">
        <div className="loading-note">
          <Circle size={8} fill="currentColor" />
          AI extracts and reasons. Deterministic code applies weights, thresholds, and overrides.
        </div>
        <button className="cancel-link" onClick={onCancel}>
          <X size={13} /> Cancel analysis
        </button>
      </div>
    </section>
  );
}

// ─── Result workspace ─────────────────────────────────────────────────────────

function ResultWorkspace({
  result,
  tab,
  setTab,
  onRerun,
}: {
  result: AnalysisResult;
  tab: Tab;
  setTab: (tab: Tab) => void;
  onRerun: () => void;
}) {
  const tabs: { key: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { key: "overview", label: "Decision", icon: LayoutDashboard },
    { key: "analysts", label: "Analysts", icon: BrainCircuit },
    { key: "evidence", label: "Evidence", icon: BookOpen },
    { key: "memo", label: "Memo", icon: FileText },
  ];

  return (
    <section className="result-section">
      <div className="result-meta">
        <div>
          <span className="kicker">
            INVESTMENT BRIEF /{" "}
            {new Date(result.generatedAt).toLocaleDateString("en-GB").replaceAll("/", ".")}
          </span>
          <h2>{result.company}</h2>
        </div>
        <div className="meta-actions">
          <button className="secondary-btn" onClick={onRerun} title="Re-run analysis">
            <RefreshCw size={14} /> Re-run
          </button>
          <button
            className="secondary-btn"
            onClick={() => window.print()}
            title="Export investment memo as PDF"
          >
            <Download size={15} /> Export memo
          </button>
        </div>
      </div>

      <div className="tabbar" role="tablist">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview result={result} />}
      {tab === "analysts" && <Analysts result={result} />}
      {tab === "evidence" && <Evidence result={result} />}
      {tab === "memo" && <Memo result={result} />}
    </section>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function Overview({ result }: { result: AnalysisResult }) {
  const highFlagCount = ANALYST_KEYS.flatMap((k) => result.analysts[k].flags).filter(
    (f) => f.severity === "HIGH",
  ).length;

  return (
    <div className="decision-grid">
      {/* Verdict card */}
      <section className={`verdict-card ${result.verdict.toLowerCase()}`}>
        <div className="verdict-top">
          <span>COMMITTEE VERDICT</span>
          <span className="confidence-dot">
            <i /> {Math.round(result.confidence * 100)}% CONFIDENCE
          </span>
        </div>
        <div className="verdict-main">
          <div>
            <strong>{result.verdict}</strong>
            <span>
              {result.verdict === "BUY"
                ? "Conviction supported by evidence"
                : result.verdict === "WATCH"
                  ? "Promising, with material conditions"
                  : "Risk-reward does not meet threshold"}
            </span>
          </div>
          <ScoreRing score={result.finalScore} />
        </div>
        <div className="verdict-stats">
          <div>
            <span>RISK LEVEL</span>
            <strong>{result.riskLevel}</strong>
          </div>
          <div>
            <span>HORIZON</span>
            <strong>{result.investmentHorizon.split(";")[0]}</strong>
          </div>
          <div>
            <span>HIGH FLAGS</span>
            <strong>{highFlagCount}</strong>
          </div>
        </div>
        {result.overrideApplied && (
          <div className="override-note">
            <ShieldAlert size={16} />
            <span>
              <strong>Override applied.</strong> {result.overrideReason}
            </span>
          </div>
        )}
      </section>

      {/* Radar chart */}
      <section className="radar-card">
        <div className="card-heading">
          <div>
            <span className="kicker">SCORE PROFILE</span>
            <h3>Where the thesis holds</h3>
          </div>
          <span className="score-legend">
            <i /> Confidence-adjusted
          </span>
        </div>
        <Radar result={result} />
      </section>

      {/* Committee summary */}
      <section className="committee-card">
        <div className="card-heading">
          <div>
            <span className="kicker">COMMITTEE VIEW</span>
            <h3>The investment case</h3>
          </div>
          <BrainCircuit size={22} />
        </div>
        <blockquote>{result.committeeSummary}</blockquote>
        <div className="committee-signoff">
          <span>MODEL SYNTHESIS</span>
          <i />
          <span>RULE-BASED DECISION</span>
        </div>
      </section>

      {/* Strengths */}
      <section className="thesis-card strengths">
        <div className="card-heading">
          <div>
            <span className="kicker">UPSIDE CASE</span>
            <h3>What works</h3>
          </div>
          <TrendingUp size={20} />
        </div>
        <ul>
          {result.keyStrengths.slice(0, 5).map((item, i) => (
            <li key={item}>
              <span>0{i + 1}</span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* Risks */}
      <section className="thesis-card risks">
        <div className="card-heading">
          <div>
            <span className="kicker">DOWNSIDE CASE</span>
            <h3>What could break</h3>
          </div>
          <ShieldAlert size={20} />
        </div>
        <ul>
          {result.keyRisks.slice(0, 5).map((item, i) => (
            <li key={item}>
              <span>0{i + 1}</span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* Score formula */}
      <section className="formula-card">
        <span className="kicker">HOW THE SCORE WAS BUILT</span>
        <div className="formula-row">
          {result.scoreBreakdown.map((item) => (
            <div key={item.key}>
              <span>{ANALYST_CONFIG[item.key].name.replace(" Analyst", "")}</span>
              <strong>{item.rawScore.toFixed(1)}</strong>
              <small>
                × {Math.round(item.confidence * 100)}% conf. × {Math.round(item.weight * 100)}%
              </small>
              <em>+{item.contribution.toFixed(1)}</em>
            </div>
          ))}
        </div>
        <p>
          AI extracts and reasons. Deterministic code applies confidence, weights, thresholds, and
          overrides. The LLM has no influence over the final verdict.
        </p>
      </section>
    </div>
  );
}

// ─── Analysts tab ─────────────────────────────────────────────────────────────

function Analysts({ result }: { result: AnalysisResult }) {
  return (
    <div className="analyst-list">
      {ANALYST_KEYS.map((key, index) => {
        const item = result.analysts[key];
        const citations = item.evidenceIds
          .map((id) => result.sources.find((s) => s.id === id))
          .filter(Boolean);

        return (
          <article className="analyst-card" key={key}>
            <div className="analyst-index">0{index + 1}</div>
            <div className="analyst-content">
              <div className="analyst-head">
                <div>
                  <span className="kicker">SPECIALIST REPORT</span>
                  <h3>{item.name}</h3>
                </div>
                <div className="analyst-score">
                  <strong>{item.score.toFixed(1)}</strong>
                  <span>/ 10</span>
                  <small>{Math.round(item.confidence * 100)}% confidence</small>
                </div>
              </div>

              <p>{item.summary}</p>

              <div className="analyst-columns">
                <div>
                  <h4>Strengths</h4>
                  {item.strengths.map((s) => (
                    <span className="finding positive" key={s}>
                      <Check size={13} />
                      {s}
                    </span>
                  ))}
                </div>
                <div>
                  <h4>Weaknesses</h4>
                  {item.weaknesses.map((s) => (
                    <span className="finding negative" key={s}>
                      <ShieldAlert size={13} />
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {item.flags.length > 0 && (
                <div className="flags">
                  {item.flags.map((flag) => (
                    <span
                      className={`flag ${flag.severity.toLowerCase()}`}
                      key={flag.code}
                      title={flag.rationale}
                    >
                      {flag.severity} · {flag.code.replaceAll("_", " ")}
                    </span>
                  ))}
                </div>
              )}

              <div className="citation-row">
                <BookOpen size={14} />
                <span>Grounded in</span>
                {citations.map(
                  (source) =>
                    source && (
                      <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
                        [{source.id}] {source.title.slice(0, 40)}…
                      </a>
                    ),
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

// ─── Evidence tab ─────────────────────────────────────────────────────────────

function Evidence({ result }: { result: AnalysisResult }) {
  return (
    <div className="evidence-layout">
      <div className="evidence-intro">
        <span className="kicker">EVIDENCE REPOSITORY</span>
        <h3>
          {result.sources.length} sources, one auditable trail
        </h3>
        <p>
          Every analyst is restricted to this research corpus. Source IDs connect claims back
          to their origin.
        </p>
        <div>
          <strong>{result.sources.filter((s) => s.publishedDate).length}</strong>
          <span>Dated sources</span>
        </div>
        <div style={{ marginTop: 12 }}>
          <strong>
            {result.sources.filter((s) => s.score && s.score > 0.8).length}
          </strong>
          <span>High-relevance sources (&gt;80%)</span>
        </div>
      </div>

      <div className="source-list">
        {result.sources.map((source) => (
          <a
            className="source-card"
            href={source.url}
            target="_blank"
            rel="noreferrer"
            key={source.id}
          >
            <span className="source-id">{source.id}</span>
            <div>
              <h4>{source.title}</h4>
              <p>{source.snippet}</p>
              <span className="source-meta">
                {source.publishedDate
                  ? new Date(source.publishedDate).toLocaleDateString()
                  : "Date unavailable"}
                {source.score
                  ? ` · ${Math.round(source.score * 100)}% relevance`
                  : ""}
              </span>
            </div>
            <ExternalLink size={15} />
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Memo tab ─────────────────────────────────────────────────────────────────

function Memo({ result }: { result: AnalysisResult }) {
  return (
    <article className="memo" id="investment-memo">
      <header>
        <div className="brand">
          <div className="brand-mark">
            <span />
          </div>
          <span>MARKET ATLAS</span>
        </div>
        <span>CONFIDENTIAL RESEARCH NOTE</span>
      </header>

      <div className="memo-title">
        <span>
          {new Date(result.generatedAt).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </span>
        <h1>{result.company}</h1>
        <p>Investment committee memorandum</p>
      </div>

      <div className="memo-call">
        <div>
          <span>RECOMMENDATION</span>
          <strong>{result.verdict}</strong>
        </div>
        <div>
          <span>FINAL SCORE</span>
          <strong>{result.finalScore.toFixed(1)} / 100</strong>
        </div>
        <div>
          <span>CONFIDENCE</span>
          <strong>{Math.round(result.confidence * 100)}%</strong>
        </div>
        <div>
          <span>RISK</span>
          <strong>{result.riskLevel}</strong>
        </div>
      </div>

      <MemoSection n="01" title="Executive View">
        <p>{result.committeeSummary}</p>
      </MemoSection>

      {ANALYST_KEYS.map((key, i) => (
        <MemoSection n={`0${i + 2}`} title={result.analysts[key].name} key={key}>
          <p>{result.analysts[key].summary}</p>
          <p>
            <strong>Score:</strong> {result.analysts[key].score.toFixed(1)}/10 at{" "}
            {Math.round(result.analysts[key].confidence * 100)}% confidence.
          </p>
          {result.analysts[key].strengths.length > 0 && (
            <>
              <p>
                <strong>Strengths:</strong>
              </p>
              <ul>
                {result.analysts[key].strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </>
          )}
          {result.analysts[key].weaknesses.length > 0 && (
            <>
              <p>
                <strong>Concerns:</strong>
              </p>
              <ul>
                {result.analysts[key].weaknesses.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </>
          )}
          {result.analysts[key].flags.length > 0 && (
            <>
              <p>
                <strong>Risk Flags:</strong>
              </p>
              <ul>
                {result.analysts[key].flags.map((f) => (
                  <li key={f.code}>
                    [{f.severity}] {f.code.replaceAll("_", " ")} — {f.rationale}
                  </li>
                ))}
              </ul>
            </>
          )}
        </MemoSection>
      ))}

      <MemoSection n="07" title="Score Breakdown">
        <p>
          The deterministic scoring engine produced {result.finalScore.toFixed(1)}/100 after
          confidence adjustment across five weighted dimensions:
        </p>
        <ul>
          {result.scoreBreakdown.map((item) => (
            <li key={item.key}>
              {ANALYST_CONFIG[item.key].name}: {item.rawScore.toFixed(1)}/10 ×{" "}
              {Math.round(item.confidence * 100)}% confidence ×{" "}
              {Math.round(item.weight * 100)}% weight = +{item.contribution.toFixed(1)} pts
            </li>
          ))}
        </ul>
      </MemoSection>

      <MemoSection n="08" title="Decision Rationale">
        <p>
          The resulting recommendation is <strong>{result.verdict}</strong>
          {result.overrideApplied
            ? `, with an override applied: ${result.overrideReason}`
            : ". No verdict override was triggered."}
        </p>
        <p>Investment horizon: {result.investmentHorizon}</p>
      </MemoSection>

      <MemoSection n="09" title="Key Watchpoints">
        <ul>
          {result.keyRisks.map((risk) => (
            <li key={risk}>{risk}</li>
          ))}
        </ul>
      </MemoSection>

      <MemoSection n="10" title="Evidence Sources">
        <ul>
          {result.sources.map((s) => (
            <li key={s.id}>
              [{s.id}] {s.title} — {s.url}
            </li>
          ))}
        </ul>
      </MemoSection>

      <footer>
        <span>Generated by Market Atlas</span>
        <span>Evidence-led · Confidence-aware · Auditable</span>
      </footer>
    </article>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function MemoSection({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="memo-section">
      <span>{n}</span>
      <div>
        <h2>{title}</h2>
        {children}
      </div>
    </section>
  );
}

function ScoreRing({ score }: { score: number }) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="score-ring">
      <svg viewBox="0 0 110 110" aria-hidden>
        <circle cx="55" cy="55" r={radius} />
        <circle
          className="ring-progress"
          cx="55"
          cy="55"
          r={radius}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: circumference * (1 - score / 100),
          }}
        />
      </svg>
      <div>
        <strong>{score.toFixed(1)}</strong>
        <span>/ 100</span>
      </div>
    </div>
  );
}

function Radar({ result }: { result: AnalysisResult }) {
  const values = ANALYST_KEYS.map(
    (key) => result.analysts[key].score * result.analysts[key].confidence,
  );
  const center = 130;
  const maxR = 92;

  const point = (i: number, value: number) => {
    const angle = -Math.PI / 2 + i * ((Math.PI * 2) / 5);
    const r = maxR * (value / 10);
    return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`;
  };

  const grid = [0.25, 0.5, 0.75, 1].map((scale) =>
    ANALYST_KEYS.map((_, i) => point(i, scale * 10)).join(" "),
  );

  const labels = ["BUSINESS", "MARKET", "PRODUCT", "SENTIMENT", "RISK"];

  return (
    <svg
      className="radar"
      viewBox="0 0 260 260"
      role="img"
      aria-label="Confidence-adjusted analyst score radar chart"
    >
      {grid.map((points, i) => (
        <polygon key={i} points={points} className="radar-grid" />
      ))}
      {ANALYST_KEYS.map((_, i) => (
        <line
          key={i}
          x1={center}
          y1={center}
          x2={point(i, 10).split(",")[0]}
          y2={point(i, 10).split(",")[1]}
        />
      ))}
      <polygon
        points={values.map((v, i) => point(i, v)).join(" ")}
        className="radar-area"
      />
      {values.map((v, i) => {
        const [x, y] = point(i, v).split(",");
        return <circle key={i} cx={x} cy={y} r="3.5" className="radar-dot" />;
      })}
      {labels.map((label, i) => {
        const [x, y] = point(i, 11.5).split(",").map(Number);
        return (
          <text key={label} x={x} y={y} textAnchor="middle" dominantBaseline="middle">
            {label}
          </text>
        );
      })}
    </svg>
  );
}
