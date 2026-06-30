"""Merge rule-layer and judgment-layer spans into a single ordered list.

Precedence rule (from the blueprint):
  If the rule layer and judgment layer both flag overlapping text,
  the rule-layer result wins (exact-match, more certain).
  Within the same layer, the earlier / longer span wins.

Algorithm:
  1. Tag each span with a priority: rule=2, judgment=1.
  2. Sort by (start ASC, priority DESC, length DESC).
  3. Walk through with a cursor; accept a span only if its start >= cursor.
  4. Advance cursor to span.end after accepting.
  5. Assign sequential IDs (span_1, span_2, …) in document order.
"""
from __future__ import annotations


def merge(rule_spans: list[dict], judgment_spans: list[dict], doc_text: str) -> list[dict]:
    tagged = (
        [{"_p": 2, **s} for s in rule_spans]
        + [{"_p": 1, **s} for s in judgment_spans]
    )

    # Sort: start ASC, then rule before judgment, then longer before shorter
    tagged.sort(key=lambda s: (s["start"], -s["_p"], -(s["end"] - s["start"])))

    accepted: list[dict] = []
    cursor = 0
    for span in tagged:
        # Skip spans that extend beyond the document (safety)
        if span["end"] > len(doc_text):
            continue
        # Skip spans that overlap an already-accepted span
        if span["start"] < cursor:
            continue
        accepted.append(span)
        cursor = span["end"]

    # Strip internal priority tag and assign sequential IDs
    result = []
    for i, span in enumerate(accepted, 1):
        clean = {k: v for k, v in span.items() if k != "_p"}
        clean["id"] = f"span_{i}"
        result.append(clean)

    return result
