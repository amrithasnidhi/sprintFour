"""One-shot generator for mock_data.json with accurate offsets."""
import json
from pathlib import Path

DOC = (
    "PATIENT CONFIDENTIALITY FORM — MERIDIAN MEDICAL CENTER\n\n"
    "Patient Jonathan M. Richardson, DOB March 14, 1978, was admitted on "
    "April 22, 2026 to Meridian Medical Center, San Francisco. Coverage is "
    "confirmed under policy BC-2847391-MH with SSN 287-41-9630 on file. The "
    "patient is married and authorized release of PHI per HIPAA §164.506. "
    "Designated emergency contact is reachable at (415) 555-0142; primary "
    "email on file is j.richardson@meridian-health.org. Mailing address: "
    "1847 Divisadero St, San Francisco, CA 94115. Attending physician is "
    "Dr. Elena Vasquez (NPI 1093847562). Record ID MRN-008473. Patient "
    "self-identifies as Hispanic."
)

SPANS = [
    # (id, text, type, decision, mode, detection_method, confidence, reason, occurrence)
    ("span_1", "Jonathan M. Richardson", "PERSON_NAME", "redacted", "anonymize", "ai_judged", 0.96,
     "High-confidence personal name match; replaced with [NAME_1] token, recoverable via the local mapping.", 1),
    ("span_2", "March 14, 1978", "DATE_OF_BIRTH", "redacted", "anonymize", "rule_matched", 0.98,
     "Matched a date pattern adjacent to a date-of-birth label; date-of-birth is a quasi-identifier.", 1),
    ("span_3", "BC-2847391-MH", "POLICY_NUMBER", "redacted", "redact", "rule_matched", 0.99,
     "Matched strict alphanumeric policy-number pattern; permanently removed, not recoverable.", 1),
    ("span_4", "287-41-9630", "SSN", "redacted", "redact", "rule_matched", 1.00,
     "Matched the standard XXX-XX-XXXX Social Security Number pattern; deterministic, permanently removed.", 1),
    ("span_5", "married", "MARITAL_STATUS", "kept_visible", None, "ai_judged", 0.42,
     "Flagged as potentially sensitive demographic info, but confidence was below threshold. Borderline — worth a manual look.", 1),
    ("span_6", "HIPAA §164.506", "REGULATORY_CITATION", "kept_visible", None, "rule_matched", 0.97,
     "Matched as a legal/regulatory citation, not personal data; confidently cleared rather than just unflagged.", 1),
    ("span_7", "(415) 555-0142", "PHONE_NUMBER", "redacted", "anonymize", "rule_matched", 0.99,
     "Matched standard US phone format; high deterministic confidence. Anonymized with a recoverable token.", 1),
    ("span_8", "j.richardson@meridian-health.org", "EMAIL", "redacted", "anonymize", "rule_matched", 0.99,
     "Matched standard email pattern; anonymized so downstream processing can still reference the same person.", 1),
    ("span_9", "1847 Divisadero St, San Francisco, CA 94115", "ADDRESS", "redacted", "redact", "ai_judged", 0.92,
     "Full mailing address combines a street, city and ZIP — a direct identifier; permanently removed.", 1),
    # Note: this San Francisco is the standalone city mention (occurrence #1 in the first sentence)
    ("span_10", "San Francisco", "LOCATION", "kept_visible", None, "ai_judged", 0.55,
     "City-level location flagged as low-risk; common enough that re-identification risk was assessed as low. Judgment call, not certainty.", 1),
    ("span_11", "Dr. Elena Vasquez", "PERSON_NAME", "kept_visible", None, "ai_judged", 0.68,
     "Matched as a person's name, but appears to be a treating clinician rather than the patient. Kept visible — borderline, review if sharing externally.", 1),
    ("span_12", "1093847562", "NPI", "redacted", "anonymize", "rule_matched", 0.95,
     "Matched 10-digit National Provider Identifier pattern; anonymized to preserve referential integrity.", 1),
    ("span_13", "MRN-008473", "MEDICAL_RECORD_NUMBER", "redacted", "redact", "rule_matched", 0.99,
     "Matched the facility's MRN prefix and digit-length pattern; permanently removed.", 1),
    ("span_14", "Hispanic", "ETHNICITY", "kept_visible", None, "ai_judged", 0.61,
     "Flagged as a protected demographic attribute; left visible because the surrounding text is a self-identification statement. Borderline — review.", 1),
]


def find_nth(haystack: str, needle: str, n: int) -> int:
    start = 0
    for _ in range(n):
        idx = haystack.find(needle, start)
        if idx == -1:
            raise ValueError(f"Could not find occurrence {n} of {needle!r}")
        start = idx + 1
    return idx


def main() -> None:
    spans_out = []
    for sid, text, typ, decision, mode, method, conf, reason, occurrence in SPANS:
        start = find_nth(DOC, text, occurrence)
        end = start + len(text)
        assert DOC[start:end] == text, f"Offset mismatch for {sid}"
        spans_out.append({
            "id": sid,
            "text": text,
            "start": start,
            "end": end,
            "type": typ,
            "decision": decision,
            "mode": mode,
            "detection_method": method,
            "confidence": conf,
            "reason": reason,
        })
    # Sort by start offset so consumers can render in document order
    spans_out.sort(key=lambda s: s["start"])
    out = {"document_text": DOC, "spans": spans_out}
    out_path = Path(__file__).parent / "data" / "mock_data.json"
    out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {out_path} with {len(spans_out)} spans, document length {len(DOC)}")


if __name__ == "__main__":
    main()
