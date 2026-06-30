export default function ConfidenceSlider({
  value,
  onChange,
  redactedCount,
  totalCount,
}) {
  const pct = Math.round(value * 100)
  return (
    <section>
      {/* Header */}
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent mb-1">
        Global Control
      </p>
      <h3 className="text-[22px] font-extrabold tracking-tight text-ink mb-1">
        Precision Threshold
      </h3>
      <p className="text-[13px] text-muted leading-relaxed mb-4">
        Calibrate trust yourself. Items at or above this confidence level are
        redacted across the entire document.
      </p>

      {/* Card */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-md shadow-2xl overflow-hidden">
        {/* Gradient slider zone */}
        <div className="bg-gradient-to-br from-accent/[0.1] to-violet-500/[0.05] border-b border-white/5 px-5 pt-4 pb-5 space-y-3">
          {/* Threshold label + number */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent font-semibold">
              Confidence Threshold
            </span>
            <span className="font-mono text-[30px] font-extrabold text-accent leading-none">
              {pct}
            </span>
          </div>

          {/* Slider */}
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

          {/* Scale labels */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
              0 — All Flagged
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
              100 — Certainties Only
            </span>
          </div>
        </div>

        {/* Count row */}
        <div className="px-5 py-4 flex items-center gap-3">
          <div className="flex-shrink-0 h-11 w-11 rounded-full bg-accent flex items-center justify-center shadow-sm">
            <span className="font-mono text-[15px] font-extrabold text-white leading-none">
              {redactedCount}
            </span>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-ink leading-snug">
              {redactedCount} of {totalCount} items redacted
            </p>
            <p className="text-[11px] text-muted">Applied across entire document</p>
          </div>
        </div>
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
            rgba(255, 255, 255, 0.1) ${pct}%,
            rgba(255, 255, 255, 0.1) 100%
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
    </section>
  )
}
