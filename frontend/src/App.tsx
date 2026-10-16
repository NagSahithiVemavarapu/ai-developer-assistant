
import { useState } from "react";
import "./App.css";
import ReactMarkdown from "react-markdown";

function App() {
  const [code, setCode] = useState("");
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  async function handleExplain() {
    if (!code.trim()) {
      setError("Please paste some code first.");
      setExplanation("");
      return;
    }

    setLoading(true);
    setError("");
    setExplanation("");

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
        throw new Error(data.error || "Failed to explain code.");
      }

      setExplanation(data.explanation);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  
async function handleAnalyzeError() {
  if (!errorMessage.trim()) {
    setError("Please enter an error message.");
    setAnalysis("");
    return;
  }

  setAnalyzing(true);
  setError("");
  setAnalysis("");

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
      throw new Error(data.error || "Failed to analyze error.");
    }

    setAnalysis(data.analysis);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Something went wrong."
    );
  } finally {
    setAnalyzing(false);
  }
}


  return (
    <main className="container">
      <h1>AI Developer Assistant</h1>
      <p className="subtitle">
        Understand code, debug errors, and improve your development skills.
      </p>

      <section className="card">
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

        {error && (
          <div className="result" role="alert">
            <h2>Error</h2>
            <p>{error}</p>
          </div>
        )}

        {explanation && (
          <div className="result" aria-live="polite">
            <h2>AI Explanation</h2>
            <pre className="explanation">{explanation}</pre>
          </div>
        )}
      </section>
      
<div className="feature-divider">
  <h2>Analyze Programming Error</h2>
  <p>Find out what went wrong and how to fix it.</p>

  <label htmlFor="error-input">Error message</label>
  <textarea
    id="error-input"
    value={errorMessage}
    onChange={(event) => setErrorMessage(event.target.value)}
    placeholder="Example: ReferenceError: x is not defined"
    rows={3}
  />

  <label htmlFor="error-code-input">Related code (optional)</label>
  <textarea
    id="error-code-input"
    value={errorCode}
    onChange={(event) => setErrorCode(event.target.value)}
    placeholder="Paste the code that caused the error..."
    rows={5}
  />

  <button onClick={handleAnalyzeError} disabled={analyzing}>
    {analyzing ? "Analyzing..." : "Analyze Error"}
  </button>

  {analysis && (
    <div className="result" aria-live="polite">
      <h2>Error Analysis</h2>
      <div className="explanation">
  <ReactMarkdown>{analysis}</ReactMarkdown>
</div>
    </div>
  )}
</div>

    </main>
  );
}

export default App;
