# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Pengujian unit murni untuk modul analisis Background Check (tanpa ketergantungan frappe)."""

import pytest

from hris_ats.bgc.analysis.identity import (
	normalize_name,
	generate_name_variants,
	is_mononym,
	calculate_match_confidence,
)
from hris_ats.bgc.analysis.classify import classify_text
from hris_ats.bgc.analysis.case import detect_party_role, evaluate_case_severity
from hris_ats.bgc.analysis.posts import analyze_posts
from hris_ats.bgc.analysis.risk import calculate_risk_level
from hris_ats.bgc.analysis.summary import generate_automated_summary
from hris_ats.bgc.providers.mock import MockProvider


# =====================================================================
# 1. Identity Analysis Tests
# =====================================================================

def test_normalize_name_removes_titles_and_punctuation():
	raw = "Dr. Ir. Budi Santoso, S.Kom., M.T."
	clean = normalize_name(raw)
	assert clean == "budi santoso"


def test_mononym_detection():
	assert is_mononym("Suharto") is True
	assert is_mononym("Budi Santoso") is False
	assert is_mononym("Dr. Wahyu") is True


def test_generate_name_variants():
	variants = generate_name_variants("Ronald Richard Smith")
	assert "ronald richard smith" in variants
	assert "ronald smith" in variants


def test_calculate_match_confidence_exact_and_context():
	candidate = "Ronald Richard"
	variants = ["ronald richard"]
	context = ["Jakarta", "UI/UX"]
	text = "Ronald Richard mahasiswa desain meraih juara lomba UI/UX di Jakarta."

	conf, reasons = calculate_match_confidence(candidate, variants, context, text, total_hits=5)
	# 50 (nama persis) + 30 (2 konteks cocok) + 10 (unik) = 90
	assert conf == 90
	assert any("Nama persis" in r for r in reasons)
	assert any("Konteks cocok" in r for r in reasons)
	assert any("Bonus nama unik" in r for r in reasons)


def test_name_twins_context_discrimination():
	"""Dua orang bernama sama 'Muhammad Rizky':
	Satu di Pekanbaru (kandidat), satu lagi di Surabaya (bukan kandidat).
	"""
	candidate = "Muhammad Rizky"
	variants = ["muhammad rizky"]
	context = ["Pekanbaru", "PT Solusi Digital"]

	# Artikel 1: Orang lain di Surabaya
	text_surabaya = "Muhammad Rizky ditangkap di Surabaya terkait kasus penipuan."
	conf_surabaya, _ = calculate_match_confidence(candidate, variants, context, text_surabaya, total_hits=50)
	# 50 (nama) + 0 (konteks tidak cocok) + 0 (hits >= 20) = 50
	assert conf_surabaya == 50

	# Artikel 2: Kandidat asli di Pekanbaru
	text_pekanbaru = "Muhammad Rizky software engineer PT Solusi Digital Pekanbaru merilis aplikasi."
	conf_pekanbaru, _ = calculate_match_confidence(candidate, variants, context, text_pekanbaru, total_hits=5)
	# 50 (nama) + 30 (2 konteks cocok) + 10 (hits < 20) = 90
	assert conf_pekanbaru == 90

	# Skor kandidat asli harus jauh lebih tinggi
	assert conf_pekanbaru > conf_surabaya


# =====================================================================
# 2. Text Classification Tests
# =====================================================================

def test_classify_prestasi_and_profesional():
	res_prestasi = classify_text("Juara 1 Lomba Desain", "Meraih penghargaan medali emas")
	assert res_prestasi["category"] == "Prestasi"
	assert res_prestasi["severity"] == "Info"

	res_prof = classify_text("Narasumber Konferensi", "Menjadi pembicara dalam workshop teknologi")
	assert res_prof["category"] == "Profesional"
	assert res_prof["severity"] == "Info"


def test_classify_risk_lexicon_and_confidence_downgrade():
	lexicon = [
		{"term": "korupsi", "category": "Hukum-negatif", "severity": "Tinggi", "enabled": 1},
		{"term": "judi online", "category": "Judi online", "severity": "Tinggi", "enabled": 1},
	]

	# Match confidence tinggi (90): severity tetap Tinggi
	res_high_conf = classify_text("Kasus Korupsi Dana", "Terlibat dalam dugaan korupsi", lexicon, match_confidence=90)
	assert res_high_conf["category"] == "Berisiko"
	assert res_high_conf["severity"] == "Tinggi"

	# Match confidence rendah (< 80): severity diturunkan satu tingkat ke Sedang
	res_low_conf = classify_text("Kasus Korupsi Dana", "Terlibat dalam dugaan korupsi", lexicon, match_confidence=75)
	assert res_low_conf["category"] == "Berisiko"
	assert res_low_conf["severity"] == "Sedang"


# =====================================================================
# 3. Court Case Analysis Tests
# =====================================================================

def test_case_role_detection():
	text = "Menyatakan Terdakwa Ronald Richard terbukti bersalah..."
	role = detect_party_role(text, "Ronald Richard")
	assert role == "Terdakwa"

	text_pemohon = "Mengabulkan permohonan pemohon Ronald Richard untuk seluruhnya..."
	role_pemohon = detect_party_role(text_pemohon, "Ronald Richard")
	assert role_pemohon == "Pemohon"


def test_case_severity_mapping_perdata_permohonan_is_info():
	"""Permohonan perdata (seperti di layar 08 desain) wajib ber-severity 'Info', bukan risiko."""
	res_permohonan = evaluate_case_severity(case_type="Perdata", party_role="Pemohon")
	assert res_permohonan["severity"] == "Info"
	assert res_permohonan["category"] == "Netral"

	res_penggugat = evaluate_case_severity(case_type="Perdata", party_role="Penggugat")
	assert res_penggugat["severity"] == "Info"

	res_saksi = evaluate_case_severity(case_type="Pidana", party_role="Saksi")
	assert res_saksi["severity"] == "Info"


def test_case_severity_mapping_criminal_defendant_is_high():
	res_terdakwa = evaluate_case_severity(case_type="Pidana", party_role="Terdakwa")
	assert res_terdakwa["severity"] == "Tinggi"
	assert res_terdakwa["category"] == "Berisiko"

	res_tergugat = evaluate_case_severity(case_type="Perdata", party_role="Tergugat")
	assert res_tergugat["severity"] == "Sedang"
	assert res_tergugat["category"] == "Berisiko"


# =====================================================================
# 4. Social Media Post Analysis Tests
# =====================================================================

def test_analyze_posts_politeness_and_activity():
	lexicon = [
		{"term": "anjing", "category": "Kata kasar", "severity": "Rendah", "enabled": 1},
		{"term": "slot gacor", "category": "Judi online", "severity": "Tinggi", "enabled": 1},
	]

	posts = [
		{"text": "Refactoring code in TypeScript today.", "created_at": "2024-03-01T10:00:00Z"},
		{"text": "Dasar anjing bikin emosi aja.", "created_at": "2024-03-02T11:00:00Z"},
		{"text": "Ayo main slot gacor malam ini!", "created_at": "2024-03-03T12:00:00Z"},
		{"text": "Loving the new React hooks.", "created_at": "2024-03-04T13:00:00Z"},
	]

	res = analyze_posts(
		posts=posts,
		required_skills=["React", "TypeScript"],
		lexicon_items=lexicon,
	)

	assert res["total_posts"] == 4
	assert res["abusive_posts_count"] == 1
	assert res["politeness_score"] < 100
	assert len(res["risk_posts"]) == 1
	assert res["risk_posts"][0]["severity"] == "Tinggi"
	assert res["professional_relevance_pct"] == 50.0  # 2 dari 4 menyebut skill


# =====================================================================
# 5. Risk Level Auto Calculation Tests
# =====================================================================

def test_calculate_risk_level_unreviewed_high_is_needs_verification():
	findings = [
		{"severity": "Tinggi", "match_confidence": 85, "hr_verdict": "Belum ditinjau"},
	]
	risk = calculate_risk_level(findings, politeness_score=100)
	assert risk == "Perlu verifikasi"


def test_calculate_risk_level_relevant_high_is_high():
	findings = [
		{"severity": "Tinggi", "match_confidence": 85, "hr_verdict": "Relevan"},
	]
	risk = calculate_risk_level(findings, politeness_score=100)
	assert risk == "Tinggi"


def test_calculate_risk_level_medium_threshold():
	# Kurang dari 3 temuan Sedang -> Rendah
	findings_2 = [
		{"severity": "Sedang", "match_confidence": 80, "hr_verdict": "Relevan"},
		{"severity": "Sedang", "match_confidence": 80, "hr_verdict": "Relevan"},
	]
	assert calculate_risk_level(findings_2, politeness_score=90) == "Rendah"

	# >= 3 temuan Sedang yang Relevan -> Sedang
	findings_3 = findings_2 + [{"severity": "Sedang", "match_confidence": 80, "hr_verdict": "Relevan"}]
	assert calculate_risk_level(findings_3, politeness_score=90) == "Sedang"

	# Skor kesantunan < 60 -> Sedang
	assert calculate_risk_level([], politeness_score=50) == "Sedang"


# =====================================================================
# 6. Automated Summary Tests
# =====================================================================

def test_generate_automated_summary_omits_zero_clauses():
	summary = generate_automated_summary(
		candidate_name="Ronald Richard",
		job_title="UI/UX Designer",
		accounts=["GitHub", "LinkedIn"],
		article_count=2,
		achievement_count=1,
		case_count=0,  # Nilai nol harus dihilangkan dari teks
		posts_count=5,
		politeness_score=100,
		risk_posts_count=0,
	)

	assert "Ronald Richard melamar sebagai UI/UX Designer." in summary
	assert "Ditemukan 2 akun publik (GitHub, LinkedIn)." in summary
	assert "Ada 2 artikel yang kemungkinan besar terkait, 1 di antaranya tentang prestasi." in summary
	assert "catatan perkara" not in summary  # Klausa 0 perkara dihilangkan
	assert "kesantunan bahasa 100/100 tanpa post yang terindikasi berisiko." in summary


# =====================================================================
# 7. Mock Provider Tests
# =====================================================================

def test_mock_provider_runs_offline():
	provider = MockProvider()
	candidate = {
		"full_name": "Ronald Richard",
		"context_terms": "Jakarta, UI/UX",
		"name_variants": "Ronald Richard\nRonald",
	}
	findings = provider.run(candidate)
	assert len(findings) > 0

	types = {f.finding_type for f in findings}
	assert "Article" in types
	assert "File" in types
	assert "Case" in types
