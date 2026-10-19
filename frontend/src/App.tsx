import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import "./App.css";
import ReactMarkdown from "react-markdown";

type HistoryItem = {
  id: string;
  type: string;
  input: string;
  response: string;
  createdAt: string;
};

type TabKey = "explain" | "analyze" | "fix";

const HISTORY_KEY = "ai-developer-assistant-history";
const MAX_HISTORY_ITEMS = 50;

const TABS: { key: TabKey; label: string }[] = [
  { key: "explain", label: "Explain Code" },
  { key: "analyze", label: "Analyze Error" },
  { key: "fix", label: "Suggest Fix" },
];

const TAB_HISTORY_TYPE: Record<TabKey, string> = {
  explain: "Explain Code",
  analyze: "Analyze Error",
  fix: "Suggest Fix",
};

const TAB_HISTORY_META: Record<
  TabKey,
  { heading: string; description: string; empty: string }
> = {
  explain: {
    heading: "Explain Code History",
    description: "Revisit your previous code explanations.",
    empty:
      "No Explain Code history yet. Your successful responses will appear here.",
  },
  analyze: {
    heading: "Analyze Error History",
    description: "Revisit your previous error analyses.",
    empty:
      "No Analyze Error history yet. Your successful responses will appear here.",
  },
  fix: {
    heading: "Suggest Fix History",
    description: "Revisit your previous suggested fixes.",
    empty:
      "No Suggest Fix history yet. Your successful responses will appear here.",
  },
};

function getRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();

  if (Number.isNaN(then)) {
    return "";
  }

  const diffSeconds = Math.max(
    0,
    Math.floor((Date.now() - then) / 1000)
  );

  if (diffSeconds < 60) {
    return "just now";
  }

  const units: [number, string][] = [
    [31536000, "year"],
    [2592000, "month"],
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
  ];

  for (const [seconds, name] of units) {
    if (diffSeconds >= seconds) {
      const value = Math.floor(diffSeconds / seconds);
      return `${value} ${name}${value === 1 ? "" : "s"} ago`;
    }
  }

  return "just now";
}

function createHistoryId(): string {
  return `${Date.now()}-${Math.random()}`;
}

function App() {
  // Explain Code states
  const [code, setCode] = useState("");
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const [explainError, setExplainError] = useState("");

  // Analyze Error states
  const [errorMessage, setErrorMessage] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  // Suggest Fix states
  const [fixCode, setFixCode] = useState("");
  const [fixErrorMessage, setFixErrorMessage] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestFixError, setSuggestFixError] = useState("");

  // Copy Code states
  const [copiedCode, setCopiedCode] = useState("");
  const [copyError, setCopyError] = useState("");

  // Active tool tab (presentational)
  const [activeTab, setActiveTab] = useState<TabKey>("explain");

  // Conversation History states
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const savedHistory = localStorage.getItem(HISTORY_KEY);

      if (!savedHistory) {
        return [];
      }

      const parsed: unknown = JSON.parse(savedHistory);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter(
          (item): item is HistoryItem =>
            item !== null &&
            typeof item === "object" &&
            typeof item.id === "string" &&
            typeof item.type === "string" &&
            typeof item.input === "string" &&
            typeof item.response === "string" &&
            typeof item.createdAt === "string"
        )
        .slice(0, MAX_HISTORY_ITEMS);
    } catch {
      return [];
    }
  });

  const [selectedHistory, setSelectedHistory] =
    useState<HistoryItem | null>(null);

  const activeHistoryType = TAB_HISTORY_TYPE[activeTab];
  const historyMeta = TAB_HISTORY_META[activeTab];

  const visibleHistory = history.filter(
    (item) => item.type === activeHistoryType
  );

  function countFor(tab: TabKey): number {
    return history.filter(
      (item) => item.type === TAB_HISTORY_TYPE[tab]
    ).length;
  }

  // Save history whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(history)
      );
    } catch {
      console.warn("Could not save conversation history.");
    }
  }, [history]);

  // Add a successful AI response to history
  function addHistory(
    type: string,
    input: string,
    response: string
  ) {
    const item: HistoryItem = {
      id: createHistoryId(),
      type,
      input,
      response,
      createdAt: new Date().toISOString(),
    };

    setHistory((previous) =>
      [item, ...previous].slice(0, MAX_HISTORY_ITEMS)
    );

    setSelectedHistory(null);
  }

  // Clear saved history for the active tool only
  function handleClearHistory() {
    const confirmed = window.confirm(
      `Clear all ${activeHistoryType} history? Items from other tools will be kept.`
    );

    if (confirmed) {
      setHistory((previous) =>
        previous.filter(
          (item) => item.type !== activeHistoryType
        )
      );
      setSelectedHistory(null);
    }
  }

  // Delete one saved conversation
  function handleDeleteHistory(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this conversation?"
    );

    if (!confirmed) {
      return;
    }

    setHistory((previous) =>
      previous.filter((item) => item.id !== id)
    );

    setSelectedHistory((current) =>
      current?.id === id ? null : current
    );
  }

  // Copy code to clipboard
  async function handleCopyCode(
    codeText: string,
    blockId: string
  ) {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopiedCode(blockId);
      setCopyError("");

      window.setTimeout(() => {
        setCopiedCode((current) =>
          current === blockId ? "" : current
        );
      }, 2000);
    } catch {
      setCopiedCode("");
      setCopyError(
        "Could not copy the code. Please select and copy it manually."
      );
    }
  }

  // Render Markdown and add Copy Code buttons
  function renderMarkdown(content: string, section: string) {
    return (
      <ReactMarkdown
        components={{
          pre({ children }) {
            return <>{children}</>;
          },
          code({ children, className }) {
            const codeText = String(children).replace(
              /\n$/,
              ""
            );
            const isCodeBlock =
              Boolean(className) || codeText.includes("\n");

            if (!isCodeBlock) {
              return <code>{children}</code>;
            }

            const blockId = `${section}-${codeText}`;

            return (
              <div className="code-container">
                <div className="code-toolbar">
                  <span className="code-language">
                    {className?.replace("language-", "") ||
                      "Code"}
                  </span>

                  <button
                    type="button"
                    className="copy-code-btn"
                    onClick={() =>
                      handleCopyCode(codeText, blockId)
                    }
                  >
                    {copiedCode === blockId
                      ? "Copied!"
                      : "Copy"}
                  </button>
                </div>

                <pre className="code-block">
                  <code className={className}>
                    {children}
                  </code>
                </pre>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    );
  }

  // 1. Explain Code
  async function handleExplain() {
    if (!code.trim()) {
      setExplainError("Please paste some code first.");
      setExplanation("");
      return;
    }

    setLoading(true);
    setExplainError("");
    setExplanation("");
    setCopyError("");

    try {
      const response = await fetch(
        "http://localhost:5000/api/explain",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to explain code."
        );
      }

      setExplanation(data.explanation);

      addHistory(
        "Explain Code",
        code,
        data.explanation
      );
    } catch (err) {
      setExplainError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  // 2. Analyze Programming Error
  async function handleAnalyzeError() {
    if (!errorMessage.trim()) {
      setAnalyzeError("Please enter an error message.");
      setAnalysis("");
      return;
    }

    setAnalyzing(true);
    setAnalyzeError("");
    setAnalysis("");
    setCopyError("");

    try {
      const response = await fetch(
        "http://localhost:5000/api/analyze-error",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            errorMessage,
            code: errorCode,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to analyze error."
        );
      }

      setAnalysis(data.analysis);

      addHistory(
        "Analyze Error",
        `Error message:\n${errorMessage}\n\nRelated code:\n${
          errorCode.trim() || "No code provided"
        }`,
        data.analysis
      );
    } catch (err) {
      setAnalyzeError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setAnalyzing(false);
    }
  }

  // 3. Suggest a Code Fix
  async function handleSuggestFix() {
    if (!fixCode.trim()) {
      setSuggestFixError(
        "Please enter the code you want to fix."
      );
      setSuggestion("");
      return;
    }

    setSuggesting(true);
    setSuggestFixError("");
    setSuggestion("");
    setCopyError("");

    try {
      const response = await fetch(
        "http://localhost:5000/api/suggest-fix",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code: fixCode,
            errorMessage: fixErrorMessage,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to suggest a fix."
        );
      }

      setSuggestion(data.suggestion);

      addHistory(
        "Suggest Fix",
        `Code:\n${fixCode}\n\nError message:\n${
          fixErrorMessage.trim() || "No error message provided"
        }`,
        data.suggestion
      );
    } catch (err) {
      setSuggestFixError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setSuggesting(false);
    }
  }

  function submitOnCtrlEnter(handler: () => void) {
    return (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key === "Enter"
      ) {
        event.preventDefault();
        handler();
      }
    };
  }

  function selectTab(tab: TabKey) {
    setActiveTab(tab);
    setSelectedHistory(null);
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLDivElement>
  ) {
    const keys = TABS.map((tab) => tab.key);
    const index = keys.indexOf(activeTab);

    let next: number;

    if (event.key === "ArrowRight") {
      next = (index + 1) % keys.length;
    } else if (event.key === "ArrowLeft") {
      next = (index - 1 + keys.length) % keys.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = keys.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    selectTab(keys[next]);
    document.getElementById(`tab-${keys[next]}`)?.focus();
  }

  return (
    <main className="container">
      <header className="page-header">
        <h1>AI Developer Assistant</h1>

        <p className="subtitle">
          Understand code, debug errors, and improve your
          development skills.
        </p>
      </header>

      <div
        className="tabs"
        role="tablist"
        aria-label="AI tools"
        onKeyDown={handleTabKeyDown}
      >
        {TABS.map((tab) => {
          const count = countFor(tab.key);

          return (
            <button
              key={tab.key}
              id={`tab-${tab.key}`}
              type="button"
              role="tab"
              className="tab"
              aria-selected={activeTab === tab.key}
              aria-controls={`panel-${tab.key}`}
              aria-label={
                count > 0
                  ? `${tab.label}, ${count} saved item${count === 1 ? "" : "s"}`
                  : tab.label
              }
              tabIndex={activeTab === tab.key ? 0 : -1}
              onClick={() => selectTab(tab.key)}
            >
              {tab.label}
              {count > 0 && (
                <span className="tab-count" aria-hidden="true">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {copyError && (
        <p className="copy-error" role="alert">
          {copyError}
        </p>
      )}

      {/* Feature 1: Explain Code */}
      <section
        className="card"
        id="panel-explain"
        role="tabpanel"
        aria-labelledby="tab-explain"
        hidden={activeTab !== "explain"}
      >
        <h2>Explain Code</h2>

        <p className="card-description">
          Paste your code to understand what it does.
        </p>

        <div className="field">
          <label
            className="field-label"
            htmlFor="code-input"
          >
            Paste your code
          </label>

          <textarea
            id="code-input"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            onKeyDown={submitOnCtrlEnter(handleExplain)}
            placeholder="Paste your JavaScript, Python, or other code here..."
            rows={10}
            spellCheck={false}
          />
        </div>

        <div className="submit-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleExplain}
            disabled={loading || !code.trim()}
          >
            {loading && (
              <span className="spinner" aria-hidden="true" />
            )}
            {loading ? "Explaining..." : "Explain Code"}
          </button>

          <span className="shortcut-hint">
            <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to submit
          </span>
        </div>

        {explainError && (
          <div className="error-panel" role="alert">
            <h3>Error</h3>
            <p>{explainError}</p>
          </div>
        )}

        {explanation && (
          <div className="result-panel" aria-live="polite">
            <h3>AI Explanation</h3>

            <div className="explanation">
              {renderMarkdown(explanation, "explanation")}
            </div>
          </div>
        )}
      </section>

      {/* Feature 2: Analyze Error */}
      <section
        className="card"
        id="panel-analyze"
        role="tabpanel"
        aria-labelledby="tab-analyze"
        hidden={activeTab !== "analyze"}
      >
        <h2>Analyze Programming Error</h2>

        <p className="card-description">
          Find out what went wrong and how to fix it.
        </p>

        <div className="field">
          <label
            className="field-label"
            htmlFor="error-input"
          >
            Error message
          </label>

          <textarea
            id="error-input"
            value={errorMessage}
            onChange={(event) =>
              setErrorMessage(event.target.value)
            }
            onKeyDown={submitOnCtrlEnter(handleAnalyzeError)}
            placeholder="Example: ReferenceError: x is not defined"
            rows={4}
          />
        </div>

        <div className="field">
          <label
            className="field-label"
            htmlFor="error-code-input"
          >
            Related code{" "}
            <span className="optional-tag">Optional</span>
          </label>

          <textarea
            id="error-code-input"
            value={errorCode}
            onChange={(event) =>
              setErrorCode(event.target.value)
            }
            onKeyDown={submitOnCtrlEnter(handleAnalyzeError)}
            placeholder="Paste the code that caused the error..."
            rows={6}
            spellCheck={false}
          />
        </div>

        <div className="submit-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAnalyzeError}
            disabled={analyzing || !errorMessage.trim()}
          >
            {analyzing && (
              <span className="spinner" aria-hidden="true" />
            )}
            {analyzing ? "Analyzing..." : "Analyze Error"}
          </button>

          <span className="shortcut-hint">
            <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to submit
          </span>
        </div>

        {analyzeError && (
          <div className="error-panel" role="alert">
            <h3>Error</h3>
            <p>{analyzeError}</p>
          </div>
        )}

        {analysis && (
          <div className="result-panel" aria-live="polite">
            <h3>Error Analysis</h3>

            <div className="explanation">
              {renderMarkdown(analysis, "analysis")}
            </div>
          </div>
        )}
      </section>

      {/* Feature 3: Suggest Fix */}
      <section
        className="card"
        id="panel-fix"
        role="tabpanel"
        aria-labelledby="tab-fix"
        hidden={activeTab !== "fix"}
      >
        <h2>Suggest a Code Fix</h2>

        <p className="card-description">
          Get corrected code and understand what needs to
          change.
        </p>

        <div className="field">
          <label
            className="field-label"
            htmlFor="fix-code-input"
          >
            Code to fix
          </label>

          <textarea
            id="fix-code-input"
            value={fixCode}
            onChange={(event) =>
              setFixCode(event.target.value)
            }
            onKeyDown={submitOnCtrlEnter(handleSuggestFix)}
            placeholder="Paste the code you want to fix..."
            rows={8}
            spellCheck={false}
          />
        </div>

        <div className="field">
          <label
            className="field-label"
            htmlFor="fix-error-input"
          >
            Error message{" "}
            <span className="optional-tag">Optional</span>
          </label>

          <textarea
            id="fix-error-input"
            value={fixErrorMessage}
            onChange={(event) =>
              setFixErrorMessage(event.target.value)
            }
            onKeyDown={submitOnCtrlEnter(handleSuggestFix)}
            placeholder="Describe the error, if you know it..."
            rows={3}
          />
        </div>

        <div className="submit-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSuggestFix}
            disabled={suggesting || !fixCode.trim()}
          >
            {suggesting && (
              <span className="spinner" aria-hidden="true" />
            )}
            {suggesting ? "Suggesting Fix..." : "Suggest Fix"}
          </button>

          <span className="shortcut-hint">
            <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to submit
          </span>
        </div>

        {suggestFixError && (
          <div className="error-panel" role="alert">
            <h3>Error</h3>
            <p>{suggestFixError}</p>
          </div>
        )}

        {suggestion && (
          <div className="result-panel" aria-live="polite">
            <h3>Suggested Fix</h3>

            <div className="explanation">
              {renderMarkdown(suggestion, "suggestion")}
            </div>
          </div>
        )}
      </section>

      {/* Conversation History */}
      <section className="card history-section">
        <div className="section-heading">
          <h2>{historyMeta.heading}</h2>

          {visibleHistory.length > 0 && (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={handleClearHistory}
            >
              Clear History
            </button>
          )}
        </div>

        <p className="card-description">
          {historyMeta.description}
        </p>

        {visibleHistory.length === 0 ? (
          <div className="history-empty">
            {historyMeta.empty}
          </div>
        ) : (
          <ul className="history-list">
            {visibleHistory.map((item) => (
              <li key={item.id} className="history-item">
                <div className="history-item-main">
                  <div className="history-meta">
                    <time
                      className="history-time"
                      dateTime={item.createdAt}
                      title={new Date(
                        item.createdAt
                      ).toLocaleString()}
                    >
                      {getRelativeTime(item.createdAt)}
                    </time>
                  </div>

                  <p className="history-preview">
                    {item.input.slice(0, 120)}
                    {item.input.length > 120 ? "..." : ""}
                  </p>
                </div>

                <div className="history-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setSelectedHistory(item)}
                  >
                    View
                  </button>

                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() =>
                      handleDeleteHistory(item.id)
                    }
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {selectedHistory && (
          <div className="result-panel history-detail">
            <div className="history-detail-heading">
              <h3>{selectedHistory.type}</h3>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedHistory(null)}
              >
                Close
              </button>
            </div>

            <p className="detail-label">Original input</p>

            <pre className="history-input">
              {selectedHistory.input}
            </pre>

            <p className="detail-label">AI response</p>

            <div className="explanation">
              {renderMarkdown(
                selectedHistory.response,
                `history-${selectedHistory.id}`
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
