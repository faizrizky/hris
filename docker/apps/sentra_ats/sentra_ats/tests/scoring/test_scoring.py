# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Pytest unit tests untuk ekstraksi dan seluruh metrik scoring (fungsi murni).
Dapat dijalankan tanpa frappe: python -m pytest apps/sentra_ats/sentra_ats/tests/scoring
"""

import os

from sentra_ats.scoring.engine import METRIC_MODULES, run_screening
from sentra_ats.scoring.extract import extract_cv, normalize_text
from sentra_ats.scoring.metrics import (
	achievement_relevance,
	ats_friendly,
	certification_relevance,
	date_consistency,
	education_relevance,
	experience_relevance,
	grammar,
	information_completeness,
	skill_relevance,
)
from sentra_ats.scoring.sections import count_recognized_sections, split_sections
from sentra_ats.scoring.total import calculate_total_score

FIXTURES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "fixtures")

DEFAULT_WEIGHTS = [
	{"metric": "ATS friendly", "weight": 10, "enabled": 1},
	{"metric": "Grammar", "weight": 5, "enabled": 1},
	{"metric": "Date consistency", "weight": 10, "enabled": 1},
	{"metric": "Information completeness", "weight": 10, "enabled": 1},
	{"metric": "Education relevance", "weight": 10, "enabled": 1},
	{"metric": "Skill relevance", "weight": 25, "enabled": 1},
	{"metric": "Experience relevance", "weight": 20, "enabled": 1},
	{"metric": "Achievement relevance", "weight": 5, "enabled": 1},
	{"metric": "Certification relevance", "weight": 5, "enabled": 1},
]

SAMPLE_CRITERIA = {
	"applicant_name": "Budi Santoso",
	"min_education": "D4/S1",
	"education_majors": "Teknik Informatika, Ilmu Komputer, Sistem Informasi",
	"min_years_experience": 3.0,
	"relevant_titles": "Software Engineer, Backend Developer, Programmer",
	"required_skills": "Python\nSQL\nERPNext\nDocker",
	"preferred_skills": "Redis\nREST API\nGit",
	"certification_keywords": "Scrum Master\nAWS",
}


def test_extraction_pdf_single_column():
	pdf_path = os.path.join(FIXTURES_DIR, "cv_01_single_column.pdf")
	res = extract_cv(pdf_path)
	assert not res.error
	assert not res.is_scan
	assert not res.is_multi_column
	assert "Budi Santoso" in res.normalized_text
	assert res.page_count == 1


def test_extraction_scan_pdf_detected():
	pdf_path = os.path.join(FIXTURES_DIR, "cv_03_scanned_image.pdf")
	res = extract_cv(pdf_path, min_text_chars_per_page=200)
	assert res.is_scan
	assert "gambar/scan" in (res.error or "")


def test_extraction_docx():
	docx_path = os.path.join(FIXTURES_DIR, "cv_04_sample.docx")
	res = extract_cv(docx_path)
	assert not res.error
	assert not res.is_scan
	assert "Mega Wulandari" in res.normalized_text
	assert "Selenium" in res.normalized_text


def test_extraction_pdf_multi_column():
	pdf_path = os.path.join(FIXTURES_DIR, "cv_02_two_column.pdf")
	res = extract_cv(pdf_path)
	assert not res.error
	assert res.is_multi_column


def test_sections_split():
	pdf_path = os.path.join(FIXTURES_DIR, "cv_01_single_column.pdf")
	res = extract_cv(pdf_path)
	sec = split_sections(res.normalized_text)
	assert "experience" in sec
	assert "education" in sec
	assert "skills" in sec
	assert count_recognized_sections(sec) >= 4


def test_metric_ats_friendly_penalizes_multi_column():
	res_single = extract_cv(os.path.join(FIXTURES_DIR, "cv_01_single_column.pdf"))
	res_multi = extract_cv(os.path.join(FIXTURES_DIR, "cv_02_two_column.pdf"))

	sec_single = split_sections(res_single.normalized_text)
	sec_multi = split_sections(res_multi.normalized_text)

	eval_single = ats_friendly.evaluate(res_single, sec_single)
	eval_multi = ats_friendly.evaluate(res_multi, sec_multi)

	assert eval_single["score"] >= 90.0
	assert eval_multi["score"] < eval_single["score"]
	assert "multi-column" in eval_multi["reason"].lower()


def test_metric_date_consistency_detects_overlaps():
	pdf_path = os.path.join(FIXTURES_DIR, "cv_09_overlapping_roles.pdf")
	res = extract_cv(pdf_path)
	sec = split_sections(res.normalized_text)

	eval_res = date_consistency.evaluate(res, sec)
	assert "overlapping" in eval_res["reason"].lower()
	assert eval_res["score"] <= 90.0


def test_metric_date_consistency_detects_mixed_formats():
	pdf_path = os.path.join(FIXTURES_DIR, "cv_08_mixed_dates.pdf")
	res = extract_cv(pdf_path)
	sec = split_sections(res.normalized_text)

	eval_res = date_consistency.evaluate(res, sec)
	assert "mixed" in eval_res["reason"].lower()


def test_metric_information_completeness_detects_missing_phone():
	pdf_path = os.path.join(FIXTURES_DIR, "cv_07_no_phone.pdf")
	res = extract_cv(pdf_path)
	sec = split_sections(res.normalized_text)

	eval_res = information_completeness.evaluate(res, sec)
	assert "phone number not found" in eval_res["reason"].lower()
	assert eval_res["score"] <= 85.0


def test_metric_education_relevance():
	res = extract_cv(os.path.join(FIXTURES_DIR, "cv_01_single_column.pdf"))
	sec = split_sections(res.normalized_text)

	# S1 Informatika vs S1 Informatika
	match_eval = education_relevance.evaluate(res, sec, SAMPLE_CRITERIA)
	assert match_eval["score"] == 100.0

	# Minta S3 -> skor turun
	high_criteria = dict(SAMPLE_CRITERIA, min_education="S3")
	low_eval = education_relevance.evaluate(res, sec, high_criteria)
	assert low_eval["score"] < 60.0


def test_metric_skill_relevance():
	res = extract_cv(os.path.join(FIXTURES_DIR, "cv_01_single_column.pdf"))
	sec = split_sections(res.normalized_text)

	eval_res = skill_relevance.evaluate(res, sec, SAMPLE_CRITERIA)
	assert eval_res["score"] >= 80.0
	assert "required skills" in eval_res["reason"].lower()


def test_metric_experience_relevance_fresh_graduate():
	res = extract_cv(os.path.join(FIXTURES_DIR, "cv_10_fresh_graduate.pdf"))
	sec = split_sections(res.normalized_text)

	eval_res = experience_relevance.evaluate(res, sec, SAMPLE_CRITERIA)
	assert eval_res["total_years"] < 1.0


def test_metric_achievement_relevance():
	res = extract_cv(os.path.join(FIXTURES_DIR, "cv_01_single_column.pdf"))
	sec = split_sections(res.normalized_text)

	eval_res = achievement_relevance.evaluate(res, sec)
	assert eval_res["score"] >= 40.0
	assert eval_res["findings_count"] >= 2


def test_total_calculation_with_inapplicable_normalization():
	metric_results = [
		{"metric": "ATS friendly", "score": 100.0, "applicable": True, "reason": "OK"},
		{"metric": "Grammar", "score": 100.0, "applicable": True, "reason": "OK"},
		{"metric": "Skill relevance", "score": 50.0, "applicable": True, "reason": "50%"},
		{"metric": "Certification relevance", "score": 0.0, "applicable": False, "reason": "N/A"},
	]
	weights = [
		{"metric": "ATS friendly", "weight": 25, "enabled": 1},
		{"metric": "Grammar", "weight": 25, "enabled": 1},
		{"metric": "Skill relevance", "weight": 25, "enabled": 1},
		{"metric": "Certification relevance", "weight": 25, "enabled": 1},
	]
	# Applicable sum = 75. Normalized weights: each applicable becomes 1/3 (33.33%).
	# Total = 100*(1/3) + 100*(1/3) + 50*(1/3) = 83.33 -> 83
	res = calculate_total_score(metric_results, weights, min_score_to_pass=75)
	assert res["total_score"] == 83.0
	assert res["passed"] == 1


def test_all_10_fixtures_end_to_end():
	"""Uji menyeluruh atas 10 berkas CV fiktif dengan ekspektasi skor masuk akal."""
	files = [
		("cv_01_single_column.pdf", "Done", 75.0, 100.0, "Experienced"),
		("cv_02_two_column.pdf", "Done", 50.0, 95.0, "Experienced"),
		("cv_03_scanned_image.pdf", "Needs Review", 0.0, 0.0, "Fresh Graduate"),  # unreadable CVs go to manual review
		("cv_04_sample.docx", "Done", 50.0, 95.0, "Experienced"),
		("cv_05_english.pdf", "Done", 70.0, 100.0, "Experienced"),
		("cv_06_indonesian.pdf", "Done", 50.0, 95.0, "Experienced"),
		("cv_07_no_phone.pdf", "Done", 40.0, 85.0, "Experienced"),
		("cv_08_mixed_dates.pdf", "Done", 50.0, 90.0, "Experienced"),
		("cv_09_overlapping_roles.pdf", "Done", 60.0, 95.0, "Experienced"),
		("cv_10_fresh_graduate.pdf", "Done", 30.0, 75.0, "Fresh Graduate"),
	]

	score_labels = [
		{"label_type": "Range", "score_from": 85, "score_to": 100, "label": "Sangat Cocok", "indicator": "green"},
		{"label_type": "Range", "score_from": 70, "score_to": 84, "label": "Memenuhi Syarat", "indicator": "blue"},
		{"label_type": "Range", "score_from": 50, "score_to": 69, "label": "Cukup Relevan", "indicator": "orange"},
		{"label_type": "Range", "score_from": 0, "score_to": 49, "label": "Kurang Memenuhi", "indicator": "red"},
	]

	results_summary = []

	for fname, expected_status, min_score, max_score, expected_level in files:
		path = os.path.join(FIXTURES_DIR, fname)
		res = run_screening(
			file_path=path,
			metric_weights=DEFAULT_WEIGHTS,
			criteria=SAMPLE_CRITERIA,
			min_score_to_pass=70.0,
			pass_description="Pelamar memenuhi kriteria lowongan.",
			fail_description="Pelamar belum memenuhi kriteria minimal.",
			score_labels=score_labels,
		)

		assert res["status"] == expected_status, f"{fname} status mismatch: {res['status']} vs {expected_status}"
		if expected_status == "Done":
			assert min_score <= res["total_score"] <= max_score, (
				f"{fname} score out of range: {res['total_score']} (expected {min_score}-{max_score})"
			)
			assert res["experience_level"] == expected_level, (
				f"{fname} exp level mismatch: {res['experience_level']} vs {expected_level}"
			)
			assert len(res["results"]) == 9
			for r in res["results"]:
				assert r["reason"], f"Metric {r['metric']} missing reason on {fname}"

		results_summary.append((fname, res["status"], res["total_score"], res["experience_level"], res["result_label"]))

	# Tampilkan hasil ringkasan untuk verifikasi
	print("\n=== RINGKASAN SKOR 10 CV FIKTIF ===")
	for row in results_summary:
		print(f"{row[0]:<30} | {row[1]:<7} | Skor: {row[2]:>4.1f} | {row[3]:<15} | Label: {row[4]}")


def test_workflow_typing_and_any_defined():
	"""Regression test: Ensure scoring/workflow.py imports and defines Any for annotations (Ruff F821 regression)."""
	import ast

	workflow_path = os.path.join(
		os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
		"scoring",
		"workflow.py",
	)
	assert os.path.exists(workflow_path), f"workflow.py not found at {workflow_path}"

	with open(workflow_path, encoding="utf-8") as f:
		tree = ast.parse(f.read(), filename=workflow_path)

	# Verify typing.Any is explicitly imported
	has_any_import = False
	for node in ast.walk(tree):
		if isinstance(node, ast.ImportFrom) and node.module == "typing":
			for alias in node.names:
				if alias.name == "Any":
					has_any_import = True
					break

	assert has_any_import, "scoring/workflow.py must import 'Any' from 'typing'"

	# Verify that functions using Any in annotations have valid AST nodes
	annotated_funcs = []
	for node in tree.body:
		if isinstance(node, ast.FunctionDef):
			for n in ast.walk(node):
				if isinstance(n, ast.Name) and n.id == "Any":
					annotated_funcs.append(node.name)
					break

	assert "rescreen" in annotated_funcs
	assert "bulk_rescreen" in annotated_funcs
	assert "rescreen_applicant" in annotated_funcs
