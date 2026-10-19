# AI Developer Assistant

A full-stack web app that helps developers **understand code**, **analyze programming errors**, and **get suggested code fixes**, powered by the Google Gemini API.

The project is two independent apps in one repo: a **React** frontend and a **Node + Express** backend. There is no database and no shared code. The backend is stateless, and the frontend keeps the conversation history in the browser.

---

## Features

- **Explain Code** - paste code and get a beginner-friendly, step-by-step explanation.
- **Analyze Error** - paste an error message (and optionally the related code) to learn what went wrong and how to fix it.
- **Suggest Fix** - get corrected code with a structured answer: problem, corrected code, explanation and assumptions.
- **Tabbed interface** - switch between the three tools; each tab keeps its own input while you switch.
- **Per-tool conversation history** - each tab shows only its own history, with a count badge on every tab.
- **History tools** - view, delete, or clear saved responses. The last 50 items are stored in `localStorage`.
- **Markdown responses** - AI output is rendered as Markdown, with a language label and a **Copy Code** button on code blocks.
- **Light and dark theme** - follows your operating system setting.
- **Keyboard friendly** - `Ctrl/Cmd + Enter` submits, tabs support arrow-key navigation, and ARIA roles are in place.
- **Responsive and full-width layout** - works on desktop and mobile.

---

## Tech Stack

| Layer    | Technology                                                   |
| -------- | ------------------------------------------------------------ |
| Frontend | Vite, React 19, TypeScript, react-markdown                   |
| Backend  | Node.js, Express 5 (CommonJS), cors, dotenv                  |
| AI       | Google Gemini API via the `@google/genai` SDK                |
| Storage  | Browser `localStorage` (no database)                         |
| Tooling  | ESLint (react-hooks), nodemon (backend dev)                  |

---

## Architecture

```
┌──────────────────────────────┐        HTTP JSON (CORS)        ┌───────────────────────────────┐
│  FRONTEND (Vite + React 19)  │ ─────────────────────────────► │  BACKEND (Node + Express 5)   │
│  http://localhost:5173       │ ◄───────────────────────────── │  http://localhost:5000        │
│                              │                                │                               │
│  • Tabs UI, forms, history   │   POST /api/explain            │  • Input validation           │
│  • localStorage persistence  │   POST /api/analyze-error      │  • Prompt construction        │
│  • Markdown + copy buttons   │   POST /api/suggest-fix        │  • Gemini API calls + retries │
└──────────────────────────────┘                                └───────────────┬───────────────┘
                                                                                │ HTTPS
                                                                                ▼
                                                                ┌───────────────────────────────┐
                                                                │   Google Gemini API           │
                                                                │   (@google/genai SDK)         │
                                                                └───────────────────────────────┘
```

---

## Project Structure

```
ai-developer-assistant/
├── backend/
│   ├── server.js          # Entire backend (single file, CommonJS)
│   ├── package.json
│   └── .env               # GEMINI_API_KEY (never committed)
└── frontend/
    ├── index.html
    ├── vite.config.ts
    ├── package.json
    └── src/
        ├── main.tsx       # React root (StrictMode)
        ├── App.tsx        # UI, state and API calls
        ├── App.css        # Component styles
        └── index.css      # Reset and base styles
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer
- npm
- A Google Gemini API key from [Google AI Studio](https://aistudio.google.com/)

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/ai-developer-assistant.git
cd ai-developer-assistant
```

### 2. Set up the backend

```bash
cd backend
npm install
```

Create a `backend/.env` file:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Start the server (port **5000**):

```bash
npm run dev
```

### 3. Set up the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

### Build the frontend for production

```bash
cd frontend
npm run build
```

The backend has no build step.

---

## API Reference

Base URL: `http://localhost:5000`

All errors return JSON in the shape `{ "error": "message" }`.

| Method | Endpoint             | Request body                      | Success response        | Notes                                                        |
| ------ | -------------------- | --------------------------------- | ----------------------- | ------------------------------------------------------------ |
| GET    | `/api/health`        | -                                 | `{ status, message }`   | Uptime check                                                 |
| POST   | `/api/explain`       | `{ code }`                        | `{ explanation }`       | Beginner-friendly, step-by-step explanation                  |
| POST   | `/api/analyze-error` | `{ errorMessage, code? }`         | `{ analysis }`          | Retries up to 3 times on 429/503 with backoff (2s, 4s)       |
| POST   | `/api/suggest-fix`   | `{ code, errorMessage? }`         | `{ suggestion }`        | Structured: Problem, Corrected code, Explanation, Assumptions |
| GET    | `/api/models`        | -                                 | `{ models: [] }`        | Debug: lists Gemini models that support `generateContent`    |

### Status codes

| Code | Meaning                                         |
| ---- | ----------------------------------------------- |
| 400  | Invalid or empty input                          |
| 429  | Gemini rate limit / quota exceeded              |
| 500  | Missing API key or unexpected server error      |
| 502  | Gemini returned an empty response               |
| 503  | Gemini service temporarily unavailable          |

### Example request

```bash
curl -X POST http://localhost:5000/api/explain \
  -H "Content-Type: application/json" \
  -d '{"code": "function multiply(a, b) { return a * b; }"}'
```

---

## How It Works

1. The user enters code or an error in one of the three tabs.
2. The frontend sends a JSON `POST` request to the matching backend endpoint.
3. The backend validates the input, builds a prompt and calls the Gemini API.
4. The response comes back as JSON, and the frontend renders it as Markdown with copyable code blocks.
5. Successful responses are saved to `localStorage` under the key `ai-developer-assistant-history` (up to 50 items) and appear in that tool's history list.

On page load, saved history is parsed and validated, and any corrupt or old-format data is silently dropped.

---

## Known Limitations

- **Hardcoded API URL** - the frontend calls `http://localhost:5000` directly (no Vite proxy or env variable). A production deployment needs a configurable base URL or a reverse proxy.
- **Browser-only history** - there is no database or login, so history belongs to one browser and is lost if site data is cleared.
- **Single-component frontend** - `App.tsx` holds all state and UI. It is easy to follow now, but it would benefit from being split into smaller components as it grows.
- **Retries on one route only** - only `/api/analyze-error` retries on 429/503. The other AI routes make a single attempt.
- **String-matching error handling** - Gemini errors are detected by their message text, which could break if the SDK changes its wording.
- **Open CORS** - the backend allows all origins for local development. Restrict this before deploying.
- **Request size limit** - request bodies are capped at 100 KB.

---

## Roadmap Ideas

- Move the API base URL into a Vite environment variable (`VITE_API_URL`)
- Split `App.tsx` into components (tabs, history, markdown renderer)
- Add retries to all AI endpoints
- Add streaming responses
- Add syntax highlighting for code blocks
- Add optional user accounts with server-side history
- Add automated tests for the backend routes and frontend components

---

## Security Notes

- Never commit your `.env` file. Make sure `.gitignore` contains `.env` and `node_modules/`.
- Keep your Gemini API key on the backend only. It is never exposed to the browser.

---

## Author

Built by **<your-name>** - [GitHub](https://github.com/NagSahithiVemavarapu)
