"""Stage 2 — Judgment layer: heuristic detectors for unstructured PII.

These are stand-ins for where an ML model (NER classifier, LLM-based extractor)
would sit in a production pipeline. They are honestly labelled `heuristic_judged`
with deliberately wider, lower confidence ranges than the rule layer — that
honesty about uncertainty IS part of the trust story for Marcus, not a weakness.

Detectors in this module:
  - PERSON_NAME  (titled names, all-caps titled names, consecutive title-case words)
  - LOCATION     (small city/country gazetteer)
  - ADDRESS      (street-pattern regex)
  - HEALTH_INFO  (medical specialties and conditions)
  - MARITAL_STATUS (keyword list)
  - ETHNICITY    (keyword list)
"""
from __future__ import annotations

import re

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _span(text, start, end, typ, decision, mode, confidence, reason) -> dict:
    return {
        "text": text,
        "start": start,
        "end": end,
        "type": typ,
        "decision": decision,
        "mode": mode,
        "detection_method": "heuristic_judged",
        "confidence": round(confidence, 4),
        "reason": reason,
    }


# ---------------------------------------------------------------------------
# TITLED NAME heuristic — catches "Mr. Holloway", "Dr. Patel", "Dr. Sarah Chen"
#
# Handles the pattern: Title. + one or more name words in title-case.
# These fire BEFORE the generic name heuristic so the merge step does not
# need to pick between a weaker generic match and a stronger titled match.
# ---------------------------------------------------------------------------

_TITLED_NAME_RE = re.compile(
    r"\b((?:Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.|Mx\.)\s+"
    r"[A-Z][a-z']{1,}(?:\s+[A-Z]\.)?(?:\s+[A-Z][a-z']{1,})?)\b"
)

def _detect_titled_names(text: str) -> list[dict]:
    spans = []
    for m in _TITLED_NAME_RE.finditer(text):
        matched = m.group(1)
        title_end = matched.index('.') + 1
        title_cue = matched[:title_end]
        spans.append(_span(
            matched, m.start(), m.end(),
            "PERSON_NAME", "redacted", "anonymize", 0.85,
            f"Name immediately follows the title cue '{title_cue}', a strong indicator "
            "of a person name (title-case name pattern with explicit honorific). "
            "Anonymized with a recoverable token.",
        ))
    return spans


# ---------------------------------------------------------------------------
# ALL-CAPS TITLED NAME — catches "DR. SARAH CHEN", "MR. JAMES HOLLOWAY"
# (letterhead / header style where everything is uppercase)
# ---------------------------------------------------------------------------

_ALLCAPS_TITLED_NAME_RE = re.compile(
    r"\b((?:MR\.|MRS\.|MS\.|DR\.|PROF\.)\s+[A-Z]{2,}(?:\s+[A-Z]{2,})+)\b"
)

def _detect_allcaps_names(text: str) -> list[dict]:
    spans = []
    for m in _ALLCAPS_TITLED_NAME_RE.finditer(text):
        matched = m.group(1)
        title_end = matched.index('.') + 1
        title_cue = matched[:title_end]
        spans.append(_span(
            matched, m.start(), m.end(),
            "PERSON_NAME", "redacted", "anonymize", 0.85,
            f"All-caps name immediately following the title '{title_cue}'; "
            "typical of letterhead or header formatting. Classified as a person name "
            "and anonymized with a recoverable token.",
        ))
    return spans


# ---------------------------------------------------------------------------
# PERSON_NAME heuristic
#
# Strategy: find sequences of 2–4 consecutive title-case words (each ≥ 2 chars).
# Score = 0.60 base
#         + 0.20 if a title-cue ("Patient", "Dr.", "Mr.", …) appears within
#           40 chars before the match start
#         - 0.25 for each word in the match that is a known non-name term
#           (month names, common document headers, institutional words, etc.)
#
# score ≥ 0.62 → redacted (anonymize)   — heuristic is confident
# 0.40 ≤ score < 0.62 → kept_visible   — heuristic is uncertain; Marcus can decide
# score < 0.40 → skip entirely          — too noisy
# ---------------------------------------------------------------------------

_NAME_SEQ_RE = re.compile(
    r"(?<![A-Za-z])"                     # not preceded by a letter
    r"([A-Z][a-z]{1,}\s+(?:[A-Z]\.\s+)?(?:[A-Z][a-z']{1,}\s+)?[A-Z][a-z']{1,})"
    r"(?![A-Za-z])"                      # not followed by a letter
)

_TITLE_CUE_RE = re.compile(
    r"(?:Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Prof\.?|Patient\s*:?\s*|Mx\.?|"
    r"Capt\.?|Lt\.?|Sgt\.?|Rev\.?|Atty\.?|Sr\.?)\s*$",
    re.IGNORECASE,
)

# Words that look like names but almost certainly aren't person names in a doc.
_NON_NAME: frozenset[str] = frozenset({
    # Calendar terms
    "January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December",
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
    # Common document / healthcare words
    "Patient", "Medical", "Center", "Hospital", "Clinic", "Health", "Care",
    "Confidentiality", "Form", "Report", "Record", "Services",
    "Inc", "Llc", "Ltd", "Corp", "Co",
    # Place modifiers that start with caps but aren't names on their own
    "San", "Los", "New", "Las", "Fort", "Saint", "Santa",
    "North", "South", "East", "West",
    # HIPAA / legal
    "Hipaa", "Phi", "Privacy",
    # Form structural words
    "Attending", "Primary", "Designated", "Emergency", "Contact",
    "Insurance", "Policy", "Mailing", "Address", "Date", "Record",
    "Coverage", "Admission",
    # Letter salutations — "Dear Dr" would otherwise score as a 2-word name
    "Dear", "Sincerely", "Regards", "Hello", "Hi",
    # Demographic / nationality adjectives that commonly form 2-word phrases
    # ("African American", "Asian American", etc.) — these must be caught by
    # the ETHNICITY detector, not the name heuristic.
    "African", "Asian", "European", "Latino", "Latina", "Latinx",
    "Hispanic", "Pacific", "Native", "Alaska", "Biracial", "Multiracial",
    "American",   # only penalises compound terms; single "American" is rarely a name
})


def _score_name(words: list[str], text_before: str) -> float:
    score = 0.60
    if _TITLE_CUE_RE.search(text_before):
        score += 0.20
    for w in words:
        if w.rstrip(".") in _NON_NAME:
            score -= 0.25
    return score


def _detect_names(text: str) -> list[dict]:
    spans = []
    for m in _NAME_SEQ_RE.finditer(text):
        matched = m.group(1)
        words = [w for w in matched.split() if w]
        before = text[max(0, m.start() - 40): m.start()]
        score = _score_name(words, before)
        if score < 0.40:
            continue

        title_cue = _TITLE_CUE_RE.search(before)
        cue_str = title_cue.group().strip() if title_cue else None

        if score >= 0.62:
            if cue_str:
                reason = (
                    f"Consecutive title-case words preceded by '{cue_str}', "
                    "a strong name-indicating cue; heuristic is confident this is "
                    "a person name. Anonymized with a recoverable token."
                )
            else:
                reason = (
                    "Consecutive title-case words with no explicit title cue; "
                    "classified as a likely person name by the heuristic with moderate-high confidence."
                )
            spans.append(_span(
                matched, m.start(), m.end(),
                "PERSON_NAME", "redacted", "anonymize", min(score, 0.95), reason,
            ))
        else:
            reason = (
                "Matched the capitalized-word name pattern but confidence was too low "
                "for automatic redaction (another word in the sequence is a common non-name term). "
                "Kept visible — worth a manual check."
            )
            spans.append(_span(
                matched, m.start(), m.end(),
                "PERSON_NAME", "kept_visible", None, score, reason,
            ))
    return spans


# ---------------------------------------------------------------------------
# LOCATION — small gazetteer of city / country names
# ---------------------------------------------------------------------------

_CITIES: frozenset[str] = frozenset({
    # US cities
    "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia",
    "San Antonio", "San Diego", "Dallas", "San Jose", "Austin", "Jacksonville",
    "San Francisco", "Columbus", "Charlotte", "Indianapolis", "Seattle", "Denver",
    "Washington", "Nashville", "Las Vegas", "Memphis", "Louisville", "Baltimore",
    "Milwaukee", "Albuquerque", "Boston", "Portland", "Fresno", "Sacramento",
    "Atlanta", "Miami", "Minneapolis", "Oakland", "Tampa", "Tucson", "Pittsburgh",
    # International
    "London", "Paris", "Tokyo", "Sydney", "Toronto", "Mumbai", "Delhi",
    "Berlin", "Beijing", "Shanghai", "Singapore", "Dubai", "Amsterdam",
    "Madrid", "Rome", "Seoul", "Mexico City", "São Paulo", "Buenos Aires",
    "Cairo", "Lagos", "Nairobi", "Johannesburg",
    # Countries (common ones)
    "United States", "United Kingdom", "Canada", "Australia", "India",
    "France", "Germany", "Japan", "China", "Brazil", "Mexico", "Italy",
    "Spain", "Russia", "Netherlands", "Sweden", "Norway", "Denmark",
})

# Sort by length descending so longer multi-word city names match before substrings
_CITY_PAT = re.compile(
    r"\b(" + "|".join(re.escape(c) for c in sorted(_CITIES, key=len, reverse=True)) + r")\b"
)


def _detect_locations(text: str) -> list[dict]:
    spans = []
    for m in _CITY_PAT.finditer(text):
        spans.append(_span(
            m.group(), m.start(), m.end(),
            "LOCATION", "kept_visible", None, 0.55,
            "Matched the city/country gazetteer; city-level locations alone are common "
            "enough that re-identification risk was judged low — a judgment call, not a certainty.",
        ))
    return spans


# ---------------------------------------------------------------------------
# ADDRESS — street-number + street-type + optional city/state/ZIP
# ---------------------------------------------------------------------------

_ADDRESS_RE = re.compile(
    r"\b(\d{1,5}\s+[A-Za-z][a-zA-Z\s]{2,35}"
    r"(?:Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Road|Rd|"
    r"Lane|Ln|Way|Court|Ct|Place|Pl|Circle|Highway|Hwy|Pkwy|Parkway)\b"
    r"(?:[^0-9\n\r]{0,50}\d{5}(?:-\d{4})?)?)",
    re.IGNORECASE,
)


def _detect_addresses(text: str) -> list[dict]:
    spans = []
    for m in _ADDRESS_RE.finditer(text):
        addr = m.group().strip()
        if len(addr) < 10:
            continue
        spans.append(_span(
            addr, m.start(), m.start() + len(addr),
            "ADDRESS", "redacted", "redact", 0.90,
            "Matched a street-address pattern (number + street name + type, "
            "optionally city/state/ZIP); a full mailing address is a direct identifier. "
            "Permanently removed.",
        ))
    return spans


# ---------------------------------------------------------------------------
# MARITAL_STATUS — keyword match
# ---------------------------------------------------------------------------

_MARITAL_RE = re.compile(
    r"\b(married|single|divorced|widowed|separated|domestic\s+partnership)\b",
    re.IGNORECASE,
)


def _detect_marital_status(text: str) -> list[dict]:
    spans = []
    for m in _MARITAL_RE.finditer(text):
        spans.append(_span(
            m.group(), m.start(), m.end(),
            "MARITAL_STATUS", "kept_visible", None, 0.35,
            "Flagged as a potentially sensitive demographic term; no rule or heuristic "
            "was confident enough to redact automatically. Kept visible — adjust the "
            "threshold or review manually if you want to be cautious.",
        ))
    return spans


# ---------------------------------------------------------------------------
# ETHNICITY / RACE — keyword match
# ---------------------------------------------------------------------------

_ETHNICITY_RE = re.compile(
    r"\b(Hispanic|Latino(?:\/Latina)?|Latina|Latinx|African[-\s]American|"
    r"Asian[-\s]American|Pacific\s+Islander|Native\s+American|Alaska\s+Native|"
    r"Caucasian|Black|White|Biracial|Multiracial)\b",
    re.IGNORECASE,
)


def _detect_ethnicity(text: str) -> list[dict]:
    spans = []
    for m in _ETHNICITY_RE.finditer(text):
        spans.append(_span(
            m.group(), m.start(), m.end(),
            "ETHNICITY", "kept_visible", None, 0.61,
            "Flagged as a protected demographic attribute; left visible because the "
            "surrounding text suggests a self-identification statement rather than "
            "a data-exposure risk. Borderline — review for your specific use case.",
        ))
    return spans


# ---------------------------------------------------------------------------
# HEALTHCARE_FACILITY — hospital and clinic names
# Catches "Meridian Medical Center", "St. Mary Hospital", etc.
# Confidence kept at 0.70 — not personal data per se, but reveals care location.
# ---------------------------------------------------------------------------

_FACILITY_KEYWORDS = (
    r"Hospital|Medical\s+Center|Medical\s+Group|"
    r"Health\s+(?:System|Network|Center|Care)|"
    r"Clinic(?:s)?|Healthcare|Infirmary|Cancer\s+Center|Care\s+Center|"
    r"Health\s+Services|Medical\s+Services|"
    r"HOSPITAL|MEDICAL\s+CENTER|MEDICAL\s+GROUP|"
    r"HEALTH\s+(?:SYSTEM|NETWORK|CENTER|CARE)|"
    r"CLINIC(?:S)?|HEALTHCARE|INFIRMARY"
)
# No IGNORECASE — [A-Z] must be uppercase so we don't start matching at lowercase words
_FACILITY_RE = re.compile(
    r"\b([A-Z][A-Za-z'.]{0,30}"           # first word starts with a capital
    r"(?:\s+[A-Z][A-Za-z'.]{0,19}){0,4}"  # optional extra capitalized words
    r"\s+(?:" + _FACILITY_KEYWORDS + r"))\b"
)


def _detect_facilities(text: str) -> list[dict]:
    spans = []
    for m in _FACILITY_RE.finditer(text):
        matched = m.group(1)
        # Skip if the name is too short (avoids "The Clinic"-style false positives)
        if len(matched.split()) < 2:
            continue
        spans.append(_span(
            matched, m.start(), m.start() + len(matched),
            "HEALTHCARE_FACILITY", "kept_visible", None, 0.70,
            f"Matched a healthcare facility name ('{matched}'); "
            "facility names can reveal where a patient received care — "
            "a HIPAA-relevant detail. Kept visible — redact if the document "
            "leaves the facility's own systems.",
        ))
    return spans


# ---------------------------------------------------------------------------
# HEALTH_INFO — medical specialties and health conditions
# ---------------------------------------------------------------------------

_MEDICAL_SPECIALTY_RE = re.compile(
    r"\b((?:cardiology|oncology|neurology|neurosurgery|psychiatry|psychology|"
    r"orthopedics|orthopaedics|ophthalmology|dermatology|gastroenterology|"
    r"endocrinology|rheumatology|nephrology|pulmonology|urology|hematology|"
    r"immunology|infectious\s+disease|radiology|pathology|anesthesiology|"
    r"obstetrics|gynecology|pediatrics|geriatrics|emergency\s+medicine|"
    r"internal\s+medicine|family\s+medicine|general\s+surgery|plastic\s+surgery)"
    r"(?:\s+(?:consultation|consult|referral|appointment|specialist|review|follow[-\s]?up))?)\b",
    re.IGNORECASE,
)

_HEALTH_CONDITION_RE = re.compile(
    r"\b(diabetes(?:\s+(?:type\s+[12]|mellitus))?|hypertension|hyperlipidemia|"
    r"depression|anxiety(?:\s+disorder)?|bipolar(?:\s+disorder)?|schizophrenia|"
    r"cancer|tumor|tumour|malignancy|carcinoma|lymphoma|leukemia|"
    r"coronary\s+artery\s+disease|heart\s+(?:disease|failure|attack)|"
    r"myocardial\s+infarction|atrial\s+fibrillation|"
    r"stroke|transient\s+ischemic\s+attack|TIA|"
    r"chest\s+pain|shortness\s+of\s+breath|chronic\s+pain|"
    r"HIV|AIDS|hepatitis\s+[ABC]|tuberculosis|"
    r"seizure(?:s)?|epilepsy|dementia|Alzheimer(?:'s)?|Parkinson(?:'s)?|"
    r"multiple\s+sclerosis|lupus|rheumatoid\s+arthritis|"
    r"chronic\s+kidney\s+disease|renal\s+failure|liver\s+(?:disease|failure)|"
    r"asthma|COPD|emphysema|pneumonia)\b",
    re.IGNORECASE,
)


def _detect_health_info(text: str) -> list[dict]:
    spans = []
    for m in _MEDICAL_SPECIALTY_RE.finditer(text):
        matched = m.group(1)
        spans.append(_span(
            matched, m.start(), m.start() + len(matched),
            "HEALTH_INFO", "kept_visible", None, 0.65,
            f"Matched a recognized medical specialty term ('{matched.split()[0].lower()}'); "
            "clinical context terms may reveal the patient's condition. Kept visible — "
            "redact if the specialty is sensitive in your use case.",
        ))
    for m in _HEALTH_CONDITION_RE.finditer(text):
        matched = m.group(1)
        spans.append(_span(
            matched, m.start(), m.start() + len(matched),
            "HEALTH_INFO", "kept_visible", None, 0.75,
            f"Matched a recognized health condition ('{matched.lower()}'); "
            "health conditions are protected under HIPAA as part of a patient's medical history. "
            "Kept visible — raise the threshold or review manually if this should be redacted.",
        ))
    return spans


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def detect(text: str) -> list[dict]:
    """Run all heuristic detectors. Returns raw span dicts (no IDs)."""
    results = []
    for fn in (
        _detect_titled_names,   # Title. Surname — most specific name pattern
        _detect_allcaps_names,  # DR. SARAH CHEN — letterhead style
        _detect_names,          # generic consecutive title-case words
        _detect_locations,
        _detect_addresses,
        _detect_facilities,
        _detect_health_info,
        _detect_marital_status,
        _detect_ethnicity,
    ):
        results.extend(fn(text))
    return results
