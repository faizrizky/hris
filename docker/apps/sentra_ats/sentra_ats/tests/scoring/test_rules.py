# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

from __future__ import annotations

from sentra_ats.scoring.engine import evaluate_resume
from sentra_ats.scoring.extract import ExtractionResult
from sentra_ats.scoring.rules import (
	apply_rules,
	average_tenure_years,
	custom_rule_matches,
	detect_language,
	evaluate_knockout,
	evaluate_penalty,
)

ID_TEXT = (
	"Saya adalah pengembang perangkat lunak dengan pengalaman kerja di bidang pendidikan dan teknologi. "
	"Saya bekerja sebagai pengembang di perusahaan dari tahun 2019 sampai tahun 2023 dan mengelola tim. "
) * 4
EN_TEXT = (
	"I am a software engineer with experience in the design of web applications and the delivery of "
	"projects for clients in the finance and education sectors at a large university and a startup. "
) * 4


def _ext(text: str, pages: int = 1, error: str | None = None) -> ExtractionResult:
	return ExtractionResult(raw_text=text, normalized_text=text, page_count=pages, error=error)


def test_detect_language():
	assert detect_language(ID_TEXT) == "id"
	assert detect_language(EN_TEXT) == "en"
	assert detect_language("工程师 软件 开发 经验 " * 40) == "other"
	assert detect_language("too short") == ""


def test_job_hopping_average_ignores_internships():
	text = "Dev A Jan 2020 - Dec 2020\nDev B Jan 2021 - Dec 2021\nIntern C (magang) Jan 2019 - Mar 2019\n"
	avg, jobs = average_tenure_years(text)
	assert jobs == 2 and avg == 1.0
	assert average_tenure_years("Dev A Jan 2020 - Dec 2022") == (None, 1)


def test_penalties():
	sections = {"experience": "Dev A Jan 2020 - Dec 2020\nDev B Jan 2021 - Dec 2021"}
	hop = evaluate_penalty({"rule": "Job Hopping", "points": 15, "threshold": 1.5}, _ext(""), sections, {})
	assert hop["triggered"] and hop["points"] == -15
	impact = evaluate_penalty({"rule": "No Impact", "points": 10, "threshold": 1}, _ext(""), {}, {"achievement_count": 0})
	assert impact["triggered"] and impact["points"] == -10
	grammar = evaluate_penalty({"rule": "Grammar", "points": 3, "threshold": 3}, _ext(""), {}, {"word_count": 100, "typo_count": 5})
	assert grammar["triggered"] and grammar["points"] == -3
	brief = evaluate_penalty({"rule": "Brevity", "points": 5, "threshold": 3, "secondary_threshold": 1000}, _ext("x " * 50, pages=4), {}, {})
	assert brief["triggered"]
	ok = evaluate_penalty({"rule": "Brevity", "points": 5, "threshold": 3, "secondary_threshold": 1000}, _ext("x " * 50, pages=2), {}, {})
	assert not ok["triggered"] and ok["points"] == 0


def test_custom_rule_operators():
	text = "Certified AWS Solutions Architect. Python, Django and AWS."
	assert custom_rule_matches({"operator": "Contains any", "value": "GCP, AWS"}, text)[0]
	assert not custom_rule_matches({"operator": "Contains all", "value": "AWS, GCP"}, text)[0]
	assert custom_rule_matches({"operator": "Does not contain", "value": "PHP"}, text)[0]
	assert custom_rule_matches({"operator": "Matches regex", "value": r"solutions\s+architect"}, text)[0]
	assert not custom_rule_matches({"operator": "Matches regex", "value": "("}, text)[0]
	assert custom_rule_matches({"operator": "Count at least", "value": "AWS", "count": 2}, text)[0]
	# whole-word match: "R" must not match inside "Architect"
	assert not custom_rule_matches({"operator": "Contains any", "value": "R"}, text)[0]


def test_knockouts_flag_review_and_cap():
	ext = _ext("Pendidikan SMA Negeri 1. Pengalaman kerja.")
	edu = evaluate_knockout({"condition": "Minimum education level", "value": "S1", "action": "Cap score", "cap_score": 60}, ext, {}, {})
	assert edu["triggered"] and edu["cap"] == 60
	lic = evaluate_knockout({"condition": "Required keyword", "value": "Brevet, CPA", "action": "Zero score"}, ext, {}, {})
	assert lic["triggered"] and lic["cap"] == 0
	years = evaluate_knockout({"condition": "Minimum years of experience", "value": "3", "action": "Needs review"}, ext, {}, {"total_years": 1})
	assert years["triggered"] and years["cap"] is None


def test_apply_rules_order_clamp_and_review():
	ext = _ext("Python developer")
	res = apply_rules(
		base_score=90,
		extraction=ext,
		sections={},
		signals={"achievement_count": 0},
		penalty_rules=[{"rule": "No Impact", "enabled": 1, "points": 10, "threshold": 1}],
		custom_rules=[{"label": "Bonus", "enabled": 1, "operator": "Contains any", "value": "Python", "effect": "Add points", "points": 30}],
		knockout_rules=[{"condition": "Required keyword", "enabled": 1, "value": "CPA", "action": "Cap score", "cap_score": 60}],
	)
	# 90 - 10 + 30 = 110 -> clamped to 100 -> capped at 60 by the knock-out
	assert res["final_score"] == 60 and res["penalty_points"] == -10 and res["needs_hr_review"] == 1
	disabled = apply_rules(90, ext, {}, {}, [{"rule": "No Impact", "enabled": 0, "points": 10}], [], [])
	assert disabled["final_score"] == 90 and disabled["rule_results"] == []


def test_evaluate_resume_gates():
	unreadable = evaluate_resume(_ext("", error="CV is a scanned image"), {"metric_weights": []}, {})
	assert unreadable["status"] == "Needs Review" and unreadable["needs_hr_review"] == 1
	foreign = evaluate_resume(_ext("工程师 软件 开发 经验 " * 40), {"metric_weights": [], "allowed_languages": "id,en"}, {})
	assert foreign["status"] == "Needs Review" and foreign["detected_language"] == "other"


def test_extract_contact():
	from sentra_ats.scoring.bulk_upload import extract_contact

	text = "CURRICULUM VITAE\nBUDI SANTOSO\nbudi.santoso@Mail.com | +62 812-3456-7890\nJakarta"
	c = extract_contact(text, "fallback")
	assert c == {"email": "budi.santoso@mail.com", "phone": "+6281234567890", "name": "Budi Santoso"}
	assert extract_contact("no contact here", "file name")["name"] == "file name"


def test_reasons_keep_template_and_params_for_translation():
	import json

	res = evaluate_penalty({"rule": "Brevity", "points": 5, "threshold": 3, "secondary_threshold": 1000}, _ext("x " * 50, pages=4), {}, {})
	assert res["reason_template"] == "{pages} pages and {words} words (limit {max_pages} pages or {max_words} words)."
	assert json.loads(res["reason_params"])["pages"] == 4
	assert res["reason"] == res["reason_template"].format(**json.loads(res["reason_params"]))


def test_split_sections_reads_spaced_and_key_competency_headings():
	from sentra_ats.scoring.sections import split_sections

	text = "Budi\nP R O F I L E\nDeveloper with experience.\nKEY COMPETENCIES\nPython\nCOURSES CERTIFICATIONS\nAWS\n"
	s = split_sections(text)
	assert "Developer" in s["summary"] and "Python" in s["skills"] and "AWS" in s["certifications"]
