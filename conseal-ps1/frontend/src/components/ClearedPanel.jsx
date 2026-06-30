import { prettyType } from '../lib/spans'

export default function ClearedPanel({ spans, selectedSpanId, onSelectSpan }) {
  const clearedSpans = spans.filter((s) => s.effectiveDecision === 'kept_visible')

  return (
    <section>
      {/* Card */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-md shadow-2xl p-5">
        {/* Header row */}
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            Visible &amp; Cleared
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
            {clearedSpans.length} item{clearedSpans.length !== 1 ? 's' : ''}
          </span>
        </div>

        <p className="text-[12px] text-muted leading-relaxed mb-4">
          These spans were scanned and deliberately left unredacted. Click any
          row to see the full reasoning.
        </p>

        {clearedSpans.length === 0 ? (
          <div className="text-center py-6">
            <div className="mx-auto h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2">
              <svg
                viewBox="0 0 14 14"
                className="h-4 w-4 text-emerald-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 7l3 3 5-6" />
              </svg>
            </div>
            <p className="text-[12px] text-muted">
              Everything is redacted at this threshold.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {clearedSpans.map((span) => (
              <ClearedRow
                key={span.id}
                span={span}
                isSelected={selectedSpanId === span.id}
                onSelect={onSelectSpan}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function typeIcon(type) {
  const t = type?.toUpperCase() || ''
  if (
    t.includes('PERSON') ||
    t.includes('NAME') ||
    t.includes('HEALTHCARE') ||
    t.includes('FACILITY')
  ) {
    // Document / person icon
    return (
      <svg
        viewBox="0 0 16 16"
        className="h-4 w-4 shrink-0 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="1" width="10" height="14" rx="1.5" />
        <path d="M6 5h4M6 8h4M6 11h2" />
      </svg>
    )
  }
  if (t.includes('LOCATION') || t.includes('ADDRESS') || t.includes('CITY') || t.includes('STATE')) {
    // Location pin icon
    return (
      <svg
        viewBox="0 0 16 16"
        className="h-4 w-4 shrink-0 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M8 1.5a4.5 4.5 0 0 1 4.5 4.5c0 3.5-4.5 8.5-4.5 8.5S3.5 9.5 3.5 6A4.5 4.5 0 0 1 8 1.5Z" />
        <circle cx="8" cy="6" r="1.5" />
      </svg>
    )
  }
  if (t.includes('DATE') || t.includes('DOB') || t.includes('BIRTH')) {
    // Calendar icon
    return (
      <svg
        viewBox="0 0 16 16"
        className="h-4 w-4 shrink-0 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2" y="3" width="12" height="12" rx="1.5" />
        <path d="M2 7h12M5 1v4M11 1v4" />
      </svg>
    )
  }
  // Default: shield icon
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4 shrink-0 text-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 1.5 L13.5 4 V8.5 C13.5 11.5 8 14.5 8 14.5 S2.5 11.5 2.5 8.5 V4 Z" />
    </svg>
  )
}

function methodSuffix(method) {
  if (method === 'rule_matched') return 'RULE'
  if (method === 'heuristic_judged') return 'HEURISTIC'
  return ''
}

function ClearedRow({ span, isSelected, onSelect }) {
  const suffix = methodSuffix(span.detection_method)
  const confPct = Math.round(span.confidence * 100)

  return (
    <li>
      <button
        onClick={() => onSelect(span.id)}
        className={`cursor-target w-full text-left rounded-xl border px-3 py-2.5 transition-colors flex items-center gap-3 ${
          isSelected
            ? 'border-accent/40 bg-accent/[0.1]'
            : 'border-white/5 bg-white/[0.02] hover:border-accent/40 hover:bg-white/[0.04]'
        }`}
      >
        {/* Type icon */}
        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-ink/[0.04] border border-ink/10 flex items-center justify-center">
          {typeIcon(span.type)}
        </div>

        {/* Center text block */}
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[13px] font-semibold text-ink truncate">
            {span.text}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted mt-0.5">
            {prettyType(span.type)}{suffix ? ` · ${suffix}` : ''}
          </div>
        </div>

        {/* Right side: confidence + chevron */}
        <div className="flex-shrink-0 flex items-center gap-1.5">
          <span className="font-mono text-[11px] font-semibold text-muted">
            {confPct}% CONF.
          </span>
          <svg
            viewBox="0 0 8 12"
            className="h-3 w-2 text-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M1 1l6 5-6 5" />
          </svg>
        </div>
      </button>
    </li>
  )
}
