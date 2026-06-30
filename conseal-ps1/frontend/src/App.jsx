import { useEffect, useMemo, useState } from 'react'
import Wordmark from './components/Wordmark'
import DocumentViewer from './components/DocumentViewer'
import ExplanationPanel from './components/ExplanationPanel'
import ConfidenceSlider from './components/ConfidenceSlider'
import FileUpload from './components/FileUpload'
import { applyThreshold } from './lib/spans'

export default function App() {
  // 'loading' | 'ready' | 'uploading' | 'error'
  const [status, setStatus] = useState('loading')
  const [docText, setDocText] = useState('')
  const [rawSpans, setRawSpans] = useState([])
  const [errorMsg, setErrorMsg] = useState('')
  const [selectedSpanId, setSelectedSpanId] = useState(null)
  const [threshold, setThreshold] = useState(0.5)
  const [showUpload, setShowUpload] = useState(false)

  // On mount: fetch the built-in sample document through the real pipeline.
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
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load sample document')
      setStatus('error')
    }
  }

  useEffect(() => { fetchSample() }, [])

  // Handle a user-uploaded file.
  const handleUpload = async (file) => {
    setStatus('uploading')
    setErrorMsg('')
    setSelectedSpanId(null)
    setShowUpload(false)
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
    } catch (err) {
      setErrorMsg(err.message || 'Upload failed')
      setStatus('error')
    }
  }

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

  return (
    <div className="min-h-full flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 sm:px-10 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          <BrandColumn />

          <section className="lg:col-span-5 space-y-4">
            {/* Upload toggle */}
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-muted">
                {status === 'ready'
                  ? `${rawSpans.length} spans detected · real pipeline`
                  : status === 'uploading'
                  ? 'Processing…'
                  : ''}
              </p>
              {status !== 'uploading' && (
                <button
                  onClick={() => setShowUpload((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-rule bg-white px-3 py-1.5 text-[12px] font-medium text-ink hover:border-accent/50 hover:text-accent transition-colors"
                >
                  <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none"
                       stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M7 2v7M4 5l3-3 3 3" />
                    <path d="M2 10v1a1 1 0 001 1h8a1 1 0 001-1v-1" />
                  </svg>
                  {showUpload ? 'Hide upload' : 'Upload your own file'}
                </button>
              )}
            </div>

            {showUpload && (
              <FileUpload onUpload={handleUpload} uploading={false} />
            )}

            {status === 'loading' && <DocumentSkeleton />}
            {status === 'uploading' && <UploadingCard />}
            {status === 'error' && (
              <ErrorCard message={errorMsg} onRetry={fetchSample} />
            )}
            {status === 'ready' && (
              <DocumentViewer
                text={docText}
                spans={effectiveSpans}
                selectedSpanId={selectedSpanId}
                onSelectSpan={(id) =>
                  setSelectedSpanId((prev) => (prev === id ? null : id))
                }
              />
            )}
          </section>

          <aside className="lg:col-span-4 lg:sticky lg:top-24 self-start space-y-6">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted mb-2">
                Explanation
              </div>
              <ExplanationPanel span={selectedSpan} />
            </div>
            <ConfidenceSlider
              value={threshold}
              onChange={setThreshold}
              redactedCount={redactedCount}
              totalCount={effectiveSpans.length}
            />
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  )
}

function TopBar() {
  return (
    <header className="border-b border-rule bg-canvas/80 backdrop-blur sticky top-0 z-20">
      <div className="max-w-[1440px] mx-auto px-6 sm:px-10 h-16 flex items-center justify-between">
        <Wordmark />
        <nav className="flex items-center gap-8 text-[14px] text-ink/80">
          <span className="hidden sm:inline">Problem</span>
          <span className="hidden sm:inline">How It Works</span>
          <span className="hidden sm:inline">Use Cases</span>
          <span className="hidden md:inline">Why Conseal</span>
          <span className="hidden md:inline">Guides</span>
          <span className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-accent text-white text-sm font-semibold">
            A
          </span>
        </nav>
      </div>
    </header>
  )
}

function BrandColumn() {
  return (
    <section className="lg:col-span-3 lg:sticky lg:top-24 self-start">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent mb-6">
        Private by design
      </p>
      <h1 className="text-[44px] sm:text-[52px] leading-[0.95] font-extrabold tracking-tight text-ink">
        Anonymize.
        <br />
        Work.
        <br />
        Restore.
      </h1>
      <p className="mt-7 text-[15px] text-muted leading-relaxed max-w-[34ch]">
        Swap PII for safe placeholders before any AI sees the file.
      </p>
      <p className="mt-3 text-[15px] text-muted leading-relaxed max-w-[34ch]">
        Restore the real values from the mapping when you're done.
      </p>

      <div className="mt-10 rounded-xl border border-rule bg-white p-5 space-y-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          Two-stage detection
        </div>
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 h-4 w-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[9px] font-bold shrink-0">1</span>
          <div>
            <p className="text-[12px] font-semibold text-ink">Rule layer</p>
            <p className="text-[11px] text-muted">Regex for email, phone, SSN, policy numbers, dates, MRN, NPI. Deterministic — confidence 0.95–1.00.</p>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 h-4 w-4 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[9px] font-bold shrink-0">2</span>
          <div>
            <p className="text-[12px] font-semibold text-ink">Judgment layer</p>
            <p className="text-[11px] text-muted">Heuristics for names, locations, addresses, demographics. Softer — confidence 0.35–0.90.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function DocumentSkeleton() {
  return (
    <div className="rounded-2xl border border-rule bg-white shadow-panel p-8">
      <div className="skeleton h-3 w-1/3 mb-3" />
      <div className="skeleton h-6 w-2/3 mb-8" />
      <div className="space-y-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="skeleton h-3" style={{ width: `${70 + ((i * 13) % 25)}%` }} />
        ))}
      </div>
    </div>
  )
}

function UploadingCard() {
  return (
    <div className="rounded-2xl border border-rule bg-white shadow-panel p-8">
      <div className="skeleton h-3 w-1/3 mb-3" />
      <div className="space-y-4 mt-6">
        {[
          { label: 'Extracting text from file', done: true },
          { label: 'Stage 1 — rule layer (regex)', done: true },
          { label: 'Stage 2 — judgment layer (heuristics)', done: false },
          { label: 'Merging and resolving overlaps', done: false },
        ].map(({ label, done }) => (
          <div key={label} className="flex items-center gap-3">
            {done ? (
              <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none"
                     stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M2 6l3 3 5-6" />
                </svg>
              </div>
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-accent/30 border-t-accent animate-spin shrink-0" />
            )}
            <span className={`text-[14px] ${done ? 'text-ink' : 'text-muted'}`}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ErrorCard({ message, onRetry }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-7 shadow-panel">
      <h3 className="text-sm font-semibold text-red-800">Error</h3>
      <p className="mt-1.5 text-[13px] text-red-700">{message}</p>
      <p className="mt-2 text-[12px] text-red-600">
        Make sure the backend is running on{' '}
        <code className="font-mono">http://127.0.0.1:8001</code>.
      </p>
      <button
        onClick={onRetry}
        className="mt-4 inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-red-700"
      >
        Retry with sample
      </button>
    </div>
  )
}

function Footer() {
  return (
    <footer className="border-t border-rule">
      <div className="max-w-[1440px] mx-auto px-6 sm:px-10 py-6 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          © 2026 Sprintfour Inc. All rights reserved.
        </p>
        <p className="text-[12px] text-muted">
          Prototype · Problem 1 — Trust &amp; Explainability
        </p>
      </div>
    </footer>
  )
}
