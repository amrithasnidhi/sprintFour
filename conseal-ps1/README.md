# Conseal — PII Redaction Review (PS1 Prototype)

A single-document redaction review prototype built for **SprintFour Hackathon — Problem Statement 1: Trust and Explainability**. Every detection decision — both what was hidden and what was deliberately kept visible — is clickable and explained with full reasoning and a calibrated confidence score. A live threshold slider lets the reviewer adjust the precision-recall trade-off in real time.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Detection Pipeline](#detection-pipeline)
- [Decision Modes](#decision-modes)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [API Reference](#api-reference)
- [Frontend Components](#frontend-components)
- [Configuration](#configuration)
- [Design Decisions](#design-decisions)

---

## Overview

Conseal addresses the core trust problem in AI-assisted document workflows: when an AI redacts sensitive information, there is no visibility into why specific decisions were made, which decisions the model was uncertain about, or what was left in the document and why.

The prototype solves this by making every span interactive. Clicking any highlighted token in the document switches the panel to show the detection method (rule-matched or heuristic-judged), the confidence score with a visual bar, the PII type, the treatment applied, and the plain-English reasoning. Spans that were scanned and deliberately left unredacted appear in a Cleared panel with the same level of explanation.

The confidence threshold slider re-evaluates all spans client-side in real time, so a reviewer can tighten or loosen the redaction boundary and immediately see what changes.

---

## Architecture

```
Browser  <---->  Vite (5173)  <--[proxy /api/*]-->  FastAPI (8002)
                                                          |
                                              +-----------+-----------+
                                              |                       |
                                         extraction.py          detection/
                                     (PDF, DOCX, TXT)       rule_layer.py
                                                            judgment_layer.py
                                                              merge.py
```

| Layer     | Technology                                              | Version    |
|-----------|---------------------------------------------------------|------------|
| Frontend  | React, Vite, Tailwind CSS                               | 18, 5, 3   |
| 3D / WebGL| Three.js, @react-three/fiber, @react-three/postprocessing| 0.168, 8, 2|
| Animation | GSAP                                                    | 3          |
| Backend   | FastAPI, Uvicorn                                        | 0.115, 0.30|
| Parsing   | pdfplumber (PDF), python-docx (DOCX)                   | 0.11, 1.1  |
| Validation| Pydantic v2                                             | 2.9        |

No database, no authentication, no live LLM call. All detection runs in Python on the uploaded document. The only persistent state is an in-memory session dictionary that holds the most recently processed document so the `/api/spans/{id}` route can serve individual span lookups without re-running detection.

---

## Detection Pipeline

Detection runs in two sequential stages followed by a merge step. The two-stage design separates high-confidence deterministic detection from lower-confidence heuristic detection, allowing the confidence scores to be honest about what each method actually guarantees.

### Stage 1 — Rule Layer (`detection/rule_layer.py`)

Regex-based deterministic detectors. These patterns match precisely defined formats and carry confidence scores of 0.95–1.00. All matches are tagged `rule_matched`.

| Detector | Pattern | Confidence | Treatment |
|---|---|---|---|
| EMAIL | Standard address + partial `@domain` without TLD (common in PDF extraction) | 0.97–0.99 | redact |
| PHONE_NUMBER | US format `(XXX) XXX-XXXX` and Indian `+91 XXXXX XXXXX` | 0.99 | redact |
| SSN | `XXX-XX-XXXX` | 1.00 | redact |
| MRN | Medical record number patterns | 0.97 | redact |
| NPI | 10-digit National Provider Identifier | 0.97 | redact |
| HIPAA | HIPAA section references | 0.97 | kept_visible |
| CREDIT_CARD | 13–19 digit card numbers with Luhn-like grouping | 0.99 | redact |
| POLICY_NUMBER | Insurance policy number formats | 0.97 | redact |
| DATE / DATE_OF_BIRTH | ISO dates, written dates, labelled DOB | 0.95–0.99 | redact |
| ACADEMIC_SCORE | Labelled CGPA/GPA values and labelled percentage strings | 0.45 | kept_visible |
| PROFILE_URL | `github.com/<handle>` and `linkedin.com/in/<handle>` | 0.98 | anonymize |
| SOCIAL_HANDLE | Kebab-case handles with 3+ hyphens and a digit; plain username after PDF bullet | 0.82–0.85 | anonymize |

### Stage 2 — Judgment Layer (`detection/judgment_layer.py`)

Heuristic detectors for unstructured PII that cannot be matched with a precise regex. Confidence scores are intentionally softer (0.35–0.90) and all matches are tagged `heuristic_judged`. The lower confidence range is a design choice: it accurately represents that these are educated guesses, not certifications.

| Detector | Strategy | Confidence |
|---|---|---|
| PERSON_NAME (all-caps header) | All-caps first-middle-last on its own line, e.g. `AMRITHA S NIDHI` | 0.83 |
| PERSON_NAME (titled) | Title prefix (`Dr.`, `Mr.`, `Prof.`) followed by name words | 0.80–0.90 |
| PERSON_NAME (generic) | Consecutive title-case words scored against a `_NON_NAME` exclusion set | 0.40–0.95 |
| LOCATION | Gazetteer lookup covering US cities, countries, Indian states and cities | 0.55 |
| ADDRESS | Street number + name + type on a single line (no cross-line matching) | 0.70 |
| HEALTHCARE_FACILITY | Capitalized words ending in Hospital/Clinic/Medical Center/etc. | 0.75 |
| HEALTH_INFO | Medical specialty and condition keyword list | 0.65–0.80 |
| MARITAL_STATUS | Relationship status keyword list | 0.60 |
| ETHNICITY | Ethnicity and nationality keyword list | 0.60 |
| ORGANIZATION | Lines starting with an org name and ending with a month-year date (resume format) | 0.88 |
| ORGANIZATION (edu) | Capitalized phrase ending with University/College/School/Institute/Vidyapeetham | 0.83 |
| PROJECT_NAME | Text before a resume pipe separator `|` or before `— GitHub` / `– GitHub` | 0.85 |

**Name scoring detail.** The generic name heuristic starts every candidate at a base score of 0.60. It adds 0.20 if a title cue precedes the phrase, and subtracts 0.25 for each word in the phrase that matches the `_NON_NAME` frozenset (approximately 130 terms covering CS/tech vocabulary, resume structural words, educational institution terms, Indian geography, and common English function words). A final score below 0.40 is dropped entirely. A score of 0.40–0.61 is emitted as `kept_visible`. A score of 0.62 or above is emitted as `redacted`.

### Merge (`detection/merge.py`)

The merge step deduplicates and resolves overlapping spans from both stages. Spans are sorted by start position ascending, then length descending, then priority (rule > judgment) descending. Any span whose character range is fully contained within an already-accepted span is discarded. This ensures that when a rule detector and a judgment detector find the same text, the rule match wins.

---

## Decision Modes

Each span carries a decision and a mode that together determine how it is rendered in the document.

| Decision | Mode | Visual treatment | Use case |
|---|---|---|---|
| `redacted` | `redact` | Solid black block; original text hidden | Phone numbers, SSNs, email addresses — permanently removed |
| `redacted` | `anonymize` | Monospace pill token e.g. `[PERSON_1]` with solid border for rule-matched, dashed for heuristic | Names, organizations, project names — recoverable via token map |
| `kept_visible` | `None` | Original text with dotted blue underline | Locations, academic scores — scanned and deliberately left in |

The confidence threshold slider re-applies thresholds client-side: raising the threshold promotes `kept_visible` spans to `redacted` if their confidence exceeds the new value, or demotes `redacted` spans back to `kept_visible` if their confidence falls below it. Spans whose confidence is always above 0.90 remain redacted at any threshold.

---

## Project Structure

```
conseal-ps1/
|
+-- backend/
|   +-- main.py                 FastAPI app, four routes, in-memory session
|   +-- models.py               Pydantic models: PIISpan, DocumentResponse
|   +-- extraction.py           Text extraction for .txt / .docx / .pdf
|   +-- generate_mock.py        One-shot script to regenerate data/mock_data.json
|   +-- sample_doc.txt          Built-in sample document (medical record)
|   +-- requirements.txt        Python dependencies
|   +-- data/
|   |   +-- mock_data.json      Pre-generated document text + 14 spans (legacy)
|   +-- detection/
|       +-- __init__.py         Exports rule_detect, judgment_detect, merge
|       +-- rule_layer.py       Stage 1: regex detectors (deterministic)
|       +-- judgment_layer.py   Stage 2: heuristic detectors (NER stand-in)
|       +-- merge.py            Deduplication and overlap resolution
|
+-- frontend/
|   +-- index.html
|   +-- vite.config.js          Dev server on 5173, proxies /api/* to 8002
|   +-- tailwind.config.js      Design tokens: ink, accent, canvas, rule, muted
|   +-- postcss.config.js
|   +-- package.json
|   +-- src/
|       +-- App.jsx             Root: upload page + review page + all state
|       +-- main.jsx            React DOM entry point
|       +-- index.css           Tailwind base + span visual classes
|       +-- lib/
|       |   +-- spans.js        buildSegments(), applyThreshold(), tokenFor()
|       +-- components/
|           +-- Dither.jsx          Three.js Bayer-dithered wave background
|           +-- Dither.css          Canvas container sizing
|           +-- DocumentViewer.jsx  Renders document text with span highlights
|           +-- SpanHighlight.jsx   Individual span: redact block / pill / underline
|           +-- ExplanationPanel.jsx  Decision reasoning panel (right sidebar)
|           +-- ConfidenceSlider.jsx  Global threshold control
|           +-- ClearedPanel.jsx      Kept-visible spans audit list
|           +-- ConfidenceBar.jsx     Visual confidence indicator
|           +-- ModeTag.jsx           Redact / anonymize badge
|           +-- Wordmark.jsx          Con[seal] logotype
|           +-- ScrollReveal.jsx      GSAP scroll-animated text
|           +-- ScrollReveal.css
|           +-- TargetCursor.jsx      Custom cursor with parallax
|           +-- TargetCursor.css
|           +-- FileUpload.jsx        (unused stub)
|
+-- README.md
+-- WRITEUP.md
```

---

## Prerequisites

- Python 3.10 or higher
- Node.js 18 or higher
- npm 9 or higher

The backend has no native binary dependencies. PDF extraction uses `pdfplumber` which is pure Python over `pdfminer.six`. DOCX extraction uses `python-docx`.

---

## Local Setup

Clone the repository, then open two terminal sessions.

**Terminal 1 — backend**

```bash
cd conseal-ps1/backend
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8002
```

The server starts at `http://127.0.0.1:8002`. FastAPI's interactive docs are at `http://127.0.0.1:8002/docs`.

**Terminal 2 — frontend**

```bash
cd conseal-ps1/frontend
npm install --legacy-peer-deps
npm run dev
```

Open `http://localhost:5173` in the browser. The Vite dev server proxies all `/api/*` requests to `127.0.0.1:8002` automatically — no CORS configuration is needed in the browser.

**Note on `--legacy-peer-deps`.** The Three.js rendering stack (`@react-three/fiber`, `@react-three/postprocessing`, `postprocessing`) has peer dependency declarations that conflict with npm 9's strict resolution. The flag tells npm to use the legacy resolution algorithm. The installed versions are fully compatible at runtime.

**Supported file types for upload**: `.txt`, `.docx`, `.pdf` (maximum 5 MB).

---

## API Reference

All routes are prefixed `/api`. The backend returns JSON; errors follow FastAPI's default `{"detail": "..."}` shape.

### POST /api/process

Upload a document and run the full two-stage detection pipeline.

**Request**: multipart/form-data with a `file` field.

**Response**:

```json
{
  "document_text": "string",
  "spans": [
    {
      "id": "span_1",
      "text": "john.doe@example.com",
      "start": 42,
      "end": 62,
      "type": "EMAIL",
      "decision": "redacted",
      "mode": "redact",
      "detection_method": "rule_matched",
      "confidence": 0.99,
      "reason": "string"
    }
  ]
}
```

**Error codes**: 413 (file too large), 415 (unsupported type), 422 (extraction failed).

---

### GET /api/sample

Process the built-in sample document (`sample_doc.txt`, a synthetic medical record) without uploading a file. Returns the same shape as `/api/process`. Useful as a demo fallback when no document is available.

---

### GET /api/spans/{span_id}

Return a single span from the most recently processed document by its `id` field (e.g. `span_1`).

**Error codes**: 404 if the ID does not exist in the current session.

---

### GET /api/health

Returns `{"status": "ok"}` with HTTP 200. Used for liveness checks.

---

## Frontend Components

### App.jsx

Root component. Owns all application state: document text, raw spans, selected span ID, confidence threshold, active tab (`document` or `audit`), and page status (`upload`, `loading`, `uploading`, `error`, `ready`).

Contains two top-level screens: `UploadPage` (the dark Dither landing page) and `ReviewPage` (the two-column document review interface). State never crosses screens except via the transition to `ready`.

The `handleSelectSpan` function sets the selected span ID and simultaneously switches the sidebar to the Explanation tab, so clicking a token in the document always reveals its reasoning without a manual tab switch.

### DocumentViewer.jsx

Renders the full document as a sequence of plain text segments and highlighted span tokens. Calls `buildSegments(text, spans)` from `lib/spans.js` to split the document string into alternating text and span segments, then renders each with `SpanHighlight` or a plain `<span>`.

### SpanHighlight.jsx

Renders a single span in one of three visual treatments based on `effectiveDecision` and `effectiveMode`:

- `redact`: solid dark block with a lock icon; the original text still occupies its width to prevent layout shift.
- `anonymize`: monospace pill showing the recoverable token (`[TYPE_N]`); solid border for `rule_matched`, dashed border for `heuristic_judged`.
- `kept_visible`: original text with a dotted blue underline.

All three variants are keyboard-accessible (`role="button"`, `tabIndex={0}`, Enter/Space triggers selection).

### ExplanationPanel.jsx

Right-sidebar panel shown when a span is selected. Displays a gradient header with the detection method tag, then the PII type badge, the treatment mode, the span text with its token (or redacted length), a visual confidence bar, and the plain-English reasoning string from the backend. If the confidence threshold has changed the original decision, a footer row explains the override.

Shows an empty state with a search icon when no span is selected.

### ConfidenceSlider.jsx

Global threshold control. The slider range is 0–100 (mapped to 0.0–1.0 confidence). Moving it calls `setThreshold` in App, which recomputes `effectiveDecision` and `effectiveMode` for every span via `applyThreshold()` in `lib/spans.js`. The count of currently redacted items updates live.

### ClearedPanel.jsx

Lists all spans whose `effectiveDecision` is `kept_visible`. Each row shows the original text, PII type, detection method suffix, and confidence percentage. Clicking a row selects the span and switches to the Explanation tab.

### Dither.jsx

Three.js WebGL component rendering a Bayer-matrix ordered dithering effect over a fractal Brownian motion wave shader. Used as the full-screen animated background on the upload/landing page. Mouse position is passed as a uniform to the fragment shader so the wave responds to cursor movement.

Requires `@react-three/fiber ^8.18.0` (React 18 compatible). Version 9 of that package requires React 19 and will produce a blank page.

### lib/spans.js

Contains three exported functions:

- `buildSegments(text, spans)` — splits a document string and a sorted span array into an ordered list of `{kind: 'text', text}` and `{kind: 'span', span}` segments for rendering.
- `applyThreshold(span, threshold)` — returns a new span object with `effectiveDecision` and `effectiveMode` set according to the threshold. Spans with confidence below the threshold are demoted to `kept_visible`; spans with confidence at or above it retain their original decision.
- `tokenFor(span)` — returns the anonymization token string, e.g. `[PERSON_1]`, based on the span type and ID.

---

## Configuration

### Backend port

The backend runs on port 8002 by default. To change it, update both the uvicorn start command and the Vite proxy target in `frontend/vite.config.js`:

```js
proxy: {
  '/api': 'http://127.0.0.1:8002',
},
```

### File size limit

Defined in `backend/main.py`:

```python
MAX_FILE_BYTES = 5 * 1024 * 1024  # 5 MB
```

### Design tokens

Defined in `frontend/tailwind.config.js`:

| Token | Value | Usage |
|---|---|---|
| `ink` | `#0F172A` | Primary text |
| `accent` | `#2563EB` | Brand blue, interactive elements |
| `accent-soft` | `#EEF2FF` | Accent backgrounds |
| `canvas` | `#F8FAFC` | Page background |
| `rule` | `#E2E8F0` | Hairline borders |
| `muted` | `#64748B` | Secondary text |

The upload/landing page overrides these with inline dark styles (`#06091a` background) to support the Dither wave effect, which requires a dark canvas for the retro dither pattern to be visible.

### Regenerating mock data

The `data/mock_data.json` file contains a pre-generated document and 14 spans used as a legacy fallback. To regenerate it after editing the sample document:

```bash
cd backend
python generate_mock.py
```

---

## Design Decisions

**Why two stages instead of one.** Regex patterns for structured PII (email, phone, SSN) are essentially perfect detectors — there is no benefit in giving them soft confidence scores. Heuristics for names and locations are genuinely uncertain. Separating them makes the confidence scores honest: a 0.99 on an email match means something different from a 0.60 on a name match, and the reviewer can see that difference.

**Why the threshold slider operates on the client.** Re-running the backend pipeline on every threshold change would add 200–500ms latency for a purely display-layer operation. All span data is already in the browser after the initial upload; `applyThreshold()` re-evaluates it synchronously in under a millisecond.

**Why ACADEMIC_SCORE is kept_visible.** GPA and percentage scores are performance data, not personal identifiers. An AI processing a resume needs the score to remain visible to evaluate the candidate. Redacting it would degrade the utility of the downstream AI output without meaningfully protecting privacy.

**Why phone and email are permanently redacted rather than anonymized.** A phone number or email in a recoverable token (`[PHONE_1]`) is still a re-identification risk if the token map is exposed. These values have no utility for a downstream AI analyzing document structure; they are pure contact information that should be removed entirely.

**Why LOCATION is kept_visible.** City and state names are low-entropy identifiers on their own. They are useful context for an AI analyzing a document. The reviewer can always raise the threshold to redact them if the document is particularly sensitive.

**Why Three.js requires `--legacy-peer-deps`.** `@react-three/fiber` v9 targets React 19. This project uses React 18. Using v8.18 resolves the conflict; the package's peer dependency declaration is `>=18 <19`, which is an exact match.
