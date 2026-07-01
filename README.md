# Conseal — PII Redaction Review Prototype

**SprintFour Hackathon · Problem Statement 1: Trust and Explainability**  
Built by Amritha S Nidhi (CB.SC.U4CSE23404)

---

## The Problem

Marcus has a sensitive document he wants to process through an AI tool. He has heard stories of files marked "redacted" where the sensitive content was still recoverable underneath. He will not adopt a tool he cannot interrogate. Every redaction needs a reason. Every non-redaction needs a reason too. Silence reads as a miss.

The standard approach to this problem produces a document with black bars and no further explanation. The user is expected to trust the bars. Marcus does not.

---

## The Insight

Most redaction tools explain what they hid. Conseal treats kept-visible content with equal seriousness.

When a location like "Houston" remains in the document, a reviewer clicking it sees: LOCATION type, heuristic-judged at 55% confidence, kept visible because city-level location alone is a low-entropy identifier — and a direct acknowledgment that this was a judgment call, not a certainty. When "HIPAA §164.506" is left in, the explanation is different: rule-matched at 97%, confidently cleared because it is a legal reference, not personal data.

Silence is not trust. Explaining the kept-visible decisions is as important as explaining the redacted ones.

---

## What the Reviewer Sees

The document renders with three distinct visual states:

- **Solid black blocks** — permanently removed content. A lock icon. No recovery path. (`[redacted — 11 chars]`)
- **Labeled tokens** — anonymized content recoverable via a token map. (`[PERSON_1]`, `[EMAIL_1]`)
- **Dotted blue underlines** — content that was scanned and deliberately left visible.

Clicking any of the three opens a panel showing: PII type, detection method (rule-matched or heuristic-judged), confidence score on a visual bar, treatment mode, and a one-sentence plain-English reason. Borderline confidence (below 0.50) renders in amber rather than blue — so a 38% marital status match looks visually different from a 99% SSN match.

A confidence threshold slider re-evaluates all spans client-side in real time. Dragging it changes what is redacted and what is not, live, and the explanation panel surfaces the override: "Conseal originally chose redacted. At your current threshold, this span is kept visible."

Trust is not binary. The slider makes it tunable.

---

## Detection Pipeline

Detection runs in two sequential stages followed by a merge step. Separating them is a deliberate choice: it makes the confidence scores honest. A 0.99 on an email regex and a 0.60 on a name heuristic are genuinely different claims, and they should look different to the reviewer.

### Stage 1 — Rule Layer (`detection/rule_layer.py`)

Deterministic regex detectors. Confidence 0.95–1.00. All matches tagged `rule_matched`.

| Detector | Pattern | Confidence | Treatment |
|---|---|---|---|
| EMAIL | Standard `local@domain.tld` + partial `@provider` without TLD (common in PDF extraction) | 0.97–0.99 | redact |
| PHONE_NUMBER | US `(XXX) XXX-XXXX` and Indian `+91 XXXXX XXXXX` | 0.99 | redact |
| SSN | `XXX-XX-XXXX` with lookaheads filtering invalid area numbers (000, 666, 9xx) | 1.00 | redact |
| MEDICAL_RECORD_NUMBER | `MRN` prefix + 5–8 digits | 0.99 | redact |
| NPI | 10-digit number adjacent to an `NPI` label | 0.95 | anonymize |
| REGULATORY_CITATION | HIPAA section references (`HIPAA §164.506`) | 0.97 | kept_visible |
| CREDIT_CARD | 16-digit card numbers in 4-4-4-4 grouping | 0.99 | redact |
| POLICY_NUMBER | 2–4 uppercase letters, hyphen, 5–10 digits, optional suffix | 0.97 | redact |
| DATE / DATE_OF_BIRTH | ISO, written, and contextual dates — DOB label → 0.98; admin label → 0.80 kept_visible; year > 16 years ago → 0.87 presumed birth year | 0.72–0.99 | varies |
| ACADEMIC_SCORE | Labelled CGPA/GPA values and percentage strings | 0.45 | kept_visible |
| PROFILE_URL | `github.com/<handle>` and `linkedin.com/in/<handle>` | 0.98 | anonymize |
| SOCIAL_HANDLE | Kebab-case handles with 3+ hyphens and a digit; plain usernames after PDF bullet artifact `(cid:N)` | 0.82–0.85 | anonymize |

Ordering matters: MRN, NPI, and HIPAA patterns run before the generic POLICY_NUMBER pattern. Without this, `MRN-008473` would be labeled as POLICY_NUMBER.

### Stage 2 — Judgment Layer (`detection/judgment_layer.py`)

Heuristic detectors for unstructured PII. Confidence 0.35–0.90. All matches tagged `heuristic_judged`. The softer confidence range is a design choice — it accurately represents that these are educated guesses, not certifications.

| Detector | Strategy | Confidence |
|---|---|---|
| PERSON_NAME (all-caps header) | Whole-line all-caps name pattern (`AMRITHA S NIDHI`), section headers excluded | 0.83 |
| PERSON_NAME (titled) | Title prefix (`Dr.`, `Mr.`, `Prof.`) + title-case name words | 0.85 |
| PERSON_NAME (all-caps titled) | `DR. SARAH CHEN` — letterhead/header style | 0.85 |
| PERSON_NAME (generic) | Consecutive title-case words scored against a `_NON_NAME` exclusion set of ~130 terms: CS/tech vocabulary, resume structural words, educational institution terms, Indian geography, common function words | 0.40–0.95 |
| LOCATION | Gazetteer: ~90 entries covering US cities, international cities, countries, Indian states and cities | 0.55 |
| ADDRESS | Street number + name + type, optionally city/state/ZIP on the same line | 0.90 |
| HEALTHCARE_FACILITY | Capitalized words ending in Hospital / Clinic / Medical Center / Health System | 0.70 |
| HEALTH_INFO | Medical specialty terms (0.65) and health condition terms (0.75) | 0.65–0.75 |
| MARITAL_STATUS | Keyword list: married, single, divorced, widowed, domestic partnership | 0.35 |
| ETHNICITY | Keyword list: Hispanic, African-American, Asian-American, Pacific Islander, etc. | 0.61 |
| ORGANIZATION | Line starting with an org name and ending with a month-year date — resume format detection | 0.88 |
| ORGANIZATION (educational) | Capitalized phrase ending with University / College / School / Institute / Vidyapeetham | 0.83 |
| PROJECT_NAME | Text before a pipe separator `\|` or before `— GitHub` in a resume project line | 0.85 |

**Name scoring detail.** Base score 0.60. +0.20 if a title cue ("Patient:", "Dr.") precedes the phrase within 40 characters. −0.25 for each word in the phrase that matches the `_NON_NAME` frozenset. Score < 0.40 → dropped. Score 0.40–0.61 → `kept_visible`. Score ≥ 0.62 → `redacted` with anonymize mode.

### Merge (`detection/merge.py`)

Spans from both stages are sorted by start position ascending, then rule-layer priority, then length descending. A cursor walks the sorted list and accepts a span only if its start position is at or after the cursor. This guarantees that rule-layer results win over heuristic results for the same text, and longer matches win over shorter ones.

---

## Decision Modes

| Decision | Mode | Visual Treatment | Guarantee |
|---|---|---|---|
| `redacted` | `redact` | Solid black block with lock icon; text hidden but still occupies width | Permanently removed, not recoverable |
| `redacted` | `anonymize` | Monospace pill (`[PERSON_1]`); solid border for rule-matched, dashed for heuristic | Recoverable via token map |
| `kept_visible` | `null` | Original text with dotted blue underline | Scanned and deliberately left in |

---

## Design Decisions

These are the non-obvious choices. The obvious ones are documented inline in the code.

**Symmetric treatment of kept-visible content.** This is the core product decision. A span that was "considered and cleared" is explained with the same panel, the same confidence bar, and the same level of detail as a span that was redacted. Content that was never flagged at all does not receive this treatment — it is just plain text. The visual distinction matters: dotted blue underline vs. unstyled text communicates "this was seen" vs. "this was not looked at."

**Confidence scores that are honest about the method.** A regex for SSN either matches or it does not — there is no probability involved, so it gets 1.00. A name heuristic is genuinely uncertain — 0.60 base with additive and subtractive terms is a modeling decision, not a measurement. Displaying both as "confidence" without surfacing that the underlying claims are different kinds of claims would be misleading. The two-stage architecture exists precisely to preserve this distinction.

**Client-side threshold re-evaluation.** Re-running the backend pipeline on every threshold change would add 200–500ms latency for a purely display-layer operation. All span data is in the browser after the initial upload; `applyThreshold()` re-evaluates synchronously in under one millisecond. The slider feeds back the current threshold to the explanation panel, which surfaces overrides explicitly rather than silently changing the document.

**Why ACADEMIC_SCORE is kept_visible.** GPA and percentage scores are performance data, not personal identifiers. An AI processing a résumé needs the grade to remain visible to evaluate the candidate. Redacting it would degrade the utility of the downstream AI output without meaningfully protecting privacy.

**Why phone and email are permanently redacted rather than anonymized.** A phone number or email in a recoverable token (`[PHONE_1]`) is still a re-identification risk if the token map is exposed. Neither value has utility for a downstream AI analyzing document structure. They are pure contact data and should be removed entirely rather than tokenized.

**Why LOCATION is kept_visible at 0.55.** City and state names are low-entropy identifiers on their own. They are useful context for an AI analyzing a document. The 0.55 confidence communicates that this was a judgment call — the reviewer can raise the threshold to redact them if the document is particularly sensitive.

**Why no live LLM.** The brief scores both options equally. Removing live inference removes 100% of demo risk: no API keys, no rate limits, no network dependency during a presentation. The judgment layer is exactly where a fine-tuned NER model would slot in a production system; the heuristics are transparent stand-ins.

**What was deliberately excluded and why.**

| Exclusion | Reasoning |
|---|---|
| Authentication and multi-user support | Marcus is a single persona reviewing his own document. No part of PS1's success criteria involves multi-user concerns. |
| Relational database | One document's spans fit in memory. A database adds migration scripts and connection management with no benefit in a single-session prototype. |
| Multi-document support | PS1 is about depth on one document. Splitting attention across documents would have made the trust experience shallower. |
| Encrypted `.csmap` file generation | The prototype models what Redact vs. Anonymize implies for recoverability, surfaced honestly in the mode tag. Implementing AES encryption is infrastructure, not experience. |
| Redux / Zustand / React Query | Two `useState` hooks and one `useMemo` are the entire state model. Adding a library would add boilerplate with no corresponding benefit at this scope. |
| CI/CD, deployment, monitoring | Not proportionate to an 8-hour, single-session prototype that runs locally and does not persist data between sessions. |

---

## Architecture

```
Browser  <---->  Vite Dev Server (5173)  <--[proxy /api/*]-->  FastAPI (8002)
                                                                     |
                                                        +------------+------------+
                                                        |                         |
                                                   extraction.py           detection/
                                                 (PDF, DOCX, TXT)       rule_layer.py
                                                                        judgment_layer.py
                                                                          merge.py
```

No database, no authentication, no live LLM. The in-memory session dictionary holds the most recently processed document so `/api/spans/{id}` can serve individual span lookups without re-running detection.

| Layer | Technology | Version |
|---|---|---|
| Frontend | React, Vite, Tailwind CSS | 18.3, 5.4, 3.4 |
| WebGL | Three.js, @react-three/fiber, @react-three/postprocessing | 0.168, 8.18, 2.19 |
| Animation | GSAP | 3.15 |
| Backend | FastAPI, Uvicorn | 0.115, 0.30 |
| Extraction | pdfplumber (PDF), python-docx (DOCX) | 0.11, 1.1 |
| Validation | Pydantic v2 | 2.9 |

---

## Project Structure

```
sprintFour/
|
+-- conseal-ps1/
|   +-- backend/
|   |   +-- main.py                  FastAPI app: four routes, in-memory session
|   |   +-- models.py                Pydantic v2 models: PIISpan, DocumentResponse
|   |   +-- extraction.py            Text extraction (.txt / .docx / .pdf)
|   |   +-- sample_doc.txt           Built-in sample document (synthetic medical record)
|   |   +-- requirements.txt         6 Python dependencies
|   |   +-- detection/
|   |       +-- rule_layer.py        Stage 1: 12 regex detectors
|   |       +-- judgment_layer.py    Stage 2: 13 heuristic detectors
|   |       +-- merge.py             Overlap resolution and ID assignment
|   |
|   +-- frontend/
|   |   +-- vite.config.js           Dev server on 5173, proxies /api/* to 8002
|   |   +-- tailwind.config.js       Design tokens: ink, accent, canvas, rule, muted
|   |   +-- src/
|   |       +-- App.jsx              Root: upload page + review page + all state
|   |       +-- lib/spans.js         buildSegments(), applyThreshold(), tokenFor()
|   |       +-- components/
|   |           +-- DocumentViewer.jsx      Document + span rendering
|   |           +-- SpanHighlight.jsx       Three visual treatments
|   |           +-- ExplanationPanel.jsx    Decision reasoning sidebar
|   |           +-- ConfidenceSlider.jsx    Global threshold control
|   |           +-- ClearedPanel.jsx        Kept-visible spans audit list
|   |           +-- ConfidenceBar.jsx       Visual confidence indicator
|   |           +-- Dither.jsx              Three.js Bayer-dithered wave background
|   |
|   +-- WRITEUP.md                   Build writeup: what was built and what was left out
|
+-- participant.md
```

---

## Local Setup

Two terminal sessions required.

**Terminal 1 — backend**

```bash
cd conseal-ps1/backend
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8002
```

Interactive API docs: `http://127.0.0.1:8002/docs`

**Terminal 2 — frontend**

```bash
cd conseal-ps1/frontend
npm install --legacy-peer-deps
npm run dev
```

Open `http://localhost:5173`.

`--legacy-peer-deps` is required because `@react-three/fiber` v8.18 (the React 18 compatible version) has a peer dependency declaration that conflicts with npm 9's strict resolution. The installed versions are fully compatible at runtime.

**Supported upload types:** `.txt`, `.docx`, `.pdf` — maximum 5 MB.

---

## API Reference

### POST /api/process

Upload a document. Runs the full two-stage pipeline.

**Request:** `multipart/form-data` with a `file` field.

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
      "reason": "Name immediately follows the title cue 'Patient:'..."
    }
  ]
}
```

**Errors:** 413 (file too large) · 415 (unsupported type) · 422 (extraction failed)

### GET /api/sample

Process the built-in sample document without uploading. Returns the same shape as `/api/process`. Use this during demos.

### GET /api/spans/{span_id}

Return one span from the most recently processed document. 404 if the ID does not exist.

### GET /api/health

Returns `{"status": "ok"}`.

---

## Demo Walkthrough

The following two-minute sequence demonstrates the full trust experience:

1. **Landing page.** The upload page opens with a Bayer-dithered wave animation. The "Anonymize. Work. Restore." hero and the two-stage detection card explain what the tool does before any document is loaded.

2. **Load the sample.** Click "Try a sample document." A pipeline progress animation plays. The page transitions to the review screen.

3. **First impression.** The document renders with ~18 highlighted spans: black bars for SSN, policy number, and medical record number; blue pills for names and email; dotted underlines for city name, marital status, ethnicity, and a HIPAA citation.

4. **Click a redacted span.** Click the SSN black bar. The panel shows: SSN type, Rule-matched at 100%, Redact mode — permanently removed, with the reason: "Matched the XXX-XX-XXXX Social Security Number pattern."

5. **Click a kept-visible span.** Click the dotted-underlined city name. Same panel format, different content: LOCATION type, Heuristic-judged at 55%, kept visible, reason: "City-level locations alone are common enough that re-identification risk was judged low — a judgment call, not a certainty."

6. **Click a confidently cleared span.** Click the HIPAA citation. Rule-matched at 97%, kept visible — "a legal reference, not personal data." The explanation makes the distinction between uncertain clearance and confident clearance visible.

7. **Adjust the threshold.** Switch to the Audit List tab and drag the slider down to 40. The marital status span (35% confidence) flips from kept-visible to redacted. The panel surfaces the override: "Conseal originally chose kept visible. At your current threshold, this span is redacted."

8. **The point.** Trust is not binary. The slider makes it tunable, and Conseal tells you exactly what changed.
