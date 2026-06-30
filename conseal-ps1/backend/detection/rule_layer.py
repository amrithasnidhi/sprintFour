"""Stage 1 — Rule layer: deterministic regex detectors.

Every match here has `detection_method: "rule_matched"` and carries a high
confidence (0.95–1.00) because the logic is exact-match, not probabilistic.
Confidence < 1.00 only where a tiny residual ambiguity exists (e.g. a policy-
number format could in principle collide with a random string; an SSN pattern
could appear in a reference number).

The reason strings explain WHAT matched, WHY it is PII, and WHAT the mode
guarantees — one sentence per rule, no generic placeholders.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

_CURRENT_YEAR = datetime.now().year

# ---------------------------------------------------------------------------
# Internal span dict shape (no id — merge.py assigns those)
# ---------------------------------------------------------------------------

def _span(text, start, end, typ, decision, mode, confidence, reason) -> dict:
    return {
        "text": text,
        "start": start,
        "end": end,
        "type": typ,
        "decision": decision,
        "mode": mode,
        "detection_method": "rule_matched",
        "confidence": round(confidence, 4),
        "reason": reason,
    }


# ---------------------------------------------------------------------------
# Individual detectors
# ---------------------------------------------------------------------------

_EMAIL_RE = re.compile(
    r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b"
)

def _detect_emails(text: str) -> list[dict]:
    spans = []
    for m in _EMAIL_RE.finditer(text):
        spans.append(_span(
            m.group(), m.start(), m.end(),
            "EMAIL", "redacted", "anonymize", 0.99,
            "Matched the standard email regex (local-part@domain.tld); "
            "anonymized with a recoverable token so referential identity is preserved."
        ))
    return spans


_PHONE_RE = re.compile(
    r"\(?\b(\d{3})\)?[-.\s](\d{3})[-.\s](\d{4})\b"
)

def _detect_phones(text: str) -> list[dict]:
    spans = []
    for m in _PHONE_RE.finditer(text):
        spans.append(_span(
            m.group(), m.start(), m.end(),
            "PHONE_NUMBER", "redacted", "anonymize", 0.99,
            "Matched the standard US phone format (area-code + 7 digits); "
            "anonymized with a recoverable token."
        ))
    return spans


# Lookaheads filter out the most obviously invalid SSN groups (000, 666, 9xx).
_SSN_RE = re.compile(
    r"\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b"
)

def _detect_ssns(text: str) -> list[dict]:
    spans = []
    for m in _SSN_RE.finditer(text):
        spans.append(_span(
            m.group(), m.start(), m.end(),
            "SSN", "redacted", "redact", 1.00,
            "Matched the XXX-XX-XXXX Social Security Number pattern; "
            "permanently removed, not recoverable."
        ))
    return spans


# Alphanumeric policy / account numbers: 2-4 uppercase letters, hyphen,
# 5-10 digits, optional hyphen + 1-4 uppercase/digit suffix. Broad enough
# to catch BC-2847391-MH style codes and similar insurance formats.
_POLICY_RE = re.compile(
    r"\b[A-Z]{2,4}-\d{5,10}(?:-[A-Z0-9]{1,4})?\b"
)

def _detect_policy_numbers(text: str) -> list[dict]:
    spans = []
    for m in _POLICY_RE.finditer(text):
        spans.append(_span(
            m.group(), m.start(), m.end(),
            "POLICY_NUMBER", "redacted", "redact", 0.97,
            "Matched an alphanumeric policy/account-number pattern "
            "(2-4 uppercase letters, 5-10 digits, optional suffix); permanently removed."
        ))
    return spans


_CREDIT_CARD_RE = re.compile(
    r"\b(?:\d{4}[-\s]){3}\d{4}\b"
)

def _detect_credit_cards(text: str) -> list[dict]:
    spans = []
    for m in _CREDIT_CARD_RE.finditer(text):
        spans.append(_span(
            m.group(), m.start(), m.end(),
            "CREDIT_CARD", "redacted", "redact", 0.99,
            "Matched a 16-digit credit/debit card number pattern; permanently removed."
        ))
    return spans


_MRN_RE = re.compile(
    r"\bMRN[-:\s]?\d{5,8}\b", re.IGNORECASE
)

def _detect_mrns(text: str) -> list[dict]:
    spans = []
    for m in _MRN_RE.finditer(text):
        spans.append(_span(
            m.group(), m.start(), m.end(),
            "MEDICAL_RECORD_NUMBER", "redacted", "redact", 0.99,
            "Matched the Medical Record Number prefix followed by 5-8 digits; permanently removed."
        ))
    return spans


# NPI: a 10-digit number immediately following the label "NPI".
# We capture only the digit group as the actual PII span.
_NPI_RE = re.compile(
    r"\bNPI\s*[:#]?\s*(\d{10})\b", re.IGNORECASE
)

def _detect_npis(text: str) -> list[dict]:
    spans = []
    for m in _NPI_RE.finditer(text):
        number = m.group(1)
        start = m.start(1)
        end = m.end(1)
        spans.append(_span(
            number, start, end,
            "NPI", "redacted", "anonymize", 0.95,
            "Matched a 10-digit National Provider Identifier adjacent to the 'NPI' label; "
            "anonymized to preserve referential identity."
        ))
    return spans


_HIPAA_RE = re.compile(
    r"\bHIPAA\s*§\s*\d+\.\d+\b", re.IGNORECASE
)

def _detect_hipaa(text: str) -> list[dict]:
    spans = []
    for m in _HIPAA_RE.finditer(text):
        spans.append(_span(
            m.group(), m.start(), m.end(),
            "REGULATORY_CITATION", "kept_visible", None, 0.97,
            "Matched a HIPAA regulatory citation; this is a legal reference, "
            "not personal data — confidently cleared, not just unflagged."
        ))
    return spans


# ---------------------------------------------------------------------------
# Date detection — two-pass: find all dates, then classify each by context.
# ---------------------------------------------------------------------------

# Full month names in English
_MONTHS = (
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
)
_MONTH_ALT = "|".join(_MONTHS)

_DATE_PATTERNS = [
    # "March 14, 1978"
    re.compile(rf"\b({_MONTH_ALT})\s+\d{{1,2}},\s+(\d{{4}})\b"),
    # "14 March 1978"
    re.compile(rf"\b\d{{1,2}}\s+({_MONTH_ALT})\s+(\d{{4}})\b"),
    # MM/DD/YYYY or DD/MM/YYYY
    re.compile(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b"),
    # YYYY-MM-DD (ISO)
    re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b"),
]

_DOB_CONTEXT_RE = re.compile(
    r"\b(?:dob|date\s+of\s+birth|born|birthdate|birth\s+date)\b",
    re.IGNORECASE,
)

_ADMIN_CONTEXT_RE = re.compile(
    r"\b(?:admitted|visit|scheduled|appointment|date\s+of\s+(?:visit|service|admission)|on\s+(?:file|record))\b",
    re.IGNORECASE,
)


def _classify_date(text: str, match_start: int, year: int) -> dict:
    """Return (decision, confidence, type, reason) for a matched date."""
    # Only check the SAME LINE before the date for context labels — checking a
    # wide backward window incorrectly pulls in labels from earlier lines
    # (e.g. "DOB:" on the previous line would mis-classify "Admitted: April …").
    line_start = text.rfind('\n', 0, match_start) + 1
    line_before = text[line_start:match_start]
    has_dob_label = bool(_DOB_CONTEXT_RE.search(line_before))
    has_admin_label = bool(_ADMIN_CONTEXT_RE.search(line_before))

    if has_dob_label:
        return (
            "redacted", "anonymize", 0.98,
            "DATE_OF_BIRTH",
            "Matched a date immediately following a date-of-birth label; "
            "DOB is a quasi-identifier. Anonymized with a recoverable token.",
        )
    if has_admin_label:
        return (
            "kept_visible", None, 0.80,
            "DATE",
            "Matched a date that appears to be an administrative or visit date "
            "rather than a date of birth — kept visible, but worth a check.",
        )
    # No label context: use year heuristic.
    if year < (_CURRENT_YEAR - 16):
        # Old enough to plausibly be a birth year.
        return (
            "redacted", "anonymize", 0.87,
            "DATE_OF_BIRTH",
            f"Matched a date with year {year} — old enough to be a date of birth "
            "even without an explicit label. Anonymized as a precaution.",
        )
    return (
        "kept_visible", None, 0.72,
        "DATE",
        "Matched a date format; appears to be a recent administrative or "
        "event date rather than a date of birth — kept visible.",
    )


def _detect_dates(text: str) -> list[dict]:
    seen: set[tuple[int, int]] = set()
    spans = []

    for pat in _DATE_PATTERNS:
        for m in pat.finditer(text):
            if (m.start(), m.end()) in seen:
                continue
            seen.add((m.start(), m.end()))

            # Extract year from the match
            year = _CURRENT_YEAR
            for g in m.groups():
                if g and g.isdigit() and len(g) == 4:
                    year = int(g)
                    break

            decision, mode, confidence, typ, reason = _classify_date(text, m.start(), year)
            spans.append(_span(m.group(), m.start(), m.end(), typ, decision, mode, confidence, reason))

    return spans


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def detect(text: str) -> list[dict]:
    """Run all rule-based detectors. Returns raw span dicts (no IDs).

    Order matters for overlap resolution inside the merge step: more-specific
    patterns (MRN, NPI, HIPAA) must come before the generic POLICY_NUMBER
    pattern so that "MRN-008473" is labelled as MEDICAL_RECORD_NUMBER, not
    incorrectly as POLICY_NUMBER (both regexes match the same substring).
    """
    results = []
    for fn in (
        _detect_emails,
        _detect_phones,
        _detect_ssns,
        _detect_mrns,       # before policy — more specific
        _detect_npis,       # before policy — more specific
        _detect_hipaa,      # before policy — more specific
        _detect_credit_cards,
        _detect_policy_numbers,  # generic; runs last to avoid shadowing the above
        _detect_dates,
    ):
        results.extend(fn(text))
    return results
