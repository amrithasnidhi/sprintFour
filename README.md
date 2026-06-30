# Conseal -- PII Redaction Review Prototype

**SprintFour Hackathon | Problem Statement 1: Trust and Explainability**

Built by Amritha S Nidhi (CB.SC.U4CSE23404)

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [Solution Overview](#solution-overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Detection Pipeline](#detection-pipeline)
  - [Stage 1 -- Rule Layer](#stage-1----rule-layer)
  - [Stage 2 -- Judgment Layer](#stage-2----judgment-layer)
  - [Merge Step](#merge-step)
- [Decision Modes](#decision-modes)
- [Project Structure](#project-structure)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [API Reference](#api-reference)
  - [POST /api/process](#post-apiprocess)
  - [GET /api/sample](#get-apisample)
  - [GET /api/spans/{span_id}](#get-apispansspan_id)
  - [GET /api/health](#get-apihealth)
- [Frontend Components](#frontend-components)
  - [App.jsx](#appjsx)
  - [DocumentViewer.jsx](#documentviewerjsx)
  - [SpanHighlight.jsx](#spanhighlightjsx)
  - [ExplanationPanel.jsx](#explanationpaneljsx)
  - [ConfidenceSlider.jsx](#confidencesliderjsx)
  - [ClearedPanel.jsx](#clearedpaneljsx)
  - [ConfidenceBar.jsx](#confidencebarjsx)
  - [ModeTag.jsx](#modetagjsx)
  - [Wordmark.jsx](#wordmarkjsx)
  - [Dither.jsx](#ditherjsx)
  - [ScrollReveal.jsx and TargetCursor.jsx](#scrollrevealjsx-and-targetcursorjsx)
  - [lib/spans.js](#libspansjs)
- [Configuration](#configuration)
  - [Backend Port](#backend-port)
  - [File Size Limit](#file-size-limit)
  - [Design Tokens](#design-tokens)
  - [Regenerating Mock Data](#regenerating-mock-data)
- [Design Decisions and Rationale](#design-decisions-and-rationale)
- [What Was Deliberately Left Out](#what-was-deliberately-left-out)
- [Sample Walkthrough](#sample-walkthrough)
- [Testing](#testing)
- [License](#license)

---

## Problem Statement

Marcus has a sensitive document he wants to process through an AI tool. He has heard stories of files marked as "redacted" where the sensitive content was still recoverable underneath. He will not adopt a tool he cannot interrogate. Every redaction needs a reason. Every non-redaction needs a reason too. Silence reads as a miss.

The objective is to build an interface where a real person -- not a developer -- can click on any decision Conseal made (hide or keep visible) and receive a clear, honest answer to the question: "Why this, and why not that?" The answer must be strong enough that an anxious, skeptical user would actually begin trusting the tool.

---

## Solution Overview

Conseal is a single-document redaction review prototype. It addresses the core trust problem in AI-assisted document workflows by making every span interactive. When a user uploads a document (PDF, DOCX, or plain text), the backend extracts the text, runs a two-stage PII detection pipeline (deterministic regex rules followed by heuristic judgment), merges and deduplicates the results, and returns an annotated document to the frontend.

The frontend renders the document with three distinct visual treatments for detected spans: solid black blocks for permanently redacted content, labeled tokens (such as `[PERSON_1]`) for anonymized content that is recoverable, and dotted blue underlines for content that was scanned and deliberately kept visible. Clicking any span opens an explanation panel that shows the PII type, the detection method (rule-matched or heuristic-judged), the confidence score with a visual bar, the mode (redact or anonymize), and a plain-English explanation of why the system made that decision.

A confidence threshold slider re-evaluates all spans client-side in real time, allowing the reviewer to tighten or loosen the redaction boundary and immediately see what changes. This converts trust from a binary proposition into something tunable.

---

## Key Features

1. **Inline document viewer with span highlighting.** The source text is rendered with detection decisions overlaid in context. Redacted spans appear as solid dark blocks with a lock icon (redact mode) or as labeled pills like `[NAME_1]` (anonymize mode). Kept-visible spans receive a dotted blue underline.

2. **Symmetric treatment of kept-visible content.** Content that was scanned and deliberately left visible is explained with the same seriousness as redacted content. A span that was "considered and cleared" is visually distinguished from plain text that was never flagged at all.

3. **Explanation panel.** Clicking any span opens a panel showing: PII type badge, detection method tag ("Rule-matched" with a checkmark icon or "Heuristic-judged" with a clock icon), confidence score as a visual bar, treatment mode tag, the original span text, and a one-sentence plain-language reason. Borderline confidence (below 0.5) renders in amber rather than blue.

4. **Confidence threshold slider.** A global control that re-filters the entire document live. Spans at or above the threshold are treated as redacted; spans below are kept visible. A persistent live count ("N of M items redacted") updates as the slider moves. When the threshold changes a span's effective decision, the explanation panel surfaces that change ("Conseal originally chose redacted; at your current threshold, this span is kept visible").

5. **Mode indicators.** Every redacted span carries a mode tag clarifying Conseal's guarantee -- "Redact -- permanently removed" or "Anonymize -- recoverable via map" -- which directly addresses the user's core fear of whether redacted content is truly gone.

6. **File upload with real detection.** Users can upload their own `.txt`, `.docx`, or `.pdf` files. The backend extracts text and runs the full two-stage detection pipeline against the actual uploaded content. A sample document is also available as a fallback for demos.

7. **Loading, error, and empty states.** A skeleton shimmer renders while the document loads. A dedicated error card with a retry button appears if the backend is unreachable. An empty state guides the user to click a span when no explanation is open.

8. **Accessibility.** All span treatments are keyboard-accessible with `role="button"`, `tabIndex={0}`, and Enter/Space key handlers. The explanation panel uses `aria-live="polite"` for screen reader announcements.

---

## Architecture

```
Browser  <---->  Vite Dev Server (port 5173)  <--[proxy /api/*]-->  FastAPI (port 8002)
                                                                       |
                                                          +------------+------------+
                                                          |                         |
                                                     extraction.py           detection/
                                                   (PDF, DOCX, TXT)       rule_layer.py
                                                                          judgment_layer.py
                                                                            merge.py
```

The system consists of two processes running locally:

- **Frontend:** A React 18 single-page application served by the Vite development server on port 5173. All `/api/*` requests are proxied to the backend. No CORS configuration is required in the browser during development.

- **Backend:** A FastAPI application served by Uvicorn on port 8002. It receives uploaded files, extracts their text content, runs the two-stage detection pipeline, and returns JSON responses containing the document text and annotated spans. An in-memory session dictionary holds the most recently processed document so the `/api/spans/{id}` route can serve individual span lookups without re-running detection.

There is no database, no authentication layer, no live LLM call, and no persistent storage. The uploaded file and its extracted text and spans live only in memory for the duration of the session. This is a deliberate architectural choice: every component that does not directly serve the trust experience was excluded to focus the entire build on the thing being judged.

---

## Detection Pipeline

Detection runs in two sequential stages followed by a merge step. The two-stage design separates high-confidence deterministic detection from lower-confidence heuristic detection, which allows the confidence scores to be honest about what each method actually guarantees. This honesty about uncertainty is itself part of the trust story for the user.

### Stage 1 -- Rule Layer

Located in `conseal-ps1/backend/detection/rule_layer.py`.

The rule layer uses deterministic regex patterns. Each match carries a confidence score of 0.95--1.00 because the logic is exact-match, not probabilistic. All matches are tagged with `detection_method: "rule_matched"`. The reason strings explain what matched, why it is PII, and what the mode guarantees.

| Detector | Pattern Description | Confidence | Decision | Mode |
|---|---|---|---|---|
| EMAIL | Standard `local@domain.tld` format, plus a fallback for emails missing the TLD (common in PDF extraction) when the provider is a known name (gmail, outlook, etc.) | 0.97--0.99 | redacted | redact |
| PHONE_NUMBER | US format `(XXX) XXX-XXXX` and Indian mobile format `+91 XXXXX XXXXX` | 0.99 | redacted | redact |
| SSN | `XXX-XX-XXXX` with lookaheads filtering invalid SSN area numbers (000, 666, 9xx) | 1.00 | redacted | redact |
| MEDICAL_RECORD_NUMBER | `MRN` prefix followed by 5--8 digits | 0.99 | redacted | redact |
| NPI | 10-digit number adjacent to an `NPI` label | 0.95 | redacted | anonymize |
| REGULATORY_CITATION | HIPAA section references (e.g., `HIPAA S164.506`) | 0.97 | kept_visible | none |
| CREDIT_CARD | 13--19 digit card numbers with Luhn-like grouping (4 groups of 4 digits) | 0.99 | redacted | redact |
| POLICY_NUMBER | Alphanumeric patterns: 2--4 uppercase letters, hyphen, 5--10 digits, optional suffix | 0.97 | redacted | redact |
| DATE / DATE_OF_BIRTH | ISO dates, written dates (`March 14, 1978`), and contextual classification: a date preceded by a DOB label is classified as DATE_OF_BIRTH (0.98); a date preceded by an administrative label is kept visible (0.80); a date with a year more than 16 years in the past is presumed to be a birth date (0.87) | 0.72--0.99 | varies | varies |
| ACADEMIC_SCORE | CGPA/GPA values and labeled percentage strings | 0.45 | kept_visible | none |
| PROFILE_URL | `github.com/<handle>` and `linkedin.com/in/<handle>` | 0.98 | redacted | anonymize |
| SOCIAL_HANDLE | Kebab-case handles with 3+ hyphens and a digit, plus plain usernames after PDF bullet artifacts (`(cid:N)`) | 0.82--0.85 | redacted | anonymize |

**Ordering matters.** More-specific patterns (MRN, NPI, HIPAA) run before the generic POLICY_NUMBER pattern. This prevents `MRN-008473` from being incorrectly labeled as POLICY_NUMBER, since both regexes would match the same substring.

### Stage 2 -- Judgment Layer

Located in `conseal-ps1/backend/detection/judgment_layer.py`.

The judgment layer uses heuristic detectors for unstructured PII that cannot be matched with a precise regex. These are stand-ins for where a machine learning model (NER classifier, LLM-based extractor) would sit in a production pipeline. Confidence scores are intentionally softer (0.35--0.90) and all matches are tagged with `detection_method: "heuristic_judged"`. The lower confidence range is a design choice: it accurately represents that these are educated guesses, not certifications.

| Detector | Strategy | Confidence |
|---|---|---|
| PERSON_NAME (all-caps header) | All-caps first-middle-last on its own line (e.g., `AMRITHA S NIDHI`), with section header words excluded | 0.83 |
| PERSON_NAME (titled) | Title prefix (`Dr.`, `Mr.`, `Prof.`, etc.) followed by title-case name words | 0.85 |
| PERSON_NAME (all-caps titled) | All-caps title + name (e.g., `DR. SARAH CHEN`) | 0.85 |
| PERSON_NAME (generic) | Consecutive title-case words scored against a `_NON_NAME` exclusion set of approximately 130 terms covering CS/tech vocabulary, resume structural words, educational institution terms, Indian geography, and common English function words | 0.40--0.95 |
| LOCATION | Gazetteer lookup covering approximately 90 entries: US cities, international cities, countries, Indian states and cities | 0.55 |
| ADDRESS | Street number + street name + street type (Street, Ave, Blvd, etc.), optionally followed by city/state/ZIP on the same line | 0.90 |
| HEALTHCARE_FACILITY | Capitalized words ending in Hospital, Clinic, Medical Center, Health System, etc. | 0.70 |
| HEALTH_INFO | Medical specialty terms (cardiology, oncology, etc.) at 0.65 and health condition terms (diabetes, hypertension, cancer, etc.) at 0.75 | 0.65--0.75 |
| MARITAL_STATUS | Keyword list: married, single, divorced, widowed, domestic partnership | 0.35 |
| ETHNICITY | Keyword list: Hispanic, African-American, Asian-American, Pacific Islander, etc. | 0.61 |
| ORGANIZATION | Lines starting with an organization name and ending with a month-year date (resume format) | 0.88 |
| ORGANIZATION (educational) | Capitalized phrases ending with University, College, School, Institute, Vidyapeetham | 0.83 |
| PROJECT_NAME | Text before a resume pipe separator `|` or before `-- GitHub` | 0.85 |

**Name scoring detail.** The generic name heuristic starts every candidate at a base score of 0.60. It adds 0.20 if a title cue (such as "Patient:", "Dr.", or "Mr.") precedes the phrase within 40 characters. It subtracts 0.25 for each word in the phrase that matches the `_NON_NAME` frozenset. A final score below 0.40 is dropped entirely. A score between 0.40 and 0.61 is emitted as `kept_visible`. A score of 0.62 or above is emitted as `redacted` with `anonymize` mode.

### Merge Step

Located in `conseal-ps1/backend/detection/merge.py`.

The merge step deduplicates and resolves overlapping spans from both stages. The algorithm:

1. Tags each span with a priority: rule = 2, judgment = 1.
2. Sorts by start position ascending, then priority descending (rule before judgment), then length descending (longer before shorter).
3. Walks through with a cursor; accepts a span only if its start position is at or after the cursor.
4. Advances the cursor to the accepted span's end position.
5. Assigns sequential IDs (`span_1`, `span_2`, ...) in document order.

This ensures that when both the rule layer and the judgment layer flag overlapping text, the rule-layer result wins because it is exact-match and more certain.

---

## Decision Modes

Each span carries a `decision` and a `mode` that together determine how it is rendered in the document.

| Decision | Mode | Visual Treatment | Use Case |
|---|---|---|---|
| `redacted` | `redact` | Solid black block with a lock icon; original text hidden but still occupies width to prevent layout shift | Phone numbers, SSNs, email addresses, credit cards -- permanently removed with no recovery path |
| `redacted` | `anonymize` | Monospace pill token (e.g., `[PERSON_1]`) with solid border for rule-matched spans and dashed border for heuristic-judged spans | Names, organizations, project names -- recoverable via a token map |
| `kept_visible` | `null` | Original text with a dotted blue underline | Locations, academic scores, regulatory citations, demographic terms -- scanned and deliberately left in |

The confidence threshold slider re-applies thresholds on the client side. Raising the threshold demotes `redacted` spans to `kept_visible` if their confidence falls below the new value. Lowering the threshold promotes `kept_visible` spans to `redacted` if their confidence meets or exceeds the new value. Spans with very high confidence (above 0.90) remain redacted at any practical threshold.

---

## Project Structure

```
sprintFour/
|
+-- conseal-ps1/                          Main application directory
|   |
|   +-- backend/
|   |   +-- main.py                       FastAPI app: four routes, in-memory session store
|   |   +-- models.py                     Pydantic v2 models: PIISpan, DocumentResponse, ErrorResponse
|   |   +-- extraction.py                 Text extraction for .txt, .docx, .pdf files
|   |   +-- generate_mock.py              One-shot script to regenerate data/mock_data.json
|   |   +-- sample_doc.txt                Built-in sample document (synthetic medical record)
|   |   +-- requirements.txt              Python dependencies (6 packages)
|   |   +-- data/
|   |   |   +-- mock_data.json            Pre-generated document text + 14 spans (legacy fallback)
|   |   +-- detection/
|   |       +-- __init__.py               Exports: rule_detect, judgment_detect, merge
|   |       +-- rule_layer.py             Stage 1: 12 regex-based detectors (449 lines)
|   |       +-- judgment_layer.py         Stage 2: 13 heuristic detectors (711 lines)
|   |       +-- merge.py                  Overlap resolution and span ID assignment (47 lines)
|   |
|   +-- frontend/
|   |   +-- index.html                    HTML entry point with Google Fonts (Inter, JetBrains Mono)
|   |   +-- vite.config.js               Vite dev server on port 5173, proxies /api/* to port 8002
|   |   +-- tailwind.config.js            Design tokens: ink, accent, canvas, rule, muted
|   |   +-- postcss.config.js             PostCSS with Tailwind and Autoprefixer
|   |   +-- package.json                  Frontend dependencies (7 runtime, 5 dev)
|   |   +-- src/
|   |       +-- App.jsx                   Root component: upload page, review page, all state (725 lines)
|   |       +-- main.jsx                  React DOM entry point
|   |       +-- index.css                 Tailwind base + custom span visual classes
|   |       +-- lib/
|   |       |   +-- spans.js              Utility functions: buildSegments, applyThreshold, tokenFor
|   |       +-- components/
|   |           +-- DocumentViewer.jsx     Renders document text with inline span highlights
|   |           +-- SpanHighlight.jsx      Individual span: three visual treatment variants
|   |           +-- ExplanationPanel.jsx   Decision reasoning panel (right sidebar)
|   |           +-- ConfidenceSlider.jsx   Global threshold control with live redaction count
|   |           +-- ClearedPanel.jsx       Kept-visible spans audit list
|   |           +-- ConfidenceBar.jsx      Visual confidence indicator (blue/amber color coding)
|   |           +-- ModeTag.jsx            Redact/Anonymize badge with mode explanation
|   |           +-- Wordmark.jsx           Con[seal] logotype with blue chip
|   |           +-- Dither.jsx             Three.js Bayer-matrix dithered wave background
|   |           +-- Dither.css             Canvas container sizing
|   |           +-- ScrollReveal.jsx       GSAP scroll-animated text
|   |           +-- ScrollReveal.css       Scroll animation styles
|   |           +-- TargetCursor.jsx       Custom cursor with parallax effect
|   |           +-- TargetCursor.css       Cursor styles
|   |           +-- FileUpload.jsx         File upload component (unused stub)
|   |
|   +-- README.md                         Project-level README (within conseal-ps1)
|   +-- WRITEUP.md                        Build writeup: what was built, what was left out, and why
|
+-- Conseal_PS1_Development_Blueprint.md  Original development blueprint (v1)
+-- Conseal_PS1_Development_Blueprint2.md Development blueprint v2 (file upload + detection pipeline)
+-- participant.md                        Participant details
+-- test_documents/                       Additional test files for manual verification
|   +-- test_patient.txt                  Referral letter with different PII patterns
+-- .gitignore                            Ignores node_modules, __pycache__, .pyc, .env
```

---

## Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Frontend Framework | React | 18.3 | Component-based UI with local state management |
| Build Tool | Vite | 5.4 | Fast HMR development server with API proxy support |
| Styling | Tailwind CSS | 3.4 | Utility-first CSS with custom design tokens |
| 3D / WebGL | Three.js, @react-three/fiber, @react-three/postprocessing | 0.168, 8.18, 2.19 | Bayer-dithered wave background on the upload page |
| Animation | GSAP | 3.15 | Scroll-triggered text reveal animations |
| Typography | Inter, JetBrains Mono | -- | System-level sans-serif body text and monospace code/data display |
| Backend Framework | FastAPI | 0.115 | Async Python web framework with automatic OpenAPI documentation |
| ASGI Server | Uvicorn | 0.30 | Production-grade ASGI server for FastAPI |
| Data Validation | Pydantic v2 | 2.9 | Request/response schema validation with type hints |
| PDF Extraction | pdfplumber | 0.11 | Pure-Python PDF text extraction over pdfminer.six |
| DOCX Extraction | python-docx | 1.1 | Microsoft Word document paragraph and table text extraction |
| File Upload | python-multipart | 0.0.12 | Multipart form data parsing for FastAPI file uploads |

**Deliberately excluded technologies:** Relational databases, ORMs, cloud deployment platforms, caching layers, CI/CD pipelines, monitoring stacks, authentication systems, Redux/Zustand state management libraries, server-state caching libraries. None of these are proportionate to a single-document, single-session prototype.

---

## Prerequisites

- **Python 3.10** or higher
- **Node.js 18** or higher
- **npm 9** or higher

The backend has no native binary dependencies. PDF extraction uses `pdfplumber`, which is pure Python built on `pdfminer.six`. DOCX extraction uses `python-docx`, also pure Python.

---

## Local Setup

Clone the repository, then open two terminal sessions.

### Terminal 1 -- Backend

```bash
cd conseal-ps1/backend
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8002
```

The server starts at `http://127.0.0.1:8002`. FastAPI's interactive API documentation is available at `http://127.0.0.1:8002/docs` (Swagger UI) and `http://127.0.0.1:8002/redoc` (ReDoc).

### Terminal 2 -- Frontend

```bash
cd conseal-ps1/frontend
npm install --legacy-peer-deps
npm run dev
```

Open `http://localhost:5173` in the browser. The Vite dev server proxies all `/api/*` requests to `127.0.0.1:8002` automatically.

**Note on `--legacy-peer-deps`.** The Three.js rendering stack (`@react-three/fiber`, `@react-three/postprocessing`, `postprocessing`) has peer dependency declarations that conflict with npm 9's strict resolution. The flag tells npm to use the legacy resolution algorithm. The installed versions are fully compatible at runtime. Specifically, `@react-three/fiber` v8.18 declares `react ^18` as a peer dependency, which is exactly what this project uses. Version 9 of that package requires React 19 and will produce a blank page.

### Supported File Types

| Type | Extension | Extraction Method |
|---|---|---|
| Plain text | `.txt` | Direct read with encoding fallback chain: UTF-8, UTF-8-SIG, CP-1252, Latin-1 |
| Microsoft Word | `.docx` | `python-docx` paragraph and table text extraction |
| PDF | `.pdf` | `pdfplumber` page-by-page text extraction |

Maximum file size: 5 MB (configurable in `backend/main.py`).

---

## API Reference

All routes are prefixed with `/api`. The backend returns JSON. Errors follow FastAPI's default `{"detail": "..."}` shape.

### POST /api/process

Upload a document and run the full two-stage detection pipeline.

**Request:** `multipart/form-data` with a `file` field containing a `.txt`, `.docx`, or `.pdf` file.

**Response (200):**

```json
{
  "document_text": "Patient Jonathan M. Richardson was admitted...",
  "spans": [
    {
      "id": "span_1",
      "text": "Jonathan M. Richardson",
      "start": 8,
      "end": 31,
      "type": "PERSON_NAME",
      "decision": "redacted",
      "mode": "anonymize",
      "detection_method": "heuristic_judged",
      "confidence": 0.85,
      "reason": "Name immediately follows the title cue 'Patient:', a strong indicator..."
    }
  ]
}
```

**Error codes:**
- `413` -- File exceeds the 5 MB size limit.
- `415` -- Unsupported file type. Only `.txt`, `.docx`, and `.pdf` are accepted.
- `422` -- Text extraction failed (corrupt file, empty document, image-only PDF without OCR).

---

### GET /api/sample

Process the built-in sample document (`sample_doc.txt`, a synthetic medical intake form) without uploading a file. Returns the same response shape as `/api/process`. Useful as a demo fallback when no document is available or when a judge's laptop has upload friction.

---

### GET /api/spans/{span_id}

Return a single span from the most recently processed document by its `id` field (e.g., `span_1`).

**Response (200):** A single `PIISpan` object (same shape as one element of the `spans` array).

**Error codes:**
- `404` -- The span ID does not exist in the current session.

---

### GET /api/health

Returns `{"status": "ok"}` with HTTP 200. Used for liveness checks.

---

## Frontend Components

### App.jsx

Root component (725 lines). Owns all application state: document text, raw spans, selected span ID, confidence threshold, active tab (`document` or `audit`), and page status (`upload`, `loading`, `uploading`, `error`, `ready`).

Contains two top-level screens:

- **UploadPage** -- The dark-themed landing page with a Dither wave background, the "Anonymize. Work. Restore." hero text, a two-stage detection pipeline explanation card, and a drag-and-drop file upload zone. Includes loading, error, and idle states within the drop zone.

- **ReviewPage** -- The two-column document review interface. On desktop (`lg` breakpoint and above), the left column (7/12 grid) holds the DocumentViewer and the right column (5/12 grid) holds a tabbed panel switching between the ExplanationPanel and the AuditTabContent (ConfidenceSlider + ClearedPanel). On mobile, the bottom tab bar switches between the document view and the audit view.

State never crosses screens except via the transition to `ready`. The `handleSelectSpan` function sets the selected span ID and simultaneously switches the sidebar to the Explanation tab, so clicking a token in the document always reveals its reasoning without a manual tab switch.

### DocumentViewer.jsx

Renders the full document as a sequence of plain text segments and highlighted span tokens. Calls `buildSegments(text, spans)` from `lib/spans.js` to split the document string into alternating text and span segments, then renders each segment as either a plain `<span>` or a `SpanHighlight` component.

Includes a gradient accent bar at the top, a "Scan complete" status indicator with a pulsing green dot, a heading ("Highlighted spans are potential PII"), and instructional text.

### SpanHighlight.jsx

Renders a single inline PII span in one of three visual treatments based on `effectiveDecision` and `effectiveMode`:

- **`redact` mode:** Solid dark block (`redact-block` CSS class) with a lock icon SVG. The original text is rendered with `aria-hidden="true"` and invisible text color, so it still occupies its full width to prevent layout shift.

- **`anonymize` mode:** Monospace pill showing the recoverable token (e.g., `[NAME_1]`). Rule-matched spans get a solid border (`anonymize-pill` class); heuristic-judged spans get a dashed border (`anonymize-pill-heuristic` class).

- **`kept_visible`:** Original text with a dotted blue underline (`kept-visible` class) and hover background highlight.

All three variants are keyboard-accessible: `role="button"`, `tabIndex={0}`, and keydown handlers for Enter and Space.

### ExplanationPanel.jsx

Right-sidebar panel shown when a span is selected. Structure:

1. **Gradient header band** with "Detection Reasoning" label and a detection method tag (green checkmark for "Rule-matched", violet clock icon for "Heuristic-judged").
2. **Type badge row** showing the PII type (e.g., "Person Name") and either a mode tag (Redact/Anonymize) or a "Kept visible" amber badge.
3. **Span display** showing the token and original text for anonymized spans, a character count for permanently redacted spans, or the original text for kept-visible spans.
4. **Confidence bar** rendered by the ConfidenceBar component.
5. **Reason text** -- the plain-English reasoning string from the backend.
6. **Threshold override notice** (conditional) -- if the user's threshold has changed the original decision, a bordered footer explains the override.

When no span is selected, shows an empty state with a search icon and instructional text.

### ConfidenceSlider.jsx

Global threshold control. The slider range is 0--100 (mapped to 0.0--1.0 confidence internally). Features:

- A gradient header zone with the "Confidence Threshold" label and a large monospace number display.
- A custom-styled range input with a blue fill track and a white thumb with blue border and drop shadow.
- Scale labels: "0 -- All Flagged" on the left, "100 -- Certainties Only" on the right.
- A count row with a blue circle showing the number of redacted items and a text summary ("N of M items redacted -- Applied across entire document").

Moving the slider calls `setThreshold` in App, which recomputes `effectiveDecision` and `effectiveMode` for every span via `applyThreshold()` in `lib/spans.js`.

### ClearedPanel.jsx

Lists all spans whose `effectiveDecision` is `kept_visible`. Each row includes:

- A circular icon based on the PII type (document icon for names and facilities, location pin for locations, calendar for dates, shield for everything else).
- The original text (truncated with ellipsis if too long).
- The PII type and detection method suffix ("RULE" or "HEURISTIC").
- The confidence percentage.
- A right chevron indicating the row is clickable.

Clicking a row selects the span and switches the active tab to the Explanation view. When all spans are redacted at the current threshold, displays an "Everything is redacted at this threshold" empty state with a green checkmark.

### ConfidenceBar.jsx

A horizontal progress bar that gets bigger and changes color as confidence climbs:

- Below 0.50: amber fill, amber text, with a "Borderline -- worth your own review" warning beneath the bar.
- 0.50 to 0.79: lighter accent blue fill.
- 0.80 and above: full accent blue fill.

This color distinction satisfies the requirement that borderline confidence must be visually distinct from clear-cut cases.

### ModeTag.jsx

A small badge component with two variants:

- **Redact:** Dark ink background, white text, white dot, with subtitle "permanently removed".
- **Anonymize:** Accent-soft background, accent text, blue dot, with subtitle "recoverable via map".

Supports a `compact` prop for smaller inline usage (removes the subtitle).

### Wordmark.jsx

Renders the "Con[seal]" logotype. "Con" is rendered in extra-bold dark text, and "seal" is rendered inside a blue rounded chip (the `wordmark-chip` CSS class).

### Dither.jsx

A Three.js WebGL component rendering a Bayer-matrix ordered dithering effect over a fractal Brownian motion wave shader. Used as the full-screen animated background on the upload/landing page. Mouse position is passed as a uniform to the fragment shader so the wave responds to cursor movement.

Requires `@react-three/fiber ^8.18.0` (React 18 compatible). Version 9 of that package requires React 19 and will produce a blank page.

### ScrollReveal.jsx and TargetCursor.jsx

- **ScrollReveal** -- GSAP-powered scroll-triggered text reveal animation component.
- **TargetCursor** -- Custom cursor overlay with parallax effect. Renders a circular cursor that follows mouse movement with configurable spin duration, color, and a distinct color when hovering over elements with the `cursor-target` class.

### lib/spans.js

Contains four exported utility functions:

- **`buildSegments(text, spans)`** -- Splits a document string and a sorted span array into an ordered list of `{kind: 'text', text}` and `{kind: 'span', span}` segments for rendering. Handles overlap resolution by sorting spans by start position ascending and length descending, then skipping any span that starts inside an already-accepted span.

- **`applyThreshold(span, threshold)`** -- Returns a new span object with `effectiveDecision` and `effectiveMode` computed from the threshold. Spans with confidence at or above the threshold retain their original decision; spans below the threshold are demoted to `kept_visible`. Preserves `originalDecision` and `originalMode` for the explanation panel.

- **`prettyType(type)`** -- Converts a PII type constant (e.g., `PERSON_NAME`) to a human-readable label (e.g., `Person Name`).

- **`tokenFor(span)`** -- Returns the anonymization token string (e.g., `[PERSON_1]`) based on the span type and ID.

---

## Configuration

### Backend Port

The backend runs on port 8002 by default. To change it, update both the Uvicorn start command and the Vite proxy target in `frontend/vite.config.js`:

```js
// frontend/vite.config.js
proxy: {
  '/api': 'http://127.0.0.1:<new-port>',
},
```

### File Size Limit

Defined in `backend/main.py`:

```python
MAX_FILE_BYTES = 5 * 1024 * 1024  # 5 MB
```

### Design Tokens

Defined in `frontend/tailwind.config.js`:

| Token | Hex Value | Usage |
|---|---|---|
| `ink` | `#0F172A` | Primary text, headings, dark UI elements |
| `accent` | `#2563EB` | Brand blue, interactive elements, links, active states |
| `accent-soft` | `#EEF2FF` | Light accent backgrounds, anonymize pill fills |
| `canvas` | `#F8FAFC` | Page background |
| `rule` | `#E2E8F0` | Hairline borders, dividers, skeleton loader base |
| `muted` | `#64748B` | Secondary text, labels, inactive states |

The font stack uses Inter (with font feature settings `cv11`, `ss01`, `ss03`) for body text and JetBrains Mono for code, data, and monospace elements. Both are loaded from Google Fonts.

The upload/landing page overrides these tokens with inline dark styles (`#06091a` background) to support the Dither wave effect, which requires a dark canvas for the retro dither pattern to be visible.

### Regenerating Mock Data

The `data/mock_data.json` file contains a pre-generated document and 14 spans used as a legacy fallback. To regenerate it after editing the sample document or detection rules:

```bash
cd conseal-ps1/backend
python generate_mock.py
```

This script uses a hardcoded document string, computes accurate character offsets for each span, and writes the result to `data/mock_data.json`.

---

## Design Decisions and Rationale

**Why two stages instead of one.** Regex patterns for structured PII (email, phone, SSN) are essentially perfect detectors -- there is no benefit in giving them soft confidence scores. Heuristics for names and locations are genuinely uncertain. Separating them makes the confidence scores honest: a 0.99 on an email match means something fundamentally different from a 0.60 on a name match, and the reviewer can see that difference. This separation is itself part of the trust story.

**Why the threshold slider operates on the client.** Re-running the backend pipeline on every threshold change would add 200--500ms of latency for a purely display-layer operation. All span data is already in the browser after the initial upload; `applyThreshold()` re-evaluates it synchronously in under a millisecond.

**Why ACADEMIC_SCORE is kept_visible.** GPA and percentage scores are performance data, not personal identifiers. An AI processing a resume needs the score to remain visible to evaluate the candidate. Redacting it would degrade the utility of the downstream AI output without meaningfully protecting privacy.

**Why phone and email are permanently redacted rather than anonymized.** A phone number or email in a recoverable token (`[PHONE_1]`) is still a re-identification risk if the token map is exposed. These values have no utility for a downstream AI analyzing document structure; they are pure contact information that should be removed entirely.

**Why LOCATION is kept_visible at 0.55 confidence.** City and state names are low-entropy identifiers on their own. They are useful context for an AI analyzing a document. The reviewer can always raise the threshold to redact them if the document is particularly sensitive. The deliberately low confidence communicates that this was a judgment call, not a certainty.

**Why local React state instead of a state management library.** `App.jsx` holds the fetched document and spans; the selected span ID, confidence threshold, and active tab are simple `useState` hooks. There is exactly one fetch on mount and no server-state synchronization needed. Redux, Zustand, or React Query would add dependency weight and boilerplate with no corresponding benefit at this scope.

**Why heuristics instead of a live LLM.** The hackathon brief explicitly offers two options: "cloud LLM" or "mock backend." This pipeline is squarely Option B. There is no AI model inference happening. This removes all demo risk -- no API keys, no rate limits, no network dependency, nothing that can fail during a live demonstration. In a production version, the judgment layer is exactly where a fine-tuned NER model or LLM-based extractor would sit.

**Why Three.js requires `--legacy-peer-deps`.** `@react-three/fiber` v9 targets React 19. This project uses React 18. Version 8.18 resolves the conflict; the package's peer dependency declaration is `>=18 <19`, which is an exact match. The `--legacy-peer-deps` flag tells npm to use the legacy resolution algorithm that tolerates this kind of transitive conflict.

**Why a single-screen approach.** Marcus's problem is one document, deeply explained. A multi-page application with a sidebar, multiple routes, or a dashboard would spread attention across surfaces without adding depth. The single-screen approach with a tabbed sidebar keeps the document and its explanations in constant visual proximity.

---

## What Was Deliberately Left Out

Each of these was an explicit scoping decision. They solve problems this prototype does not have.

| Exclusion | Reasoning |
|---|---|
| Live LLM detection | The brief scores both options equally. Mock detection removes 100% of demo risk and lets the entire build focus on the trust UI. |
| Authentication and multi-user support | Marcus is a single persona reviewing his own document. There is no second user, and no part of PS1's success criteria depends on multi-user concerns. |
| Relational database | One document's worth of spans fits trivially in memory. A database would add complexity, migration scripts, and connection management with no corresponding benefit since nothing needs to persist between sessions. |
| Multi-document support | That is Problem Statement 2's territory. PS1 is about depth on one document, not throughput across many. Splitting attention would have made the trust experience weaker, not stronger. |
| Real encrypted `.csmap` file generation | The prototype models what Redact vs. Anonymize implies for recoverability, surfaced honestly in the mode tag, without implementing actual AES encryption. That is infrastructure, not experience. |
| Backend that mutates state | No writes, no persistence layer, no background jobs. The reviewer never changes the underlying data; they only change their view of it (which span is selected, where the slider sits). All of that lives in React state. |
| CI/CD, deployment, monitoring | Not proportionate to an 8-hour, single-session prototype that runs locally. |

---

## Sample Walkthrough

The following sequence demonstrates the full trust experience in approximately two minutes:

1. **Landing page.** The application opens on a dark-themed upload page with a Bayer-dithered wave animation. The "Anonymize. Work. Restore." hero text and the two-stage detection pipeline card establish what the tool does before any document is loaded.

2. **Load the sample.** Click "Try a sample document" to load the built-in medical intake form. The loading state shows a pipeline progress animation (extracting text, running rule layer, running judgment layer, merging). The page transitions to the review screen.

3. **Document overview.** The document renders with approximately 15--18 spans highlighted: solid black blocks for permanently redacted items (SSN, policy number), blue pills for anonymized items (`[PERSON_1]`, `[EMAIL_1]`), and dotted blue underlines for kept-visible items (city name, marital status, ethnicity, regulatory citation).

4. **Click a redacted span.** Click `[PERSON_1]` (the anonymized patient name). The explanation panel opens, showing: PERSON_NAME type, Heuristic-judged detection method, 85% confidence with a blue bar, Anonymize mode tag, the original text, and the reason: "Name immediately follows the title cue 'Patient', a strong indicator of a person name."

5. **Click a kept-visible span.** Click the dotted-underlined "San Francisco." The same panel format explains: LOCATION type, Heuristic-judged at 55%, kept visible, with the caveat: "City-level locations alone are common enough that re-identification risk was judged low -- a judgment call, not a certainty."

6. **Click a confidently cleared span.** Click the dotted-underlined "HIPAA S164.506." A different shape of "kept visible": REGULATORY_CITATION type, Rule-matched at 97%, confidently cleared rather than uncertain.

7. **Adjust the threshold.** Switch to the Audit List tab and drag the threshold slider down to 40. The "married" span (confidence 0.35) flips from kept-visible to redacted. The explanation panel surfaces the override: "Conseal originally chose kept visible; at your current threshold, this span is redacted." Drag the slider up to 70 -- items like the physician name (confidence 0.85) may change status.

8. **Final point.** "Trust is not binary. You can tune it, and Conseal will tell you what changed."

---

## Testing

### Manual Verification

The `test_documents/` directory at the repository root contains additional test files:

- `test_patient.txt` -- A referral letter with different PII patterns including titled names (`Mr. James T. Holloway`), a different city (`Houston`), a different attending physician, and all the standard structured PII types. Useful for verifying that the detection pipeline generalizes beyond the built-in sample.

To test with this file, start the backend and frontend, then upload `test_patient.txt` through the drag-and-drop interface or the "Choose File" button.

### API Testing

FastAPI's built-in interactive documentation at `http://127.0.0.1:8002/docs` provides a "Try it out" button for each endpoint, allowing direct API testing without any additional tooling.

---

## License

This project was built as a hackathon submission for the SprintFour Hackathon (Problem Statement 1: Trust and Explainability). It is a prototype intended for demonstration purposes.
