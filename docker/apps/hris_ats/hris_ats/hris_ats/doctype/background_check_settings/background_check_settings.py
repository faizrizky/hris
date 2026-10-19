from __future__ import annotations

import re
import urllib.parse
from typing import Any

import frappe
from frappe import _
from frappe.model.document import Document

DEFAULT_BLOCKED_DOMAINS = (
	"instagram.com",
	"instagr.am",
	"facebook.com",
	"fb.com",
	"fb.me",
	"tiktok.com",
	"linkedin.com",
	"lnkd.in",
)


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


def detect_login_page(final_url: str, html_or_text: str, display_text: str) -> bool:
	"""Mendeteksi apakah respons kemungkinan adalah halaman login/checkpoint/authwall.

	Kriteria:
	1. URL akhir mengarah ke jalur login (mis. /login, /signin, /checkpoint, /authwall, accounts/login).
	2. Tag <title> mengandung kata login / sign in / masuk.
	3. Ada form dengan input password (<input type="password">).
	4. Isi sangat pendek (< 500 karakter) yang memuat ajakan login dan tanpa konten profil.

	Halaman publik panjang dengan tautan 'Sign in' di navigasi BUKAN halaman login.
	"""
	raw_html = html_or_text or ""
	url_lower = (final_url or "").lower()

	# 1. Jalur URL akhir ke login / checkpoint / authwall
	login_url_patterns = ("/login", "/signin", "/sign-in", "accounts/login", "checkpoint", "authwall", "/session/new")
	parsed = urllib.parse.urlsplit(final_url or "")
	path_lower = parsed.path.lower()
	if any(p in path_lower or p in url_lower for p in login_url_patterns):
		return True

	# 2. Tag <title> mengandung frasa login
	m_title = re.search(r"<title[^>]*>(.*?)</title>", raw_html, re.IGNORECASE | re.DOTALL)
	if m_title:
		title_lower = m_title.group(1).lower().strip()
		title_login_phrases = ("log in", "login", "sign in", "signin", "masuk")
		if any(w in title_lower for w in title_login_phrases):
			return True

	# 3. Terdapat input bertipe password
	if re.search(r'<input[^>]+type=["\']?password["\']?', raw_html, re.IGNORECASE):
		return True

	# 4. Halaman sangat pendek (< 500 karakter) tanpa konten profil namun berisi frasa login
	clean_text = (display_text or "").lower()
	text_len = len(clean_text)
	profile_indicators = (
		"posts",
		"followers",
		"following",
		"pengikut",
		"postingan",
		"profile",
		"repositories",
		"contributions",
		"starred",
	)
	has_profile_content = any(ind in clean_text for ind in profile_indicators)
	login_phrases = ("log in", "sign in", "masuk", "login")
	has_login_phrase = any(phrase in clean_text for phrase in login_phrases)

	if text_len < 500 and has_login_phrase and not has_profile_content:
		return True

	return False


def extract_title_and_text(html: str) -> tuple[str, str]:
	"""Ekstrak judul halaman dan 300 karakter pertama teks bersih."""
	title = ""
	if not html:
		return "", ""
	m = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
	if m:
		title = re.sub(r"\s+", " ", m.group(1)).strip()

	clean_html = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.IGNORECASE | re.DOTALL)
	clean_text = re.sub(r"<[^>]+>", " ", clean_html)
	clean_text = re.sub(r"\s+", " ", clean_text).strip()
	return title, clean_text[:300]


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
		if not getattr(self, "fetch_blocked_domains", None):
			self.fetch_blocked_domains = "\n".join(DEFAULT_BLOCKED_DOMAINS)

	def validate(self):
		self.fetch_browser_status = get_scrapling_browser_status()
		if not self.fetch_user_agent:
			self.fetch_user_agent = self.get_default_user_agent()
		if not getattr(self, "fetch_blocked_domains", None):
			self.fetch_blocked_domains = "\n".join(DEFAULT_BLOCKED_DOMAINS)

		self.validate_risk_acknowledgment()
		self.validate_consent_text_version()

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
			or has_removed_blocked_domains
		)

		if is_risky and not bool(self.fetch_risk_acknowledged):
			frappe.throw(
				_(
					"Saving settings with robots.txt ignored, Browser identity, stealth mode, "
					"or removed default blocked domains requires risk acknowledgment (fetch_risk_acknowledged)."
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
	"""Uji pengambilan profil publik dalam 3 mode Scrapling (hanya System Manager)."""
	if "System Manager" not in frappe.get_roles():
		frappe.throw(_("Only System Manager can perform test fetch."), frappe.PermissionError)

	if not consent_acknowledged:
		frappe.throw(
			_("You must confirm profile ownership or permission before proceeding."),
			title=_("Permission Required"),
		)

	if not url or not (url.startswith("http://") or url.startswith("https://")):
		frappe.throw(_("URL must start with http:// or https://."), title=_("Invalid URL"))

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

	modes = [
		("Company", FetchConfig(identity="Company", stealth=False, respect_robots=respect_robots)),
		("Browser", FetchConfig(identity="Browser", stealth=False, respect_robots=respect_robots)),
		("Stealth", FetchConfig(identity="Browser", stealth=True, respect_robots=respect_robots)),
	]

	browser_installed = is_scrapling_browser_installed()
	results = []

	for mode_name, config in modes:
		if mode_name == "Stealth" and not browser_installed:
			results.append({
				"mode": mode_name,
				"status": "Skipped",
				"message": _("Stealth mode skipped: browser is not installed."),
				"is_login_page": False,
			})
			_log_test_fetch(user=frappe.session.user, domain=domain, mode=mode_name, status="Skipped", is_login=False)
			continue

		try:
			res = fetch(url, config=config)
			title, preview = extract_title_and_text(res.body)
			is_login = detect_login_page(res.url, res.body, preview)
			results.append({
				"mode": mode_name,
				"status": res.status,
				"final_url": res.url,
				"mode_used": res.mode_used,
				"size_bytes": len(res.content) if res.content is not None else len(res.body.encode("utf-8")),
				"title": title,
				"preview_text": preview,
				"is_login_page": is_login,
			})
			_log_test_fetch(user=frappe.session.user, domain=domain, mode=mode_name, status=str(res.status), is_login=is_login)
		except Exception as e:
			results.append({
				"mode": mode_name,
				"status": "Error",
				"error": str(e),
				"is_login_page": False,
			})
			_log_test_fetch(user=frappe.session.user, domain=domain, mode=mode_name, status=f"Error: {e}", is_login=False)

	return {"url": url, "domain": domain, "results": results}
