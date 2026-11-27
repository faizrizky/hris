# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Template rules applied after the weighted metrics (pure, no frappe import).

Order (TalentaKu blueprint): gates -> additive base score -> penalties (red flags) ->
custom rules -> knock-outs -> tier label. Every rule reports what it did and why, so HR can
see the evidence behind a score. Knock-outs never reject on their own: they cap or zero the
score and flag the screening for HR review.
"""

from __future__ import annotations

import json
import re
from typing import Any

from sentra_ats.scoring.extract import ExtractionResult
from sentra_ats.scoring.metrics.date_consistency import extract_date_ranges
from sentra_ats.scoring.metrics.education_relevance import detect_candidate_degree, parse_degree_level

# --- Language gate ---------------------------------------------------------------------------

STOPWORDS = {
	"id": {
		"dan", "yang", "di", "ke", "dari", "untuk", "dengan", "pada", "dalam", "sebagai", "adalah",
		"ini", "itu", "atau", "saya", "kami", "tahun", "bulan", "kerja", "pengalaman", "pendidikan",
	},
	"en": {
		"and", "the", "of", "to", "in", "for", "with", "on", "as", "at", "by", "is", "a", "an",
		"my", "experience", "education", "skills", "work", "years", "university",
	},
}
MIN_WORDS_FOR_LANGUAGE = 50
MIN_STOPWORD_RATIO = 0.03
MAX_NON_LATIN_RATIO = 0.3


def detect_language(text: str) -> str:
	"""'id', 'en', 'other', or '' when the text is too short to tell."""
	letters = [c for c in text if c.isalpha()]
	if letters:
		non_latin = sum(1 for c in letters if ord(c) > 0x024F)
		if non_latin / len(letters) > MAX_NON_LATIN_RATIO:
			return "other"
	words = re.findall(r"[a-zA-Z]+", text.lower())
	if len(words) < MIN_WORDS_FOR_LANGUAGE:
		return ""
	hits = {lang: sum(1 for w in words if w in sw) for lang, sw in STOPWORDS.items()}
	lang, count = max(hits.items(), key=lambda kv: kv[1])
	return lang if count / len(words) >= MIN_STOPWORD_RATIO else "other"


def say(out: dict[str, Any], template: str, **params: Any) -> None:
	"""Set a result's reason from an English template. The template and parameters are stored too,
	so the desk can translate the sentence when it is shown instead of when it was scored."""
	out["reason"] = template.format(**params)
	out["reason_template"] = template
	out["reason_params"] = json.dumps(params, ensure_ascii=False, default=str)


# --- Confidence (how well the CV was read) ----------------------------------------------------

CONFIDENCE_METRICS = ("ATS friendly", "Date consistency", "Information completeness")


def calculate_confidence(
	metric_results: list[dict[str, Any]], sections: dict[str, str]
) -> tuple[str, dict[str, Any]]:
	"""Reading quality, kept out of the score: a creative two-column CV is not a weaker candidate."""
	scores = {r["metric"]: float(r.get("score", 0)) for r in metric_results if r["metric"] in CONFIDENCE_METRICS}
	recognized = sum(1 for k, v in sections.items() if k not in ("header", "other") and v.strip())
	lowest = min(scores.values()) if scores else 100.0
	params = {"recognized": recognized, "lowest": f"{lowest:.0f}"}
	message: dict[str, Any] = {}
	if recognized < 2 or lowest < 50:
		level, template = "Low", "Only {recognized} CV sections recognized; lowest reading score {lowest}."
	elif recognized < 3 or lowest < 70:
		level, template = "Medium", "{recognized} CV sections recognized; lowest reading score {lowest}."
	else:
		level, template = "High", "{recognized} CV sections recognized; reading scores all at least 70."
	say(message, template, **params)
	return level, message


# --- Penalties ----------------------------------------------------------------------------------

PENALTY_RULES = ("Job Hopping", "No Impact", "Grammar", "Brevity")
# Contract, internship and project roles are short by design and must not count as job hopping
SHORT_BY_DESIGN = re.compile(r"\b(intern|internship|magang|freelance|kontrak|contract|project[- ]based|part[- ]time|paruh waktu)\b", re.I)
MONTHS_PER_YEAR = 12.0


def average_tenure_years(experience_text: str) -> tuple[float | None, int]:
	"""Average years per job, ignoring roles that are short by design. None when fewer than 2 jobs."""
	tenures = []
	lines = experience_text.splitlines()
	for i, line in enumerate(lines):
		# The job title usually sits on the date line or the line above it
		title_area = (lines[i - 1] if i else "") + " " + line
		if SHORT_BY_DESIGN.search(title_area):
			continue
		for r in extract_date_ranges(line):
			(sy, sm), (ey, em) = r["start"], r["end"]
			months = (ey * 12 + em) - (sy * 12 + sm) + 1
			if months > 0:
				tenures.append(months / MONTHS_PER_YEAR)
	if len(tenures) < 2:
		return None, len(tenures)
	return round(sum(tenures) / len(tenures), 2), len(tenures)


def evaluate_penalty(
	rule: dict[str, Any], extraction: ExtractionResult, sections: dict[str, str], signals: dict[str, Any]
) -> dict[str, Any]:
	name = rule.get("rule")
	points = float(rule.get("points") or 0)
	threshold = float(rule.get("threshold") or 0)
	out = {"rule_type": "Penalty", "rule": name, "triggered": 0, "points": 0.0, "effect": "", "reason": "", "evidence": ""}

	if name == "Job Hopping":
		avg, jobs = average_tenure_years(sections.get("experience", "") or extraction.normalized_text)
		limit = threshold or 1.5
		if avg is None:
			say(out, "Not enough dated jobs to judge tenure ({jobs} found).", jobs=jobs)
		elif avg < limit:
			out["triggered"] = 1
			say(out, "Average tenure {avg} years across {jobs} jobs is below {limit} years.", avg=avg, jobs=jobs, limit=limit)
		else:
			say(out, "Average tenure {avg} years across {jobs} jobs.", avg=avg, jobs=jobs)
	elif name == "No Impact":
		found = int(signals.get("achievement_count", 0))
		need = int(threshold or 1)
		if found < need:
			out["triggered"] = 1
			say(out, "{found} measurable achievements found (numbers, %, Rp); at least {need} expected.", found=found, need=need)
		else:
			say(out, "{found} measurable achievements found.", found=found)
		out["evidence"] = signals.get("achievement_example", "")
	elif name == "Grammar":
		words = int(signals.get("word_count", 0))
		typos = int(signals.get("typo_count", 0))
		limit = threshold or 3.0
		ratio = (typos / words * 100.0) if words else 0.0
		if words and ratio > limit:
			out["triggered"] = 1
			say(out, "Typo ratio {ratio}% is above {limit}%.", ratio=f"{ratio:.1f}", limit=limit)
		else:
			say(out, "Typo ratio {ratio}% (limit {limit}%).", ratio=f"{ratio:.1f}", limit=limit)
		out["evidence"] = signals.get("typo_example", "")
	elif name == "Brevity":
		max_pages = int(threshold or 3)
		max_words = int(rule.get("secondary_threshold") or 1000)
		words = len(extraction.normalized_text.split())
		if extraction.page_count > max_pages or words > max_words:
			out["triggered"] = 1
			say(out, "{pages} pages and {words} words (limit {max_pages} pages or {max_words} words).",
				pages=extraction.page_count, words=words, max_pages=max_pages, max_words=max_words)
		else:
			say(out, "{pages} pages and {words} words.", pages=extraction.page_count, words=words)
	else:
		say(out, "Unknown penalty rule: {name}", name=name)

	if out["triggered"]:
		out["points"] = -points
		out["effect"] = "Subtract points"
	return out


# --- Custom rules ------------------------------------------------------------------------------

def _terms(value: str) -> list[str]:
	return [t.strip() for t in re.split(r"[\n,;]+", value or "") if t.strip()]


def _contains(text: str, term: str) -> bool:
	return re.search(r"(?<!\w)" + re.escape(term) + r"(?!\w)", text, re.IGNORECASE) is not None


def _section_text(section: str, extraction: ExtractionResult, sections: dict[str, str]) -> str:
	key = (section or "Whole CV").lower()
	if key == "whole cv":
		return extraction.normalized_text
	return sections.get(key, "")


def custom_rule_matches(rule: dict[str, Any], text: str) -> tuple[bool, str]:
	op = rule.get("operator") or "Contains any"
	value = rule.get("value") or ""
	terms = _terms(value)
	if op == "Contains any":
		hit = [t for t in terms if _contains(text, t)]
		return bool(hit), ", ".join(hit)
	if op == "Contains all":
		missing = [t for t in terms if not _contains(text, t)]
		return not missing and bool(terms), ", ".join(missing) if missing else ", ".join(terms)
	if op == "Does not contain":
		hit = [t for t in terms if _contains(text, t)]
		return not hit, ", ".join(hit)
	if op == "Matches regex":
		try:
			m = re.search(value, text, re.IGNORECASE)
		except re.error:
			return False, ""
		return bool(m), m.group(0)[:120] if m else ""
	if op == "Count at least":
		need = int(rule.get("count") or 1)
		total = sum(len(re.findall(r"(?<!\w)" + re.escape(t) + r"(?!\w)", text, re.IGNORECASE)) for t in terms)
		return total >= need, f"{total}x"
	return False, ""


def evaluate_custom(rule: dict[str, Any], extraction: ExtractionResult, sections: dict[str, str]) -> dict[str, Any]:
	text = _section_text(rule.get("section"), extraction, sections)
	matched, evidence = custom_rule_matches(rule, text)
	effect = rule.get("effect") or "Flag only"
	points = float(rule.get("points") or 0)
	out = {
		"rule_type": "Custom",
		"rule": rule.get("label") or rule.get("value") or "Custom rule",
		"triggered": 1 if matched else 0,
		"points": 0.0,
		"effect": effect if matched else "",
		"evidence": evidence,
		"cap": None,
	}
	say(
		out,
		"{operator} '{value}' in {section}: matched." if matched else "{operator} '{value}' in {section}: not matched.",
		operator=rule.get("operator") or "Contains any", value=rule.get("value") or "", section=rule.get("section") or "Whole CV",
	)
	if matched:
		if effect == "Add points":
			out["points"] = points
		elif effect == "Subtract points":
			out["points"] = -points
		elif effect == "Cap score":
			out["cap"] = points
	return out


# --- Knock-outs --------------------------------------------------------------------------------

def evaluate_knockout(
	rule: dict[str, Any], extraction: ExtractionResult, sections: dict[str, str], signals: dict[str, Any]
) -> dict[str, Any]:
	cond = rule.get("condition") or "Required keyword"
	value = rule.get("value") or ""
	failed = False
	template, params = "", {}
	if cond == "Minimum education level":
		need = parse_degree_level(value)
		level, name = detect_candidate_degree(sections.get("education", "") or extraction.normalized_text)
		failed = need > 0 and level < need
		template, params = "Highest education detected: {detected}; required {required}.", {"detected": name, "required": value}
	elif cond == "Minimum years of experience":
		need = float(value or 0)
		years = float(signals.get("total_years", 0))
		failed = years < need
		template, params = "{years} years of experience detected; required {required}.", {"years": years, "required": need}
	else:
		terms = _terms(value)
		found = [t for t in terms if _contains(extraction.normalized_text, t)]
		if (rule.get("match") or "Any") == "All":
			failed = len(found) < len(terms)
		else:
			failed = not found
		template, params = "Required: {required}. Found: {found}.", {"required": value, "found": ", ".join(found) or "none"}
	action = rule.get("action") or "Cap score"
	out = {
		"rule_type": "Knock-out",
		"rule": rule.get("description") or f"{cond}: {value}",
		"triggered": 1 if failed else 0,
		"points": 0.0,
		"effect": action if failed else "",
		"evidence": "",
		"cap": (0.0 if action == "Zero score" else float(rule.get("cap_score") or 60)) if failed and action != "Needs review" else None,
	}
	say(out, template, **params)
	return out


# --- Orchestration -----------------------------------------------------------------------------

def apply_rules(
	base_score: float,
	extraction: ExtractionResult,
	sections: dict[str, str],
	signals: dict[str, Any],
	penalty_rules: list[dict[str, Any]],
	custom_rules: list[dict[str, Any]],
	knockout_rules: list[dict[str, Any]],
) -> dict[str, Any]:
	"""Returns final score, rule results and whether HR must review."""
	results: list[dict[str, Any]] = []
	score = float(base_score)

	for rule in penalty_rules:
		if rule.get("enabled"):
			res = evaluate_penalty(rule, extraction, sections, signals)
			score += res["points"]
			results.append(res)

	caps: list[float] = []
	needs_review = False
	for rule in custom_rules:
		if rule.get("enabled"):
			res = evaluate_custom(rule, extraction, sections)
			score += res["points"]
			if res["cap"] is not None:
				caps.append(res["cap"])
			if res["triggered"] and res["effect"] == "Flag only":
				needs_review = True
			results.append(res)

	score = max(0.0, min(100.0, score))

	for rule in knockout_rules:
		if rule.get("enabled"):
			res = evaluate_knockout(rule, extraction, sections, signals)
			if res["triggered"]:
				needs_review = True
				if res["cap"] is not None:
					caps.append(res["cap"])
			results.append(res)

	if caps:
		score = min(score, min(caps))
	for r in results:
		r.pop("cap", None)
	return {
		"final_score": float(round(score)),
		"penalty_points": float(sum(r["points"] for r in results if r["rule_type"] == "Penalty")),
		"rule_results": results,
		"needs_hr_review": 1 if needs_review else 0,
	}
