# Conseal — Redaction Review (PS1 prototype)

A single-document, single-screen prototype for **Problem 1: Trust &
Explainability**. Every redaction decision (and every kept-visible decision)
is clickable and explained. A confidence threshold slider lets the reviewer
calibrate trust live.

Built from `Conseal_PS1_Development_Blueprint.md` in the repo root.

---

## Stack

| Layer    | Choice                         |
| -------- | ------------------------------ |
| Frontend | React + Vite + Tailwind        |
| Backend  | FastAPI                        |
| Data     | Static JSON (`mock_data.json`) |

No database, no auth, no live LLM call — see `WRITEUP.md` for what was
deliberately left out and why.

---

## Run locally (under 5 minutes)

You need Python 3.10+ and Node 18+.

**Terminal 1 — backend:**

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

**Terminal 2 — frontend:**

```bash
cd frontend
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. The Vite dev server proxies `/api/*` to the
FastAPI backend on port 8000.

---

## API

| Method | Route                  | Description                             |
| ------ | ---------------------- | --------------------------------------- |
| GET    | `/api/document`        | Returns document text + all PII spans   |
| GET    | `/api/spans/{span_id}` | Returns the full record for one span    |
| GET    | `/api/health`          | Health check (returns `{status: ok}`)   |

FastAPI's auto-generated docs are at <http://127.0.0.1:8000/docs>.

---

## Regenerating mock data

Span offsets are computed from the document text by a one-shot script:

```bash
cd backend
python generate_mock.py
```

Edit the `DOC` string or the `SPANS` list in `generate_mock.py` to change
the document or the decision set.

---

## Project layout

```
conseal-ps1/
├── backend/
│   ├── main.py              # FastAPI app, two GET routes + health
│   ├── models.py            # Pydantic models: PIISpan, DocumentResponse
│   ├── generate_mock.py     # one-shot offset generator for mock_data.json
│   ├── data/
│   │   └── mock_data.json   # document_text + 14 spans
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── index.css        # Tailwind + Conseal-styled span treatments
│   │   ├── lib/spans.js     # segment builder + threshold filter
│   │   └── components/
│   │       ├── DocumentViewer.jsx
│   │       ├── SpanHighlight.jsx
│   │       ├── ExplanationPanel.jsx
│   │       ├── ConfidenceSlider.jsx
│   │       ├── ConfidenceBar.jsx
│   │       ├── ModeTag.jsx
│   │       └── Wordmark.jsx
│   ├── index.html
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── vite.config.js
│   └── package.json
├── README.md
└── WRITEUP.md
```
