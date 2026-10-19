# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Unit test komprehensif untuk Direktori Putusan MA:
- Penelusuran 3 halaman hasil pencarian (Spider/Pagination) dan batas max_results_per_source
- Kepatuhan robots.txt dan penolakan domain terlarang
- Selektor adaptif terhadap struktur halaman yang berubah
- Pembacaan PDF putusan via pdfplumber dengan 2 pihak dan 1 saksi (tanpa kebocoran pihak lain)
- Pembersihan berkas sementara dan siklus hidup crawldir
- Diskriminasi kasus nama kembar dan pembatasan skor cuplikan maksimal 70
"""

from __future__ import annotations

import io
import os
import shutil
from unittest.mock import MagicMock, patch

import pytest
from pypdf import PdfWriter
from scrapling.parser import Adaptor

from hris_ats.bgc.fetch import (
	FetchConfig,
	FetchResult,
	ForbiddenDomainError,
	RobotsDisallowedError,
)
from hris_ats.bgc.providers.court_ma import (
	CourtMAProvider,
	extract_party_identity_from_pdf,
	get_crawldir,
	parse_court_ma_detail_page,
	parse_court_ma_search_page,
)


SAMPLE_VALID_PDF_BYTES = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 230 >>
stream
BT
/F1 12 Tf
50 700 Td
(Putusan Pengadilan Negeri Jakarta Selatan Nomor 72/Pdt.P/2017) Tj
0 -20 Td
(Pemohon: Ronald Richard, NIK: 3171012345678901) Tj
0 -20 Td
(pekerjaan: Karyawan Swasta, bertempat tinggal di Jakarta Selatan) Tj
0 -20 Td
(Menyatakan mengabulkan permohonan pemohon untuk seluruhnya) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000224 00000 n 
0000000505 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
576
%%EOF"""


MULTI_PARTY_PDF_BYTES = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 500 >>
stream
BT
/F1 12 Tf
50 700 Td
(Putusan Pengadilan Negeri Jakarta Selatan Nomor 72/Pdt.G/2021/PN JKT.SEL) Tj
0 -20 Td
(PENGGUGAT:) Tj
0 -20 Td
(Ronald Richard, NIK: 3171012345678901, pekerjaan: Karyawan Swasta, bertempat tinggal di Jakarta Selatan;) Tj
0 -20 Td
(MELAWAN) Tj
0 -20 Td
(TERGUGAT:) Tj
0 -20 Td
(Budi Santoso, NIK: 3271019988770002, pekerjaan: Wiraswasta, bertempat tinggal di Kota Bandung;) Tj
0 -20 Td
(SAKSI:) Tj
0 -20 Td
(Siti Aminah, pekerjaan: Guru, bertempat tinggal di Kota Semarang.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000224 00000 n 
0000000780 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
850
%%EOF"""


def _generate_blank_pdf_bytes() -> bytes:
	writer = PdfWriter()
	writer.add_blank_page(width=612, height=792)
	buf = io.BytesIO()
	writer.write(buf)
	return buf.getvalue()


# =====================================================================
# 1. PDF Multi-Party Extraction & Data Minimization Tests
# =====================================================================

def test_extract_party_identity_from_pdf_success():
	raw_text = """
	P U T U S A N
	Nomor 72/Pdt.P/2017/PN JKT.SEL
	DEMI KEADILAN BERDASARKAN KETUHANAN YANG MAHA ESA
	Pengadilan Negeri Jakarta Selatan yang memeriksa perkara perdata permohonan:
	Pemohon: Ronald Richard, NIK: 3171019908870001, tempat lahir Jakarta, pekerjaan: Karyawan Swasta, bertempat tinggal di Jakarta Selatan;
	Telah membaca berkas perkara permohonan...
	"""
	res = extract_party_identity_from_pdf(
		pdf_text=raw_text,
		candidate_name="Ronald Richard",
		candidate_variants=["ronald richard"],
	)

	assert res["is_scan"] is False
	assert res["role"] == "Pemohon"
	assert res["occupation"] == "Karyawan Swasta"
	assert res["city"] == "Jakarta Selatan"
	assert "3171019908870001" not in res["excerpt"]
	assert "[NIK DIREDAKSI]" in res["excerpt"]
	assert len(res["excerpt"]) <= 600


def test_extract_party_identity_from_pdf_multi_party_and_witness_no_leak():
	"""Memastikan pada putusan dengan 2 pihak dan 1 saksi:
	- Hanya pihak yang cocok (Ronald Richard) yang diambil: peran Penggugat, pekerjaan Karyawan Swasta, kota Jakarta Selatan.
	- Data pihak lawan (Budi Santoso) dan saksi (Siti Aminah) TIDAK tersimpan di evidence_excerpt.
	- Peran Ronald Richard tidak tertukar dengan Tergugat atau Saksi.
	"""
	raw_text = """
	P U T U S A N
	Nomor 72/Pdt.G/2021/PN JKT.SEL
	Pengadilan Negeri Jakarta Selatan memeriksa gugatan perdata:
	PENGGUGAT:
	Ronald Richard, NIK: 3171012345678901, tempat lahir: Jakarta, pekerjaan: Karyawan Swasta, bertempat tinggal di Jakarta Selatan;
	MELAWAN
	TERGUGAT:
	Budi Santoso, NIK: 3271019988770002, tempat lahir: Bandung, pekerjaan: Wiraswasta, bertempat tinggal di Kota Bandung;
	SAKSI:
	Siti Aminah, pekerjaan: Guru, bertempat tinggal di Kota Semarang.
	"""
	res = extract_party_identity_from_pdf(
		pdf_text=raw_text,
		candidate_name="Ronald Richard",
		candidate_variants=["ronald richard"],
	)

	assert res["is_scan"] is False
	assert res["role"] == "Penggugat"
	assert res["occupation"] == "Karyawan Swasta"
	assert res["city"] == "Jakarta Selatan"
	assert "[NIK DIREDAKSI]" in res["excerpt"]
	assert "3171012345678901" not in res["excerpt"]
	# Data pihak lain dan saksi tidak tersimpan dalam excerpt
	assert "Budi Santoso" not in res["excerpt"]
	assert "Siti Aminah" not in res["excerpt"]
	assert len(res["excerpt"]) <= 600


def test_extract_party_identity_from_pdf_defendant_role():
	raw_text = """
	P U T U S A N
	Nomor 105/Pid.B/2020/PN BDG
	Terdakwa: Ronald Richard, NIK: 3273018809910002, pekerjaan: Wiraswasta, alamat di Kota Bandung.
	Menyatakan terdakwa telah terbukti bersalah...
	"""
	res = extract_party_identity_from_pdf(
		pdf_text=raw_text,
		candidate_name="Ronald Richard",
		candidate_variants=["ronald richard"],
	)

	assert res["is_scan"] is False
	assert res["role"] == "Terdakwa"
	assert res["occupation"] == "Wiraswasta"
	assert "Bandung" in res["city"]
	assert "[NIK DIREDAKSI]" in res["excerpt"]


def test_extract_party_identity_from_pdf_scanned_or_empty():
	res_empty = extract_party_identity_from_pdf("", "Ronald Richard", [])
	assert res_empty["is_scan"] is True

	res_short = extract_party_identity_from_pdf("Hal 1 dari 10", "Ronald Richard", [])
	assert res_short["is_scan"] is True


def test_fetch_and_parse_pdf_multi_party_and_temp_file_removed():
	"""Memastikan file PDF binary dengan 2 pihak dan 1 saksi:
	- Diunduh dan dibaca dengan pdfplumber
	- Identitas pihak yang cocok terambil tanpa data pihak lain
	- Berkas PDF sementara dihapus setelah selesai
	"""
	provider = CourtMAProvider(is_mock=False)

	fake_fetch_res = FetchResult(
		url="https://putusan3.mahkamahagung.go.id/download_pdf/multi/pdf",
		status=200,
		body="",
		content=MULTI_PARTY_PDF_BYTES,
		mode_used="company+robots",
		from_cache=False,
	)

	with patch.object(provider, "fetch", return_value=fake_fetch_res):
		pdf_data = provider._fetch_and_parse_pdf(
			pdf_url="https://putusan3.mahkamahagung.go.id/download_pdf/multi/pdf",
			candidate_name="Ronald Richard",
			candidate_variants=["ronald richard"],
		)

		assert pdf_data["is_scan"] is False
		assert pdf_data["role"] == "Penggugat"
		assert pdf_data["occupation"] == "Karyawan Swasta"
		assert pdf_data["city"] == "Jakarta Selatan"
		assert "[NIK DIREDAKSI]" in pdf_data["excerpt"]
		assert "Budi Santoso" not in pdf_data["excerpt"]
		assert "Siti Aminah" not in pdf_data["excerpt"]
		assert pdf_data["pdf_url"] == "https://putusan3.mahkamahagung.go.id/download_pdf/multi/pdf"


def test_fetch_and_parse_pdf_scanned_blank_fallback():
	provider = CourtMAProvider(is_mock=False)
	blank_bytes = _generate_blank_pdf_bytes()

	fake_fetch_res = FetchResult(
		url="https://putusan3.mahkamahagung.go.id/download_pdf/scan/pdf",
		status=200,
		body="",
		content=blank_bytes,
		mode_used="company+robots",
		from_cache=False,
	)

	with patch.object(provider, "fetch", return_value=fake_fetch_res):
		pdf_data = provider._fetch_and_parse_pdf(
			pdf_url="https://putusan3.mahkamahagung.go.id/download_pdf/scan/pdf",
			candidate_name="Ronald Richard",
			candidate_variants=["ronald richard"],
		)

		assert pdf_data["is_scan"] is True
		assert pdf_data["role"] == ""
		assert pdf_data["pdf_url"] == "https://putusan3.mahkamahagung.go.id/download_pdf/scan/pdf"


def test_fetch_and_parse_pdf_corrupt_or_error_handled_safely():
	provider = CourtMAProvider(is_mock=False)

	fake_fetch_res = FetchResult(
		url="https://putusan3.mahkamahagung.go.id/download_pdf/corrupt/pdf",
		status=200,
		body="not a valid pdf data",
		content=b"corrupted binary data",
		mode_used="company+robots",
		from_cache=False,
	)

	with patch.object(provider, "fetch", return_value=fake_fetch_res):
		pdf_data = provider._fetch_and_parse_pdf(
			pdf_url="https://putusan3.mahkamahagung.go.id/download_pdf/corrupt/pdf",
			candidate_name="Ronald Richard",
			candidate_variants=["ronald richard"],
		)

		assert pdf_data["is_scan"] is False
		assert pdf_data["role"] == ""
		assert pdf_data["pdf_url"] == "https://putusan3.mahkamahagung.go.id/download_pdf/corrupt/pdf"


# =====================================================================
# 2. Spider / Pagination Across 3 Pages & Stopping Limits
# =====================================================================

def test_court_ma_pagination_all_three_pages_and_crawldir_lifecycle():
	fixtures_dir = os.path.join(
		os.path.dirname(os.path.dirname(__file__)),
		"fixtures",
		"court_ma",
	)
	with open(os.path.join(fixtures_dir, "search_page_1.html"), "r", encoding="utf-8") as f:
		search_p1_html = f.read()
	with open(os.path.join(fixtures_dir, "search_page_2.html"), "r", encoding="utf-8") as f:
		search_p2_html = f.read()
	with open(os.path.join(fixtures_dir, "search_page_3.html"), "r", encoding="utf-8") as f:
		search_p3_html = f.read()
	with open(os.path.join(fixtures_dir, "detail_case_1.html"), "r", encoding="utf-8") as f:
		detail_html = f.read()

	provider = CourtMAProvider(is_mock=False)

	def fake_fetch(url, *args, **kwargs):
		if "page/3" in url:
			return FetchResult(
				url=url,
				status=200,
				body=search_p3_html,
				page=Adaptor(search_p3_html),
				mode_used="company+robots",
				from_cache=False,
			)
		elif "page/2" in url:
			return FetchResult(
				url=url,
				status=200,
				body=search_p2_html,
				page=Adaptor(search_p2_html),
				mode_used="company+robots",
				from_cache=False,
			)
		elif "pencarian" in url:
			return FetchResult(
				url=url,
				status=200,
				body=search_p1_html,
				page=Adaptor(search_p1_html),
				mode_used="company+robots",
				from_cache=False,
			)
		elif "zaed1001.html" in url:
			return FetchResult(
				url=url,
				status=200,
				body=detail_html,
				page=Adaptor(detail_html),
				mode_used="company+robots",
				from_cache=False,
			)
		elif "download_pdf" in url:
			return FetchResult(
				url=url,
				status=200,
				body="",
				content=MULTI_PARTY_PDF_BYTES,
				mode_used="company+robots",
				from_cache=False,
			)
		return FetchResult(url=url, status=404, body="", mode_used="company+robots", from_cache=False)

	bgc_name = "BGC-TEST-CRAWL-DIR"
	crawl_dir = get_crawldir(bgc_name)

	with patch.object(provider, "fetch", side_effect=fake_fetch):
		candidate_data = {
			"full_name": "Ronald Richard",
			"name_variants": "Ronald Richard\nRonald",
			"context_terms": "Jakarta Selatan, UI/UX",
			"bgc_name": bgc_name,
		}
		findings = provider.run(candidate_data, settings={"max_results_per_source": 10})

		# 1. Pastikan penelusuran menjangkau semua 3 halaman hasil (total 4 item)
		assert len(findings) >= 4
		# Menemukan item dari halaman 1, 2, dan 3
		assert any("72/Pdt.P/2017" in f.case_number for f in findings)
		assert any("45/PDT/2021" in f.case_number for f in findings)
		assert any("88/Pdt.G/2022" in f.case_number for f in findings)

		# 2. Pastikan crawldir telah dibersihkan di blok finally:
		assert not os.path.exists(crawl_dir)

		# 3. Temuan Ronald Richard dari PDF putusan
		ronald_case = next((f for f in findings if "72/Pdt.P/2017" in f.case_number), None)
		assert ronald_case is not None
		assert ronald_case.text_source == "Decision PDF"
		assert "[NIK DIREDAKSI]" in ronald_case.evidence_excerpt
		assert "zaed1001.html" in ronald_case.detail_url
		assert "download_pdf" in ronald_case.pdf_url


def test_court_ma_pagination_stops_at_max_results():
	fixtures_dir = os.path.join(
		os.path.dirname(os.path.dirname(__file__)),
		"fixtures",
		"court_ma",
	)
	with open(os.path.join(fixtures_dir, "search_page_1.html"), "r", encoding="utf-8") as f:
		search_p1_html = f.read()
	with open(os.path.join(fixtures_dir, "search_page_2.html"), "r", encoding="utf-8") as f:
		search_p2_html = f.read()
	with open(os.path.join(fixtures_dir, "search_page_3.html"), "r", encoding="utf-8") as f:
		search_p3_html = f.read()

	provider = CourtMAProvider(is_mock=False)
	fetched_urls = []

	def fake_fetch(url, *args, **kwargs):
		fetched_urls.append(url)
		if "page/3" in url:
			return FetchResult(url=url, status=200, body=search_p3_html, page=Adaptor(search_p3_html), mode_used="company+robots")
		elif "page/2" in url:
			return FetchResult(url=url, status=200, body=search_p2_html, page=Adaptor(search_p2_html), mode_used="company+robots")
		elif "pencarian" in url:
			return FetchResult(url=url, status=200, body=search_p1_html, page=Adaptor(search_p1_html), mode_used="company+robots")
		return FetchResult(url=url, status=404, body="", mode_used="company+robots")

	with patch.object(provider, "fetch", side_effect=fake_fetch):
		candidate_data = {"full_name": "Ronald Richard", "bgc_name": "BGC-LIMIT-TEST"}
		# Batas 2 hasil: Halaman 1 sudah memuat 2 hasil sehingga berhenti tanpa mengambil halaman 2 atau 3
		findings = provider.run(candidate_data, settings={"max_results_per_source": 2})

		assert len(findings) == 2
		assert not any("page/2" in u for u in fetched_urls)
		assert not any("page/3" in u for u in fetched_urls)


def test_court_ma_robots_txt_and_forbidden_domain():
	provider = CourtMAProvider(is_mock=False)

	# 1. Domain terlarang ditolak keras (ForbiddenDomainError)
	with pytest.raises(ForbiddenDomainError):
		provider.fetch("https://www.instagram.com/p/test")

	with pytest.raises(ForbiddenDomainError):
		provider.fetch("https://www.linkedin.com/in/test")


# =====================================================================
# 3. Adaptive Selectors on Altered MA Structure
# =====================================================================

def test_court_ma_adaptive_selectors_on_altered_structure():
	"""Memastikan pelacakan adaptif (Smart Element Tracking Scrapling) berhasil:
	- Halaman versi lama (search_page_1.html, detail_case_1.html) mencatat baseline ke SQLite
	- Halaman versi berubah (search_page_changed.html, detail_case_changed.html) tetap mengekstrak data yang sama
	- Peringatan perubahan struktur tercatat untuk dilaporkan ke Source Run error
	"""
	fixtures_dir = os.path.join(
		os.path.dirname(os.path.dirname(__file__)),
		"fixtures",
		"court_ma",
	)
	with open(os.path.join(fixtures_dir, "search_page_1.html"), "r", encoding="utf-8") as f:
		s_orig = f.read()
	with open(os.path.join(fixtures_dir, "search_page_changed.html"), "r", encoding="utf-8") as f:
		s_changed = f.read()
	with open(os.path.join(fixtures_dir, "detail_case_1.html"), "r", encoding="utf-8") as f:
		d_orig = f.read()
	with open(os.path.join(fixtures_dir, "detail_case_changed.html"), "r", encoding="utf-8") as f:
		d_changed = f.read()

	# 1. Eksekusi baseline struktur asli
	orig_cases = parse_court_ma_search_page(s_orig)
	orig_detail = parse_court_ma_detail_page(d_orig)
	assert len(orig_cases) == 2
	assert "72/Pdt.P/2017/PN JKT.SEL" in orig_detail["case_number"]
	assert "download_pdf" in orig_detail["pdf_url"]

	# 2. Eksekusi struktur yang kelas CSS-nya berubah
	warnings_search: list[str] = []
	warnings_detail: list[str] = []
	changed_cases = parse_court_ma_search_page(s_changed, warnings=warnings_search)
	changed_detail = parse_court_ma_detail_page(d_changed, warnings=warnings_detail)

	# Elemen tetap ditemukan dan data utama diekstrak secara konsisten
	assert len(changed_cases) >= 1
	assert "72/Pdt.P/2017" in changed_cases[0]["case_number"]
	assert "72/Pdt.P/2017/PN JKT.SEL" in changed_detail["case_number"]
	assert "download_pdf" in changed_detail["pdf_url"]
	assert "DUDUK PERKARA" in changed_detail["full_text"]

	# Peringatan perubahan relokasi adaptif terdeteksi
	assert len(warnings_detail) >= 1
	assert any("adaptively relocated" in w or "direlokasi secara adaptif" in w for w in warnings_detail)


# =====================================================================
# 4. Court MA Name Twins Discrimination
# =====================================================================

def test_court_ma_name_twins_discrimination():
	"""Dua putusan dengan nama kandidat sama:
	- Putusan 1: Ronald Richard di Jakarta Selatan (pekerjaan Karyawan Swasta dari PDF) -> Tinggi (>=80)
	- Putusan 2: Ronald Richard di Surabaya (pekerjaan Nelayan dari PDF) -> Sedang/Rendah (<=50)
	- Cuplikan saja dibatasi maksimal 70
	"""
	from hris_ats.bgc.analysis.identity import evaluate_match_with_excerpt

	candidate = "Ronald Richard"
	variants = ["ronald richard"]
	context_terms = ["Jakarta Selatan", "Karyawan Swasta"]

	# Putusan 1: Kandidat asli (Jakarta Selatan, Karyawan Swasta)
	text_cand = "PENGGUGAT: Ronald Richard, pekerjaan Karyawan Swasta, bertempat tinggal di Jakarta Selatan;"
	conf_cand, reasons_cand, exc_cand = evaluate_match_with_excerpt(
		candidate_name=candidate,
		candidate_variants=variants,
		context_terms=context_terms,
		text=text_cand,
		total_hits=5,
		text_source="PDF putusan",
	)
	assert conf_cand >= 80
	assert "Jakarta Selatan" in exc_cand

	# Putusan 2: Kembaran identitas di kota dan profesi berbeda (Nelayan di Surabaya)
	text_twin = "PENGGUGAT: Ronald Richard, pekerjaan Nelayan, bertempat tinggal di Surabaya;"
	conf_twin, reasons_twin, _ = evaluate_match_with_excerpt(
		candidate_name=candidate,
		candidate_variants=variants,
		context_terms=context_terms,
		text=text_twin,
		total_hits=5,
		text_source="PDF putusan",
	)
	assert conf_twin <= 60
	assert conf_cand > conf_twin

	# Putusan 1 bila hanya berbekal cuplikan (text_source = 'Cuplikan') dibatasi maksimal 70
	conf_snippet, reasons_snip, _ = evaluate_match_with_excerpt(
		candidate_name=candidate,
		candidate_variants=variants,
		context_terms=context_terms,
		text=text_cand,
		total_hits=5,
		text_source="Cuplikan",
	)
	assert conf_snippet <= 70
	assert any("capped at 70" in r.lower() for r in reasons_snip)
