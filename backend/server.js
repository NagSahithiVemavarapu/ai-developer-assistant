
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json({ limit: "100kb" }));

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// 1. Backend health check
app.get("/api/health", (req, res) => {
  return res.json({
    status: "success",
    message: "Backend is running",
  });
});

// 2. Explain Code
app.post("/api/explain", async (req, res) => {
  try {
    const { code } = req.body;

    if (typeof code !== "string" || !code.trim()) {
      return res.status(400).json({
        error: "Please provide some code to explain.",
      });
    }

    if (!ai) {
      return res.status(500).json({
        error: "Gemini API key is missing. Check your backend .env file.",
      });
    }

    const response = await ai.interactions.create({
      model: "gemini-3.8-flash",
      input: `Explain this code in simple beginner-friendly language.
Describe what it does step by step.

Code:
${code}`,
    });

    if (!response.output_text) {
      return res.status(502).json({
        error: "Gemini returned an empty response. Please try again.",
      });
    }

    return res.json({
      explanation: response.output_text,
    });
  } catch (error) {
    console.error("Gemini request failed:", error.message);

    const message = error.message || "";

    if (
      message.includes('"code":503') ||
      message.includes("UNAVAILABLE")
    ) {
      return res.status(503).json({
        error: "Gemini is temporarily busy. Please try again shortly.",
      });
    }

    if (
      message.includes('"code":429') ||
      message.includes("RESOURCE_EXHAUSTED")
    ) {
      return res.status(429).json({
        error: "Gemini request limit reached. Please wait and try again.",
      });
    }

    return res.status(500).json({
      error: "Gemini could not explain the code. Please try again later.",
    });
  }
});

// 3. Analyze Programming Errors
app.post("/api/analyze-error", async (req, res) => {
  try {
    const { errorMessage, code } = req.body;

    if (
      typeof errorMessage !== "string" ||
      !errorMessage.trim()
    ) {
      return res.status(400).json({
        error: "Please provide an error message.",
      });
    }

    if (
      code !== undefined &&
      typeof code !== "string"
    ) {
      return res.status(400).json({
        error: "The related code must be a string.",
      });
    }

    if (!ai) {
      return res.status(500).json({
        error: "Gemini API key is missing. Check your backend .env file.",
      });
    }

    let response;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await ai.interactions.create({
          model: "gemini-3.8-flash",
          input: `Analyze this programming error for a beginner.

Error message:
${errorMessage}

Code related to the error:
${
  typeof code === "string" && code.trim()
    ? code
    : "No code provided"
}

Explain:
1. What the error means.
2. Why it might happen.
3. How to fix it.
4. Show corrected code in a fenced code block if possible.

If information is insufficient, explain what is missing.`,
        });

        break;
      } catch (error) {
        const message = error.message || "";

        const isTemporary =
          message.includes('"code":503') ||
          message.includes("UNAVAILABLE") ||
          message.includes('"code":429') ||
          message.includes("RESOURCE_EXHAUSTED");

        if (!isTemporary || attempt === 3) {
          throw error;
        }

        console.log(
          `Gemini busy. Retry ${attempt + 1}/3...`
        );

        await new Promise((resolve) =>
          setTimeout(resolve, attempt * 2000)
        );
      }
    }

    if (!response || !response.output_text) {
      return res.status(502).json({
        error: "Gemini returned an empty response. Please try again.",
      });
    }

    return res.json({
      analysis: response.output_text,
    });
  } catch (error) {
    console.error("Error analysis failed:", error.message);

    const message = error.message || "";

    if (
      message.includes('"code":503') ||
      message.includes("UNAVAILABLE")
    ) {
      return res.status(503).json({
        error: "Gemini is temporarily busy. Please try again shortly.",
      });
    }

    if (
      message.includes('"code":429') ||
      message.includes("RESOURCE_EXHAUSTED")
    ) {
      return res.status(429).json({
        error: "Gemini request limit reached. Please wait and try again.",
      });
    }

    return res.status(500).json({
      error: "Could not analyze the error. Please try again later.",
    });
  }
});

// 4. Suggest a Code Fix
app.post("/api/suggest-fix", async (req, res) => {
  try {
    const { code, errorMessage } = req.body;

    if (typeof code !== "string" || !code.trim()) {
      return res.status(400).json({
        error: "Please provide the code you want to fix.",
      });
    }

    if (
      errorMessage !== undefined &&
      typeof errorMessage !== "string"
    ) {
      return res.status(400).json({
        error: "The error message must be a string.",
      });
    }

    if (!ai) {
      return res.status(500).json({
        error: "Gemini API key is missing. Check your backend .env file.",
      });
    }

    const response = await ai.interactions.create({
      model: "gemini-3.8-flash",
      input: `You are a helpful programming assistant for beginners.

Analyze the supplied code and error message.

Follow this response format:

## 1. Problem Identified
Explain what is wrong and why the error occurs.

## 2. Corrected Code
Provide the complete corrected code inside a fenced code block.
Specify the programming language after the opening backticks,
for example, javascript or python.

## 3. Beginner-Friendly Explanation
Explain the changes in simple language.

## 4. Assumptions or Missing Information
Mention assumptions or alternative fixes when relevant.

Important instructions:
- Keep the corrected code separate from the explanation.
- The code block must contain only the corrected code, without explanatory text.
- Preserve the original program's intended behavior where possible.
- If there are multiple valid fixes, choose a reasonable default and explain alternatives.
- Do not claim that the code was tested or executed.
- If the cause is uncertain, clearly explain the uncertainty.

Code to fix:
${code}

Error message:
${
  typeof errorMessage === "string" && errorMessage.trim()
    ? errorMessage
    : "No error message provided."
}`,
    });

    if (!response.output_text) {
      return res.status(502).json({
        error: "Gemini returned an empty response. Please try again.",
      });
    }

    return res.json({
      suggestion: response.output_text,
    });
  } catch (error) {
    console.error("Code fix suggestion failed:", error.message);

    const message = error.message || "";

    if (
      message.includes('"code":503') ||
      message.includes("UNAVAILABLE")
    ) {
      return res.status(503).json({
        error: "Gemini is temporarily busy. Please try again shortly.",
      });
    }

    if (
      message.includes('"code":429') ||
      message.includes("RESOURCE_EXHAUSTED")
    ) {
      return res.status(429).json({
        error: "Gemini request limit reached. Please wait and try again.",
      });
    }

    return res.status(500).json({
      error: "Could not suggest a code fix. Please try again later.",
    });
  }
});

// 5. List available Gemini models (debug endpoint)
app.get("/api/models", async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({
        error: "Gemini API key is missing. Check your backend .env file.",
      });
    }

    const models = await ai.models.list();
    const availableModels = [];

    for await (const model of models) {
      if (model.supportedActions?.includes("generateContent")) {
        availableModels.push(model.name);
      }
    }

    return res.json({
      models: availableModels,
    });
  } catch (error) {
    console.error("Model listing failed:", error.message);

    return res.status(500).json({
      error: "Could not list models. Check the backend terminal.",
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
