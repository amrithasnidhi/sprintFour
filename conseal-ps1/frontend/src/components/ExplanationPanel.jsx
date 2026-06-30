import ConfidenceBar from './ConfidenceBar'
import ModeTag from './ModeTag'
import { prettyType, tokenFor } from '../lib/spans'

export default function ExplanationPanel({ span }) {
  if (!span) return <EmptyState />

  const isRedacted = span.effectiveDecision === 'redacted'
  const userOverrode =
    span.originalDecision !== span.effectiveDecision &&
    span.originalDecision !== undefined

  return (
    <section
      className="rounded-2xl border border-rule bg-white shadow-panel p-6 sm:p-7"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          Decision
        </span>
        <DetectionTag method={span.detection_method} />
      </div>

      <div className="flex items-center flex-wrap gap-2 mb-3">
        <TypeBadge type={span.type} />
        {isRedacted && <ModeTag mode={span.effectiveMode} />}
        {!isRedacted && <KeptVisibleTag />}
      </div>

      <div className="mb-5">
        <div className="text-[11px] uppercase tracking-[0.08em] text-muted mb-1">
          Span
        </div>
        <div className="font-mono text-[13px] bg-canvas border border-rule rounded-lg px-3 py-2 text-ink break-all">
          {isRedacted && span.effectiveMode === 'anonymize' ? (
            <>
              <span className="text-accent font-semibold">{tokenFor(span)}</span>
              <span className="text-muted"> ← {span.text}</span>
            </>
          ) : isRedacted ? (
            <span className="text-muted">[redacted — {span.text.length} chars]</span>
          ) : (
            <span>{span.text}</span>
          )}
        </div>
      </div>

      <div className="mb-5">
        <ConfidenceBar value={span.confidence} />
      </div>

      <div className="mb-2">
        <div className="text-[11px] uppercase tracking-[0.08em] text-muted mb-1.5">
          Why this decision
        </div>
        <p className="text-[14px] leading-relaxed text-ink/90">{span.reason}</p>
      </div>

      {userOverrode && (
        <div className="mt-4 pt-4 border-t border-rule">
          <div className="text-[11px] uppercase tracking-[0.08em] text-muted mb-1">
            Your threshold changed this
          </div>
          <p className="text-[12px] text-ink/70">
            Conseal originally chose{' '}
            <strong className="text-ink">{span.originalDecision.replace('_', ' ')}</strong>
            . At your current threshold, this span is{' '}
            <strong className="text-ink">{span.effectiveDecision.replace('_', ' ')}</strong>.
          </p>
        </div>
      )}
    </section>
  )
}

function EmptyState() {
  return (
    <section className="rounded-2xl border border-dashed border-rule bg-white/60 p-7 text-center">
      <div className="mx-auto h-10 w-10 rounded-full bg-accent-soft flex items-center justify-center mb-3">
        <span className="text-accent text-lg">?</span>
      </div>
      <h3 className="text-sm font-semibold text-ink">
        Click any highlighted or underlined text
      </h3>
      <p className="text-[13px] text-muted mt-1.5 leading-relaxed">
        Every decision has a reason. Both the things we hid and the things we
        deliberately kept visible.
      </p>
    </section>
  )
}

function TypeBadge({ type }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.04] border border-ink/10 px-2.5 py-1 text-[11px] font-medium text-ink">
      <span className="font-mono text-[10px] opacity-60">PII</span>
      {prettyType(type)}
    </span>
  )
}

function KeptVisibleTag() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Kept visible
    </span>
  )
}

function DetectionTag({ method }) {
  const isRule = method === 'rule_matched'
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
        isRule ? 'text-emerald-700' : 'text-violet-700'
      }`}
      title={
        isRule
          ? 'Deterministic — matched a strict pattern'
          : 'Soft judgment — AI assessment'
      }
    >
      <DetectionIcon isRule={isRule} />
      {isRule ? 'Rule-matched' : 'AI-judged'}
    </span>
  )
}

function DetectionIcon({ isRule }) {
  if (isRule) {
    return (
      <svg
        viewBox="0 0 14 14"
        className="h-3 w-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 7l3 3 5-6" />
      </svg>
    )
  }
  return (
    <svg
      viewBox="0 0 14 14"
      className="h-3 w-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="5" />
      <path d="M7 4.5v3l1.8 1.2" />
    </svg>
  )
}
