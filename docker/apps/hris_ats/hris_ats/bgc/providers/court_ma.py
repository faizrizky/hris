# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Provider pemeriksaan Direktori Putusan Mahkamah Agung.
Mendukung mode live (via Scrapling bgc/fetch.py) dan fallback ke MockProvider jika mode mock aktif.
"""

from __future__ import annotations

import re
import urllib.parse
from typing import Any

from hris_ats.bgc.analysis.case import evaluate_case_severity
from hris_ats.bgc.analysis.identity import calculate_match_confidence
from hris_ats.bgc.fetch import FetchConfig, FetchResult
from hris_ats.bgc.providers.base import BaseProvider, FindingData
from hris_ats.bgc.providers.mock import MockProvider

try:
	from scrapling.parser import Adaptor
except ImportError:
	Adaptor = None


ID_MONTHS = {
	"januari": "01",
	"februari": "02",
	"maret": "03",
	"april": "04",
	"mei": "05",
	"juni": "06",
	"juli": "07",
	"agustus": "08",
	"september": "09",
	"oktober": "10",
	"november": "11",
	"desember": "12",
}


def parse_indonesian_date(text: str | None) -> str | None:
	"""Mengubah tanggal format Indonesia (mis. 10 Maret 2017) menjadi YYYY-MM-DD."""
	if not text:
		return None
	text = text.strip()
	if len(text) == 10 and text[4] == "-" and text[7] == "-":
		return text
	match = re.search(r"(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})", text)
	if match:
		day, month_name, year = match.groups()
		month_code = ID_MONTHS.get(month_name.lower())
		if month_code:
			return f"{year}-{month_code}-{int(day):02d}"
	return text


def parse_court_ma_search_page(html_or_page: Any) -> list[dict[str, Any]]:
	"""Mengurai halaman daftar hasil pencarian Direktori Putusan MA."""
	page = html_or_page if hasattr(html_or_page, "css") else (Adaptor(html_or_page) if Adaptor else None)
	if page is None:
		return []

	# Cek apakah ada indikasi hasil pencarian seharusnya ditemukan
	header_text = "".join(page.css(".search-result-header *::text, .search-stats::text").getall())
	has_results_claimed = False
	if "putusan yang ditemukan" in header_text.lower():
		# Jika tertulis bukan "0 putusan"
		match_stats = re.search(r"dari\s+(\d+)\s+putusan", header_text.lower())
		if match_stats and int(match_stats.group(1)) > 0:
			has_results_claimed = True

	# Cari elemen kartu hasil
	items = page.css(".spost.clearfix, .entry-result, div[data-id]")
	if not items and has_results_claimed:
		raise ValueError("Gagal mengurai struktur halaman Direktori Putusan MA: selektor tidak menemukan elemen hasil putusan.")

	results: list[dict[str, Any]] = []
	for it in items:
		title = it.css(".entry-title a::text, h3 a::text, .case-link::text").get()
		link = it.css(".entry-title a::attr(href), h3 a::attr(href), .case-link::attr(href)").get()
		snippet = "".join(it.css(".entry-content *::text, .spost-excerpt *::text").getall()).strip()

		item_data: dict[str, Any] = {
			"title": (title or "Putusan Mahkamah Agung").strip(),
			"detail_url": link or "",
			"snippet": snippet,
			"case_number": "",
			"case_type": "Perdata",
			"court": "Mahkamah Agung",
			"party_role": "",
			"registered_on": None,
			"adjudicated_on": None,
			"uploaded_on": None,
		}

		for tr in it.css("tr"):
			th = "".join(tr.css("th *::text, th::text").getall()).strip().rstrip(":")
			td = "".join(tr.css("td *::text, td::text").getall()).strip().lstrip(": ")
			if not th or not td:
				continue
			th_l = th.lower()
			if "nomor" in th_l:
				item_data["case_number"] = td
			elif "klasifikasi" in th_l and "sub" not in th_l:
				item_data["case_type"] = td
			elif "lembaga peradilan" in th_l or "pengadilan" in th_l:
				item_data["court"] = td
			elif "register" in th_l:
				item_data["registered_on"] = parse_indonesian_date(td)
			elif "tanggal putus" in th_l or th_l == "putus":
				item_data["adjudicated_on"] = parse_indonesian_date(td)
			elif "upload" in th_l:
				item_data["uploaded_on"] = parse_indonesian_date(td)
			elif "pihak" in th_l:
				item_data["parties"] = td
				if ":" in td:
					item_data["party_role"] = td.split(":")[0].strip()

		results.append(item_data)

	return results


def parse_court_ma_detail_page(html_or_page: Any) -> dict[str, Any]:
	"""Mengurai halaman detail putusan MA dan mengekstrak metadata serta tautan PDF."""
	page = html_or_page if hasattr(html_or_page, "css") else (Adaptor(html_or_page) if Adaptor else None)
	if page is None:
		return {}

	data: dict[str, Any] = {}
	title = page.css("h1.case-title::text, .page-header h1::text, h1::text").get()
	if title:
		data["title"] = title.strip()

	pdf_link = page.css("a.btn-download-pdf::attr(href), a[href*='download_pdf']::attr(href)").get()
	if pdf_link:
		data["pdf_url"] = pdf_link

	full_text = " ".join(page.css(".full-content *::text, .case-text *::text, .entry-content *::text").getall()).strip()
	if full_text:
		data["full_text"] = full_text

	for tr in page.css(".detail-table tr, table.table tr"):
		cells = tr.css("td")
		if len(cells) >= 2:
			k = "".join(cells[0].css("*::text").getall()).strip().rstrip(":")
			v = "".join(cells[1].css("*::text").getall()).strip().lstrip(": ")
			k_l = k.lower()
			if "nomor perkara" in k_l or k_l == "nomor":
				data["case_number"] = v
			elif "klasifikasi" in k_l and "sub" not in k_l:
				data["case_type"] = v
			elif "lembaga peradilan" in k_l:
				data["court"] = v
			elif "register" in k_l:
				data["registered_on"] = parse_indonesian_date(v)
			elif "tanggal putus" in k_l or k_l == "putus":
				data["adjudicated_on"] = parse_indonesian_date(v)
			elif "upload" in k_l:
				data["uploaded_on"] = parse_indonesian_date(v)
			elif "para pihak" in k_l:
				data["parties"] = v
				if ":" in v:
					data["party_role"] = v.split(":")[0].strip()
			elif "amar" in k_l:
				data["amar"] = v

	return data


class CourtMAProvider(BaseProvider):
	name: str = "CourtMAProvider"

	def __init__(
		self,
		config: FetchConfig | None = None,
		is_mock: bool = True,
	):
		super().__init__(config=config, rate_limit_per_minute=5)
		self.is_mock = is_mock
		self.mock_provider = MockProvider()
		self.last_mode_used: str = ""
		self.last_robots_ignored_count: int = 0

	def run(
		self,
		candidate_data: dict[str, Any],
		settings: dict[str, Any] | None = None,
	) -> list[FindingData]:
		if self.is_mock:
			data = dict(candidate_data)
			data["source"] = "Case history"
			return self.mock_provider.run(data, settings)

		name = candidate_data.get("full_name", "")
		name_variants = candidate_data.get("name_variants", [])
		if isinstance(name_variants, str):
			name_variants = [v.strip() for v in name_variants.split("\n") if v.strip()]

		context_terms = candidate_data.get("context_terms", [])
		if isinstance(context_terms, str):
			context_terms = [t.strip() for t in context_terms.split(",") if t.strip()]

		max_results = 50
		if settings and isinstance(settings, dict):
			max_results = settings.get("max_results_per_source") or 50

		search_url = f"https://putusan3.mahkamahagung.go.id/direktori/pencarian/q/{urllib.parse.quote(name)}.html"
		fetch_res = self.fetch(search_url)
		self.last_mode_used = fetch_res.mode_used
		if fetch_res.robots_ignored:
			self.last_robots_ignored_count += 1

		extracted_cases = parse_court_ma_search_page(fetch_res.page or fetch_res.body)
		if not extracted_cases:
			return []

		extracted_cases = extracted_cases[:max_results]
		findings: list[FindingData] = []

		for c in extracted_cases:
			detail_url = c.get("detail_url")
			detail_data: dict[str, Any] = {}
			if detail_url:
				try:
					detail_res = self.fetch(detail_url)
					if detail_res.robots_ignored:
						self.last_robots_ignored_count += 1
					detail_data = parse_court_ma_detail_page(detail_res.page or detail_res.body)
				except Exception:
					pass

			# Gabungkan metadata
			c.update(detail_data)

			# Analisis kecocokan nama dan keparahan perkara
			full_text = c.get("full_text") or f"{c['title']} {c['snippet']} {c.get('amar', '')}"
			conf, reasons = calculate_match_confidence(
				name, name_variants, context_terms, full_text, total_hits=len(extracted_cases)
			)

			case_type = c.get("case_type", "Perdata")
			party_role = c.get("party_role", "Pemohon")
			case_eval = evaluate_case_severity(case_type, party_role)

			findings.append(FindingData(
				finding_type="Case",
				title=c.get("title") or "Putusan Pengadilan",
				snippet=c.get("snippet") or c.get("amar", ""),
				url=detail_url or search_url,
				source_name="Direktori Putusan MA",
				case_type=case_type,
				case_number=c.get("case_number", ""),
				court=c.get("court", ""),
				party_role=party_role,
				registered_on=c.get("registered_on"),
				uploaded_on=c.get("uploaded_on"),
				adjudicated_on=c.get("adjudicated_on"),
				match_confidence=conf,
				match_reasons="; ".join(reasons),
				category=case_eval["category"],
				severity=case_eval["severity"],
				detail_url=detail_url or "",
				pdf_url=c.get("pdf_url", ""),
				text_source="Teks lengkap" if c.get("full_text") else "Cuplikan",
				evidence_excerpt=(c.get("amar") or c.get("snippet", ""))[:600],
			))

		return findings
