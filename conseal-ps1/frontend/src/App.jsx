import { useRef, useMemo, useState } from 'react'
import Wordmark from './components/Wordmark'
import DocumentViewer from './components/DocumentViewer'
import ExplanationPanel from './components/ExplanationPanel'
import ConfidenceSlider from './components/ConfidenceSlider'
import ScrollReveal from './components/ScrollReveal'
import TargetCursor from './components/TargetCursor'
import ClearedPanel from './components/ClearedPanel'
import Dither from './components/Dither'
import { applyThreshold } from './lib/spans'

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  // 'upload' | 'loading' | 'uploading' | 'error' | 'ready'
  const [status, setStatus] = useState('upload')
  const [docText, setDocText] = useState('')
  const [rawSpans, setRawSpans] = useState([])
  const [errorMsg, setErrorMsg] = useState('')
  const [selectedSpanId, setSelectedSpanId] = useState(null)
  const [threshold, setThreshold] = useState(0.5)
  // 'document' | 'audit'
  const [activeTab, setActiveTab] = useState('document')

  // ── API calls ───────────────────────────────────────────────────────────────
  const fetchSample = async () => {
    setStatus('loading')
    setErrorMsg('')
    setSelectedSpanId(null)
    try {
      const res = await fetch('/api/sample')
      if (!res.ok) throw new Error(`API returned ${res.status}`)
      const data = await res.json()
      setDocText(data.document_text)
      setRawSpans(data.spans)
      setStatus('ready')
      setActiveTab('document')
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load sample document')
      setStatus('error')
    }
  }

  const handleUpload = async (file) => {
    setStatus('uploading')
    setErrorMsg('')
    setSelectedSpanId(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/process', { method: 'POST', body: formData })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || `Upload failed (${res.status})`)
      }
      const data = await res.json()
      setDocText(data.document_text)
      setRawSpans(data.spans)
      setStatus('ready')
      setActiveTab('document')
    } catch (err) {
      setErrorMsg(err.message || 'Upload failed')
      setStatus('error')
    }
  }

  const handleBack = () => {
    setStatus('upload')
    setDocText('')
    setRawSpans([])
    setErrorMsg('')
    setSelectedSpanId(null)
    setActiveTab('document')
  }

  // ── Derived state ───────────────────────────────────────────────────────────
  const effectiveSpans = useMemo(
    () => rawSpans.map((s) => applyThreshold(s, threshold)),
    [rawSpans, threshold]
  )

  const selectedSpan = useMemo(
    () => effectiveSpans.find((s) => s.id === selectedSpanId) || null,
    [effectiveSpans, selectedSpanId]
  )

  const redactedCount = effectiveSpans.filter(
    (s) => s.effectiveDecision === 'redacted'
  ).length

  const handleSelectSpan = (id) => {
    const isDeselecting = selectedSpanId === id
    setSelectedSpanId(isDeselecting ? null : id)
    if (!isDeselecting) setActiveTab('document')
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <TargetCursor
        spinDuration={2}
        hideDefaultCursor
        parallaxOn
        cursorColor="#ffffff"
        cursorColorOnTarget="#6366f1"
      />

      {status !== 'ready' ? (
        <UploadPage
          status={status}
          errorMsg={errorMsg}
          onUpload={handleUpload}
          onSample={fetchSample}
        />
      ) : (
        <ReviewPage
          docText={docText}
          effectiveSpans={effectiveSpans}
          selectedSpanId={selectedSpanId}
          selectedSpan={selectedSpan}
          threshold={threshold}
          setThreshold={setThreshold}
          redactedCount={redactedCount}
          onSelectSpan={handleSelectSpan}
          onBack={handleBack}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          rawSpansCount={rawSpans.length}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen 1 — Upload Page (dark Dither hero)
// ─────────────────────────────────────────────────────────────────────────────
function UploadPage({ status, errorMsg, onUpload, onSample }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [localError, setLocalError] = useState('')

  const ACCEPTED_EXTS = ['.txt', '.docx', '.pdf']
  const MAX_MB = 25

  function validate(file) {
    const ext = file.name.split('.').pop().toLowerCase()
    if (!ACCEPTED_EXTS.includes(`.${ext}`)) {
      return `Unsupported type: .${ext}. Upload a .txt, .docx, or .pdf.`
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is ${MAX_MB} MB.`
    }
    return null
  }

  function handle(file) {
    setLocalError('')
    const err = validate(file)
    if (err) { setLocalError(err); return }
    onUpload(file)
  }

  const isLoading = status === 'loading' || status === 'uploading'

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-canvas">
      {/* ── Full-screen Dither background ── */}
      <div className="absolute inset-0 z-0">
        <Dither
          waveColor={[0.14, 0.22, 0.70]}
          disableAnimation={false}
          enableMouseInteraction={true}
          mouseRadius={0.45}
          colorNum={4}
          waveAmplitude={0.32}
          waveFrequency={3}
          waveSpeed={0.04}
          pixelSize={2}
        />
      </div>
      {/* Vignette — fades edges to deep navy so content pops */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 80% at 50% 50%, rgba(11, 15, 25, 0.4) 0%, #0B0F19 100%)',
        }}
      />
      {/* Bottom fade so the tab bar blends */}
      <div className="absolute bottom-0 left-0 right-0 h-32 z-[1] pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, #0B0F19)' }}
      />

      {/* ── Header ── */}
      <header className="relative z-10 border-b border-white/[0.08] bg-white/[0.03] backdrop-blur sticky top-0">
        <div className="max-w-md mx-auto px-6 h-14 flex items-center justify-between">
          {/* White wordmark for dark bg */}
          <div className="inline-flex items-baseline gap-[1px] select-none">
            <span className="text-[20px] font-extrabold tracking-tight leading-none text-white">Con</span>
            <span className="wordmark-chip">seal</span>
          </div>
          <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-blue-500 text-white text-sm font-semibold">
            A
          </span>
        </div>
      </header>

      {/* ── Body ── */}
      <main className="relative z-10 flex-1 flex flex-col items-center px-6 py-12">
        <div className="w-full max-w-md space-y-7">

          {/* Hero text */}
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.20em] text-blue-400/80 mb-4">
              Private by Design
            </p>
            <h1 className="text-[46px] sm:text-[52px] leading-[0.93] font-extrabold tracking-tight text-white mb-5">
              Anonymize.
              <br />
              Work.
              <br />
              <span className="text-blue-400">Restore.</span>
            </h1>
            <p className="text-white/80 text-[14px] leading-relaxed max-w-[32ch]">
              Swap PII for safe placeholders before any AI sees the file.
              Restore the real values when you are done.
            </p>
          </div>

          {/* Two-stage detection card — glass */}
          <div className="rounded-xl border border-white/10 bg-[#0B0F19]/70 backdrop-blur-md p-5 space-y-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/60">
              Two-stage detection
            </div>
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 h-4 w-4 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-[9px] font-bold shrink-0">
                1
              </span>
              <div>
                <p className="text-[12px] font-semibold text-white/90">Rule layer</p>
                <p className="text-[11px] text-white/70">
                  Regex for email, phone, SSN, policy numbers, dates, MRN, NPI.
                  Deterministic — confidence 0.95–1.00.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 h-4 w-4 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-400 flex items-center justify-center text-[9px] font-bold shrink-0">
                2
              </span>
              <div>
                <p className="text-[12px] font-semibold text-white/90">Judgment layer</p>
                <p className="text-[11px] text-white/70">
                  Heuristics for names, locations, addresses, demographics. Softer —
                  confidence 0.35–0.90.
                </p>
              </div>
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); if (!isLoading) setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              const file = e.dataTransfer.files?.[0]
              if (file && !isLoading) handle(file)
            }}
            className={`rounded-2xl border-2 border-dashed p-8 text-center transition-all backdrop-blur-md ${
              dragOver
                ? 'border-accent/60 bg-accent/20'
                : 'border-white/20 bg-[#0B0F19]/70 hover:border-white/30 hover:bg-[#0B0F19]/90'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_EXTS.join(',')}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handle(file)
                e.target.value = ''
              }}
              className="hidden"
              disabled={isLoading}
            />

            {isLoading ? (
              <div className="flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                  <svg className="h-7 w-7 animate-spin text-blue-400" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[16px] font-semibold text-white mb-1">
                    {status === 'uploading' ? 'Uploading…' : 'Loading sample…'}
                  </p>
                  <p className="text-[13px] text-white/40">Running two-stage detection pipeline</p>
                </div>
                <div className="space-y-2 w-full max-w-[220px] text-left mt-1">
                  {[
                    { label: 'Extracting text from file', done: true },
                    { label: 'Stage 1 — rule layer (regex)', done: true },
                    { label: 'Stage 2 — judgment layer (heuristics)', done: false },
                    { label: 'Merging and resolving overlaps', done: false },
                  ].map(({ label, done }) => (
                    <div key={label} className="flex items-center gap-2 text-[11px]">
                      {done ? (
                        <svg viewBox="0 0 12 12" className="h-3 w-3 text-emerald-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M2 6l3 3 5-6" />
                        </svg>
                      ) : (
                        <div className="h-3 w-3 rounded-full border-2 border-blue-500/30 border-t-blue-400 animate-spin shrink-0" />
                      )}
                      <span className={done ? 'text-white/80' : 'text-white/30'}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : status === 'error' ? (
              <div className="flex flex-col items-center gap-3">
                <div className="h-14 w-14 rounded-full bg-red-500/15 border border-red-500/25 flex items-center justify-center">
                  <svg viewBox="0 0 20 20" className="h-7 w-7 text-red-400" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="10" cy="10" r="8" />
                    <path d="M10 6v4M10 14h.01" />
                  </svg>
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-red-300 mb-1">Something went wrong</p>
                  <p className="text-[12px] text-red-400/70">{errorMsg}</p>
                </div>
                <button onClick={onSample} className="cursor-target mt-1 rounded-lg bg-red-500 px-4 py-2 text-[13px] font-medium text-white hover:bg-red-400 transition-colors">
                  Retry with sample
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-white/[0.07] border border-white/15 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="h-8 w-8 text-blue-400" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 4v12M8 8l4-4 4 4" />
                    <path d="M14 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  </svg>
                </div>
                <div>
                  <p className="text-[20px] font-bold text-white mb-1">Drop your file here</p>
                  <p className="text-[13px] text-white/70">
                    PDF, DOCX, or plain text — up to 25 MB.
                  </p>
                </div>
                <button
                  onClick={() => inputRef.current?.click()}
                  className="cursor-target w-full rounded-xl bg-blue-500 text-white font-semibold text-[15px] py-3.5 hover:bg-blue-400 transition-colors shadow-lg shadow-blue-500/20"
                >
                  + Choose File
                </button>
                {localError && <p className="text-[12px] text-red-400 -mt-2">{localError}</p>}
                <button onClick={onSample} className="cursor-target text-[13px] text-white/70 hover:text-white hover:underline underline-offset-2 transition-colors mt-2">
                  Try a sample document →
                </button>
              </div>
            )}
          </div>

          {/* Trust badges */}
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/40 text-center">
            AES-256 Encrypted · HIPAA Compliant · Zero Data Retention · V.2.4.0
          </p>
        </div>
      </main>

      {/* ── Bottom tab bar ── */}
      <nav className="relative z-10 border-t border-white/[0.08] bg-white/[0.03] backdrop-blur">
        <div className="max-w-md mx-auto flex">
          <DarkTabBarItem icon={<DocIcon />} label="Document" active />
          <DarkTabBarItem icon={<ListIcon />} label="Audit List" active={false} disabled />
        </div>
      </nav>
    </div>
  )
}

function DarkTabBarItem({ icon, label, active, disabled }) {
  return (
    <button
      disabled={disabled}
      className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-3 text-[10px] font-mono uppercase tracking-[0.12em] transition-colors ${
        disabled
          ? 'text-white/15 cursor-not-allowed'
          : active
          ? 'text-blue-400 border-t-2 border-blue-400 -mt-px'
          : 'text-white/30 hover:text-white/60'
      }`}
    >
      <span>{icon}</span>
      {label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen 2 + 3 — Review Page
// ─────────────────────────────────────────────────────────────────────────────
function ReviewPage({
  docText,
  effectiveSpans,
  selectedSpanId,
  selectedSpan,
  threshold,
  setThreshold,
  redactedCount,
  onSelectSpan,
  onBack,
  activeTab,
  setActiveTab,
  rawSpansCount,
}) {
  const spanCount = effectiveSpans.length

  const handleExport = () => {
    let report = `Conseal Anonymization Report\n`
    report += `============================\n\n`
    report += `Confidence Threshold Applied: ${threshold.toFixed(2)}\n`
    report += `Total Spans Detected: ${effectiveSpans.length}\n`
    report += `Spans Redacted/Anonymized: ${redactedCount}\n`
    report += `Spans Kept Visible: ${effectiveSpans.length - redactedCount}\n\n`
    report += `--- SPAN AUDIT ---\n\n`

    effectiveSpans.forEach((span, idx) => {
      report += `[${idx + 1}] Text: "${span.text}"\n`
      report += `    Type: ${span.type}\n`
      report += `    Method: ${span.method === 'rule_matched' ? 'Rule layer (Regex)' : 'Judgment layer (Heuristics)'}\n`
      report += `    Confidence: ${span.confidence.toFixed(2)}\n`
      report += `    Final Decision: ${span.effectiveDecision.toUpperCase()} `
      if (span.effectiveDecision === 'kept_visible') {
        report += `(Reason: confidence below threshold of ${threshold.toFixed(2)})\n`
      } else {
        report += `(Mode: ${span.effectiveMode})\n`
      }
      report += `\n`
    })

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'conseal_audit_report.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      {/* ── Header ── */}
      <header className="border-b border-rule bg-canvas/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 h-14 flex items-center gap-3">
          {/* Back */}
          <button
            onClick={onBack}
            className="cursor-target flex items-center justify-center h-8 w-8 rounded-lg border border-rule bg-white/[0.02] hover:bg-white/[0.06] hover:border-accent/40 transition-colors shrink-0"
            aria-label="Back to upload"
          >
            <svg
              viewBox="0 0 14 14"
              className="h-3.5 w-3.5 text-ink"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 2L4 7l5 5" />
            </svg>
          </button>

          {/* Wordmark — centered */}
          <div className="flex-1 flex justify-center">
            <Wordmark />
          </div>

          {/* Right slot */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleExport}
              className="cursor-target inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.02] px-3 py-1 text-[11px] font-medium text-ink hover:border-accent/50 hover:text-accent hover:bg-white/[0.04] transition-colors"
            >
              <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 2v5M4 5l3 3 3-3" />
                <path d="M2 11h10" />
              </svg>
              Export Report
            </button>
            {activeTab === 'document' ? (
              <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-accent-soft border border-accent/20 px-2.5 py-1 font-mono text-[11px] font-semibold text-accent">
                {spanCount} spans
              </span>
            ) : (
              <button
                onClick={onBack}
                className="cursor-target shrink-0 text-[12px] text-accent hover:underline underline-offset-2"
              >
                Back to Upload
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Sub-banner (document tab only) ── */}
      {activeTab === 'document' && (
        <div className="border-b border-rule bg-white/[0.01]">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8 h-10 flex items-center justify-between gap-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              {rawSpansCount} spans detected · real pipeline
            </p>
            <button
              onClick={onBack}
              className="cursor-target inline-flex items-center gap-1.5 rounded-md border border-rule bg-white/[0.02] px-3 py-1 text-[11px] font-medium text-ink hover:border-accent/50 hover:text-accent hover:bg-white/[0.04] transition-colors shrink-0"
            >
              <svg
                viewBox="0 0 14 14"
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M7 2v7M4 5l3-3 3 3" />
                <path d="M2 10v1a1 1 0 001 1h8a1 1 0 001-1v-1" />
              </svg>
              ↑ Upload your own
            </button>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-8 py-6">
        {/* Mobile: show one panel at a time based on tab */}
        <div className="lg:hidden">
          {activeTab === 'document' ? (
            <div className="space-y-4">
              <DocumentViewer
                text={docText}
                spans={effectiveSpans}
                selectedSpanId={selectedSpanId}
                onSelectSpan={onSelectSpan}
              />
              {selectedSpan && (
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted mb-2">
                    Explanation
                  </div>
                  <ExplanationPanel span={selectedSpan} />
                </div>
              )}
            </div>
          ) : (
            <AuditTabContent
              effectiveSpans={effectiveSpans}
              selectedSpanId={selectedSpanId}
              threshold={threshold}
              setThreshold={setThreshold}
              redactedCount={redactedCount}
              onSelectSpan={(id) => { onSelectSpan(id); setActiveTab('document') }}
            />
          )}
        </div>

        {/* Desktop: two columns */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-8">
          {/* Left — document (always visible) */}
          <section className="col-span-7">
            <DocumentViewer
              text={docText}
              spans={effectiveSpans}
              selectedSpanId={selectedSpanId}
              onSelectSpan={onSelectSpan}
            />
          </section>

          {/* Right — tabbed panel */}
          <aside className="col-span-5 sticky top-20 self-start">
            {/* Desktop tab row — pill style */}
            <div className="flex gap-1 bg-canvas border border-rule rounded-xl p-1 mb-4">
              <SidebarTab
                label="Explanation"
                icon={<ExplainIcon />}
                active={activeTab === 'document'}
                onClick={() => setActiveTab('document')}
              />
              <SidebarTab
                label="Audit List"
                icon={<ListIcon />}
                badge={spanCount}
                active={activeTab === 'audit'}
                onClick={() => setActiveTab('audit')}
              />
            </div>

            {activeTab === 'document' ? (
              <ExplanationPanel span={selectedSpan} />
            ) : (
              <AuditTabContent
                effectiveSpans={effectiveSpans}
                selectedSpanId={selectedSpanId}
                threshold={threshold}
                setThreshold={setThreshold}
                redactedCount={redactedCount}
                onSelectSpan={(id) => { onSelectSpan(id); setActiveTab('document') }}
              />
            )}
          </aside>
        </div>
      </main>

      {/* ── Bottom tab bar (mobile) ── */}
      <nav className="lg:hidden border-t border-rule bg-canvas sticky bottom-0 z-10">
        <div className="flex">
          <TabBarItem
            icon={<DocIcon />}
            label="Document"
            active={activeTab === 'document'}
            onClick={() => setActiveTab('document')}
          />
          <TabBarItem
            icon={<ListIcon />}
            label="Audit List"
            active={activeTab === 'audit'}
            onClick={() => setActiveTab('audit')}
          />
        </div>
      </nav>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen 3 content — Audit tab
// ─────────────────────────────────────────────────────────────────────────────
function AuditTabContent({
  effectiveSpans,
  selectedSpanId,
  threshold,
  setThreshold,
  redactedCount,
  onSelectSpan,
}) {
  return (
    <div className="space-y-6">
      <ConfidenceSlider
        value={threshold}
        onChange={setThreshold}
        redactedCount={redactedCount}
        totalCount={effectiveSpans.length}
      />
      <ClearedPanel
        spans={effectiveSpans}
        selectedSpanId={selectedSpanId}
        onSelectSpan={onSelectSpan}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────
function TabBarItem({ icon, label, active, onClick, disabled }) {
  return (
    <button
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
      className={`cursor-target flex-1 flex flex-col items-center justify-center gap-0.5 py-3 text-[10px] font-mono uppercase tracking-[0.12em] transition-colors ${
        disabled
          ? 'text-muted/40 cursor-not-allowed'
          : active
          ? 'text-accent border-t-2 border-accent -mt-px'
          : 'text-muted hover:text-ink'
      }`}
    >
      <span className={active && !disabled ? 'text-accent' : ''}>{icon}</span>
      {label}
    </button>
  )
}

function SidebarTab({ label, icon, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`cursor-target flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all ${
        active
          ? 'bg-white/[0.06] shadow-sm text-ink border border-white/10'
          : 'text-muted hover:text-ink hover:bg-white/[0.02]'
      }`}
    >
      <span className={active ? 'text-accent' : 'opacity-60'}>{icon}</span>
      {label}
      {badge !== undefined && (
        <span
          className={`ml-0.5 rounded-full px-1.5 py-px font-mono text-[9px] font-bold leading-none ${
            active ? 'bg-accent text-white' : 'bg-rule text-muted'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

function ExplainIcon() {
  return (
    <svg
      viewBox="0 0 14 14"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="5.5" />
      <path d="M7 6v3.5M7 4.2h.01" />
    </svg>
  )
}

function DocIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
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

function ListIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 4h10M3 8h10M3 12h6" />
    </svg>
  )
}
