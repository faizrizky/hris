# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Unit test untuk parser Direktori Putusan Mahkamah Agung terhadap fixture HTML."""

from __future__ import annotations

import os

import pytest

from sentra_ats.bgc.providers.court_ma import (
	CourtMAProvider,
	parse_court_ma_detail_page,
	parse_court_ma_search_page,
	parse_indonesian_date,
)

FIXTURES_DIR = os.path.join(
	os.path.dirname(os.path.dirname(__file__)),
	"fixtures",
	"court_ma",
)


def test_parse_indonesian_date():
	assert parse_indonesian_date("10 Maret 2017") == "2017-03-10"
	assert parse_indonesian_date("15 Januari 2020") == "2020-01-15"
	assert parse_indonesian_date("12 Mei 2020") == "2020-05-12"
	assert parse_indonesian_date("2021-06-15") == "2021-06-15"
	assert parse_indonesian_date(None) is None


def test_parse_court_ma_search_page_fixture():
	search_file = os.path.join(FIXTURES_DIR, "search_page_1.html")
	with open(search_file, encoding="utf-8") as f:
		html = f.read()

	items = parse_court_ma_search_page(html)
	assert len(items) == 2

	# Case 1
	c1 = items[0]
	assert "72/Pdt.P/2017/PN JKT.SEL" in c1["case_number"]
	assert c1["case_type"] == "Perdata"
	assert c1["court"] == "PN JAKARTA SELATAN"
	assert c1["registered_on"] == "2017-03-10"
	assert c1["adjudicated_on"] == "2017-04-20"
	assert c1["uploaded_on"] == "2017-04-01"
	assert "Pemohon" in c1["party_role"]
	assert "zaed1001.html" in c1["detail_url"]
	assert "Ronald Richard" in c1["snippet"]

	# Case 2
	c2 = items[1]
	assert "105/Pid.B/2020/PN JKT.PST" in c2["case_number"]
	assert c2["case_type"] == "Pidana Khusus"
	assert c2["court"] == "PN JAKARTA PUSAT"
	assert "Terdakwa" in c2["party_role"]


def test_parse_court_ma_detail_page_fixture():
	detail_file = os.path.join(FIXTURES_DIR, "detail_case_1.html")
	with open(detail_file, encoding="utf-8") as f:
		html = f.read()

	data = parse_court_ma_detail_page(html)
	assert "72/Pdt.P/2017/PN JKT.SEL" in data["case_number"]
	assert data["case_type"] == "Perdata"
	assert "Jakarta Selatan" in data["court"]
	assert data["registered_on"] == "2017-03-10"
	assert data["adjudicated_on"] == "2017-04-20"
	assert data["uploaded_on"] == "2017-04-01"
	assert "Pemohon" in data["party_role"]
	assert "download_pdf/zaed1001/pdf" in data["pdf_url"]
	assert "DUDUK PERKARA" in data["full_text"]


def test_parse_court_ma_search_unparseable_structure_raises():
	bad_html = """
	<div class="search-result-header">
		<h2>Hasil Pencarian</h2>
		<p class="search-stats">Menampilkan 1 - 10 dari 25 putusan yang ditemukan</p>
	</div>
	<div class="completely-changed-layout">
		<span>Layout berubah total tanpa kelas yang cocok</span>
	</div>
	"""
	with pytest.raises(ValueError) as exc:
		parse_court_ma_search_page(bad_html)

	assert "Gagal mengurai struktur halaman Direktori Putusan MA" in str(exc.value)
