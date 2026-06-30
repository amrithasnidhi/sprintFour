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
    <article className="rounded-2xl border border-rule bg-white shadow-panel p-8 sm:p-10">
      <header className="mb-6 pb-4 border-b border-rule">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          Patient Confidentiality Form · Meridian Medical Center
        </div>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink">
          Redact. Keep no mapping. <span className="text-muted">No way back.</span>
        </h2>
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
    </article>
  )
}
