# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Lapisan pengambil halaman tunggal berbasis Scrapling untuk Background Check.
Menjamin kepatuhan terhadap domain terlarang, robots.txt (Protego), batas laju per-domain via Redis,
caching 24 jam, serta mode identitas (Company / Browser / Stealth).
"""

from __future__ import annotations

import hashlib
import hmac
import re
import time
import urllib.parse
from collections.abc import Callable
from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from typing import Any

try:
	from protego import Protego
except ImportError:
	Protego = None

try:
	from scrapling.parser import Adaptor
except ImportError:
	Adaptor = None


# 1. Konstanta Domain Terlarang Bawaan (UU PDP & Ketentuan Layanan)
DEFAULT_BLOCKED_DOMAINS = (
	"instagram.com",
	"instagr.am",
	"facebook.com",
	"fb.com",
	"fb.me",
	"tiktok.com",
	"linkedin.com",
	"lnkd.in",
	"threads.net",
	"threads.com",
)
FORBIDDEN_DOMAINS = DEFAULT_BLOCKED_DOMAINS


# 2. Exception Khusus
class FetchError(Exception):
	"""Base class exception untuk fetch layer."""
	pass


class ForbiddenDomainError(FetchError):
	"""Dilemparkan bila URL mengarah ke domain terlarang."""
	pass


class RobotsDisallowedError(FetchError):
	"""Dilemparkan bila URL dilarang oleh robots.txt saat respect_robots=True."""
	pass


class RedisUnavailableError(FetchError):
	"""Dilemparkan bila cache Redis tidak tersedia dan mode live menolak fallback memori."""
	pass


class StealthBrowserNotInstalledError(FetchError):
	"""Dilemparkan bila mode stealth aktif namun browser belum terpasang."""
	pass


class FetchNetworkError(FetchError):
	"""Dilemparkan bila terjadi kegagalan jaringan atau timeout."""
	pass


# 3. Data Structures
@dataclass
class FetchConfig:
	"""Konfigurasi pengambilan halaman web (dibangun dari Background Check Settings)."""
	respect_robots: bool = True
	identity: str = "Company"  # "Company" | "Browser"
	user_agent: str = "HRIS Background Check (+hr@example.com)"
	stealth: bool = False
	stealth_domains: list[str] = field(default_factory=list)
	blocked_domains: list[str] | tuple[str, ...] | None = None
	rate_limit_per_minute: int = 30
	cache_ttl_seconds: int = 86400
	timeout_seconds: int = 15
	storage_state: dict[str, Any] | None = None
	auto_escalate: bool = False
	use_login_session: bool = False
	crawler_account: str | None = None
	hourly_limit: int = 10
	daily_limit: int = 50
	min_delay_seconds: int = 15
	jitter_seconds: int = 20
	is_mock: bool = False


@dataclass
class FetchResult:
	"""Hasil pengambilan halaman web."""
	url: str
	status: int
	body: str
	mode_used: str  # "company+robots", "company", "browser+robots", "browser", "stealth+robots", "stealth"
	robots_ignored: bool = False
	from_cache: bool = False
	page: Any | None = None
	content: bytes | None = None
	is_login_wall: bool = False
	is_blocked: bool = False
	crawler_account: str | None = None


# 4. Cache Abstraction
class BaseCacheBackend:
	def get(self, key: str) -> Any:
		raise NotImplementedError

	def set(self, key: str, value: Any, ttl: int | None = None) -> None:
		raise NotImplementedError


class MemoryCacheBackend(BaseCacheBackend):
	"""Cache in-memory sederhana untuk pengujian mandiri pytest."""
	def __init__(self):
		self._store: dict[str, tuple[float | None, Any]] = {}

	def get(self, key: str) -> Any:
		if key in self._store:
			expiry, val = self._store[key]
			if expiry is None or time.time() < expiry:
				return val
			del self._store[key]
		return None

	def set(self, key: str, value: Any, ttl: int | None = None, **kwargs) -> None:
		expiry_sec = ttl or kwargs.get("ttl_seconds") or kwargs.get("expires_in_sec") or kwargs.get("ex")
		expiry = time.time() + expiry_sec if expiry_sec else None
		self._store[key] = (expiry, value)

	def get_value(self, key: str, **kwargs) -> Any:
		return self.get(key)

	def set_value(self, key: str, value: Any, expires_in_sec: int | None = None, **kwargs) -> None:
		self.set(key, value, ttl=expires_in_sec)

	def delete_value(self, key: str) -> None:
		self._store.pop(key, None)


class FrappeRedisCacheBackend(BaseCacheBackend):
	"""Cache Redis via frappe.cache untuk lingkungan operasional ERPNext."""
	def get(self, key: str) -> Any:
		try:
			import frappe
			if hasattr(frappe, "cache") and frappe.cache:
				return frappe.cache.get_value(key)
		except Exception as e:
			try:
				import frappe
				frappe.log_error(title="Redis Cache Get Error", message=str(e))
			except Exception:
				pass
		return None

	def set(self, key: str, value: Any, ttl: int | None = None) -> None:
		try:
			import frappe
			if hasattr(frappe, "cache") and frappe.cache:
				frappe.cache.set_value(key, value, expires_in_sec=ttl)
		except Exception as e:
			try:
				import frappe
				frappe.log_error(title="Redis Cache Set Error", message=str(e))
			except Exception:
				pass


def is_redis_available() -> bool:
	"""Memeriksa ketersediaan koneksi Redis/frappe.cache."""
	try:
		import frappe
		if hasattr(frappe, "cache") and frappe.cache:
			if hasattr(frappe.cache, "ping"):
				return bool(frappe.cache.ping())
			return True
	except Exception:
		return False
	return False


def get_default_cache_backend(is_mock: bool = False) -> BaseCacheBackend:
	"""
	Mengembalikan cache backend default.
	Mode live: gagal tertutup (fail-closed) jika Redis tidak tersedia, melempar RedisUnavailableError.
	Fallback ke MemoryCacheBackend hanya diizinkan saat pengujian (frappe.flags.in_test) atau mock.
	"""
	try:
		import frappe
		in_test = bool(getattr(getattr(frappe, "flags", None), "in_test", False))
	except Exception:
		in_test = False

	if is_redis_available():
		return FrappeRedisCacheBackend()

	if in_test or is_mock:
		return MemoryCacheBackend()

	raise RedisUnavailableError("Redis not available")


def get_site_secret() -> bytes:
	"""Mengambil rahasia site untuk HMAC hashing kunci cache (tidak membocorkan nama kandidat / URL polos ke Redis).
	Bila tidak ada secret_key atau encryption_key yang dikonfigurasi, sistem gagal tertutup (fail-closed).
	"""
	try:
		import frappe
		if hasattr(frappe, "local") and frappe.local:
			conf = getattr(frappe.local, "conf", None) or {}
			secret = conf.get("secret_key") or conf.get("encryption_key")
			if secret:
				return str(secret).encode("utf-8")
	except Exception:
		pass
	raise RuntimeError("Site secret_key or encryption_key not configured for cache HMAC (fail-closed)")


def hash_url(url: str) -> str:
	"""HMAC-SHA256 hash URL dengan secret site."""
	secret = get_site_secret()
	return hmac.new(secret, url.strip().encode("utf-8"), hashlib.sha256).hexdigest()


def get_cache_key(url: str, mode: str, method: str = "GET") -> str:
	"""Menghasilkan kunci cache Redis dengan URL ter-hash HMAC-SHA256."""
	norm_method = method.upper()
	url_hash = hash_url(url)
	return f"sentra_ats:fetch_cache:{mode}:{norm_method}:{url_hash}"


# 5. Helper Pengecekan Domain & Status Browser
def get_domain(url: str) -> str:
	"""Ekstrak nama host (huruf kecil, tanpa port)."""
	parsed = urllib.parse.urlsplit(url)
	netloc = parsed.netloc.lower()
	if ":" in netloc:
		netloc = netloc.split(":")[0]
	return netloc.strip(".")


def read_stored_blocked_domains() -> str | None:
	"""Nilai mentah `fetch_blocked_domains` di tabSingles.

	None = belum pernah disimpan (pakai daftar bawaan). String kosong = sengaja dikosongkan
	oleh System Manager (tidak ada domain yang diblokir). Dibedakan lewat keberadaan barisnya,
	bukan dari nilainya, karena NULL dan "" sama-sama dibaca sebagai kosong oleh Frappe.
	"""
	import frappe

	rows = frappe.db.sql(
		"select value from `tabSingles` where doctype=%s and field=%s limit 1",
		("Background Check Settings", "fetch_blocked_domains"),
	)
	if not rows:
		return None
	return rows[0][0] or ""


def blocked_domains_row_exists() -> bool:
	return read_stored_blocked_domains() is not None


def parse_blocked_domains(raw: str | None) -> list[str]:
	return [line.strip().lower() for line in (raw or "").splitlines() if line.strip()]


def get_blocked_domains() -> list[str]:
	"""Membaca daftar domain terlarang dari Background Check Settings.

	Daftar kosong yang sengaja disimpan dihormati (tidak diisi ulang dengan daftar bawaan).
	"""
	try:
		import frappe

		if hasattr(frappe, "db") and frappe.db:
			raw = read_stored_blocked_domains()
			if raw is not None:
				return parse_blocked_domains(raw)
	except Exception:
		pass
	return list(DEFAULT_BLOCKED_DOMAINS)


def is_forbidden_domain(url: str, blocked_domains: list[str] | tuple[str, ...] | None = None) -> bool:
	"""Memeriksa apakah domain URL termasuk dalam daftar platform terlarang."""
	domain = get_domain(url)
	if not domain:
		return False
	if blocked_domains is None:
		blocked_domains = get_blocked_domains()
	for forbidden in blocked_domains:
		forbidden = forbidden.lower().strip()
		if domain == forbidden or domain.endswith("." + forbidden):
			return True
	return False


def is_scrapling_browser_installed() -> bool:
	"""Cek status instalasi browser Scrapling langsung dari package Scrapling / patchright."""
	try:
		from scrapling.cli import __PACKAGE_DIR__
		if __PACKAGE_DIR__.joinpath(".scrapling_dependencies_installed").exists():
			return True
	except Exception:
		pass

	try:
		import os

		from patchright.sync_api import sync_playwright
		with sync_playwright() as p:
			if os.path.exists(p.chromium.executable_path):
				return True
	except Exception:
		pass

	return False


def determine_mode(config: FetchConfig, domain: str) -> tuple[str, str]:
	"""
	Menentukan jenis fetcher dan string mode_used.
	Return: (fetcher_type, mode_used)
	fetcher_type: "stealth" | "browser" | "company"
	mode_used: "stealth+robots", "stealth", "browser+robots", "browser", "company+robots", "company"
	"""
	# Cek apakah stealth aktif dan domain cocok
	is_stealth = False
	if config.stealth:
		if not config.stealth_domains:
			is_stealth = True
		else:
			clean_domains = [d.strip().lower() for d in config.stealth_domains if d.strip()]
			for sd in clean_domains:
				if domain == sd or domain.endswith("." + sd):
					is_stealth = True
					break

	if is_stealth:
		fetcher_type = "stealth"
		mode_used = "stealth+robots" if config.respect_robots else "stealth"
		return fetcher_type, mode_used

	if config.identity.lower() == "browser":
		fetcher_type = "browser"
		mode_used = "browser+robots" if config.respect_robots else "browser"
		return fetcher_type, mode_used

	fetcher_type = "company"
	mode_used = "company+robots" if config.respect_robots else "company"
	return fetcher_type, mode_used


# 6. Batas Laju (Rate Limiting)
def enforce_rate_limit(
	domain: str,
	min_interval: float,
	cache: BaseCacheBackend,
	sleep_fn: Callable[[float], None] = time.sleep,
	time_fn: Callable[[], float] = time.time,
) -> None:
	"""Menegakkan jeda minimum per domain menggunakan cache backend (Redis / Memory)."""
	if min_interval <= 0 or not domain:
		return

	rate_key = f"sentra_ats:rate_limit:{domain}"
	now = time_fn()
	last_call = cache.get(rate_key)

	if last_call is not None:
		try:
			last_time = float(last_call)
			elapsed = now - last_time
			if elapsed < min_interval:
				wait_time = min_interval - elapsed
				sleep_fn(wait_time)
				now = time_fn()
		except (ValueError, TypeError):
			pass

	cache.set(rate_key, str(now), ttl=3600)


# 7. Penanganan robots.txt
def check_robots_txt(
	target_url: str,
	user_agent: str,
	respect_robots: bool,
	cache: BaseCacheBackend,
	raw_fetch_fn: Callable[[str], tuple[int, str]] | None = None,
	is_mock: bool = False,
) -> tuple[bool, bool]:
	"""
	Memeriksa izin URL pada robots.txt.
	Return: (allowed, robots_ignored)
	"""
	parsed = urllib.parse.urlsplit(target_url)
	if not parsed.scheme or not parsed.netloc:
		return True, False

	domain = get_domain(target_url)
	robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"

	# Jika URL target adalah robots.txt itu sendiri, jangan recursive check
	if parsed.path.rstrip("/") == "/robots.txt":
		return True, False

	robots_cache_key = f"sentra_ats:robots_txt:{domain}"
	cached_robots = cache.get(robots_cache_key)

	if cached_robots is None:
		# Ambil robots.txt
		status, text = 404, ""
		if is_mock:
			status, text = 404, ""
		elif raw_fetch_fn:
			try:
				status, text = raw_fetch_fn(robots_url)
			except Exception:
				status, text = 404, ""
		else:
			try:
				from scrapling.fetchers import Fetcher
				res = Fetcher.get(
					robots_url,
					impersonate=None,
					stealthy_headers=False,
					headers={"User-Agent": user_agent},
					timeout=10,
				)
				status = res.status
				text = res.text if hasattr(res, "text") else str(res.body, errors="ignore")
			except Exception:
				status, text = 404, ""

		cached_robots = text if status == 200 else ""
		cache.set(robots_cache_key, cached_robots, ttl=86400)

	# Jika robots.txt kosong atau tidak ada
	if not cached_robots or not Protego:
		return True, False

	try:
		rp = Protego.parse(cached_robots)
		allowed = rp.can_fetch(target_url, user_agent)
	except Exception:
		allowed = True

	if allowed:
		return True, False
	else:
		# Dilarang oleh robots.txt
		if respect_robots:
			raise RobotsDisallowedError(
				f"Akses ke URL '{target_url}' dilarang oleh robots.txt untuk User-Agent '{user_agent}'."
			)
		else:
			# Dilonggarkan oleh setting: tetap diambil, tandai robots_ignored = True
			return True, True


def is_response_blocked(
	status: int,
	url: str,
	body: str,
	preview: str = "",
) -> tuple[bool, str]:
	"""Mendeteksi apakah respons terhalang anti-bot atau dinding login.
	Return: (is_blocked, reason)
	reason: 'login required' | 'blocked' | ''
	"""
	if status in (401, 403, 429, 503):
		return True, "blocked"

	body_lower = (body or "").lower()
	title_match = re.search(r"<title[^>]*>(.*?)</title>", body or "", re.IGNORECASE)
	title = title_match.group(1).lower() if title_match else ""

	if any(k in title for k in ("just a moment...", "attention required!", "security check", "robot check", "cloudflare")):
		return True, "blocked"
	if any(k in body_lower for k in ("cf-browser-verification", "ray id:", "data-ray=", "dd-challenge", "perimeterx", "_wafchallengeid", "slardarwaf")):
		return True, "blocked"

	try:
		from sentra_ats.sentra_ats.doctype.background_check_settings.background_check_settings import (
			detect_login_page,
		)
		if detect_login_page(url, body or "", preview):
			return True, "login required"
	except Exception:
		pass

	return False, ""


def _fetch_single_mode(
	url: str,
	mode: str,
	config: FetchConfig,
	cache: BaseCacheBackend,
	domain: str,
	norm_method: str = "GET",
	max_size_bytes: int | None = None,
	storage_state: dict[str, Any] | None = None,
	crawler_account_name: str | None = None,
	crawler_account_label: str | None = None,
	raw_fetch_fn: Callable[..., Any] | None = None,
	sleep_fn: Callable[[float], None] = time.sleep,
	time_fn: Callable[[], float] = time.time,
	is_mock: bool = False,
) -> FetchResult:
	"""Eksekusi satu percobaan pengambilan halaman pada mode tertentu."""
	# 1. Cek robots.txt
	robots_ignored = False
	if config.respect_robots or not config.respect_robots:
		_, robots_ignored = check_robots_txt(
			target_url=url,
			user_agent=config.user_agent,
			respect_robots=config.respect_robots,
			cache=cache,
			is_mock=is_mock,
		)

	# 2. Batas laju per domain
	min_interval = 60.0 / max(1, config.rate_limit_per_minute)
	enforce_rate_limit(domain, min_interval, cache, sleep_fn=sleep_fn, time_fn=time_fn)

	# 3. Mode sesi: tegakkan rate limits, lock, dan delay
	effective_state = storage_state or config.storage_state
	acc_name = crawler_account_name or config.crawler_account

	lock_acquired = False
	if mode == "session":
		if not effective_state and acc_name:
			try:
				from sentra_ats.bgc.crawler_session import get_decrypted_storage_state
				effective_state = get_decrypted_storage_state(acc_name)
			except Exception:
				pass

		if acc_name and not is_mock:
			from sentra_ats.bgc.crawler_session import (
				acquire_crawler_account_lock,
				check_and_update_crawler_rate_limits,
				enforce_crawler_delay,
			)

			# Rate limit and lock errors must stop the request, never be swallowed
			try:
				check_and_update_crawler_rate_limits(acc_name)
			except Exception as e:
				raise FetchError(f"Crawler account '{acc_name}' rate limit: {e}") from e
			if not acquire_crawler_account_lock(acc_name):
				raise FetchError(f"Crawler account '{acc_name}' is in use by another request")
			lock_acquired = True
			try:
				enforce_crawler_delay(acc_name, sleep_fn=sleep_fn, time_fn=time_fn)
			except Exception:
				pass

	# 4. Validasi Mode Stealth
	if mode == "stealth" and not is_mock:
		if not is_scrapling_browser_installed():
			raise StealthBrowserNotInstalledError("Stealth mode active but browser is not installed")

	cookies_list = effective_state.get("cookies", []) if isinstance(effective_state, dict) else []
	cookie_dict = {c["name"]: c["value"] for c in cookies_list if "name" in c and "value" in c}

	status = 200
	body = ""
	res_page = None

	try:
		if raw_fetch_fn:
			raw_res = raw_fetch_fn(url=url, mode=mode, config=config, method=norm_method)
			if isinstance(raw_res, FetchResult):
				status = raw_res.status
				body = raw_res.body
				res_page = raw_res.page
			elif isinstance(raw_res, tuple) and len(raw_res) == 3:
				status, body, res_page = raw_res
			elif isinstance(raw_res, tuple) and len(raw_res) == 2:
				status, body = raw_res
				res_page = None
			else:
				status, body, res_page = 200, str(raw_res or ""), None
		else:
			if mode == "stealth" or (mode == "session" and is_scrapling_browser_installed()):
				from scrapling.fetchers import StealthyFetcher
				stealth_kwargs: dict[str, Any] = {
					"timeout": config.timeout_seconds * 1000,
					"headless": True,
					# JS challenges (e.g. TikTok WAF) reload the page; without this the challenge page is returned
					"network_idle": True,
				}
				if cookies_list:
					stealth_kwargs["cookies"] = cookies_list
				res = StealthyFetcher.fetch(url, **stealth_kwargs)
				status = res.status
				body = res.text if hasattr(res, "text") else str(res.body, errors="ignore")
				res_page = res
			elif mode in ("browser", "session"):
				from scrapling.fetchers import Fetcher
				browser_kwargs: dict[str, Any] = {
					"impersonate": "chrome",
					"stealthy_headers": True,
					"timeout": config.timeout_seconds,
				}
				if cookie_dict:
					browser_kwargs["cookies"] = cookie_dict

				if norm_method == "GET":
					res = Fetcher.get(url, **browser_kwargs)
				elif norm_method == "HEAD":
					from scrapling.fetchers.requests import __FetcherClientInstance__
					head_kwargs = dict(browser_kwargs)
					impersonate = head_kwargs.pop("impersonate", "chrome")
					stealth = head_kwargs.pop("stealthy_headers", True)
					res = __FetcherClientInstance__._make_request(
						"HEAD",
						url=url,
						impersonate=impersonate,
						stealth=stealth,
						**head_kwargs,
					)
				else:
					res = Fetcher.get(url, **browser_kwargs)

				status = res.status
				body = res.text if hasattr(res, "text") else str(getattr(res, "body", b""), errors="ignore")
				res_page = res
			else:
				# Mode Company
				from scrapling.fetchers import Fetcher
				req_headers = {"User-Agent": config.user_agent}
				company_kwargs: dict[str, Any] = {
					"impersonate": None,
					"stealthy_headers": False,
					"headers": req_headers,
					"timeout": config.timeout_seconds,
				}
				if cookie_dict:
					company_kwargs["cookies"] = cookie_dict

				if norm_method == "GET":
					res = Fetcher.get(url, **company_kwargs)
				elif norm_method == "HEAD":
					from scrapling.fetchers.requests import __FetcherClientInstance__
					head_kwargs = dict(company_kwargs)
					head_kwargs.pop("stealthy_headers", None)
					res = __FetcherClientInstance__._make_request(
						"HEAD",
						url=url,
						stealth=False,
						**head_kwargs,
					)
				else:
					res = Fetcher.get(url, **company_kwargs)

				status = res.status
				body = res.text if hasattr(res, "text") else str(getattr(res, "body", b""), errors="ignore")
				res_page = res

	except Exception as e:
		if raw_fetch_fn:
			raise FetchNetworkError(f"Failed to fetch {url}: {e}") from e
		raise FetchNetworkError(f"Gagal mengambil {url}: {e}") from e
	finally:
		if lock_acquired:
			try:
				from sentra_ats.bgc.crawler_session import release_crawler_account_lock
				release_crawler_account_lock(acc_name)
			except Exception:
				pass

	content_bytes = b""
	if hasattr(res_page, "body") and isinstance(res_page.body, bytes):
		content_bytes = res_page.body
		body = content_bytes.decode("utf-8", errors="ignore")
	elif isinstance(body, bytes):
		content_bytes = body
		body = body.decode("utf-8", errors="ignore")
	elif isinstance(body, str):
		content_bytes = body.encode("utf-8", errors="ignore")

	if max_size_bytes and len(content_bytes) > max_size_bytes:
		raise FetchError(f"Ukuran berkas {len(content_bytes)} bytes melebihi batas {max_size_bytes} bytes")

	if res_page is None and Adaptor:
		res_page = Adaptor(body)

	is_blocked, reason = is_response_blocked(status, url, body)

	# Jika mode sesi mendapati checkpoint/challenge, tandai akun crawler
	if mode == "session" and acc_name and not is_mock:
		if is_blocked and (any(cp in url.lower() for cp in ("checkpoint", "challenge", "authwall")) or status in (401, 403, 429)):
			try:
				from sentra_ats.bgc.crawler_session import mark_crawler_account_challenge
				mark_crawler_account_challenge(acc_name, f"Crawler session encountered challenge/checkpoint at {url}")
			except Exception:
				pass

	return FetchResult(
		url=url,
		status=status,
		body=body,
		mode_used=mode,
		robots_ignored=robots_ignored,
		from_cache=False,
		page=res_page,
		content=content_bytes,
		is_login_wall=(reason == "login required"),
		is_blocked=(reason == "blocked"),
		crawler_account=crawler_account_label,
	)


# 8. Fungsi Utama: fetch()
def fetch(
	url: str,
	config: FetchConfig | None = None,
	*,
	method: str = "GET",
	max_size_bytes: int | None = None,
	cache_backend: BaseCacheBackend | None = None,
	raw_fetch_fn: Callable[..., Any] | None = None,
	sleep_fn: Callable[[float], None] = time.sleep,
	time_fn: Callable[[], float] = time.time,
	is_mock: bool = False,
) -> FetchResult:
	"""
	Mengambil konten web melalui Scrapling dengan penegakan aturan:
	- Domain terlarang (Instagram, Facebook, TikTok, LinkedIn) selalu ditolak.
	- robots.txt dicek dan dicache 24 jam via Protego.
	- Mode identitas & stealth sesuai config.
	- Auto-escalate Company -> Browser -> stealth -> session saat terhalang.
	- Batas laju per domain via Redis/Memory.
	- Cache hasil GET 24 jam.
	"""
	if config is None:
		config = get_fetch_config_from_settings()

	blocked_domains = getattr(config, "blocked_domains", None)
	if is_forbidden_domain(url, blocked_domains=blocked_domains):
		raise ForbiddenDomainError(
			f"Akses pengambilan halaman ke domain '{get_domain(url)}' dilarang keras oleh kebijakan privasi & ketentuan layanan."
		)

	domain = get_domain(url)
	mock_mode = is_mock or bool(getattr(config, "is_mock", False))
	cache = cache_backend or get_default_cache_backend(is_mock=mock_mode)
	norm_method = method.upper()

	fetcher_type, default_mode = determine_mode(config, domain)
	has_session = bool(config.storage_state)
	if has_session:
		default_mode = f"{default_mode}+session"

	# Cek Cache 24 jam (hanya untuk request GET tanpa sesi)
	cache_key = get_cache_key(url, default_mode, norm_method)
	if norm_method == "GET" and not has_session:
		cached_data = cache.get(cache_key)
		if cached_data is not None and isinstance(cached_data, dict):
			body = cached_data.get("body", "")
			content_bytes = cached_data.get("content") or (body.encode("utf-8") if isinstance(body, str) else b"")
			if not body and content_bytes:
				body = content_bytes.decode("utf-8", errors="ignore")
			if max_size_bytes and len(content_bytes) > max_size_bytes:
				raise FetchError(f"Ukuran berkas {len(content_bytes)} bytes melebihi batas {max_size_bytes} bytes")
			page = Adaptor(body) if Adaptor else None
			return FetchResult(
				url=url,
				status=cached_data.get("status", 200),
				body=body,
				mode_used=default_mode,
				robots_ignored=cached_data.get("robots_ignored", False),
				from_cache=True,
				page=page,
				content=content_bytes,
			)

	# Jalur Tanpa Eskalasi Otomatis
	if not getattr(config, "auto_escalate", False):
		target_mode = "session" if has_session else fetcher_type
		res = _fetch_single_mode(
			url=url,
			mode=target_mode,
			config=config,
			cache=cache,
			domain=domain,
			norm_method=norm_method,
			max_size_bytes=max_size_bytes,
			storage_state=config.storage_state,
			crawler_account_name=config.crawler_account,
			raw_fetch_fn=raw_fetch_fn,
			sleep_fn=sleep_fn,
			time_fn=time_fn,
			is_mock=mock_mode,
		)
		res.mode_used = default_mode
		if norm_method == "GET" and res.status == 200 and not res.is_login_wall and not res.is_blocked and not has_session:
			cache.set(
				cache_key,
				{"status": res.status, "body": res.body, "robots_ignored": res.robots_ignored, "content": res.content},
				ttl=config.cache_ttl_seconds,
			)
		return res

	# Jalur Eskalasi Otomatis: Company -> Browser -> stealth -> session
	modes_to_try: list[str] = ["company", "browser"]

	stealth_allowed = False
	if config.stealth:
		if not config.stealth_domains:
			stealth_allowed = True
		else:
			clean_domains = [d.strip().lower() for d in config.stealth_domains if d.strip()]
			for sd in clean_domains:
				if domain == sd or domain.endswith("." + sd):
					stealth_allowed = True
					break

	if stealth_allowed and (mock_mode or is_scrapling_browser_installed()):
		modes_to_try.append("stealth")

	crawler_acc_name = config.crawler_account
	crawler_acc_label = None
	session_allowed = False

	if config.storage_state is not None:
		session_allowed = True
	elif getattr(config, "use_login_session", False):
		try:
			from sentra_ats.bgc.crawler_session import get_eligible_crawler_account_for_url
			c_acc = get_eligible_crawler_account_for_url(url)
			if c_acc:
				session_allowed = True
				crawler_acc_name = c_acc["name"]
				crawler_acc_label = c_acc.get("account_label")
		except Exception:
			pass

	if session_allowed:
		modes_to_try.append("session")

	chain: list[str] = []
	last_res: FetchResult | None = None

	for mode in modes_to_try:
		chain.append(mode)
		res = _fetch_single_mode(
			url=url,
			mode=mode,
			config=config,
			cache=cache,
			domain=domain,
			norm_method=norm_method,
			max_size_bytes=max_size_bytes,
			storage_state=config.storage_state,
			crawler_account_name=crawler_acc_name,
			crawler_account_label=crawler_acc_label,
			raw_fetch_fn=raw_fetch_fn,
			sleep_fn=sleep_fn,
			time_fn=time_fn,
			is_mock=mock_mode,
		)
		last_res = res

		if not res.is_blocked and not res.is_login_wall and res.status == 200:
			# Berhenti di percobaan pertama yang berhasil
			res.mode_used = ">".join(chain)
			if norm_method == "GET" and mode != "session" and not has_session:
				cache.set(
					get_cache_key(url, res.mode_used, norm_method),
					{"status": res.status, "body": res.body, "robots_ignored": res.robots_ignored, "content": res.content},
					ttl=config.cache_ttl_seconds,
				)
			return res

	# Bila seluruh mode yang diizinkan gagal
	if last_res:
		last_res.mode_used = ">".join(chain)
		return last_res

	raise FetchError(f"No fetch modes available to try for {url}")


def get_fetch_config_from_settings() -> FetchConfig:
	"""Membaca konfigurasi Background Check Settings dari Frappe."""
	try:
		import frappe
		settings = frappe.get_single("Background Check Settings")
		stealth_domains_raw = settings.fetch_stealth_domains or ""
		stealth_domains = [d.strip() for d in stealth_domains_raw.split("\n") if d.strip()]
		blocked_domains = get_blocked_domains()

		return FetchConfig(
			respect_robots=bool(settings.fetch_respect_robots),
			identity=settings.fetch_identity or "Company",
			user_agent=settings.fetch_user_agent or "HRIS Background Check (+hr@example.com)",
			stealth=bool(settings.fetch_stealth_mode),
			stealth_domains=stealth_domains,
			blocked_domains=blocked_domains,
			rate_limit_per_minute=settings.rate_limit_per_minute or 30,
			cache_ttl_seconds=86400,
			timeout_seconds=15,
			auto_escalate=bool(getattr(settings, "fetch_auto_escalate", 0)),
			use_login_session=bool(getattr(settings, "fetch_use_login_session", 0)),
		)
	except Exception:
		return FetchConfig(blocked_domains=list(DEFAULT_BLOCKED_DOMAINS))

