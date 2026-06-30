import { useEffect, useMemo, useState } from 'react'
import Wordmark from './components/Wordmark'
import DocumentViewer from './components/DocumentViewer'
import ExplanationPanel from './components/ExplanationPanel'
import ConfidenceSlider from './components/ConfidenceSlider'
import { applyThreshold } from './lib/spans'

export default function App() {
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [docText, setDocText] = useState('')
  const [rawSpans, setRawSpans] = useState([])
  const [errorMsg, setErrorMsg] = useState('')
  const [selectedSpanId, setSelectedSpanId] = useState(null)
  const [threshold, setThreshold] = useState(0.5)

  const fetchDocument = async () => {
    setStatus('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/document')
      if (!res.ok) throw new Error(`API returned ${res.status}`)
      const data = await res.json()
      setDocText(data.document_text)
      setRawSpans(data.spans)
      setStatus('ready')
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load document')
      setStatus('error')
    }
  }

  useEffect(() => {
    fetchDocument()
  }, [])

  // Apply the threshold to every span; this is the live filter.
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

          <section className="lg:col-span-5">
            {status === 'loading' && <DocumentSkeleton />}
            {status === 'error' && (
              <ErrorCard message={errorMsg} onRetry={fetchDocument} />
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

      <div className="mt-10 rounded-xl border border-rule bg-white p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted mb-2">
          What this prototype shows
        </div>
        <p className="text-[13px] text-ink/80 leading-relaxed">
          A real person, not a developer, clicking on every redaction Conseal
          made (and every one it didn't) and getting a clear, honest answer to{' '}
          <em className="not-italic font-semibold text-ink">
            why this, and why not that?
          </em>
        </p>
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
          <div
            key={i}
            className="skeleton h-3"
            style={{ width: `${70 + ((i * 13) % 25)}%` }}
          />
        ))}
      </div>
    </div>
  )
}

function ErrorCard({ message, onRetry }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-7 shadow-panel">
      <h3 className="text-sm font-semibold text-red-800">
        Couldn't load the document
      </h3>
      <p className="mt-1.5 text-[13px] text-red-700">{message}</p>
      <p className="mt-2 text-[12px] text-red-600">
        Make sure the backend is running on{' '}
        <code className="font-mono">http://127.0.0.1:8000</code>.
      </p>
      <button
        onClick={onRetry}
        className="mt-4 inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-red-700"
      >
        Retry
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
