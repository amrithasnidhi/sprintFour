/**
 * A confidence bar gets bigger and bluer as confidence climbs. Below 0.5
 * shows up in a warning amber so borderline cases don't look identical to
 * confident ones (F2 edge-case requirement).
 */
export default function ConfidenceBar({ value }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  const isLow = value < 0.5
  const isMid = !isLow && value < 0.8
  const fillClass = isLow
    ? 'bg-amber-500'
    : isMid
    ? 'bg-accent/70'
    : 'bg-accent'
  const labelClass = isLow ? 'text-amber-400' : 'text-ink'

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[11px] uppercase tracking-[0.08em] text-muted">
          Confidence
        </span>
        <span className={`font-mono text-sm font-semibold ${labelClass}`}>
          {pct}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-rule overflow-hidden">
        <div
          className={`h-full ${fillClass} transition-[width] duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isLow && (
        <p className="mt-1.5 text-[11px] text-amber-400">
          Borderline — worth your own review.
        </p>
      )}
    </div>
  )
}
