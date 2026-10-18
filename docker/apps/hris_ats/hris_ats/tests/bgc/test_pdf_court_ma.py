# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Unit test untuk parser PDF Putusan MA, ekstraksi identitas pihak, dan siklus hidup pagination."""

from __future__ import annotations

import io
import os
import shutil
from unittest.mock import patch

import pytest
from pypdf import PdfWriter
from scrapling.parser import Adaptor

from hris_ats.bgc.fetch import FetchResult
from hris_ats.bgc.providers.court_ma import (
	CourtMAProvider,
	extract_party_identity_from_pdf,
	get_crawldir,
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


def _generate_blank_pdf_bytes() -> bytes:
	writer = PdfWriter()
	writer.add_blank_page(width=612, height=792)
	buf = io.BytesIO()
	writer.write(buf)
	return buf.getvalue()


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
	# Teks kosong
	res_empty = extract_party_identity_from_pdf("", "Ronald Richard", [])
	assert res_empty["is_scan"] is True

	# Teks terlalu pendek (misal hanya nomor halaman)
	res_short = extract_party_identity_from_pdf("Hal 1 dari 10", "Ronald Richard", [])
	assert res_short["is_scan"] is True


def test_fetch_and_parse_pdf_valid_content():
	provider = CourtMAProvider(is_mock=False)

	fake_fetch_res = FetchResult(
		url="https://putusan3.mahkamahagung.go.id/download_pdf/123/pdf",
		status=200,
		body="",
		content=SAMPLE_VALID_PDF_BYTES,
		mode_used="company+robots",
		from_cache=False,
	)

	with patch.object(provider, "fetch", return_value=fake_fetch_res):
		pdf_data = provider._fetch_and_parse_pdf(
			pdf_url="https://putusan3.mahkamahagung.go.id/download_pdf/123/pdf",
			candidate_name="Ronald Richard",
			candidate_variants=["ronald richard"],
		)

		assert pdf_data["is_scan"] is False
		assert pdf_data["role"] == "Pemohon"
		assert pdf_data["occupation"] == "Karyawan Swasta"
		assert pdf_data["city"] == "Jakarta Selatan"
		assert "[NIK DIREDAKSI]" in pdf_data["excerpt"]
		assert pdf_data["pdf_url"] == "https://putusan3.mahkamahagung.go.id/download_pdf/123/pdf"


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


def test_court_ma_pagination_and_crawldir_lifecycle():
	fixtures_dir = os.path.join(
		os.path.dirname(os.path.dirname(__file__)),
		"fixtures",
		"court_ma",
	)
	with open(os.path.join(fixtures_dir, "search_page_1.html"), "r", encoding="utf-8") as f:
		search_p1_html = f.read()
	with open(os.path.join(fixtures_dir, "search_page_2.html"), "r", encoding="utf-8") as f:
		search_p2_html = f.read()
	with open(os.path.join(fixtures_dir, "detail_case_1.html"), "r", encoding="utf-8") as f:
		detail_html = f.read()

	provider = CourtMAProvider(is_mock=False)

	def fake_fetch(url, *args, **kwargs):
		if "page/2" in url:
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
				content=SAMPLE_VALID_PDF_BYTES,
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

		# 1. Pastikan penelusuran multi-halaman berjalan
		assert len(findings) >= 2
		# 2. Pastikan crawldir telah dibersihkan di blok finally:
		assert not os.path.exists(crawl_dir)

		# 3. Temuan Ronald Richard dari PDF putusan
		ronald_case = next((f for f in findings if "72/Pdt.P/2017" in f.case_number), None)
		assert ronald_case is not None
		assert ronald_case.party_role == "Pemohon"
		assert ronald_case.text_source == "PDF putusan"
		assert "[NIK DIREDAKSI]" in ronald_case.evidence_excerpt
		assert "zaed1001.html" in ronald_case.detail_url
		assert "download_pdf" in ronald_case.pdf_url
