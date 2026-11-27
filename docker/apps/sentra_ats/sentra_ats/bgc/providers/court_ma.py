# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Provider pemeriksaan Direktori Putusan Mahkamah Agung.
Mendukung penelusuran halaman (pagination crawler), selektor adaptif (Smart Element Tracking),
find_similar, ekstraksi PDF putusan via pdfplumber, serta deteksi akurat identitas para pihak.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import tempfile
import urllib.parse
from typing import Any

from rapidfuzz import fuzz

from sentra_ats.bgc.adaptive import create_adaptive_adaptor, ensure_adaptive_page, query_adaptive_element
from sentra_ats.bgc.analysis.case import detect_party_role, evaluate_case_severity
from sentra_ats.bgc.analysis.identity import (
	calculate_match_confidence,
	evaluate_match_with_excerpt,
	normalize_name,
)
from sentra_ats.bgc.fetch import FetchConfig, FetchResult
from sentra_ats.bgc.providers.base import BaseProvider, FindingData
from sentra_ats.bgc.providers.mock import MockProvider

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

NIK_REGEX = re.compile(r"\b\d{16}\b")


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


def get_crawldir(bgc_name: str | None = None) -> str:
	"""Mendapatkan path crawldir di sites/<site>/private/sentra_ats/crawl/<nama Background Check>/."""
	try:
		import frappe
		if hasattr(frappe, "get_site_path") and getattr(frappe, "local", None) and getattr(frappe.local, "site", None):
			base = os.path.abspath(frappe.get_site_path("private", "sentra_ats", "crawl"))
			folder = os.path.join(base, bgc_name or "default")
			os.makedirs(folder, exist_ok=True)
			return folder
	except Exception:
		pass

	base_bench = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
	base = os.path.join(base_bench, "sites", "hris.localhost", "private", "sentra_ats", "crawl")
	folder = os.path.join(base, bgc_name or "default")
	os.makedirs(folder, exist_ok=True)
	return folder


def extract_party_identity_from_pdf(
	pdf_text: str,
	candidate_name: str,
	candidate_variants: list[str] | None = None,
) -> dict[str, Any]:
	"""Mengekstrak identitas pihak yang cocok dari teks PDF putusan.

	Hanya mengambil pihak yang namanya cocok: peran, pekerjaan, kota/kabupaten.
	Tidak menyimpan NIK (diredaksi), alamat lengkap, nama pihak lain, atau isi putusan.
	"""
	if not pdf_text or not candidate_name:
		return {"is_scan": True, "role": "", "occupation": "", "city": "", "excerpt": ""}

	if len(pdf_text.strip()) < 50:
		return {"is_scan": True, "role": "", "occupation": "", "city": "", "excerpt": ""}

	clean_text = pdf_text.lower()
	clean_cand = normalize_name(candidate_name)
	variants = [normalize_name(v) for v in (candidate_variants or [clean_cand]) if v]
	if clean_cand not in variants:
		variants.insert(0, clean_cand)

	best_idx = -1
	matched_v = ""
	for v in variants:
		idx = clean_text.find(v)
		if idx != -1:
			best_idx = idx
			matched_v = v
			break

	if best_idx == -1:
		# Cari dengan fuzz pada potongan teks awal
		words = clean_cand.split()
		target_len = len(words)
		pdf_words = clean_text.split()
		best_fuzz = 0.0
		best_word_idx = -1
		for i in range(min(500, max(1, len(pdf_words) - target_len + 1))):
			w = " ".join(pdf_words[i : i + target_len + 1])
			for v in variants:
				ratio = fuzz.token_sort_ratio(v, w)
				if ratio > best_fuzz:
					best_fuzz = ratio
					best_word_idx = i
					matched_v = v
		if best_fuzz >= 80 and best_word_idx != -1:
			best_idx = clean_text.find(" ".join(pdf_words[best_word_idx : best_word_idx + 2]))

	if best_idx == -1:
		return {"is_scan": False, "role": "", "occupation": "", "city": "", "excerpt": ""}

	matched_len = len(matched_v) if matched_v else len(candidate_name)

	# 1. Cari batas awal blok pihak kandidat (sebelum kemunculan nama)
	pre_text = pdf_text[:best_idx]
	header_matches = list(re.finditer(
		r'(?:penggugat|terdakwa|tergugat|pemohon|termohon|saksi|turut tergugat)\s*(?:i+|[0-9]+)?\s*[:\-]?',
		pre_text,
		re.IGNORECASE,
	))
	if header_matches:
		block_start = header_matches[-1].start()
	else:
		block_start = max(0, best_idx - 100)

	# 2. Cari batas akhir blok pihak kandidat (sebelum pihak lawan / saksi / isi putusan)
	post_text = pdf_text[best_idx + matched_len:]
	boundary_matches = list(re.finditer(
		r'\b(?:melawan|lawan|tergugat|penggugat|turut tergugat|pemohon|termohon|saksi|pengadilan\s+negeri|telah\s+membaca|menimbang|memperhatikan|mengingat|mengadili|memutuskan)\b',
		post_text,
		re.IGNORECASE,
	))
	if boundary_matches:
		block_end = best_idx + matched_len + boundary_matches[0].start()
	else:
		semi_idx = post_text.find(";")
		if semi_idx != -1 and semi_idx < 300:
			block_end = best_idx + matched_len + semi_idx + 1
		else:
			block_end = min(len(pdf_text), best_idx + matched_len + 300)

	party_block = pdf_text[block_start:block_end].strip()

	# Peran dari PDF (hanya dihitung dalam blok pihak kandidat agar tidak tertukar dengan pihak lain)
	role = detect_party_role(party_block, matched_v or candidate_name)
	if role == "Tidak diketahui":
		role = ""

	# Pekerjaan pihak yang cocok
	occupation = ""
	occ_match = re.search(
		r"pekerjaan\s*[:\s]+([A-Za-z0-9\s/]+?)(?:,|\.|\n|;|\bdalam\b|\bbertempat\b|\bberalamat\b)",
		party_block,
		re.IGNORECASE,
	)
	if occ_match:
		occupation = occ_match.group(1).strip()
		if len(occupation) > 50:
			occupation = occupation[:50].strip()

	# Kota / Kabupaten alamat pihak yang cocok
	city = ""
	city_match = re.search(
		r"\b(Jakarta\s+[A-Za-z]+|Kota\s+[A-Za-z]+|Kabupaten\s+[A-Za-z]+|Pekanbaru|Surabaya|Bandung|Medan|Semarang|Yogyakarta|Makassar|Denpasar|Palembang|Malang|Depok|Tangerang|Bekasi|Bogor)\b",
		party_block,
		re.IGNORECASE,
	)
	if city_match:
		city = city_match.group(1).strip()

	# Excerpt bukti <= 600 karakter HANYA dari blok pihak yang cocok
	raw_excerpt = party_block[:600].strip()
	evidence_excerpt = NIK_REGEX.sub("[NIK DIREDAKSI]", raw_excerpt)

	return {
		"is_scan": False,
		"role": role,
		"occupation": occupation,
		"city": city,
		"excerpt": evidence_excerpt,
	}


def parse_court_ma_search_page(
	html_or_page: Any,
	warnings: list[str] | None = None,
) -> list[dict[str, Any]]:
	"""Mengurai halaman daftar hasil pencarian Direktori Putusan MA menggunakan selektor adaptif dan find_similar."""
	page = ensure_adaptive_page(html_or_page)
	if page is None:
		return []

	# Cek apakah ada indikasi hasil pencarian seharusnya ditemukan
	header_text = "".join(page.css(".search-result-header *::text, .search-stats::text").getall())
	has_results_claimed = False
	if "putusan yang ditemukan" in header_text.lower():
		match_stats = re.search(r"dari\s+(\d+)\s+putusan", header_text.lower())
		if match_stats and int(match_stats.group(1)) > 0:
			has_results_claimed = True

	# 1. Cari elemen hasil pertama menggunakan selektor adaptif
	matched_elems, _, warning = query_adaptive_element(
		page,
		".spost.clearfix, .entry-result, div[data-id]",
		identifier="court_ma_search_item",
		min_acceptable_similarity=65.0,
	)
	if warning and warnings is not None:
		warnings.append(warning)

	items: list[Any] = []
	seen_nodes = set()
	if matched_elems:
		first_item = matched_elems[0]
		items.append(first_item)
		if hasattr(first_item, "_root") and first_item._root is not None:
			seen_nodes.add(id(first_item._root))

		# 2. Pakai find_similar dari baris hasil pertama untuk mengambil semua baris hasil
		if hasattr(first_item, "find_similar"):
			try:
				similar_rows = first_item.find_similar()
				for s in similar_rows:
					node_id = id(getattr(s, "_root", s))
					if node_id not in seen_nodes:
						seen_nodes.add(node_id)
						items.append(s)
			except Exception:
				pass

		for it in matched_elems[1:]:
			node_id = id(getattr(it, "_root", it))
			if node_id not in seen_nodes:
				seen_nodes.add(node_id)
				items.append(it)

	if not items and has_results_claimed:
		raise ValueError("Gagal mengurai struktur halaman Direktori Putusan MA: selektor tidak menemukan elemen hasil putusan.")

	results: list[dict[str, Any]] = []
	for it in items:
		title_sel = it.css(".entry-title a, h3 a, .case-link")
		title = (title_sel.first.get_all_text() if title_sel else "").strip()
		link = it.css(".entry-title a::attr(href), h3 a::attr(href), .case-link::attr(href)").get()
		snip_sel = it.css(".entry-content, .spost-excerpt")
		snippet = (snip_sel.first.get_all_text() if snip_sel else "").strip()

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
			th_sel = tr.css("th")
			td_sel = tr.css("td")
			th = (th_sel.first.get_all_text() if th_sel else "").strip().rstrip(":")
			td = (td_sel.first.get_all_text() if td_sel else "").strip().lstrip(": ")
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

	valid_results = [r for r in results if r.get("detail_url") or r.get("case_number") or r.get("snippet")]
	if not valid_results and has_results_claimed:
		raise ValueError("Gagal mengurai struktur halaman Direktori Putusan MA: selektor tidak menemukan elemen hasil putusan.")

	return valid_results


def parse_court_ma_detail_page(
	html_or_page: Any,
	warnings: list[str] | None = None,
) -> dict[str, Any]:
	"""Mengurai halaman detail putusan MA dan mengekstrak metadata serta tautan PDF."""
	page = ensure_adaptive_page(html_or_page)
	if page is None:
		return {}

	data: dict[str, Any] = {}

	# Judul perkara dengan pelacakan adaptif
	title_elems, _, w_title = query_adaptive_element(
		page,
		"h1.case-title::text, .page-header h1::text, h1::text",
		identifier="court_ma_detail_title",
	)
	if title_elems:
		data["title"] = title_elems.get().strip()
	if w_title and warnings is not None:
		warnings.append(w_title)

	# Link download PDF dengan pelacakan adaptif
	pdf_elems, _, w_pdf = query_adaptive_element(
		page,
		"a.btn-download-pdf::attr(href), a[href*='download_pdf']::attr(href)",
		identifier="court_ma_detail_pdf",
	)
	if pdf_elems:
		data["pdf_url"] = pdf_elems.get()
	if w_pdf and warnings is not None:
		warnings.append(w_pdf)

	# Isi lengkap putusan
	content_elems, _, w_content = query_adaptive_element(
		page,
		".full-content p, .case-text p, .entry-content p, .full-content, .case-text",
		identifier="court_ma_detail_full_text",
	)
	if content_elems:
		data["full_text"] = " ".join(
			e.get_all_text().strip() if hasattr(e, "get_all_text") else (e.get().strip() if hasattr(e, "get") else str(e).strip())
			for e in content_elems
		).strip()
	if w_content and warnings is not None:
		warnings.append(w_content)

	# Tabel detail perkara
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


# Catatan Arsitektur:
# Penelusuran halaman direktori putusan Mahkamah Agung dilakukan secara prosedural lewat
# CourtMAProvider dan fetch.py (bukan Scrapling Spider), untuk memastikan penegakan batas
# laju domain terdistribusi di Redis, kepatuhan robots.txt, stealth browsing, dan secret cache
# HMAC tetap seragam di seluruh pipeline BGC. Kelas Spider kosong (CourtMASpider) telah dihapus.


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
		self.warnings: list[str] = []

	def _fetch_and_parse_pdf(
		self,
		pdf_url: str,
		candidate_name: str,
		candidate_variants: list[str],
	) -> dict[str, Any]:
		"""Mengunduh berkas PDF putusan (batas ukuran 20 MB, timeout) dan membaca identitas pihak dengan pdfplumber."""
		if not pdf_url:
			return {"is_scan": False, "role": "", "occupation": "", "city": "", "excerpt": "", "pdf_url": ""}

		with tempfile.TemporaryDirectory() as tmp_dir:
			pdf_file_path = os.path.join(tmp_dir, "putusan.pdf")
			try:
				fetch_res = self.fetch(pdf_url, max_size_bytes=20 * 1024 * 1024)
				if fetch_res.robots_ignored:
					self.last_robots_ignored_count += 1

				content = fetch_res.content or (fetch_res.body.encode("utf-8") if isinstance(fetch_res.body, str) else b"")
				if not content:
					return {"is_scan": False, "role": "", "occupation": "", "city": "", "excerpt": "", "pdf_url": pdf_url}

				with open(pdf_file_path, "wb") as f:
					f.write(content)

				import pdfplumber
				extracted_pages_text: list[str] = []
				with pdfplumber.open(pdf_file_path) as pdf:
					# Baca maksimal 5 halaman pertama (bagian identitas para pihak selalu di awal)
					for page in pdf.pages[:5]:
						t = page.extract_text() or ""
						if t:
							extracted_pages_text.append(t)

				full_pdf_text = "\n".join(extracted_pages_text).strip()
				if not full_pdf_text or len(full_pdf_text) < 50:
					# PDF hasil scan tanpa teks layer -> turun ke halaman detail
					return {"is_scan": True, "role": "", "occupation": "", "city": "", "excerpt": "", "pdf_url": pdf_url}

				result = extract_party_identity_from_pdf(full_pdf_text, candidate_name, candidate_variants)
				result["pdf_url"] = pdf_url
				result["is_scan"] = False
				return result
			except Exception:
				return {"is_scan": False, "role": "", "occupation": "", "city": "", "excerpt": "", "pdf_url": pdf_url}

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
		candidate_city = candidate_data.get("city") or candidate_data.get("candidate_city")
		if candidate_city and candidate_city not in context_terms:
			context_terms = [*list(context_terms), candidate_city]

		max_results = 50
		if settings and isinstance(settings, dict):
			max_results = settings.get("max_results_per_source") or 50

		bgc_name = candidate_data.get("bgc_name") or "default"
		crawl_dir = get_crawldir(bgc_name)

		search_url = f"https://putusan3.mahkamahagung.go.id/direktori/pencarian/q/{urllib.parse.quote(name)}.html"
		all_extracted_cases: list[dict[str, Any]] = []

		try:
			# Penelusuran halaman (Pagination) sampai max_results_per_source
			current_url: str | None = search_url
			visited_urls: set[str] = set()

			while current_url and len(all_extracted_cases) < max_results:
				if current_url in visited_urls:
					break
				visited_urls.add(current_url)

				fetch_res = self.fetch(current_url)
				self.last_mode_used = fetch_res.mode_used
				if fetch_res.robots_ignored:
					self.last_robots_ignored_count += 1

				page_obj = fetch_res.page or fetch_res.body
				cases = parse_court_ma_search_page(page_obj, warnings=self.warnings)
				if not cases:
					break

				for c in cases:
					if len(all_extracted_cases) < max_results:
						all_extracted_cases.append(c)

				if len(all_extracted_cases) >= max_results:
					break

				# Cari link pagination berikutnya (rel='next' atau .pagination-next)
				adaptor_obj = page_obj if hasattr(page_obj, "css") else (Adaptor(page_obj) if Adaptor else None)
				next_url = None
				if adaptor_obj:
					next_link = adaptor_obj.css(".pagination li a[rel='next']::attr(href), .pagination-next::attr(href)").get()
					if next_link:
						next_url = urllib.parse.urljoin(current_url, next_link)

				current_url = next_url

		finally:
			# crawldir dihapus saat sumber selesai
			if os.path.exists(crawl_dir):
				shutil.rmtree(crawl_dir, ignore_errors=True)

		if not all_extracted_cases:
			return []

		findings: list[FindingData] = []
		clean_name = normalize_name(name)
		variants_for_eval = [normalize_name(v) for v in (name_variants or [clean_name]) if v]
		if clean_name not in variants_for_eval:
			variants_for_eval.insert(0, clean_name)

		for c in all_extracted_cases:
			detail_url = c.get("detail_url")
			detail_data: dict[str, Any] = {}
			if detail_url:
				try:
					detail_res = self.fetch(detail_url)
					if detail_res.robots_ignored:
						self.last_robots_ignored_count += 1
					detail_data = parse_court_ma_detail_page(detail_res.page or detail_res.body, warnings=self.warnings)
				except Exception:
					pass

			c.update(detail_data)

			# Hitung kemiripan nama awal untuk menentukan apakah perlu mengunduh PDF putusan
			combined_search_snippet = f"{c.get('parties', '')} {c.get('title', '')} {c.get('snippet', '')}"
			clean_snippet = normalize_name(combined_search_snippet)
			initial_name_sim = 0.0
			for v in variants_for_eval:
				if v in clean_snippet:
					initial_name_sim = 100.0
					break
				r = fuzz.token_sort_ratio(v, clean_snippet)
				if r > initial_name_sim:
					initial_name_sim = r

			text_source = "Snippet"
			evidence_excerpt = (c.get("amar") or c.get("snippet", ""))[:600]
			pdf_url = c.get("pdf_url", "")

			# Unduh PDF putusan bila kemiripan_nama >= 80
			if initial_name_sim >= 80.0 and pdf_url:
				pdf_data = self._fetch_and_parse_pdf(pdf_url, name, name_variants)
				if pdf_data.get("is_scan"):
					# PDF hasil scan tanpa teks -> turun ke halaman detail
					text_source = "Full text"
				elif pdf_data.get("role") or pdf_data.get("excerpt"):
					text_source = "Decision PDF"
					# Peran dari PDF mengalahkan peran dari cuplikan
					if pdf_data.get("role"):
						c["party_role"] = pdf_data["role"]
					if pdf_data.get("excerpt"):
						evidence_excerpt = pdf_data["excerpt"]
				else:
					text_source = "Full text" if c.get("full_text") else "Snippet"
			elif c.get("full_text"):
				text_source = "Full text"

			# Evaluasi kecocokan identitas dengan prioritas sumber teks
			full_text = c.get("full_text") or f"{c['title']} {c['snippet']} {c.get('amar', '')}"
			text_to_eval = f"{evidence_excerpt} {full_text}" if text_source in ("Decision PDF", "PDF putusan") else full_text

			conf, reasons, exc = evaluate_match_with_excerpt(
				candidate_name=name,
				candidate_variants=name_variants,
				context_terms=context_terms,
				text=text_to_eval,
				total_hits=len(all_extracted_cases),
				text_source=text_source,
			)

			if not evidence_excerpt or text_source not in ("Decision PDF", "PDF putusan"):
				evidence_excerpt = exc or evidence_excerpt

			case_type = c.get("case_type", "Perdata")
			party_role = c.get("party_role", "Pemohon")
			case_eval = evaluate_case_severity(case_type, party_role)

			reasons_tmpl = "; ".join([getattr(r, "template", str(r)) for r in reasons])
			reasons_params = {}
			for r in reasons:
				if hasattr(r, "params"):
					reasons_params.update(r.params)

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
				match_reasons_template=reasons_tmpl,
				match_reasons_params=json.dumps(reasons_params) if reasons_params else "{}",
				category=case_eval["category"],
				severity=case_eval["severity"],
				detail_url=detail_url or "",
				pdf_url=pdf_url,
				text_source=text_source,
				evidence_excerpt=evidence_excerpt[:600],
			))

		return findings
