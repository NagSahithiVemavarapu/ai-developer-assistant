
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

app.get("/api/health", (req, res) => {
  res.json({
    status: "success",
    message: "Backend is running",
  });
});

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

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Explain this code in simple beginner-friendly language. Describe what it does step by step.

Code:
${code}`,
    });

    res.json({
      explanation: response.text,
    });
  
} catch (error) {
  console.error("Gemini request failed:", error.message);

  const errorMessage = error.message || "";

  if (
    errorMessage.includes('"code":503') ||
    errorMessage.includes("UNAVAILABLE")
  ) {
    return res.status(503).json({
      error: "Gemini is temporarily busy. Please wait a few seconds and try again.",
    });
  }

  res.status(500).json({
    error: "Gemini could not explain the code. Please try again later.",
  });
}

});


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

    if (!ai) {
      return res.status(500).json({
        error: "Gemini API key is missing. Check your backend .env file.",
      });
    }

    let response;

for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `Analyze this programming error for a beginner.

Error message:
${errorMessage}

Code related to the error:
${typeof code === "string" && code.trim() ? code : "No code provided"}

Explain:
1. What the error means.
2. Why it might happen.
3. How to fix it.
4. Show corrected code if possible.

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

    console.log(`Gemini busy. Retry ${attempt + 1}/3...`);

    await new Promise((resolve) =>
      setTimeout(resolve, attempt * 2000)
    );
  }
}

res.json({
  analysis: response.text,
});

    res.json({
      analysis: response.text,
    });
  } catch (error) {
    console.error("Error analysis failed:", error.message);

    res.status(500).json({
      error: "Could not analyze the error. Please try again later.",
    });
  }
});


app.get("/api/models", async (req, res) => {
  try {
    const models = await ai.models.list();

    const availableModels = [];

    for await (const model of models) {
      if (model.supportedActions?.includes("generateContent")) {
        availableModels.push(model.name);
      }
    }

    res.json({ models: availableModels });
  } catch (error) {
    console.error("Model listing failed:", error.message);
    res.status(500).json({
      error: "Could not list models. Check the backend terminal.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
