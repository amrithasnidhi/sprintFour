export default function ConfidenceSlider({
  value,
  onChange,
  redactedCount,
  totalCount,
}) {
  const pct = Math.round(value * 100)
  return (
    <div className="rounded-2xl border border-rule bg-white shadow-panel p-6">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-[11px] uppercase tracking-[0.14em] text-muted">
          Confidence threshold
        </h3>
        <span className="font-mono text-lg font-semibold text-ink">{pct}</span>
      </div>
      <p className="text-[12px] text-muted mb-4 leading-snug">
        Calibrate trust yourself. Items at or above this confidence get
        redacted.
      </p>

      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={pct}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="conseal-range w-full"
        aria-label="Confidence threshold"
      />

      <div className="mt-4 flex items-center justify-between text-[12px]">
        <span className="text-muted">0 — redact everything flagged</span>
        <span className="text-muted">100 — only redact certainties</span>
      </div>

      <div className="mt-5 rounded-lg bg-accent-soft border border-accent/20 px-3 py-2.5">
        <p className="text-[13px] text-accent font-medium">
          <span className="font-mono font-semibold">{redactedCount}</span> of{' '}
          <span className="font-mono font-semibold">{totalCount}</span> flagged
          items would be redacted at this threshold.
        </p>
      </div>

      <style>{`
        input.conseal-range {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          background: linear-gradient(
            to right,
            #2563EB 0%,
            #2563EB ${pct}%,
            #E2E8F0 ${pct}%,
            #E2E8F0 100%
          );
          border-radius: 9999px;
          outline: none;
        }
        input.conseal-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          background: #ffffff;
          border: 2px solid #2563EB;
          border-radius: 9999px;
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(15, 23, 42, 0.18);
        }
        input.conseal-range::-moz-range-thumb {
          width: 18px;
          height: 18px;
          background: #ffffff;
          border: 2px solid #2563EB;
          border-radius: 9999px;
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(15, 23, 42, 0.18);
        }
      `}</style>
    </div>
  )
}
