# Conseal PS1 — Build Writeup

## What this prototype is

A single screen where **Marcus** — Conseal's anxious, skeptical user — can
load a sample medical document, see every redaction decision laid over the
text in context, and click any decision (hidden _or_ kept visible) to get a
plain-language answer to **"why this, and why not that?"**

It is built for Problem 1 of the SprintFour hackathon: **Trust &
Explainability**.

---

## What was built

- **Inline document viewer** that renders the source text with spans
  highlighted in place. Three distinct visual treatments distinguish the
  three states a span can be in:
  - `redact` mode → solid dark block with a small lock glyph. The hidden
    text still occupies its full width so the layout doesn't reflow.
  - `anonymize` mode → labelled pill like `[NAME_1]`, mirroring how the
    real Conseal pipeline emits substitution tokens.
  - Kept-visible-but-flagged → dotted blue underline, clickable like the
    others.
- **Explanation panel** that opens on click and shows: PII type, detection
  method (Rule-matched vs AI-judged with distinct icons), confidence as a
  bar (low confidence rendered in amber so borderline cases are not styled
  identically to clear-cut ones), mode tag, the original span text behind
  the redaction, and a one-sentence plain-language reason.
- **Symmetric treatment of kept-visible content.** This is the single most
  important differentiator for PS1. A span that was _considered and
  rejected_ (`HIPAA §164.506`, `Dr. Elena Vasquez`, `married`, `Hispanic`,
  city-level `San Francisco`) is just as clickable as a redaction and gets
  the same kind of explanation — including whether it was confidently
  cleared or kept visible despite a borderline confidence.
- **Confidence threshold slider** that re-filters the entire document live.
  Spans whose confidence is at or above the threshold are treated as
  redacted; spans below are kept visible. A persistent live count
  ("`N` of `M` flagged items would be redacted at this threshold") sits
  under the slider. When the user's threshold changes the effective
  decision for a span, the explanation panel surfaces that ("Conseal
  originally chose redacted; at your current threshold, this span is kept
  visible").
- **Mode tags** on every redacted span clarifying Conseal's literal
  guarantee — "Redacted — permanently removed" vs "Anonymized — recoverable
  via map" — which directly answers Marcus's core fear of "is it really
  gone?"
- **Loading and error states.** A shimmer skeleton renders while the
  document is being fetched, and a dedicated error card with a retry
  button shows if the backend is unreachable.

---

## What was deliberately left out

Each of these was an explicit scoping call — they solve problems this
prototype does not have.

- **A live LLM detection call.** The brief explicitly allows a mock backend
  and is not scored either way for going live. Mocking removes demo risk
  entirely and lets 100% of the build time go into the trust UI.
- **Authentication, accounts, multi-user.** Marcus is one persona reviewing
  his own document. There is no second user, and no part of PS1's success
  criteria depends on multi-user concerns.
- **A relational database.** One document's worth of spans (14, in our
  case) fits trivially in a JSON file. A DB would add complexity with no
  corresponding benefit.
- **Multi-document support.** That is Problem 2's territory. Problem 1 is
  about _depth_ on one document, not _throughput_ across many. Splitting
  attention would have made the trust experience weaker, not stronger.
- **Real encrypted `.csmap` file generation.** The prototype models what
  Redact vs Anonymize _implies_ for recoverability — surfaced honestly in
  the mode tag — without implementing actual encryption, which is
  infrastructure, not experience.
- **A backend that mutates state.** No writes, no persistence layer, no
  background jobs. The reviewer never changes the underlying data; they
  only change their view of it (which span is selected, where the slider
  sits) and that lives entirely in React state.

---

## Why the design choices

- **Conseal's visual identity, not a debug page.** Light canvas
  (`#F8FAFC`), brand blue (`#2563EB`), dark navy ink (`#0F172A`), generous
  whitespace, the `Con[seal]` wordmark with the bracketed half rendered as
  a chip. The hero column on the left mirrors the homepage's "Anonymize.
  Work. Restore." pane so the prototype feels like part of the product,
  not bolted onto it.
- **Three columns on desktop, stacked on small screens.** The left column
  holds branding so it stays present; the middle holds the document; the
  right holds the explanation panel and slider as a sticky aside, which is
  exactly the relationship the blueprint describes ("slide-in" panel +
  persistent slider at the bottom).
- **Distinguishing "considered and cleared" from "never looked at."** A
  span that was scanned and deliberately left visible carries the same
  weight in the UI as a redaction. Plain text that was never flagged at
  all carries no decoration. This is the nuance PS1 rewards most.
- **Borderline confidence is visually distinct.** The confidence bar
  switches from blue to amber below 0.5, and the panel adds a "borderline
  — worth your own review" caveat. Two near-identical numbers (0.49 vs
  0.51) read differently to the eye, which matches how the underlying
  uncertainty actually behaves.
- **Overlap precedence is defined, not silent.** `buildSegments` in
  `lib/spans.js` sorts by start ASC, length DESC, and skips any span that
  starts inside an already-accepted one. This satisfies F1's validation
  rule and means a "name inside an address" case has a deterministic
  rendering.

---

## How a 2-minute demo would go

1. Page loads with the document and a `50` threshold. About 13 of 14
   flagged items are redacted; only `married` (confidence 0.42) is kept
   visible by the threshold.
2. Click `Jonathan M. Richardson` — a clean explanation card shows
   PERSON_NAME, AI-judged, 96% confidence, Anonymize mode with the
   `[NAME_1]` substitution token and a plain reason.
3. Click `San Francisco` (dotted underline). The same panel format
   explains: city-level location, AI-judged at 55%, kept visible, with the
   honest caveat that this was a judgment call.
4. Click `HIPAA §164.506` — a different shape of "kept visible": a
   confident regulatory citation, rule-matched at 97%, _confidently
   cleared_ rather than _uncertain_.
5. Drag the threshold down to 40. The amber-borderline `married` flips to
   anonymize. The explanation panel's "Your threshold changed this" note
   surfaces. Drag back up to 70 — items like `Dr. Elena Vasquez` (0.68)
   flip from kept-visible to anonymized.
6. End on the slider: "trust is not binary — you can tune it, and Conseal
   will tell you what changed."

---

## What the trust experience hinges on

> Every redaction needs a reason; every non-redaction needs a reason too.
> Silence reads as a miss.

The single design decision that earns the most points against PS1's
judging criteria is treating kept-visible content as a first-class
decision, not a default. The bulk of the build time went into the
explanation panel — specifically, into making the same component answer
both "why did you hide this?" and "why did you not hide this?" with the
same seriousness.
