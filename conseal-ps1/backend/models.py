from typing import List, Literal, Optional
from pydantic import BaseModel


class PIISpan(BaseModel):
    id: str
    text: str
    start: int
    end: int
    type: str
    decision: Literal["redacted", "kept_visible"]
    mode: Optional[Literal["redact", "anonymize"]] = None
    detection_method: Literal["rule_matched", "heuristic_judged", "ai_judged"]
    confidence: float
    reason: str


class DocumentResponse(BaseModel):
    document_text: str
    spans: List[PIISpan]


class ErrorResponse(BaseModel):
    error: str
