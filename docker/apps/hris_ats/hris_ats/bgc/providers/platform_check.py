# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Pengecekan akun profil publik pada platform media sosial/profesional.
Hanya memeriksa username dan URL profil publik yang dinyatakan kandidat/HR.
DILARANG memeriksa keterdaftaran akun melalui email atau nomor telepon (UU PDP & ToS).
Menggunakan bgc/fetch.py, selektor adaptif untuk nama tampilan, bio, dan lokasi,
serta menolak scraping untuk domain Instagram, Facebook, TikTok, dan LinkedIn.
"""

from __future__ import annotations

from typing import Any

from hris_ats.bgc.adaptive import create_adaptive_adaptor, ensure_adaptive_page, query_adaptive_element
from hris_ats.bgc.analysis.identity import calculate_account_identity_match
from hris_ats.bgc.fetch import FetchConfig, FetchResult, is_forbidden_domain
from hris_ats.bgc.providers.base import BaseProvider


class PlatformCheckProvider(BaseProvider):
	name: str = "PlatformCheckProvider"

	def __init__(
		self,
		config: FetchConfig | None = None,
		rate_limit_per_minute: int = 30,
	):
		super().__init__(config=config, rate_limit_per_minute=rate_limit_per_minute)
		self.warnings: list[str] = []

	def check_single_account(
		self,
		platform_name: str,
		username: str,
		url_template: str,
		check_method: str = "Status code",
		check_value: str = "200",
		is_mock: bool = False,
		candidate_name: str = "",
		candidate_variants: list[str] | None = None,
		candidate_city: str | None = None,
		candidate_cv_terms: list[str] | None = None,
		display_name_selector: str | None = None,
		bio_selector: str | None = None,
		location_selector: str | None = None,
		declared_by: str = "Candidate",
	) -> dict[str, Any]:
		"""Memeriksa keberadaan dan mengekstrak kecocokan identitas profil publik akun."""
		clean_user = username.strip().lstrip("@")
		profile_url = url_template.replace("{username}", clean_user) if url_template else ""

		post_access = "Manual review only"
		if platform_name in ("GitHub", "YouTube", "Reddit", "Mastodon"):
			post_access = "API"

		# Domain terlarang tidak pernah diambil halamannya
		blocked_domains = getattr(self.config, "blocked_domains", None) if self.config else None
		if is_forbidden_domain(profile_url, blocked_domains=blocked_domains):
			return {
				"exists": 1 if (declared_by == "Candidate" and bool(clean_user)) else 0,
				"profile_url": profile_url,
				"post_access": "Manual review only",
				"mode_used": "",
				"robots_ignored": False,
				"body": "",
				"page": None,
				"display_name": "",
				"bio_snippet": "",
				"profile_location": "",
				"identity_match": None,
				"identity_reasons": (
					["Prohibited platform for automated scraping: manual verification"]
					if declared_by == "Candidate"
					else ["Account not declared by candidate on prohibited platform"]
				),
			}

		if is_mock or not profile_url:
			# Mock mode
			is_declared = (declared_by == "Candidate")
			mock_match = 100 if is_declared else 40
			exists = 1 if is_declared or mock_match >= 50 else 0
			return {
				"exists": exists,
				"profile_url": profile_url,
				"post_access": post_access,
				"mode_used": "mock",
				"robots_ignored": False,
				"body": "",
				"page": None,
				"display_name": candidate_name or clean_user,
				"bio_snippet": "Software Engineer & Designer",
				"profile_location": candidate_city or "Jakarta",
				"identity_match": mock_match,
				"identity_reasons": ["Simulation mode (mock)"] if is_mock else [],
			}

		has_selectors = bool(display_name_selector or bio_selector or location_selector)
		method = "GET" if (has_selectors or check_method != "Status code") else "HEAD"

		try:
			fetch_res = self.fetch(profile_url, method=method)
			status_code = fetch_res.status
			body = fetch_res.body or ""

			if check_method == "Status code":
				exists = 1 if str(status_code) == str(check_value or "200") else 0
			elif check_method == "Body contains":
				exists = 1 if (check_value and check_value in body) else 0
			elif check_method == "Body not contains":
				exists = 1 if (check_value and check_value not in body) else 0
			else:
				exists = 1 if status_code == 200 else 0

			display_name = ""
			bio_snippet = ""
			profile_location = ""
			identity_match: int | None = None
			identity_reasons: list[str] = []

			if exists == 1 and has_selectors:
				page = ensure_adaptive_page(fetch_res.page or body, url=profile_url)

				# 1. Ekstraksi Nama Tampilan dengan selektor adaptif
				if display_name_selector and page:
					dn_sel, _, w_dn = query_adaptive_element(
						page,
						display_name_selector,
						identifier=f"{platform_name}_display_name",
					)
					if dn_sel:
						display_name = (dn_sel.first.get_all_text() if hasattr(dn_sel, "first") else "").strip()
					if w_dn:
						self.warnings.append(w_dn)

				# 2. Ekstraksi Bio (maks. 300 karakter)
				if bio_selector and page:
					bio_sel, _, w_bio = query_adaptive_element(
						page,
						bio_selector,
						identifier=f"{platform_name}_bio",
					)
					if bio_sel:
						raw_bio = (bio_sel.first.get_all_text() if hasattr(bio_sel, "first") else "").strip()
						bio_snippet = raw_bio[:300]
					if w_bio:
						self.warnings.append(w_bio)

				# 3. Ekstraksi Lokasi Profil
				if location_selector and page:
					loc_sel, _, w_loc = query_adaptive_element(
						page,
						location_selector,
						identifier=f"{platform_name}_location",
					)
					if loc_sel:
						profile_location = (loc_sel.first.get_all_text() if hasattr(loc_sel, "first") else "").strip()
					if w_loc:
						self.warnings.append(w_loc)

				# Hitung identity_match dengan rumus 6.2.1
				identity_match, identity_reasons = calculate_account_identity_match(
					candidate_name=candidate_name,
					candidate_variants=candidate_variants,
					candidate_city=candidate_city,
					candidate_cv_terms=candidate_cv_terms,
					display_name=display_name,
					bio=bio_snippet,
					location=profile_location,
					declared_by_candidate=(declared_by == "Candidate"),
					is_forbidden=False,
				)

			elif exists == 1 and not has_selectors:
				# Platform tanpa selektor dilewati untuk langkah ekstraksi
				identity_match = 10 if declared_by == "Candidate" else 0
				identity_reasons = ["Akun dinyatakan sendiri oleh kandidat (+10)"] if declared_by == "Candidate" else ["Platform tanpa selektor profil publik"]

			elif exists == 0:
				identity_match = 0
				identity_reasons = ["Akun profil publik tidak ditemukan (non-200)"]

			# Aturan keras 6.2.1: Akun yang tidak dinyatakan kandidat dengan identity_match < 50 tidak ditampilkan sebagai milik kandidat
			if declared_by != "Candidate" and (identity_match is not None and identity_match < 50):
				exists = 0

			return {
				"exists": exists,
				"profile_url": profile_url,
				"post_access": post_access,
				"mode_used": fetch_res.mode_used,
				"robots_ignored": fetch_res.robots_ignored,
				"body": body,
				"page": fetch_res.page,
				"display_name": display_name,
				"bio_snippet": bio_snippet,
				"profile_location": profile_location,
				"identity_match": identity_match,
				"identity_reasons": identity_reasons,
			}

		except Exception as e:
			return {
				"exists": 0,
				"profile_url": profile_url,
				"post_access": post_access,
				"mode_used": "",
				"robots_ignored": False,
				"body": "",
				"page": None,
				"display_name": "",
				"bio_snippet": "",
				"profile_location": "",
				"identity_match": 0,
				"identity_reasons": [f"Gagal memeriksa profil: {str(e)}"],
			}
