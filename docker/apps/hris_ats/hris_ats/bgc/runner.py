# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Runner eksekusi background job pemeriksaan Background Check per sumber yang disetujui.
Menghormati consent_scope kandidat, memperbarui source_runs dan publish_realtime,
serta menjalankan analisis risiko dan ringkasan otomatis pada akhir proses.
Mendukung pemilihan provider live vs mock melalui Background Check Settings (mock_provider).
"""

from __future__ import annotations

import json
from datetime import timedelta
from typing import Any

import frappe
from frappe import _
from frappe.utils import add_days, now_datetime, nowdate

from hris_ats.bgc.analysis.posts import analyze_posts
from hris_ats.bgc.analysis.risk import calculate_risk_level
from hris_ats.bgc.analysis.summary import generate_automated_summary
from hris_ats.bgc.fetch import (
	FetchConfig,
	RedisUnavailableError,
	get_fetch_config_from_settings,
	is_forbidden_domain,
	is_redis_available,
)
from hris_ats.bgc.providers.base import FindingData
from hris_ats.bgc.providers.court_ma import CourtMAProvider
from hris_ats.bgc.providers.mock import MockProvider
from hris_ats.bgc.providers.platform_check import PlatformCheckProvider
from hris_ats.bgc.providers.posts import PostsProvider
from hris_ats.bgc.providers.web_search import WebSearchProvider


def is_social_account(platform_name: str, profile_url: str = "") -> bool:
	"""Memeriksa apakah platform memerlukan persetujuan sosial (Instagram, Facebook, TikTok, LinkedIn, dsb. atau domain terblokir bawaan)."""
	if not platform_name and not profile_url:
		return False
	if platform_name and frappe.db.exists("Background Check Platform", platform_name):
		req = frappe.db.get_value("Background Check Platform", platform_name, "requires_social_consent")
		if req:
			return True
		tmpl = frappe.db.get_value("Background Check Platform", platform_name, "profile_url_template")
		if tmpl and not profile_url:
			profile_url = tmpl
	if platform_name and platform_name.lower() in ("instagram", "facebook", "tiktok", "linkedin", "twitter/x", "x"):
		return True
	if profile_url:
		from hris_ats.bgc.fetch import DEFAULT_BLOCKED_DOMAINS, is_forbidden_domain
		if is_forbidden_domain(profile_url, blocked_domains=DEFAULT_BLOCKED_DOMAINS):
			return True
	return False



def run_all_sources(bgc_name: str) -> None:
	"""Memproses seluruh sumber yang disetujui untuk dokumen Background Check."""
	if not frappe.db.exists("Background Check", bgc_name):
		return

	bgc = frappe.get_doc("Background Check", bgc_name)

	# Validasi keras: Dilarang memeriksa tanpa izin yang sah (UU PDP)
	if bgc.consent_status != "Granted":
		frappe.log_error(
			title="BGC Aborted: No Consent",
			message=f"Screening aborted for {bgc.name} because consent_status is '{bgc.consent_status}' (must be 'Granted').",
		)
		return

	bgc.status = "Crawling"
	bgc.save(ignore_permissions=True)

	settings = frappe.get_single("Background Check Settings")
	retention_days = settings.retention_days or 90
	min_confidence = settings.min_match_confidence or 50
	is_mock = bool(settings.mock_provider)
	fetch_config = get_fetch_config_from_settings()

	# Ambil daftar leksikon aktif
	lexicon_records = frappe.get_all(
		"Background Check Lexicon",
		filters={"enabled": 1},
		fields=["category", "term", "is_regex", "severity", "weight", "enabled"],
	)

	# Ambil kriteria lowongan jika ada
	required_skills = []
	preferred_skills = []
	job_title = ""
	if bgc.job_applicant:
		applicant = frappe.get_doc("Job Applicant", bgc.job_applicant)
		if applicant.job_title:
			jo = frappe.get_doc("Job Opening", applicant.job_title)
			job_title = jo.job_title or ""
			if jo.required_skills:
				required_skills = [s.strip() for s in jo.required_skills.split("\n") if s.strip()]
			if jo.preferred_skills:
				preferred_skills = [s.strip() for s in jo.preferred_skills.split("\n") if s.strip()]

	candidate_data = {
		"full_name": bgc.full_name,
		"name_variants": bgc.name_variants or "",
		"context_terms": bgc.context_terms or "",
		"lexicon_items": lexicon_records,
	}

	politeness_score = 100
	total_posts_analyzed = 0
	risk_posts_count = 0

	# Map izin per sumber dari consent_scope
	granted_sources = {
		row.source: bool(row.granted)
		for row in bgc.consent_scope
	}

	for run_row in bgc.source_runs:
		source_name = run_row.source

		# Periksa apakah sumber ini disetujui
		if not granted_sources.get(source_name, False):
			run_row.status = "Skipped"
			run_row.error = _("Source not granted by candidate.")
			run_row.error_template = "Source not granted by candidate."
			run_row.error_params = "{}"
			continue

		# Mode live: jika Redis tidak tersedia, gagal tertutup (fail-closed)
		if not is_mock and not getattr(getattr(frappe, "flags", None), "in_test", False):
			if not is_redis_available():
				run_row.status = "Failed"
				run_row.error = _("Redis not available")
				run_row.error_template = "Redis not available"
				run_row.error_params = "{}"
				run_row.finished_on = now_datetime()
				continue

		# Update status Crawling
		run_row.status = "Crawling"
		run_row.started_on = now_datetime()
		bgc.save(ignore_permissions=True)

		frappe.publish_realtime(
			"bgc_source_progress",
			{"bgc": bgc.name, "source": source_name, "status": "Crawling"},
			doctype="Background Check",
			docname=bgc.name,
		)

		try:
			if source_name == "Platform":
				# Cek akun publik yang dinyatakan
				p_provider = PlatformCheckProvider(config=fetch_config)
				modes_used: set[str] = set()
				robots_ignored_count = 0

				candidate_city = ""
				if bgc.job_applicant and frappe.db.exists("Job Applicant", bgc.job_applicant):
					meta = frappe.get_meta("Job Applicant")
					city_field = "city" if meta.has_field("city") else ("location" if meta.has_field("location") else None)
					if city_field:
						candidate_city = frappe.db.get_value("Job Applicant", bgc.job_applicant, city_field) or ""
				if not candidate_city and bgc.context_terms:
					for term in [t.strip() for t in bgc.context_terms.split(",") if t.strip()]:
						if any(c in term.lower() for c in ("jakarta", "bandung", "surabaya", "medan", "pekanbaru", "semarang", "yogyakarta", "makassar", "denpasar", "palembang", "malang", "depok", "tangerang", "bekasi", "bogor")):
							candidate_city = term
							break

				candidate_cv_terms = [t.strip() for t in (bgc.context_terms or "").split(",") if t.strip()]
				name_variants = [v.strip() for v in (bgc.name_variants or "").split("\n") if v.strip()]

				platform_accounts = [
					acc for acc in bgc.accounts
					if not is_social_account(acc.platform, getattr(acc, "profile_url", None))
				]

				for acc in platform_accounts:
					plat_doc = frappe.get_doc("Background Check Platform", acc.platform) if frappe.db.exists("Background Check Platform", acc.platform) else None
					url_tmpl = plat_doc.profile_url_template if plat_doc else ""
					chk_method = plat_doc.check_method if plat_doc else "Status code"
					chk_val = plat_doc.check_value if plat_doc else "200"
					dn_sel = getattr(plat_doc, "display_name_selector", None) if plat_doc else None
					bio_sel = getattr(plat_doc, "bio_selector", None) if plat_doc else None
					loc_sel = getattr(plat_doc, "location_selector", None) if plat_doc else None

					res = p_provider.check_single_account(
						platform_name=acc.platform,
						username=acc.username,
						url_template=url_tmpl,
						check_method=chk_method,
						check_value=chk_val,
						is_mock=is_mock,
						candidate_name=bgc.full_name,
						candidate_variants=name_variants,
						candidate_city=candidate_city,
						candidate_cv_terms=candidate_cv_terms,
						display_name_selector=dn_sel,
						bio_selector=bio_sel,
						location_selector=loc_sel,
						declared_by=acc.declared_by or "Candidate",
					)
					acc.profile_url = res["profile_url"]
					acc.exists = res["exists"]
					acc.post_access = res["post_access"]
					acc.display_name = res.get("display_name", "")
					acc.bio_snippet = res.get("bio_snippet", "")
					acc.profile_location = res.get("profile_location", "")
					acc.identity_match = res.get("identity_match")
					reasons_val = res.get("identity_reasons", [])
					if isinstance(reasons_val, list):
						acc.identity_reasons = "; ".join(str(r) for r in reasons_val)
						acc.identity_reasons_template = "; ".join(getattr(r, "template", str(r)) for r in reasons_val)
						id_params = {}
						for r in reasons_val:
							if hasattr(r, "params"):
								id_params.update(r.params)
						acc.identity_reasons_params = json.dumps(id_params) if id_params else "{}"
					else:
						acc.identity_reasons = str(reasons_val or "")
						acc.identity_reasons_template = str(reasons_val or "")
						acc.identity_reasons_params = "{}"

					if res.get("mode_used"):
						modes_used.add(res["mode_used"])
					if res.get("robots_ignored"):
						robots_ignored_count += 1

				run_row.items_found = len([a for a in platform_accounts if a.exists])
				run_row.fetch_mode_used = ", ".join(sorted(modes_used)) if modes_used else ("mock" if is_mock else "company")
				run_row.robots_ignored_count = robots_ignored_count
				if p_provider.warnings:
					warn_msg = "; ".join(p_provider.warnings)
					run_row.error = warn_msg
					run_row.error_template = warn_msg
					run_row.error_params = "{}"
				run_row.status = "Done"

			elif source_name == "Article":
				if is_mock:
					candidate_data["source"] = "Article"
					provider = WebSearchProvider()
					findings = provider.run(candidate_data)
					_save_findings(bgc.name, findings)
					run_row.items_found = len(findings)
					run_row.fetch_mode_used = "mock"
					run_row.robots_ignored_count = 0
					run_row.status = "Done"
				else:
					# Bila mock_provider=0 dan belum dikonfigurasi, tandai Skipped
					run_row.status = "Skipped"
					run_row.error = _("Search provider not configured.")
					run_row.error_template = "Search provider not configured."
					run_row.error_params = "{}"
					run_row.items_found = 0
					run_row.fetch_mode_used = ""
					run_row.robots_ignored_count = 0

			elif source_name == "File":
				if is_mock:
					candidate_data["source"] = "File"
					provider = WebSearchProvider()
					findings = provider.run(candidate_data)
					_save_findings(bgc.name, findings)
					run_row.items_found = len(findings)
					run_row.fetch_mode_used = "mock"
					run_row.robots_ignored_count = 0
					run_row.status = "Done"
				else:
					run_row.status = "Skipped"
					run_row.error = _("Search provider not configured.")
					run_row.error_template = "Search provider not configured."
					run_row.error_params = "{}"
					run_row.items_found = 0
					run_row.fetch_mode_used = ""
					run_row.robots_ignored_count = 0

			elif source_name == "Case history":
				candidate_data["source"] = "Case history"
				candidate_data["bgc_name"] = bgc.name
				settings_dict = {"max_results_per_source": settings.max_results_per_source or 50}
				provider = CourtMAProvider(config=fetch_config, is_mock=is_mock)
				findings = provider.run(candidate_data, settings=settings_dict)
				_save_findings(bgc.name, findings)
				run_row.items_found = len(findings)
				run_row.fetch_mode_used = "mock" if is_mock else (provider.last_mode_used or "company+robots")
				run_row.robots_ignored_count = 0 if is_mock else provider.last_robots_ignored_count
				if provider.warnings:
					warn_msg = "; ".join(provider.warnings)
					run_row.error = warn_msg
					run_row.error_template = warn_msg
					run_row.error_params = "{}"
				run_row.status = "Done"

			elif source_name == "Posts":
				if is_mock:
					p_provider = PostsProvider()
					all_fetched_posts = []
					api_accounts = [
						acc for acc in bgc.accounts
						if not is_social_account(acc.platform, getattr(acc, "profile_url", None)) and acc.post_access == "API"
					]
					for acc in api_accounts:
						acc_posts = p_provider.fetch_posts(acc.platform, acc.username)
						all_fetched_posts.extend(acc_posts)

					if all_fetched_posts:
						p_analysis = analyze_posts(
							posts=all_fetched_posts,
							required_skills=required_skills,
							preferred_skills=preferred_skills,
							lexicon_items=lexicon_records,
						)
						politeness_score = p_analysis["politeness_score"]
						total_posts_analyzed = p_analysis["total_posts"]
						risk_posts = p_analysis["risk_posts"]
						risk_posts_count = len(risk_posts)

						# Simpan post berisiko sebagai Finding
						post_findings = []
						for rp in risk_posts:
							r_flags = rp.get("risk_flags") or ""
							post_findings.append(FindingData(
								finding_type="Post",
								title="Public Post Flagged as Risky",
								snippet=rp["text"],
								url=rp.get("url") or "",
								severity=rp.get("severity") or "Medium",
								category="Risky",
								risk_flags=r_flags,
								risk_flags_template=r_flags,
								risk_flags_params="{}",
								match_confidence=100,
							))
						_save_findings(bgc.name, post_findings)

					run_row.items_found = total_posts_analyzed
					run_row.fetch_mode_used = "mock"
					run_row.robots_ignored_count = 0
					run_row.status = "Done"
				else:
					run_row.status = "Skipped"
					run_row.error = _("Social media API credentials not configured.")
					run_row.error_template = "Social media API credentials not configured."
					run_row.error_params = "{}"
					run_row.items_found = 0
					run_row.fetch_mode_used = ""
					run_row.robots_ignored_count = 0

			elif source_name == "Social Media":
				social_accounts = [
					acc for acc in bgc.accounts
					if is_social_account(acc.platform, getattr(acc, "profile_url", None))
				]
				valid_social_accounts = []
				skipped_accounts = 0
				modes_used: set[str] = set()
				robots_ignored_count = 0

				candidate_city = ""
				if bgc.job_applicant and frappe.db.exists("Job Applicant", bgc.job_applicant):
					meta = frappe.get_meta("Job Applicant")
					city_field = "city" if meta.has_field("city") else ("location" if meta.has_field("location") else None)
					if city_field:
						candidate_city = frappe.db.get_value("Job Applicant", bgc.job_applicant, city_field) or ""
				if not candidate_city and bgc.context_terms:
					for term in [t.strip() for t in bgc.context_terms.split(",") if t.strip()]:
						if any(c in term.lower() for c in ("jakarta", "bandung", "surabaya", "medan", "pekanbaru", "semarang", "yogyakarta", "makassar", "denpasar", "palembang", "malang", "depok", "tangerang", "bekasi", "bogor")):
							candidate_city = term
							break

				candidate_cv_terms = [t.strip() for t in (bgc.context_terms or "").split(",") if t.strip()]
				name_variants = [v.strip() for v in (bgc.name_variants or "").split("\n") if v.strip()]
				p_provider = PlatformCheckProvider(config=fetch_config)

				all_social_posts = []

				for acc in social_accounts:
					plat_doc = frappe.get_doc("Background Check Platform", acc.platform) if frappe.db.exists("Background Check Platform", acc.platform) else None
					url_tmpl = plat_doc.profile_url_template if plat_doc else ""
					chk_method = plat_doc.check_method if plat_doc else "Status code"
					chk_val = plat_doc.check_value if plat_doc else "200"
					dn_sel = getattr(plat_doc, "display_name_selector", None) if plat_doc else None
					bio_sel = getattr(plat_doc, "bio_selector", None) if plat_doc else None
					loc_sel = getattr(plat_doc, "location_selector", None) if plat_doc else None

					prof_url = url_tmpl.replace("{username}", acc.username.strip().lstrip("@")) if url_tmpl else ""
					if prof_url and not acc.profile_url:
						acc.profile_url = prof_url

					# Conditions: scope granted + social_consent == 1 + domain not blocked
					blocked = is_forbidden_domain(prof_url, blocked_domains=getattr(fetch_config, "blocked_domains", None)) if prof_url else False
					if not acc.social_consent or blocked:
						skipped_accounts += 1
						if not acc.social_consent:
							acc.exists = 0
							acc.identity_match = None
							acc.display_name = ""
						elif prof_url and blocked and acc.social_consent:
							acc.exists = 1 if (acc.declared_by == "Candidate" and bool(acc.username)) else 0
							acc.identity_match = None
							acc.display_name = ""
							acc.identity_reasons = _("Prohibited platform for automated scraping: manual verification")
							acc.identity_reasons_template = "Prohibited platform for automated scraping: manual verification"
							acc.identity_reasons_params = "{}"
						continue

					valid_social_accounts.append(acc)

					res = p_provider.check_single_account(
						platform_name=acc.platform,
						username=acc.username,
						url_template=url_tmpl,
						check_method=chk_method,
						check_value=chk_val,
						is_mock=is_mock,
						candidate_name=bgc.full_name,
						candidate_variants=name_variants,
						candidate_city=candidate_city,
						candidate_cv_terms=candidate_cv_terms,
						display_name_selector=dn_sel,
						bio_selector=bio_sel,
						location_selector=loc_sel,
						declared_by=acc.declared_by or "Candidate",
					)
					acc.profile_url = res["profile_url"]
					acc.exists = res["exists"]
					acc.post_access = res["post_access"]
					acc.display_name = res.get("display_name", "")
					acc.bio_snippet = res.get("bio_snippet", "")
					acc.profile_location = res.get("profile_location", "")
					acc.identity_match = res.get("identity_match")
					reasons_val = res.get("identity_reasons", [])
					if isinstance(reasons_val, list):
						acc.identity_reasons = "; ".join(str(r) for r in reasons_val)
						acc.identity_reasons_template = "; ".join(getattr(r, "template", str(r)) for r in reasons_val)
						id_params = {}
						for r in reasons_val:
							if hasattr(r, "params"):
								id_params.update(r.params)
						acc.identity_reasons_params = json.dumps(id_params) if id_params else "{}"
					else:
						acc.identity_reasons = str(reasons_val or "")
						acc.identity_reasons_template = str(reasons_val or "")
						acc.identity_reasons_params = "{}"

					if res.get("mode_used"):
						modes_used.add(res["mode_used"])
					if res.get("robots_ignored"):
						robots_ignored_count += 1

					if is_mock:
						posts_prov = PostsProvider()
						acc_posts = posts_prov.fetch_posts(acc.platform, acc.username)
						all_social_posts.extend(acc_posts)

				if all_social_posts:
					p_analysis = analyze_posts(
						posts=all_social_posts,
						required_skills=required_skills,
						preferred_skills=preferred_skills,
						lexicon_items=lexicon_records,
					)
					politeness_score = p_analysis["politeness_score"]
					total_posts_analyzed += p_analysis["total_posts"]
					risk_posts = p_analysis["risk_posts"]
					risk_posts_count += len(risk_posts)

					post_findings = []
					for rp in risk_posts:
						r_flags = rp.get("risk_flags") or ""
						post_findings.append(FindingData(
							finding_type="Post",
							title="Public Post Flagged as Risky",
							snippet=rp["text"],
							url=rp.get("url") or "",
							severity=rp.get("severity") or "Medium",
							category="Risky",
							risk_flags=r_flags,
							risk_flags_template=r_flags,
							risk_flags_params="{}",
							match_confidence=100,
						))
					_save_findings(bgc.name, post_findings)

				run_row.items_found = len([a for a in social_accounts if a.exists]) + len(all_social_posts)
				run_row.accounts_skipped = skipped_accounts
				run_row.fetch_mode_used = ", ".join(sorted(modes_used)) if modes_used else ("mock" if is_mock else "company")
				run_row.robots_ignored_count = robots_ignored_count
				if skipped_accounts > 0:
					msg = _("{0} social media accounts skipped due to missing consent or blocked domain.").format(skipped_accounts)
					run_row.error = msg
					run_row.error_template = "{count} social media accounts skipped due to missing consent or blocked domain."
					run_row.error_params = json.dumps({"count": skipped_accounts})
				run_row.status = "Done"

			run_row.finished_on = now_datetime()

		except RedisUnavailableError:
			run_row.status = "Failed"
			run_row.error = _("Redis not available")
			run_row.error_template = "Redis not available"
			run_row.error_params = "{}"
			run_row.finished_on = now_datetime()
			frappe.log_error(title=f"BGC Source Error: {source_name}", message=frappe.get_traceback())

		except Exception as e:
			err_str = str(e)
			run_row.status = "Failed"
			run_row.error = err_str
			run_row.error_template = err_str
			run_row.error_params = "{}"
			run_row.finished_on = now_datetime()
			frappe.log_error(title=f"BGC Source Error: {source_name}", message=frappe.get_traceback())

		frappe.publish_realtime(
			"bgc_source_progress",
			{"bgc": bgc.name, "source": source_name, "status": run_row.status},
			doctype="Background Check",
			docname=bgc.name,
		)

	# Hitung tingkat risiko otomatis dan ringkasan
	all_findings_raw = frappe.get_all(
		"Background Check Finding",
		filters={"background_check": bgc.name},
		fields=["severity", "match_confidence", "hr_verdict", "category", "finding_type"],
	)

	calculated_risk = calculate_risk_level(
		findings=all_findings_raw,
		politeness_score=politeness_score,
		min_confidence=min_confidence,
	)

	# Hitung jumlah item untuk ringkasan
	article_count = frappe.db.count("Background Check Finding", {"background_check": bgc.name, "finding_type": "Article"})
	achievement_count = frappe.db.count(
		"Background Check Finding",
		{"background_check": bgc.name, "finding_type": "Article", "category": ["in", ["Achievement", "Prestasi"]]},
	)
	case_count = frappe.db.count("Background Check Finding", {"background_check": bgc.name, "finding_type": "Case"})

	account_platforms = [a.platform for a in bgc.accounts if a.platform]

	summary_text = generate_automated_summary(
		candidate_name=bgc.full_name,
		job_title=job_title,
		accounts=account_platforms,
		article_count=article_count,
		achievement_count=achievement_count,
		case_count=case_count,
		posts_count=total_posts_analyzed,
		politeness_score=politeness_score,
		risk_posts_count=risk_posts_count,
	)

	bgc.risk_level_auto = calculated_risk
	bgc.politeness_score = politeness_score
	bgc.summary_auto = str(summary_text)
	bgc.summary_auto_template = getattr(summary_text, "template", str(summary_text))
	bgc.summary_auto_params = json.dumps(getattr(summary_text, "params", {}))
	bgc.status = "Done"
	bgc.purge_after = add_days(nowdate(), retention_days)

	bgc.save(ignore_permissions=True)

	# Beri notifikasi realtime form telah selesai
	frappe.publish_realtime(
		"bgc_completed",
		{"bgc": bgc.name, "status": "Done", "risk_level_auto": bgc.risk_level_auto},
		doctype="Background Check",
		docname=bgc.name,
	)


def _save_findings(bgc_name: str, findings: list[FindingData]) -> None:
	"""Menyimpan list FindingData ke DocType Background Check Finding tanpa duplikasi."""
	for item in findings:
		filters = {
			"background_check": bgc_name,
			"finding_type": item.finding_type,
			"title": item.title,
		}
		if item.url:
			filters["url"] = item.url

		existing = frappe.db.get_value("Background Check Finding", filters, "name")
		if existing:
			doc = frappe.get_doc("Background Check Finding", existing)
		else:
			doc = frappe.new_doc("Background Check Finding")
			doc.background_check = bgc_name

		for key, val in item.as_dict().items():
			if hasattr(doc, key):
				# Pertahankan verdict dan catatan HR jika sudah pernah diisi
				if key in ("hr_verdict", "hr_note") and getattr(doc, key, None) and getattr(doc, key) not in ("Belum ditinjau", "Not reviewed"):
					continue
				setattr(doc, key, val)
		doc.save(ignore_permissions=True)
