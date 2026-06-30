import { buildSegments } from '../lib/spans'
import SpanHighlight from './SpanHighlight'

export default function DocumentViewer({
  text,
  spans,
  selectedSpanId,
  onSelectSpan,
  compact = false,
}) {
  const segments = buildSegments(text, spans)

  return (
    <article className={`rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-md shadow-2xl overflow-hidden ${compact ? 'overflow-y-auto max-h-[calc(100vh-9rem)]' : ''}`}>
      {/* Accent top bar */}
      <div className="h-[3px] bg-gradient-to-r from-accent via-violet-500 to-indigo-400" />

      <div className={compact ? 'p-5' : 'p-8 sm:p-10'}>
        <header className={`border-b border-white/5 ${compact ? 'mb-4 pb-3' : 'mb-6 pb-5'}`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Scan complete · Conseal PII
            </span>
          </div>
          <h2 className={`font-bold tracking-tight text-ink ${compact ? 'text-[17px]' : 'text-[22px]'}`}>
            Highlighted spans are{' '}
            <span className="text-accent">potential PII.</span>
          </h2>
          {!compact && (
            <p className="mt-1 text-[13px] text-muted">
              Click any token to see the full detection reasoning in the panel.
            </p>
          )}
        </header>

        <div className={`font-mono leading-[1.85] text-ink/90 whitespace-pre-wrap break-words ${compact ? 'text-[13px]' : 'text-[15px]'}`}>
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
