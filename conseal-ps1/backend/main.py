"""Conseal PS1 — FastAPI backend.

Serves a single mock document and its PII span decisions from a static JSON
file. No database, no auth — see WRITEUP.md for the scope rationale.
"""
import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import DocumentResponse, PIISpan

DATA_PATH = Path(__file__).parent / "data" / "mock_data.json"

app = FastAPI(title="Conseal PS1 — Redaction Review", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _load() -> dict:
    with DATA_PATH.open("r", encoding="utf-8") as fh:
        return json.load(fh)


@app.get("/api/document", response_model=DocumentResponse)
def get_document() -> DocumentResponse:
    return DocumentResponse(**_load())


@app.get("/api/spans/{span_id}", response_model=PIISpan)
def get_span(span_id: str) -> PIISpan:
    data = _load()
    for span in data["spans"]:
        if span["id"] == span_id:
            return PIISpan(**span)
    raise HTTPException(status_code=404, detail=f"Span {span_id!r} not found")


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
