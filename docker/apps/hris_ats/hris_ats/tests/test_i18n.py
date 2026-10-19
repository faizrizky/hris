# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Pytest test suite for Fase 2 i18n guards:
(a) All source strings in _() / __() have matching rows in id.csv.
(b) No common Indonesian words in UI source strings outside allowlisted CV vocabulary modules.
(c) All label, description, and options in DocType JSONs are in English and covered in id.csv.
(d) render produces Indonesian when lang="id" and English when lang="en".
(e) Migration patch migrate_select_to_english is idempotent.
"""

from __future__ import annotations

import ast
import csv
import glob
import json
import os
import re
from typing import Any

import pytest

from hris_ats.i18n import LocalizedText, render

BASE_APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ID_CSV_PATH = os.path.join(BASE_APP_DIR, "translations", "id.csv")

COMMON_ID_WORDS = [
	"dan", "yang", "tidak", "dengan", "untuk",
	"belum", "sudah", "pada", "dari", "atau",
	"adalah", "harus",
]

ALLOWLISTED_CV_MODULES = {
	"sections.py",
	"education.py",
	"skills.py",
	"experience.py",
	"achievement.py",
	"certification.py",
}


def load_translations() -> dict[str, str]:
	"""Loads source -> target translations from translations/id.csv."""
	translations: dict[str, str] = {}
	if os.path.exists(ID_CSV_PATH):
		with open(ID_CSV_PATH, encoding="utf-8") as f:
			reader = csv.reader(f)
			for row in reader:
				if row and len(row) >= 2:
					translations[row[0]] = row[1]
	return translations


def extract_python_source_strings(app_dir: str) -> list[tuple[str, str]]:
	"""Extracts literal string arguments from _("...") or frappe._("...") in Python files."""
	strings: list[tuple[str, str]] = []
	for root, _dirs, files in os.walk(app_dir):
		if "tests" in root or "__pycache__" in root:
			continue
		for f in files:
			if f.endswith(".py"):
				path = os.path.join(root, f)
				with open(path, encoding="utf-8") as pyf:
					try:
						tree = ast.parse(pyf.read(), filename=path)
					except Exception:
						continue
					for node in ast.walk(tree):
						if isinstance(node, ast.Call):
							is_trans = False
							if isinstance(node.func, ast.Name) and node.func.id == "_":
								is_trans = True
							elif isinstance(node.func, ast.Attribute) and node.func.attr == "_":
								is_trans = True
							if (
								is_trans
								and node.args
								and isinstance(node.args[0], ast.Constant)
								and isinstance(node.args[0].value, str)
							):
								val = node.args[0].value.strip()
								if val:
									strings.append((path, val))
	return strings


def extract_js_source_strings(app_dir: str) -> list[tuple[str, str]]:
	"""Extracts literal string arguments from __("...") in JS files."""
	strings: list[tuple[str, str]] = []
	for root, _dirs, files in os.walk(app_dir):
		if "tests" in root or "node_modules" in root:
			continue
		for f in files:
			if f.endswith(".js"):
				path = os.path.join(root, f)
				with open(path, encoding="utf-8") as jsf:
					content = jsf.read()
					matches = re.findall(r"__\(\s*([\"\x27])((?:\\.|(?!\1).)*?)\1\s*[,)]", content)
					for _q, s in matches:
						try:
							s_clean = s.encode().decode("unicode-escape").strip()
						except Exception:
							s_clean = s.strip()
						if s_clean:
							strings.append((path, s_clean))
	return strings


def extract_html_source_strings(app_dir: str) -> list[tuple[str, str]]:
	"""Extracts literal string arguments from _("...") or __("...") in HTML files."""
	strings: list[tuple[str, str]] = []
	for root, _dirs, files in os.walk(app_dir):
		if "tests" in root:
			continue
		for f in files:
			if f.endswith(".html"):
				path = os.path.join(root, f)
				with open(path, encoding="utf-8") as hf:
					content = hf.read()
					matches = re.findall(r"(?:__|_)\(\s*([\"\x27])((?:\\.|(?!\1).)*?)\1\s*[,)]", content)
					for _q, s in matches:
						try:
							s_clean = s.encode().decode("unicode-escape").strip()
						except Exception:
							s_clean = s.strip()
						if s_clean:
							strings.append((path, s_clean))
	return strings


# =====================================================================
# Guard (a): Semua string sumber di _() / __() punya baris di id.csv
# =====================================================================

def test_guard_a_source_strings_have_id_csv_translations():
	translations = load_translations()
	assert len(translations) > 0, "translations/id.csv must not be empty"

	py_strings = extract_python_source_strings(BASE_APP_DIR)
	js_strings = extract_js_source_strings(BASE_APP_DIR)
	html_strings = extract_html_source_strings(BASE_APP_DIR)

	all_extracted = py_strings + js_strings + html_strings
	assert len(all_extracted) > 0, "Expected to extract UI source strings from Python, JS, and HTML"

	missing: list[tuple[str, str]] = []
	for file_path, string_val in all_extracted:
		if string_val not in translations:
			missing.append((os.path.basename(file_path), string_val))

	if missing:
		sample_missing = "\n".join(f"  [{f}] {s!r}" for f, s in sorted(set(missing))[:20])
		pytest.fail(f"Found {len(missing)} UI source strings missing from translations/id.csv:\n{sample_missing}")


# =====================================================================
# Guard (b): Tidak ada string sumber memuat kata Indonesia umum di luar allowlist
# =====================================================================

def test_guard_b_no_indonesian_source_strings_outside_allowlist():
	id_word_pattern = re.compile(r"\b(" + "|".join(COMMON_ID_WORDS) + r")\b", re.IGNORECASE)

	py_strings = extract_python_source_strings(BASE_APP_DIR)
	js_strings = extract_js_source_strings(BASE_APP_DIR)
	html_strings = extract_html_source_strings(BASE_APP_DIR)

	all_extracted = py_strings + js_strings + html_strings
	violations: list[tuple[str, str, list[str]]] = []

	for file_path, string_val in all_extracted:
		filename = os.path.basename(file_path)
		if filename in ALLOWLISTED_CV_MODULES:
			continue

		hits = id_word_pattern.findall(string_val)
		if hits:
			violations.append((filename, string_val, list(set(hits))))

	if violations:
		sample = "\n".join(f"  [{f}] {s!r} (detected ID words: {h})" for f, s, h in violations[:15])
		pytest.fail(f"Found {len(violations)} source strings with common Indonesian words outside allowlist:\n{sample}")


# =====================================================================
# Guard (c): Semua label, description, options di JSON doctype berbahasa Inggris dan terkover di id.csv
# =====================================================================

def test_guard_c_doctype_schemas_english_and_covered_in_id_csv():
	translations = load_translations()
	id_word_pattern = re.compile(r"\b(" + "|".join(COMMON_ID_WORDS) + r")\b", re.IGNORECASE)

	doctype_dir = os.path.join(BASE_APP_DIR, "hris_ats", "doctype")
	json_files = glob.glob(os.path.join(doctype_dir, "*", "*.json"))
	assert len(json_files) >= 10, "Expected at least 10 DocType schema JSON files"

	missing_translations: list[tuple[str, str, str]] = []
	indonesian_violations: list[tuple[str, str, str, list[str]]] = []

	for json_file in json_files:
		dt_name = os.path.basename(os.path.dirname(json_file))
		with open(json_file, encoding="utf-8") as f:
			data = json.load(f)

		for field in data.get("fields", []):
			fn = field.get("fieldname", "")

			# 1. Label
			lbl = field.get("label")
			if lbl and lbl.strip():
				clean_lbl = lbl.strip()
				if clean_lbl not in translations:
					missing_translations.append((dt_name, f"label({fn})", clean_lbl))
				hits = id_word_pattern.findall(clean_lbl)
				if hits:
					indonesian_violations.append((dt_name, f"label({fn})", clean_lbl, hits))

			# 2. Description
			desc = field.get("description")
			if desc and desc.strip():
				clean_desc = desc.strip()
				if clean_desc not in translations:
					missing_translations.append((dt_name, f"description({fn})", clean_desc))
				hits = id_word_pattern.findall(clean_desc)
				if hits:
					indonesian_violations.append((dt_name, f"description({fn})", clean_desc, hits))

			# 3. Select options
			ftype = field.get("fieldtype")
			opts = field.get("options")
			if ftype == "Select" and opts and isinstance(opts, str):
				for raw_opt in opts.split("\n"):
					opt = raw_opt.strip()
					# Exclude non-translatable technical values (series format, raw colors)
					if not opt or opt.startswith("RS-") or opt.startswith("BGC-") or opt in (
						"green", "orange", "red", "blue", "grey", "purple"
					):
						continue

					if opt not in translations:
						missing_translations.append((dt_name, f"option({fn})", opt))
					hits = id_word_pattern.findall(opt)
					if hits:
						indonesian_violations.append((dt_name, f"option({fn})", opt, hits))

	assert not indonesian_violations, (
		f"DocType schema has Indonesian words in labels/descriptions/options: {indonesian_violations[:10]}"
	)
	assert not missing_translations, (
		f"DocType schema items missing from translations/id.csv: {missing_translations[:10]}"
	)


# =====================================================================
# Guard (d): render menghasilkan teks Indonesia saat lang="id" dan Inggris saat lang="en"
# =====================================================================

def test_guard_d_render_bilingual_behavior():
	# 1. Parameterized summary template
	template_summary = "{name} applied for {title}."
	params_summary = {"name": "Ronald Richard", "title": "UI/UX Designer"}

	res_en = render(template_summary, params_summary, lang="en")
	assert res_en == "Ronald Richard applied for UI/UX Designer."

	res_id = render(template_summary, params_summary, lang="id")
	assert res_id == "Ronald Richard melamar sebagai UI/UX Designer."

	# 2. Metric scoring template
	template_metric = "Matched {matched_req_count} of {total_req_count} required skills"
	params_metric = {"matched_req_count": 3, "total_req_count": 4}

	metric_en = render(template_metric, params_metric, lang="en")
	assert metric_en == "Matched 3 of 4 required skills"

	metric_id = render(template_metric, params_metric, lang="id")
	assert metric_id == "Cocok 3 dari 4 keahlian wajib"

	# 3. Compound template separated by sentence boundary
	compound_template = (
		"{name} applied for {title}. "
		"{n} public accounts were found ({platforms})."
	)
	comp_en = render(compound_template, {"name": "Ronald Richard", "title": "UI/UX Designer", "n": 2, "platforms": "GitHub, LinkedIn"}, lang="en")
	assert "applied for UI/UX Designer" in comp_en
	assert "were found" in comp_en

	comp_id = render(compound_template, {"name": "Ronald Richard", "title": "UI/UX Designer", "n": 2, "platforms": "GitHub, LinkedIn"}, lang="id")
	assert "melamar sebagai UI/UX Designer" in comp_id
	assert "Ditemukan 2 akun publik" in comp_id

	# 4. LocalizedText object
	loc = LocalizedText(
		text="2 articles are likely related.",
		template="{a} articles are likely related.",
		params={"a": 2},
	)
	assert render(loc, lang="en") == "2 articles are likely related."
	assert render(loc, lang="id") == "Ada 2 artikel yang kemungkinan besar terkait."


# =====================================================================
# Guard (e): Patch migrasi nilai Select idempoten
# =====================================================================

def test_guard_e_migrate_select_patch_idempotent():
	from hris_ats.patches.v1_0 import migrate_select_to_english

	has_db = False
	try:
		import frappe
		if getattr(frappe.local, "db", None) is not None:
			has_db = True
		else:
			bench_sites = "/home/frappe/frappe-bench/sites"
			if os.path.exists(bench_sites):
				os.chdir(bench_sites)
				frappe.init(site="hris.localhost")
				frappe.connect()
				has_db = getattr(frappe.local, "db", None) is not None
	except Exception:
		has_db = False

	if has_db:
		# Run twice on real/connected DB to prove idempotency
		migrate_select_to_english.execute()
		migrate_select_to_english.execute()
	else:
		# Offline verification with mock db
		from unittest.mock import MagicMock, patch

		mock_db = MagicMock()
		with patch.object(frappe, "db", mock_db):
			migrate_select_to_english.execute()
			call_count_1 = mock_db.sql.call_count
			assert call_count_1 > 0, "Patch should execute SQL updates"

			migrate_select_to_english.execute()
			call_count_2 = mock_db.sql.call_count
			assert call_count_2 == call_count_1 * 2, "Patch should be repeatable without errors"


# =====================================================================
# Guard (f): ats_consent bilingual template & language priority
# =====================================================================

def test_guard_f_ats_consent_template_and_language_flow():
	consent_html_path = os.path.join(BASE_APP_DIR, "www", "ats_consent.html")
	assert os.path.exists(consent_html_path), "ats_consent.html must exist"

	with open(consent_html_path, encoding="utf-8") as f:
		html = f.read()

	# 1. Verify visible ID | EN toggle
	assert ">ID</a>" in html, "ats_consent.html must have an ID language toggle"
	assert ">EN</a>" in html, "ats_consent.html must have an EN language toggle"

	# 2. Verify checkboxes are not checked by default
	checkbox_tags = re.findall(r"<input[^>]+type=[\"']checkbox[\"'][^>]*>", html, re.IGNORECASE)
	assert len(checkbox_tags) > 0, "Expected checkbox inputs in ats_consent.html"
	for tag in checkbox_tags:
		assert "checked" not in tag.lower(), f"Checkbox must not be checked by default: {tag}"

	# 3. Verify consent_language passed to submission
	assert 'name="consent_language"' in html, "consent_language must be submitted with form"

	# 4. Verify ats_consent.py implements priority: ?lang= -> candidate_language -> Accept-Language -> id
	consent_py_path = os.path.join(BASE_APP_DIR, "www", "ats_consent.py")
	with open(consent_py_path, encoding="utf-8") as f:
		py_code = f.read()

	assert 'frappe.form_dict.get("lang")' in py_code
	assert "candidate_language" in py_code
	assert "Accept-Language" in py_code
	assert "consent_text_en" in py_code
	assert "consent_text_id" in py_code


# =====================================================================
# Guard (g): Metric templates in scoring/metrics/*.py are in id.csv and render bilingual
# =====================================================================

def test_guard_g_metric_templates_translated_and_render_bilingual():
	translations = load_translations()
	metrics_dir = os.path.join(BASE_APP_DIR, "scoring", "metrics")
	template_strings: list[tuple[str, str]] = []

	for fname in sorted(os.listdir(metrics_dir)):
		if not fname.endswith(".py"):
			continue
		path = os.path.join(metrics_dir, fname)
		with open(path, encoding="utf-8") as f:
			content = f.read()
		parts = re.findall(r"(?:template_parts\.append\(|final_template\s*=\s*)([\"\x27])((?:\\.|(?!\1).)+)\1", content)
		for _q, s in parts:
			s_clean = s.strip()
			if s_clean and not s_clean.startswith("; ") and s_clean != ";":
				template_strings.append((fname, s_clean))

	assert len(template_strings) > 0, "Expected to extract metric template strings"

	missing = []
	for fname, tmpl in template_strings:
		if tmpl not in translations:
			missing.append((fname, tmpl))

	assert not missing, f"Found metric templates missing from translations/id.csv: {missing}"

	# Test bilingual rendering on a sample of metric templates
	sample_tests = [
		(
			"Found {count} measurable work achievements (e.g. percentages, amounts, or project scale).",
			{"count": 2},
			"Found 2 measurable work achievements (e.g. percentages, amounts, or project scale).",
			"Ditemukan 2 pencapaian kerja terukur (mis. persentase, nominal, atau skala proyek).",
		),
		(
			"Certifications matched: {certs}",
			{"certs": "PMP, AWS"},
			"Certifications matched: PMP, AWS",
			"Sertifikasi cocok: PMP, AWS",
		),
		(
			"Experience of {years} years meets minimum requirement of {min_years} years",
			{"years": 5, "min_years": 3},
			"Experience of 5 years meets minimum requirement of 3 years",
			"Pengalaman 5 tahun memenuhi syarat minimal 3 tahun",
		),
	]

	for tmpl, params, exp_en, exp_id in sample_tests:
		res_en = render(tmpl, params, lang="en")
		assert res_en == exp_en
		res_id = render(tmpl, params, lang="id")
		assert res_id == exp_id


# =====================================================================
# Guard (h): Consent text version auto increment in Settings
# =====================================================================

def test_guard_h_consent_text_version_auto_increment():
	from unittest.mock import MagicMock

	from hris_ats.hris_ats.doctype.background_check_settings.background_check_settings import (
		validate_consent_text_version,
	)

	# Case 1: Initial version v1.0
	doc = MagicMock()
	doc.is_new.return_value = True
	doc.consent_text_version = ""
	doc.consent_text_id = "Teks ID 1"
	doc.consent_text_en = "Text EN 1"
	validate_consent_text_version(doc)
	assert doc.consent_text_version == "v1.0"

	# Case 2: Unchanged text keeps version
	doc.is_new.return_value = False
	doc.has_value_changed.return_value = False
	doc.consent_text_version = "v1.0"
	validate_consent_text_version(doc)
	assert doc.consent_text_version == "v1.0"

	# Case 3: Changing consent_text_id bumps v1.0 -> v1.1
	doc.has_value_changed.side_effect = lambda f: f == "consent_text_id"
	validate_consent_text_version(doc)
	assert doc.consent_text_version == "v1.1"

	# Case 4: Changing consent_text_en bumps v1.1 -> v1.2
	doc.consent_text_version = "v1.1"
	doc.has_value_changed.side_effect = lambda f: f == "consent_text_en"
	validate_consent_text_version(doc)
	assert doc.consent_text_version == "v1.2"


# =====================================================================
# Guard (i): Social Media scope & account runner isolation
# =====================================================================

def test_guard_i_social_media_scope_and_account_runner_isolation():
	from hris_ats.bgc.runner import is_social_account

	# 1. Social platforms detection based on requires_social_consent
	assert is_social_account("Instagram") is True
	assert is_social_account("LinkedIn") is True
	assert is_social_account("TikTok") is True
	assert is_social_account("Facebook") is True

	# 2. Non-social platforms
	assert is_social_account("GitHub") is False
	assert is_social_account("YouTube") is False
	assert is_social_account("Medium") is False
	assert is_social_account("Behance") is False

