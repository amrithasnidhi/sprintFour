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
      className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-md shadow-2xl overflow-hidden"
      aria-live="polite"
    >
      {/* Gradient header band */}
      <div className="bg-gradient-to-br from-accent/[0.1] to-violet-500/[0.05] border-b border-white/5 px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent font-semibold">
            Detection Reasoning
          </span>
          <DetectionTag method={span.detection_method} />
        </div>
      </div>

      <div className="p-6 sm:p-7">
        <div className="flex items-center flex-wrap gap-2 mb-4">
          <TypeBadge type={span.type} />
          {isRedacted && <ModeTag mode={span.effectiveMode} />}
          {!isRedacted && <KeptVisibleTag />}
        </div>

        <div className="mb-5">
          <div className="text-[11px] uppercase tracking-[0.08em] text-muted mb-1">
            Span
          </div>
          <div className="font-mono text-[13px] bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2 text-ink break-all">
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
          <div className="mt-4 pt-4 border-t border-white/5">
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
      </div>
    </section>
  )
}

function EmptyState() {
  return (
    <section className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-accent/20 to-violet-500/10 border border-accent/20 flex items-center justify-center mb-4">
        <svg
          viewBox="0 0 20 20"
          className="h-7 w-7 text-accent"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="m13 13 3.5 3.5" />
          <path d="M8.5 6.5v4M6.5 8.5h4" />
        </svg>
      </div>
      <h3 className="text-[15px] font-semibold text-ink mb-1.5">
        Select a span to inspect
      </h3>
      <p className="text-[13px] text-muted leading-relaxed max-w-[24ch] mx-auto">
        Click any highlighted token in the document to see the full detection reasoning.
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
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-400">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      Kept visible
    </span>
  )
}

function DetectionTag({ method }) {
  const isRule = method === 'rule_matched'
  const label = isRule ? 'Rule-matched' : 'Heuristic-judged'
  const title = isRule
    ? 'Deterministic — matched a strict regex pattern; confidence is genuinely earned'
    : 'Heuristic judgment — name/location/demographic heuristic; confidence is intentionally softer'
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
        isRule ? 'text-emerald-400' : 'text-violet-400'
      }`}
      title={title}
    >
      <DetectionIcon isRule={isRule} />
      {label}
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
