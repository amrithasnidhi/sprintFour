import { useRef, useState } from 'react'

const ACCEPTED_EXTS = ['.txt', '.docx', '.pdf']
const MAX_MB = 5

/**
 * Compact upload trigger shown inside the document card header.
 * On file select or drop → calls onUpload(file). Parent owns the POST call
 * so it can update global state (docText, rawSpans, status).
 */
export default function FileUpload({ onUpload, uploading }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [localError, setLocalError] = useState('')

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
    if (err) {
      setLocalError(err)
      return
    }
    onUpload(file)
  }

  function onInputChange(e) {
    const file = e.target.files?.[0]
    if (file) handle(file)
    e.target.value = ''
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handle(file)
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative rounded-xl border-2 border-dashed px-5 py-5 text-center transition-colors
          ${dragOver ? 'border-accent bg-accent-soft' : 'border-rule bg-white hover:border-accent/50'}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTS.join(',')}
          onChange={onInputChange}
          className="hidden"
          disabled={uploading}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2 py-1">
            <Spinner />
            <p className="text-[13px] text-accent font-medium">Processing your document…</p>
            <PipelineSteps />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-1">
            <UploadIcon dragOver={dragOver} />
            <p className="text-[13px] text-ink font-medium">
              Drop a file here, or{' '}
              <button
                onClick={() => inputRef.current?.click()}
                className="text-accent underline underline-offset-2 hover:no-underline"
              >
                browse
              </button>
            </p>
            <p className="text-[11px] text-muted">.txt · .docx · .pdf · max {MAX_MB} MB</p>
          </div>
        )}
      </div>

      {localError && (
        <p className="mt-2 text-[12px] text-red-600">{localError}</p>
      )}
    </div>
  )
}

function UploadIcon({ dragOver }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`h-7 w-7 transition-colors ${dragOver ? 'text-accent' : 'text-muted'}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 3v10M6 7l4-4 4 4" />
      <path d="M3 14v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

/**
 * Shows the two pipeline stages so Marcus can see what's happening — matches
 * the blueprint description of the two-stage detection model.
 */
function PipelineSteps() {
  return (
    <div className="mt-2 text-left space-y-1.5 w-full max-w-[240px]">
      {[
        { label: 'Extracting text from file', done: true },
        { label: 'Rule layer — regex detectors', done: true },
        { label: 'Judgment layer — heuristics', done: false },
        { label: 'Merging & resolving overlaps', done: false },
      ].map(({ label, done }) => (
        <div key={label} className="flex items-center gap-2 text-[11px]">
          {done ? (
            <svg viewBox="0 0 12 12" className="h-3 w-3 text-emerald-600 shrink-0" fill="currentColor">
              <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          ) : (
            <svg className="h-3 w-3 animate-spin text-accent/60 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-20" cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4" />
              <path className="opacity-60" fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          <span className={done ? 'text-ink' : 'text-muted'}>{label}</span>
        </div>
      ))}
    </div>
  )
}
