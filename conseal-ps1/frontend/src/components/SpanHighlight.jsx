import { tokenFor } from '../lib/spans'

/**
 * Renders a single inline PII span. Three distinct visual treatments:
 *  - `redact` mode    → solid dark block with lock glyph (the hidden text
 *                       still occupies its full width so layout doesn't shift)
 *  - `anonymize` mode → monospace pill like [NAME_1] (rule_matched = solid
 *                       border; heuristic_judged = dashed border)
 *  - kept_visible     → original text with a dotted blue underline
 */
export default function SpanHighlight({ span, onSelect, isSelected }) {
  const selectedClass = isSelected ? 'span-selected' : ''
  const handleClick = (e) => {
    e.preventDefault()
    onSelect(span.id)
  }

  if (span.effectiveDecision === 'kept_visible') {
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClick(e)}
        className={`cursor-target kept-visible ${selectedClass}`}
        title="Considered and kept visible — click for reasoning"
      >
        {span.text}
      </span>
    )
  }

  if (span.effectiveMode === 'redact') {
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClick(e)}
        className={`cursor-target redact-block ${selectedClass}`}
        title="Permanently removed — click to see why"
        aria-label={`Redacted ${span.type}`}
      >
        <LockGlyph />
        <span aria-hidden="true">{span.text}</span>
      </span>
    )
  }

  // anonymize mode — rule_matched gets solid border, heuristic_judged gets dashed
  const pillClass =
    span.detection_method === 'heuristic_judged'
      ? 'anonymize-pill-heuristic'
      : 'anonymize-pill'

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClick(e)}
      className={`cursor-target ${pillClass} ${selectedClass}`}
      title="Anonymized — recoverable via map. Click for details."
    >
      {tokenFor(span)}
    </span>
  )
}

function LockGlyph() {
  return (
    <svg
      viewBox="0 0 12 12"
      className="h-2.5 w-2.5 mr-1 inline-block text-white/70"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M3 5V3.5a3 3 0 1 1 6 0V5h.5A1.5 1.5 0 0 1 11 6.5v3A1.5 1.5 0 0 1 9.5 11h-7A1.5 1.5 0 0 1 1 9.5v-3A1.5 1.5 0 0 1 2.5 5H3Zm1.5 0h3V3.5a1.5 1.5 0 0 0-3 0V5Z" />
    </svg>
  )
}
