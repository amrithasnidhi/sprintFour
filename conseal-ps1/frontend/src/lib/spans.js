/**
 * Build an ordered list of render segments from raw document text and the
 * full span list. Each segment is either plain text or a span object. Spans
 * are deduplicated for overlaps using an "outer/longer wins" precedence rule
 * (sorted by start ASC, then length DESC; any span starting inside an already
 * accepted span is skipped). This matches the F1 validation rule from the
 * blueprint: spans cannot silently overlap without a defined precedence.
 */
export function buildSegments(text, spans) {
  if (!text) return []
  const sorted = [...spans].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start
    return (b.end - b.start) - (a.end - a.start)
  })

  const accepted = []
  let cursor = 0
  for (const span of sorted) {
    if (span.start < cursor) continue // overlaps a previously accepted span
    if (span.start < 0 || span.end > text.length) continue
    accepted.push(span)
    cursor = span.end
  }

  const segments = []
  let pos = 0
  for (const span of accepted) {
    if (span.start > pos) {
      segments.push({ kind: 'text', text: text.slice(pos, span.start) })
    }
    segments.push({ kind: 'span', span })
    pos = span.end
  }
  if (pos < text.length) {
    segments.push({ kind: 'text', text: text.slice(pos) })
  }
  return segments
}

/**
 * Apply the user-controlled confidence threshold to a span. Above-or-equal
 * the threshold => effectively redacted (using whatever mode the span has,
 * defaulting to `anonymize` if the original decision was kept_visible and
 * we're now choosing to redact it). Below the threshold => kept visible.
 *
 * The original decision/mode is preserved on the returned object as
 * `originalDecision` / `originalMode` so the explanation panel can still
 * show what the system did by default.
 */
export function applyThreshold(span, threshold) {
  const wouldRedact = span.confidence >= threshold
  let effectiveDecision = wouldRedact ? 'redacted' : 'kept_visible'
  let effectiveMode = null
  if (effectiveDecision === 'redacted') {
    effectiveMode = span.mode || 'anonymize'
  }
  return {
    ...span,
    effectiveDecision,
    effectiveMode,
    originalDecision: span.decision,
    originalMode: span.mode,
  }
}

/** Human-readable PII type label, e.g. PERSON_NAME -> "Person Name". */
export function prettyType(type) {
  return type
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Anonymize-mode token like [NAME_1], [EMAIL_2]. Stable per id. */
export function tokenFor(span) {
  const base = span.type.split('_')[0]
  const trailing = (span.id.match(/\d+/) || ['1'])[0]
  return `[${base}_${trailing}]`
}
