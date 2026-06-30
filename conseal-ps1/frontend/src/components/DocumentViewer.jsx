import { buildSegments } from '../lib/spans'
import SpanHighlight from './SpanHighlight'

export default function DocumentViewer({
  text,
  spans,
  selectedSpanId,
  onSelectSpan,
}) {
  const segments = buildSegments(text, spans)

  return (
    <article className="rounded-2xl border border-rule bg-white shadow-panel overflow-hidden">
      {/* Accent top bar */}
      <div className="h-[3px] bg-gradient-to-r from-accent via-violet-500 to-indigo-400" />

      <div className="p-8 sm:p-10">
        <header className="mb-6 pb-5 border-b border-rule">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Scan complete · Conseal PII
            </span>
          </div>
          <h2 className="text-[22px] font-bold tracking-tight text-ink">
            Highlighted spans are{' '}
            <span className="text-accent">potential PII.</span>
          </h2>
          <p className="mt-1 text-[13px] text-muted">
            Click any token to see the full detection reasoning in the panel.
          </p>
        </header>

        <div className="font-mono text-[15px] leading-[1.85] text-ink/90 whitespace-pre-wrap break-words">
          {segments.map((seg, i) =>
            seg.kind === 'text' ? (
              <span key={i}>{seg.text}</span>
            ) : (
              <SpanHighlight
                key={seg.span.id}
                span={seg.span}
                onSelect={onSelectSpan}
                isSelected={selectedSpanId === seg.span.id}
              />
            )
          )}
        </div>
      </div>
    </article>
  )
}
