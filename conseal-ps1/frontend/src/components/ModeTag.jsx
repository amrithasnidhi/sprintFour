export default function ModeTag({ mode, compact = false }) {
  if (!mode) return null
  const isRedact = mode === 'redact'
  const label = isRedact ? 'Redact' : 'Anonymize'
  const sub = isRedact ? 'permanently removed' : 'recoverable via map'

  const base =
    'inline-flex items-center gap-1.5 rounded-full border font-medium tracking-tight'
  const palette = isRedact
    ? 'border-ink/15 bg-ink text-white'
    : 'border-accent/30 bg-accent-soft text-accent'
  const size = compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'

  return (
    <span className={`${base} ${palette} ${size}`} title={sub}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isRedact ? 'bg-white/80' : 'bg-accent'
        }`}
      />
      {label}
      {!compact && <span className="opacity-70 font-normal">· {sub}</span>}
    </span>
  )
}
