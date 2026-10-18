
import { useEffect, useState } from "react";
import "./App.css";
import ReactMarkdown from "react-markdown";

type HistoryItem = {
  id: string;
  type: string;
  input: string;
  response: string;
  createdAt: string;
};

const HISTORY_KEY = "ai-developer-assistant-history";
const MAX_HISTORY_ITEMS = 50;

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
      id: `${Date.now()}-${Math.random()}`,
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

  // Clear all saved history
  function handleClearHistory() {
    const confirmed = window.confirm(
      "Are you sure you want to clear all conversation history?"
    );

    if (confirmed) {
      setHistory([]);
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
            const codeText = String(children).replace(/\n$/, "");
            const isCodeBlock = Boolean(className);

            if (!isCodeBlock) {
              return <code>{children}</code>;
            }

            const blockId = `${section}-${codeText}`;

            return (
              <div className="code-container">
                <div className="code-toolbar">
                  <span className="code-language">
                    {className?.replace("language-", "") || "Code"}
                  </span>

                  <button
                    type="button"
                    className="copy-code-button"
                    onClick={() =>
                      handleCopyCode(codeText, blockId)
                    }
                  >
                    {copiedCode === blockId
                      ? "Copied!"
                      : "Copy Code"}
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

  return (
    <main className="container">
      <h1>AI Developer Assistant</h1>

      <p className="subtitle">
        Understand code, debug errors, and improve your
        development skills.
      </p>

      {/* Conversation History */}
      <section className="card history-section">
        <div className="history-heading">
          <h2>Conversation History</h2>

          {history.length > 0 && (
            <button
              type="button"
              className="clear-history-button"
              onClick={handleClearHistory}
            >
              Clear History
            </button>
          )}
        </div>

        <p>
          Revisit your previous explanations, error analyses,
          and code fixes.
        </p>

        {history.length === 0 ? (
          <p className="history-empty">
            No history yet. Your successful AI responses
            will appear here.
          </p>
        ) : (
          <ul className="history-list">
            {history.map((item) => (
              <li key={item.id} className="history-item">
                <div className="history-item-details">
                  <strong>{item.type}</strong>
                  <span className="history-date">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                  <p className="history-preview">
                    {item.input.slice(0, 100)}
                    {item.input.length > 100 ? "..." : ""}
                  </p>
                </div>
                <div className="history-actions">
                    <button
                      type="button"
                      className="view-history-button"
                      onClick={() => setSelectedHistory(item)}
                    >
                    View
                    </button>
                    <button
                    type="button"
                    className="delete-history-button"
                    onClick={() => handleDeleteHistory(item.id)}
                    >
                    Delete
                    </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {selectedHistory && (
          <div className="result history-detail">
            <div className="history-heading">
              <h3>{selectedHistory.type}</h3>

              <button
                type="button"
                className="view-history-button"
                onClick={() => setSelectedHistory(null)}
              >
                Close
              </button>
            </div>

            <p>
              <strong>Original input</strong>
            </p>

            <pre className="history-input">
              {selectedHistory.input}
            </pre>

            <p>
              <strong>AI response</strong>
            </p>

            <div className="explanation">
              {renderMarkdown(
                selectedHistory.response,
                `history-${selectedHistory.id}`
              )}
            </div>
          </div>
        )}
      </section>

      {/* Feature 1: Explain Code */}
      <section className="card">
        <h2>Explain Code</h2>

        <p>Paste your code to understand what it does.</p>

        <label htmlFor="code-input">Paste your code</label>

        <textarea
          id="code-input"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Paste your JavaScript, Python, or other code here..."
          rows={10}
        />

        <button onClick={handleExplain} disabled={loading}>
          {loading ? "Explaining..." : "Explain Code"}
        </button>

        {explainError && (
          <div className="result" role="alert">
            <h2>Error</h2>
            <p>{explainError}</p>
          </div>
        )}

        {explanation && (
          <div className="result" aria-live="polite">
            <h2>AI Explanation</h2>
            <div className="explanation">
              {renderMarkdown(explanation, "explanation")}
            </div>
          </div>
        )}
      </section>

      {/* Feature 2: Analyze Error */}
      <section className="feature-divider">
        <h2>Analyze Programming Error</h2>

        <p>Find out what went wrong and how to fix it.</p>

        <label htmlFor="error-input">Error message</label>

        <textarea
          id="error-input"
          value={errorMessage}
          onChange={(event) =>
            setErrorMessage(event.target.value)
          }
          placeholder="Example: ReferenceError: x is not defined"
          rows={3}
        />

        <label htmlFor="error-code-input">
          Related code (optional)
        </label>

        <textarea
          id="error-code-input"
          value={errorCode}
          onChange={(event) =>
            setErrorCode(event.target.value)
          }
          placeholder="Paste the code that caused the error..."
          rows={5}
        />

        <button
          onClick={handleAnalyzeError}
          disabled={analyzing}
        >
          {analyzing ? "Analyzing..." : "Analyze Error"}
        </button>

        {analyzeError && (
          <div className="result" role="alert">
            <h2>Error</h2>
            <p>{analyzeError}</p>
          </div>
        )}

        {analysis && (
          <div className="result" aria-live="polite">
            <h2>Error Analysis</h2>
            <div className="explanation">
              {renderMarkdown(analysis, "analysis")}
            </div>
          </div>
        )}
      </section>

      {/* Feature 3: Suggest Fix */}
      <section className="feature-divider">
        <h2>Suggest a Code Fix</h2>

        <p>
          Get corrected code and understand what needs to change.
        </p>

        <label htmlFor="fix-code-input">Code to fix</label>

        <textarea
          id="fix-code-input"
          value={fixCode}
          onChange={(event) => setFixCode(event.target.value)}
          placeholder="Paste the code you want to fix..."
          rows={6}
        />

        <label htmlFor="fix-error-input">
          Error message (optional)
        </label>

        <textarea
          id="fix-error-input"
          value={fixErrorMessage}
          onChange={(event) =>
            setFixErrorMessage(event.target.value)
          }
          placeholder="Describe the error, if you know it..."
          rows={3}
        />

        <button
          onClick={handleSuggestFix}
          disabled={suggesting}
        >
          {suggesting ? "Suggesting Fix..." : "Suggest Fix"}
        </button>

        {suggestFixError && (
          <div className="result" role="alert">
            <h2>Error</h2>
            <p>{suggestFixError}</p>
          </div>
        )}

        {suggestion && (
          <div className="result" aria-live="polite">
            <h2>Suggested Fix</h2>
            <div className="explanation">
              {renderMarkdown(suggestion, "suggestion")}
            </div>
          </div>
        )}

        {copyError && (
          <p className="copy-error" role="alert">
            {copyError}
          </p>
        )}
      </section>
    </main>
  );
}

export default App;
