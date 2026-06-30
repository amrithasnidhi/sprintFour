# Conseal PS1 -- Build Writeup

## What this prototype is

A single-screen application where **Marcus** -- Conseal's anxious, skeptical user -- can
upload his own document (or load a built-in sample), see every detection decision
laid over the text in context, and click any decision (redacted *or* kept visible) to get a
plain-language answer to **"why this, and why not that?"**

It is built for Problem 1 of the SprintFour hackathon: **Trust and Explainability**.

---

## What was built

### File upload and real detection

The user can drag and drop or select a `.txt`, `.docx`, or `.pdf` file up to 5 MB. The
backend extracts raw text from the uploaded file (`extraction.py` handles UTF-8/CP-1252
fallback for plain text, `python-docx` for Word documents, and `pdfplumber` for PDF
with page concatenation), then runs the full two-stage detection pipeline against
that actual content. A built-in sample medical intake form is also available as a
fallback via `GET /api/sample` for instant demos without an upload.

The upload page renders a dark-themed hero (`#06091a` background) with a Bayer-matrix
dithered wave animation (Three.js + `@react-three/fiber`) that responds to mouse
position. A pipeline progress animation (extracting text, rule layer, judgment layer,
merging) runs during the upload state to make the processing visible.

### Two-stage detection pipeline

**Stage 1 -- Rule layer (`detection/rule_layer.py`).** Twelve deterministic regex
detectors cover: email addresses (full and TLD-less), US and Indian phone numbers,
Social Security Numbers (with invalid-area-code lookaheads), Medical Record Numbers,
National Provider Identifiers, HIPAA regulatory citations, credit card numbers, insurance
policy/account numbers, dates (with DOB vs. administrative context classification),
academic CGPA/GPA scores, GitHub and LinkedIn profile URLs, and social media handles
(kebab-case slugs and PDF bullet artifact usernames). All matches carry confidence
0.95--1.00 and are tagged `rule_matched`.

**Stage 2 -- Judgment layer (`detection/judgment_layer.py`).** Thirteen heuristic
detectors cover: all-caps resume name headers, titled names (`Dr.`, `Mr.`, `Prof.`),
all-caps titled names (letterhead style), generic consecutive title-case name sequences
scored against a 130-term `_NON_NAME` exclusion set, city and country gazetteer
locations (approximately 90 entries), street addresses, healthcare facility names,
medical specialties and health conditions, marital status keywords, ethnicity keywords,
employer/school names on resume date-lines, educational institution names by suffix,
and personal project names before resume pipe or GitHub separators. All matches carry
confidence 0.35--0.90 and are tagged `heuristic_judged`.

**Merge step (`detection/merge.py`).** Sorts all spans by start position ascending,
then rule-layer priority over judgment-layer, then length descending. Accepts each span
only if its start is at or after the current cursor; advances the cursor to the span's
end on acceptance. Assigns sequential IDs (`span_1`, `span_2`, ...) in document order.
Rule-layer results win all overlaps.

### Inline document viewer

The document text is rendered with spans highlighted in place via `DocumentViewer.jsx`,
which calls `buildSegments()` in `lib/spans.js` to split the document string into
alternating plain-text and span segments. Three distinct visual treatments distinguish
the three states a span can be in:

- **`redact` mode** -- solid dark block with a small lock glyph; the hidden text still
  occupies its full width so the layout does not reflow.
- **`anonymize` mode** -- labeled pill like `[PERSON_1]`, mirroring how the real Conseal
  pipeline emits substitution tokens. Spans detected by the rule layer get a solid
  border; heuristic-judged spans get a dashed border, which distinguishes certainty from
  heuristic confidence at a glance.
- **Kept-visible-but-flagged** -- dotted blue underline (`#2563EB`), clickable like
  the others.

An animated pulsing green status dot and a "Scan complete" label confirm the detection
run completed.

### Explanation panel

Opens on click and shows, in order: the detection method tag (green checkmark for
"Rule-matched", violet clock for "Heuristic-judged"), the PII type badge, a mode tag
or "Kept visible" badge, the span text (anonymize tokens show `[TOKEN] <- original`;
redact shows `[redacted -- N chars]`; kept-visible shows the raw text), a confidence
bar that switches from blue to amber below 0.50 with a "Borderline -- worth your own
review" caveat, and the one-sentence plain-language reason string from the backend.

If the user's confidence threshold has overridden the system's original decision, a
bordered footer row explains the override: "Conseal originally chose redacted; at your
current threshold, this span is kept visible."

An empty state with a search icon and instructional text displays when no span is selected.

### Symmetric treatment of kept-visible content

This is the single most important differentiator for PS1. A span that was *considered
and rejected* -- the HIPAA citation confidently cleared by the rule layer, the city
name kept visible by a soft heuristic judgment, the marital status term left in at a
borderline 0.35 confidence -- is just as clickable as a redaction and gets the same
kind of explanation panel, including whether it was confidently cleared or merely
uncertain. Plain text that was never flagged at all carries no decoration, so the
reviewer can distinguish "checked and cleared" from "never looked at."

### Confidence threshold slider

The `ConfidenceSlider` component renders a custom-styled range input (0--100, mapped to
0.0--1.0) with a blue fill track, a white thumb with blue border and drop shadow, and
scale labels. Moving it calls `setThreshold` in `App.jsx`, which recomputes
`effectiveDecision` and `effectiveMode` for every span via `applyThreshold()` in
`lib/spans.js`. The count of currently redacted items updates live ("N of M items
redacted"). All threshold re-evaluation runs synchronously on the client against the
already-loaded span list -- no new API call is made per slider move.

### Cleared / Audit panel & Export

The `ClearedPanel` lists all spans whose `effectiveDecision` is `kept_visible`. Each
row shows a type-appropriate icon (person/document, location pin, calendar, shield), the
original text, the PII type and detection method suffix, and the confidence percentage.
Clicking a row selects the span and switches the sidebar to the Explanation tab. When
the threshold is high enough that every span is redacted, the panel shows an "Everything
is redacted at this threshold" empty state with a green checkmark.

Once the reviewer is satisfied with the threshold, they can click "Export Report" from the
header to download a plain-text audit trail of every detection, its confidence, the applied
threshold, and the final decision.

### Mode tags

Every redacted span carries a mode tag clarifying Conseal's literal guarantee:
"Redact -- permanently removed" or "Anonymize -- recoverable via map." This directly
answers Marcus's core fear of "is it really gone?" The `ModeTag` component supports
a `compact` prop that omits the subtitle for dense layouts.

### Loading and error states

A shimmer skeleton animation renders while the pipeline processes. A dedicated error
card appears with the specific error message (file too large, unsupported type,
extraction failure, backend unreachable) and a "Retry with sample" button. File
validation runs client-side before the upload is sent, so obviously wrong files are
rejected immediately without a round trip.

### Responsive layout

On desktop (`lg` breakpoint and above), a 7/12 -- 5/12 two-column grid places the
document on the left and the tabbed explanation/audit panel on the right as a sticky
aside. On mobile, a bottom tab bar switches between the document view and the audit
view. The confidence slider and explanation panel stack vertically on small screens.

### Accessibility

All three span treatment variants include `role="button"`, `tabIndex={0}`, and keydown
handlers for Enter and Space. The explanation panel carries `aria-live="polite"` for
screen reader announcements. Back and upload buttons carry `aria-label` attributes.

---

## What was deliberately left out

Each of these was an explicit scoping decision -- they solve problems this prototype
does not have.

- **A live LLM detection call.** The brief explicitly allows a mock backend and does not
  score either option differently. Removing API-key setup, rate limits, and network
  failure risk from the demo path was the correct trade-off. In a production version,
  the judgment layer is exactly where a fine-tuned NER model or LLM-based extractor
  would sit. The detection pipeline here is fully explainable as "two independent,
  complementary detectors with a precedence rule."

- **Authentication, accounts, multi-user.** Marcus is one persona reviewing his own
  document. There is no second user, and no part of PS1's success criteria requires
  multi-user concerns. Introducing auth would have consumed hours solving a problem
  this persona does not have.

- **A relational database.** One uploaded document's worth of spans fits trivially in
  memory for the session. The in-memory session dictionary in `main.py` is the entire
  persistence layer. A database would add complexity, migration scripts, and connection
  management with no corresponding benefit, since nothing needs to survive between
  sessions.

- **Multi-document support.** That is Problem Statement 2's territory. PS1 is about
  *depth* on one document, not *throughput* across many. Splitting attention would
  have made the trust experience weaker, not stronger.

- **Real encrypted `.csmap` file generation.** The prototype models what Redact vs.
  Anonymize *implies* for recoverability -- surfaced honestly in the mode tag on every
  span -- without implementing actual AES encryption. That is infrastructure, not
  experience.

- **A backend that mutates state.** No writes, no persistence layer, no background jobs.
  The reviewer never changes the underlying data; they only change their view of it
  (which span is selected, where the slider sits), and all of that lives in React state.

- **Redux, Zustand, or any server-state library.** There is exactly one fetch on mount.
  `useState` and `useMemo` in `App.jsx` are the entire state model. A state management
  library would add dependency weight and boilerplate with no corresponding benefit at
  this scope.

---

## Why the design choices

**Two detection stages with honest confidence ranges.** Regex patterns for structured
PII (email, phone, SSN) are essentially perfect detectors -- giving them soft confidence
scores would be dishonest. Heuristics for names and locations are genuinely uncertain.
Separating them makes the confidence scores mean something: a 0.99 on an email match is
fundamentally different from a 0.60 on a name match, and the reviewer can see and feel
that difference in the UI.

**Dashed border vs. solid border for anonymize pills.** Rule-matched spans get a solid
border on their `[TOKEN]` pill; heuristic-judged spans get a dashed border. This
sub-treatment within the anonymize state communicates detection method at a glance,
without requiring the reviewer to open the explanation panel to learn whether a decision
was deterministic or probabilistic.

**Conseal's visual identity, not a debug page.** Light canvas (`#F8FAFC`), brand blue
(`#2563EB`), dark navy ink (`#0F172A`), generous whitespace, the `Con[seal]` wordmark
with the bracketed half rendered as a blue chip, and Inter + JetBrains Mono as the
font stack. The design reads as part of the Conseal product, not bolted onto it.

**Dark upload page with Bayer dithering.** The landing page overrides the light design
tokens with a deep navy (`#06091a`) background to make the retro dither wave visible
and impactful. The two-stage detection pipeline card on the landing page educates the
user about how detection works *before* they see a single span -- setting honest
expectations before the trust experience begins.

**Borderline confidence is visually distinct.** The `ConfidenceBar` component switches
from blue to amber below 0.50, and the panel adds a "Borderline -- worth your own
review" caveat. Two near-identical numbers (0.49 vs. 0.51) read differently to the eye,
which matches how the underlying uncertainty actually behaves.

**Overlap precedence is defined, not silent.** `buildSegments` in `lib/spans.js` sorts
by start ascending and length descending, then skips any span that starts inside an
already-accepted one. The merge step in the backend applies the same logic with rule-
layer priority on top. A "name inside an address" case has a deterministic rendering
and a clear, explainable precedence rule.

**Client-side threshold re-evaluation.** Re-running the backend pipeline on every slider
move would add 200--500ms of latency for a purely display-layer operation. All span data
is already in the browser; `applyThreshold()` re-evaluates every span synchronously in
under a millisecond. The explanation panel's threshold-override notice closes the loop:
when the user changes a span's effective decision, the panel surfaces that change
immediately.

---

## How a 2-minute demo would go

1. Page loads on the dark upload screen. The dither wave and hero text ("Anonymize.
   Work. Restore.") establish context. Click "Try a sample document."

2. The pipeline progress animation runs (extracting text, rule layer, judgment layer,
   merging). The review screen appears with the medical intake form fully annotated.

3. Click `[PERSON_1]` (Jonathan M. Richardson). The explanation panel opens: PERSON_NAME,
   Heuristic-judged, 85% confidence (blue bar), Anonymize mode, and the reason --
   "Name immediately follows the title cue 'Patient', a strong indicator of a person
   name."

4. Click `[SSN_4]` (the SSN block). Rule-matched at 100% confidence. "Matched the
   XXX-XX-XXXX Social Security Number pattern -- permanently removed, not recoverable."
   The Redact mode tag reinforces this.

5. Click the dotted-underlined "San Francisco." Same panel format: LOCATION, Heuristic-
   judged at 55%, kept visible, with the honest caveat that this was a judgment call,
   not a certainty.

6. Click "HIPAA S164.506." A different shape of "kept visible": REGULATORY_CITATION,
   Rule-matched at 97%, *confidently cleared* rather than uncertain.

7. Switch to Audit List. Drag the threshold slider down to 35. The "married" span
   (confidence 0.35) flips to redacted. The explanation panel surfaces the override.
   Drag up to 70 -- items like the attending physician name may change status. The live
   count updates with each tick.

8. End on the slider: "Trust is not binary -- you can tune it, and Conseal will tell
   you exactly what changed and why."

---

## What the trust experience hinges on

> Every redaction needs a reason; every non-redaction needs a reason too. Silence reads
> as a miss.

The single design decision that earns the most against PS1's judging criteria is
treating kept-visible content as a first-class decision, not a default. The bulk of the
build time went into the explanation panel -- specifically, into making the same
component answer both "why did you hide this?" and "why did you *not* hide this?" with
the same seriousness, the same information density, and the same visual weight.

The confidence bar's amber/blue color split, the dashed/solid border distinction on
anonymize pills, the threshold-override notice, and the "considered and cleared" vs.
"never flagged" visual distinction are all in service of the same principle: every
decision should be legible, and no silence should read as a miss.
