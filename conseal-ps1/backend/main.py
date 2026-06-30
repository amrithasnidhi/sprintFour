"""Conseal PS1 — FastAPI backend (Blueprint 2).

Routes:
  POST /api/process  — upload a .txt/.docx/.pdf, run extraction + detection
  GET  /api/sample   — process the built-in sample_doc.txt (no upload needed)
  GET  /api/spans/{id} — return one span from the most-recently processed doc
  GET  /api/health   — health check

No database, no auth, no live LLM — see WRITEUP.md.
"""
from __future__ import annotations

import io
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from extraction import extract_text
from detection import judgment_detect, merge, rule_detect
from models import DocumentResponse, PIISpan

SAMPLE_PATH = Path(__file__).parent / "sample_doc.txt"
MAX_FILE_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_EXTENSIONS = {"txt", "docx", "pdf"}

app = FastAPI(title="Conseal PS1 — Redaction Review", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# In-memory session — stores spans from the most-recently processed document
# so /api/spans/{id} can serve them without re-running detection.
# Single-process dev server; this is fine for a single-session prototype.
# ---------------------------------------------------------------------------
_session: dict = {"spans": [], "doc_text": ""}


def _run_pipeline(doc_text: str) -> list[dict]:
    rule_spans = rule_detect(doc_text)
    judgment_spans = judgment_detect(doc_text)
    return merge(rule_spans, judgment_spans, doc_text)


def _build_response(doc_text: str) -> DocumentResponse:
    spans = _run_pipeline(doc_text)
    _session["spans"] = spans
    _session["doc_text"] = doc_text
    return DocumentResponse(
        document_text=doc_text,
        spans=[PIISpan(**s) for s in spans],
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post("/api/process", response_model=DocumentResponse)
async def process_file(file: UploadFile = File(...)) -> DocumentResponse:
    """Accept a file upload, extract text, run the two-stage detection pipeline."""
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '.{ext}'. Upload a .txt, .docx, or .pdf.",
        )

    raw = await file.read()
    if len(raw) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="File too large. Maximum size is 5 MB.",
        )

    try:
        doc_text = extract_text(io.BytesIO(raw), ext)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    return _build_response(doc_text)


@app.get("/api/sample", response_model=DocumentResponse)
def get_sample() -> DocumentResponse:
    """Process the built-in sample document — useful as a demo fallback."""
    try:
        doc_text = SAMPLE_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="sample_doc.txt not found on server.")
    return _build_response(doc_text)


@app.get("/api/spans/{span_id}", response_model=PIISpan)
def get_span(span_id: str) -> PIISpan:
    """Return one span from the most-recently processed document."""
    for span in _session["spans"]:
        if span["id"] == span_id:
            return PIISpan(**span)
    raise HTTPException(status_code=404, detail=f"Span '{span_id}' not found.")


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
