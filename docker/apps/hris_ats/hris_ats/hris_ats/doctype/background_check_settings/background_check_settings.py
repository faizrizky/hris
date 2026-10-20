from __future__ import annotations

import re
import urllib.parse
from typing import Any

import frappe
from frappe import _
from frappe.model.document import Document

from hris_ats.bgc.fetch import DEFAULT_BLOCKED_DOMAINS, blocked_domains_row_exists


def get_scrapling_browser_status() -> str:
	"""Cek status instalasi browser Scrapling langsung dari package Scrapling / patchright."""
	try:
		from scrapling.cli import __PACKAGE_DIR__

		if __PACKAGE_DIR__.joinpath(".scrapling_dependencies_installed").exists():
			return "Installed"
	except Exception:
		pass

	try:
		import os

		from patchright.sync_api import sync_playwright

		with sync_playwright() as p:
			if os.path.exists(p.chromium.executable_path):
				return "Installed"
	except Exception:
		pass

	return "Not installed"


def validate_consent_text_version(doc: Any) -> None:
	if not doc.is_new() and (
		doc.has_value_changed("consent_text_id") or doc.has_value_changed("consent_text_en")
	):
		curr = doc.consent_text_version or "v1.0"
		match = re.match(r"^v?(\d+)(?:\.(\d+))?$", str(curr))
		if match:
			major = int(match.group(1))
			minor = int(match.group(2) or 0) + 1
			doc.consent_text_version = f"v{major}.{minor}"
		else:
			doc.consent_text_version = "v1.1"
	elif doc.is_new() and not getattr(doc, "consent_text_version", None):
		doc.consent_text_version = "v1.0"


def extract_page_signals(html: str) -> dict[str, Any]:
	"""Ekstrak sinyal halaman lengkap: title, full_text, og:title, og:description,
	meta_description, input password, JSON-LD profile, dan preview dari konten utama.
	"""
	import html as html_module

	if not html:
		return {
			"title": "",
			"full_text": "",
			"text_len": 0,
			"og_title": "",
			"og_description": "",
			"meta_description": "",
			"has_password_input": False,
			"has_profile_jsonld": False,
			"preview": "",
		}

	# 1. Title
	title = ""
	m_title = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
	if m_title:
		title = html_module.unescape(re.sub(r"\s+", " ", m_title.group(1)).strip())

	# 2. Meta tags helper: parse each <meta> tag once (linear time even on multi-MB pages)
	meta_tags: list[dict[str, str]] = []
	attr_re = re.compile(r'([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s"\'>]+))')
	for m_tag in re.finditer(r"<meta\b([^>]*)>", html, re.IGNORECASE):
		attrs = {}
		for a in attr_re.finditer(m_tag.group(1)):
			value = a.group(2) if a.group(2) is not None else (a.group(3) if a.group(3) is not None else a.group(4))
			attrs[a.group(1).lower()] = value or ""
		meta_tags.append(attrs)

	def get_meta(attr_name: str, attr_val: str) -> str:
		for attrs in meta_tags:
			if attrs.get(attr_name, "").lower() == attr_val.lower() and "content" in attrs:
				return html_module.unescape(attrs["content"].strip())
		return ""

	og_title = get_meta("property", "og:title") or get_meta("name", "og:title")
	og_description = get_meta("property", "og:description") or get_meta("name", "og:description")
	meta_description = get_meta("name", "description") or get_meta("property", "description")

	# 3. Form input type="password"
	has_password_input = bool(re.search(r'<input[^>]+type=["\']?password["\']?', html, re.IGNORECASE))

	# 4. JSON-LD Person or ProfilePage
	has_profile_jsonld = False
	jsonld_matches = re.findall(
		r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
		html,
		re.IGNORECASE | re.DOTALL,
	)
	for j_text in jsonld_matches:
		if re.search(r'["\']@type["\']\s*:\s*["\'](Person|ProfilePage)["\']', j_text, re.IGNORECASE):
			has_profile_jsonld = True
			break

	# 5. Full clean text
	clean_html = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.IGNORECASE | re.DOTALL)
	full_text = re.sub(r"<[^>]+>", " ", clean_html)
	full_text = html_module.unescape(re.sub(r"\s+", " ", full_text).strip())
	text_len = len(full_text)

	# 6. Preview text: prefer <main> or role="main" if present
	main_text = ""
	m_main = re.search(r"<main[^>]*>(.*?)</main>", clean_html, re.IGNORECASE | re.DOTALL)
	if not m_main:
		m_main = re.search(r'<[a-z0-9]+\s+[^>]*?role=["\']main["\'][^>]*>(.*?)</[a-z0-9]+>', clean_html, re.IGNORECASE | re.DOTALL)
	if m_main:
		m_content = re.sub(r"<[^>]+>", " ", m_main.group(1))
		main_text = html_module.unescape(re.sub(r"\s+", " ", m_content).strip())

	preview_source = main_text if len(main_text) >= 50 else full_text
	preview = preview_source[:300]

	return {
		"title": title,
		"full_text": full_text,
		"text_len": text_len,
		"og_title": og_title,
		"og_description": og_description,
		"meta_description": meta_description,
		"has_password_input": has_password_input,
		"has_profile_jsonld": has_profile_jsonld,
		"preview": preview,
	}


def detect_login_page(final_url: str, html_or_text: str, display_text: str = "") -> bool:
	"""Mendeteksi apakah respons kemungkinan adalah halaman login/checkpoint/authwall.

	Memakai sinyal bertingkat dan teks penuh:
	1. Sinyal kuat (cukup sendirian):
	   - Jalur URL akhir ke login/checkpoint/authwall/signin.
	   - Tag <title> yang intinya halaman login (tanpa nama profil (@handle)).
	2. Sinyal profil positif (menetralkan sinyal lemah):
	   - og:title/og:description/meta description memuat kata profil.
	   - Judul memuat handle (@handle).
	   - JSON-LD Person atau ProfilePage.
	   - Teks penuh panjang (> 2000 karakter) yang memuat kata profil.
	3. Sinyal lemah (berlaku hanya bila tanpa sinyal profil dan teks penuh < 1500 karakter):
	   - Ada form input password.
	   - Ada frasa login pada teks.
	"""
	raw_html = html_or_text or ""
	url_lower = (final_url or "").lower()

	signals = extract_page_signals(raw_html)
	title = signals["title"]
	full_text = signals["full_text"] or display_text
	text_len = signals["text_len"] or len(full_text)

	# 1. Sinyal kuat (cukup sendirian)
	# A. Jalur URL akhir
	login_url_patterns = (
		"/login",
		"/signin",
		"/sign-in",
		"accounts/login",
		"/checkpoint",
		"checkpoint",
		"/authwall",
		"authwall",
		"/session/new",
		"/challenge",
	)
	parsed = urllib.parse.urlsplit(final_url or "")
	path_lower = parsed.path.lower()
	if any(p in path_lower or p in url_lower for p in login_url_patterns):
		return True

	# B. Tag <title> yang intinya halaman login
	title_lower = title.lower().strip()
	has_profile_handle = bool(
		re.search(r"\(@[a-zA-Z0-9._-]+\)", title) or re.search(r"\([a-zA-Z0-9._-]+\)", title)
	)

	is_pure_login_title = False
	if title_lower:
		if title_lower.startswith(("log in", "login", "sign in", "signin", "masuk")):
			is_pure_login_title = True
		elif title_lower in ("instagram", "meta", "facebook", "linkedin", "tiktok") and not has_profile_handle:
			is_pure_login_title = True

	if is_pure_login_title:
		return True

	# 2. Sinyal profil positif (menetralkan sinyal lemah)
	profile_keywords = (
		"followers",
		"following",
		"pengikut",
		"mengikuti",
		"posts",
		"postingan",
		"repositories",
		"contributions",
		"connections",
		"photos and videos",
		"foto dan video",
	)
	meta_combined = f"{signals['og_title']} {signals['og_description']} {signals['meta_description']}".lower()
	has_meta_profile = any(kw in meta_combined for kw in profile_keywords)
	has_jsonld_profile = signals["has_profile_jsonld"]
	full_text_lower = full_text.lower()
	has_long_profile_text = (text_len > 2000) and any(kw in full_text_lower for kw in profile_keywords)

	has_positive_profile = (
		has_meta_profile
		or has_jsonld_profile
		or has_profile_handle
		or has_long_profile_text
	)

	if has_positive_profile:
		return False

	# 3. Sinyal lemah (hanya berlaku jika TIDAK ada sinyal profil positif DAN text_len < 1500)
	has_password = signals["has_password_input"]
	login_phrases = ("log in", "sign in", "masuk", "login", "create an account", "daftar akun")
	has_login_phrase = any(phrase in full_text_lower for phrase in login_phrases)

	if (has_password or has_login_phrase) and text_len < 1500:
		return True

	return False


def extract_title_and_text(html: str) -> tuple[str, str]:
	"""Ekstrak judul halaman dan 300 karakter pertama teks bersih."""
	signals = extract_page_signals(html)
	return signals["title"], signals["preview"]


def _log_test_fetch(user: str, domain: str, mode: str, status: str, is_login: bool) -> None:
	"""Catat pengujian fetch ke log tanpa menyimpan isi halaman."""
	try:
		log_entry = {
			"time": frappe.utils.now_datetime().isoformat(),
			"user": user,
			"domain": domain,
			"mode": mode,
			"status": status,
			"is_login_page": is_login,
		}
		frappe.logger("bgc_test_fetch").info(frappe.as_json(log_entry))
	except Exception:
		pass


class BackgroundCheckSettings(Document):
	def onload(self):
		self.fetch_browser_status = get_scrapling_browser_status()
		if not self.fetch_user_agent:
			self.fetch_user_agent = self.get_default_user_agent()
		# Daftar bawaan hanya ditampilkan bila belum pernah disimpan. Daftar yang sengaja
		# dikosongkan tidak boleh diisi ulang.
		if not blocked_domains_row_exists():
			self.fetch_blocked_domains = "\n".join(DEFAULT_BLOCKED_DOMAINS)

	def validate(self):
		self.fetch_browser_status = get_scrapling_browser_status()
		if not self.fetch_user_agent:
			self.fetch_user_agent = self.get_default_user_agent()

		self.validate_risk_acknowledgment()
		self.validate_consent_text_version()
		self.validate_thresholds()

	def validate_thresholds(self):
		if self.social_max_posts is not None and self.social_max_posts < 1:
			frappe.throw(_("Social Max Posts must be at least 1."))
		if getattr(self, "social_max_comments", None) is not None and self.social_max_comments < 1:
			frappe.throw(_("Social Max Comments must be at least 1."))
		if self.social_lookback_months is not None and self.social_lookback_months < 0:
			frappe.throw(_("Social Lookback Months cannot be negative (0 = no limit)."))
		if self.export_max_mb is not None and self.export_max_mb < 1:
			frappe.throw(_("Max Candidate Export Size (MB) must be at least 1."))

	def validate_consent_text_version(self):
		validate_consent_text_version(self)

	def get_default_user_agent(self) -> str:
		company = frappe.defaults.get_user_default("Company") or frappe.db.get_single_value(
			"Global Defaults", "default_company"
		)
		if company:
			return f"{company} HR Background Check (+hr@example.com)"
		return "HRIS Background Check (+hr@example.com)"

	def validate_risk_acknowledgment(self):
		curr_blocked = [
			line.strip().lower()
			for line in (self.fetch_blocked_domains or "").splitlines()
			if line.strip()
		]
		has_removed_blocked_domains = any(d not in curr_blocked for d in DEFAULT_BLOCKED_DOMAINS)

		is_risky = (
			not bool(self.fetch_respect_robots)
			or self.fetch_identity == "Browser"
			or bool(self.fetch_stealth_mode)
			or bool(getattr(self, "fetch_use_login_session", 0))
			or bool(getattr(self, "fetch_auto_escalate", 0))
			or has_removed_blocked_domains
		)

		if is_risky and not bool(self.fetch_risk_acknowledged):
			frappe.throw(
				_(
					"Saving settings with robots.txt ignored, Browser identity, stealth mode, "
					"auto-escalate mode, or removed default blocked domains requires risk acknowledgment (fetch_risk_acknowledged)."
				),
				title=_("Risk Acknowledgment Required"),
			)

		if self.fetch_risk_acknowledged:
			if not self.fetch_risk_ack_by or self.has_value_changed("fetch_risk_acknowledged"):
				self.fetch_risk_ack_by = getattr(frappe.session, "user", None) or "Administrator"
				self.fetch_risk_ack_on = frappe.utils.now_datetime()
		else:
			self.fetch_risk_ack_by = None
			self.fetch_risk_ack_on = None


@frappe.whitelist()
def test_fetch(url: str, consent_acknowledged: int = 0) -> dict[str, Any]:
	"""Uji pengambilan profil publik Scrapling (hanya System Manager).
	Mendukung mode Company, Browser, Stealth, dan mode keempat Session bila ada akun crawler Connected.
	"""
	if "System Manager" not in frappe.get_roles():
		frappe.throw(_("Only System Manager can perform test fetch."), frappe.PermissionError)

	if not consent_acknowledged:
		frappe.throw(
			_("You must confirm profile ownership or permission before proceeding."),
			title=_("Permission Required"),
		)

	if not url or not (url.startswith("http://") or url.startswith("https://")):
		frappe.throw(_("URL must start with http:// or https://."), title=_("Invalid URL"))

	from hris_ats.bgc.crawler_session import (
		check_and_update_crawler_rate_limits,
		extract_profile_data_summary,
		get_decrypted_storage_state,
		get_eligible_crawler_account_for_url,
		mark_crawler_account_challenge,
	)
	from hris_ats.bgc.fetch import (
		FetchConfig,
		ForbiddenDomainError,
		fetch,
		get_domain,
		is_forbidden_domain,
		is_scrapling_browser_installed,
	)

	domain = get_domain(url)
	if is_forbidden_domain(url):
		frappe.throw(
			_("Domain {0} is currently blocked in Settings. Remove it from blocked domains and acknowledge risk first to test.").format(domain),
			title=_("Blocked Domain"),
		)

	settings = frappe.get_single("Background Check Settings")
	respect_robots = bool(settings.fetch_respect_robots)

	crawler_account = get_eligible_crawler_account_for_url(url)

	modes: list[tuple[str, str, FetchConfig | None, dict | None]] = [
		("Company", "Company", FetchConfig(identity="Company", stealth=False, respect_robots=respect_robots), None),
		("Browser", "Browser", FetchConfig(identity="Browser", stealth=False, respect_robots=respect_robots), None),
		("Stealth", "Stealth", FetchConfig(identity="Browser", stealth=True, respect_robots=respect_robots), None),
	]

	if crawler_account:
		modes.append((
			"Session",
			f"Session ({crawler_account['account_label']})",
			None,
			crawler_account,
		))

	browser_installed = is_scrapling_browser_installed()
	results = []
	browser_body = None

	for mode_key, mode_label, config, acc_info in modes:
		if mode_key == "Stealth" and not browser_installed:
			results.append({
				"mode": mode_label,
				"status": "Skipped",
				"message": _("Stealth mode skipped: browser is not installed."),
				"is_login_page": False,
			})
			_log_test_fetch(user=frappe.session.user, domain=domain, mode=mode_label, status="Skipped", is_login=False)
			continue

		if mode_key == "Session" and acc_info:
			try:
				# Enforce crawler account rate limits
				check_and_update_crawler_rate_limits(acc_info["name"])

				# Decrypt session strictly in process; never logged, cached, or returned
				decrypted_state = get_decrypted_storage_state(acc_info["name"])
				if not decrypted_state:
					results.append({
						"mode": mode_label,
						"account_label": acc_info["account_label"],
						"status": "Error",
						"error": _("Stored session state is empty or invalid."),
						"is_login_page": False,
					})
					_log_test_fetch(user=frappe.session.user, domain=domain, mode=mode_label, status="Error: empty session", is_login=False)
					continue

				session_config = FetchConfig(
					identity="Browser",
					stealth=browser_installed,
					respect_robots=respect_robots,
					storage_state=decrypted_state,
				)

				res = fetch(url, config=session_config)
				signals = extract_page_signals(res.body)
				is_login = detect_login_page(res.url, res.body, signals["preview"])

				# Challenge / checkpoint detection on crawler account
				is_challenge = is_login and any(cp in res.url.lower() for cp in ("checkpoint", "challenge", "authwall"))
				if is_challenge or res.status in (401, 403, 429):
					mark_crawler_account_challenge(acc_info["name"], f"Crawler session encountered challenge/checkpoint at {res.url}")

				session_summary = extract_profile_data_summary(res.body)
				browser_summary = extract_profile_data_summary(browser_body) if browser_body else None

				comparison = None
				if browser_summary:
					comparison = {
						"posts_count": {"session": session_summary["posts_count"], "browser": browser_summary["posts_count"]},
						"has_name": {"session": session_summary["has_name"], "browser": browser_summary["has_name"]},
						"has_bio": {"session": session_summary["has_bio"], "browser": browser_summary["has_bio"]},
						"has_followers": {"session": session_summary["has_followers"], "browser": browser_summary["has_followers"]},
					}

				results.append({
					"mode": mode_label,
					"account_label": acc_info["account_label"],
					"status": res.status,
					"final_url": res.url,
					"mode_used": res.mode_used,
					"size_bytes": len(res.content) if res.content is not None else len(res.body.encode("utf-8")),
					"title": signals["title"],
					"og_title": signals["og_title"],
					"og_description": signals["og_description"],
					"preview_text": signals["preview"],
					"is_login_page": is_login,
					"comparison_with_browser": comparison,
					"profile_summary": session_summary,
				})
				_log_test_fetch(user=frappe.session.user, domain=domain, mode=mode_label, status=str(res.status), is_login=is_login)
			except Exception as e:
				results.append({
					"mode": mode_label,
					"account_label": acc_info["account_label"],
					"status": "Error",
					"error": str(e),
					"is_login_page": False,
				})
				_log_test_fetch(user=frappe.session.user, domain=domain, mode=mode_label, status=f"Error: {e}", is_login=False)
			continue

		try:
			res = fetch(url, config=config)
			signals = extract_page_signals(res.body)
			is_login = detect_login_page(res.url, res.body, signals["preview"])
			if mode_key == "Browser":
				browser_body = res.body

			results.append({
				"mode": mode_label,
				"status": res.status,
				"final_url": res.url,
				"mode_used": res.mode_used,
				"size_bytes": len(res.content) if res.content is not None else len(res.body.encode("utf-8")),
				"title": signals["title"],
				"og_title": signals["og_title"],
				"og_description": signals["og_description"],
				"preview_text": signals["preview"],
				"is_login_page": is_login,
			})
			_log_test_fetch(user=frappe.session.user, domain=domain, mode=mode_label, status=str(res.status), is_login=is_login)
		except Exception as e:
			results.append({
				"mode": mode_label,
				"status": "Error",
				"error": str(e),
				"is_login_page": False,
			})
			_log_test_fetch(user=frappe.session.user, domain=domain, mode=mode_label, status=f"Error: {e}", is_login=False)

	return {"url": url, "domain": domain, "results": results}
