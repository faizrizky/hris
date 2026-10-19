# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Lapisan pengambil halaman tunggal berbasis Scrapling untuk Background Check.
Menjamin kepatuhan terhadap domain terlarang, robots.txt (Protego), batas laju per-domain via Redis,
caching 24 jam, serta mode identitas (Company / Browser / Stealth).
"""

from __future__ import annotations

import hashlib
import hmac
import time
import urllib.parse
from collections.abc import Callable
from dataclasses import dataclass, field
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

	def set(self, key: str, value: Any, ttl: int | None = None) -> None:
		expiry = time.time() + ttl if ttl else None
		self._store[key] = (expiry, value)


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
	return f"hris_ats:fetch_cache:{mode}:{norm_method}:{url_hash}"


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

	rate_key = f"hris_ats:rate_limit:{domain}"
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

	robots_cache_key = f"hris_ats:robots_txt:{domain}"
	cached_robots = cache.get(robots_cache_key)

	if cached_robots is None:
		# Ambil robots.txt
		status, text = 404, ""
		if raw_fetch_fn:
			try:
				status, text = raw_fetch_fn(robots_url)
			except Exception:
				status, text = 500, ""
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
	fetcher_type, mode_used = determine_mode(config, domain)
	mock_mode = is_mock or bool(getattr(config, "is_mock", False))
	cache = cache_backend or get_default_cache_backend(is_mock=mock_mode)

	# Cek Cache 24 jam (hanya untuk request GET)
	norm_method = method.upper()
	cache_key = get_cache_key(url, mode_used, norm_method)
	if norm_method == "GET":
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
				mode_used=mode_used,
				robots_ignored=cached_data.get("robots_ignored", False),
				from_cache=True,
				page=page,
				content=content_bytes,
			)

	# Cek robots.txt
	robots_ignored = False
	if config.respect_robots or not config.respect_robots:
		_, robots_ignored = check_robots_txt(
			target_url=url,
			user_agent=config.user_agent,
			respect_robots=config.respect_robots,
			cache=cache,
		)

	# Batas laju (Rate limit per domain)
	min_interval = 60.0 / max(1, config.rate_limit_per_minute)
	enforce_rate_limit(domain, min_interval, cache, sleep_fn=sleep_fn, time_fn=time_fn)

	# Validasi Mode Stealth
	if fetcher_type == "stealth":
		if not is_scrapling_browser_installed():
			raise StealthBrowserNotInstalledError("Stealth mode active but browser is not installed")

	# Eksekusi Pengambilan Konten
	if raw_fetch_fn:
		# Custom mock hook untuk testing
		try:
			status, body, res_page = raw_fetch_fn(url=url, mode=fetcher_type, config=config, method=norm_method)
		except Exception as e:
			raise FetchNetworkError(f"Failed to fetch {url}: {e}") from e
	else:
		try:
			if fetcher_type == "stealth":
				from scrapling.fetchers import StealthyFetcher
				res = StealthyFetcher.fetch(
					url,
					timeout=config.timeout_seconds * 1000,
					headless=True,
				)
				status = res.status
				body = res.text if hasattr(res, "text") else str(res.body, errors="ignore")
				res_page = res
			elif fetcher_type == "browser":
				from scrapling.fetchers import Fetcher
				if norm_method == "GET":
					res = Fetcher.get(
						url,
						impersonate="chrome",
						stealthy_headers=True,
						timeout=config.timeout_seconds,
					)
				elif norm_method == "HEAD":
					from scrapling.fetchers.requests import __FetcherClientInstance__
					res = __FetcherClientInstance__._make_request(
						"HEAD",
						url=url,
						impersonate="chrome",
						stealth=True,
						timeout=config.timeout_seconds,
					)
				else:
					res = Fetcher.get(url, impersonate="chrome", stealthy_headers=True, timeout=config.timeout_seconds)

				status = res.status
				body = res.text if hasattr(res, "text") else str(getattr(res, "body", b""), errors="ignore")
				res_page = res
			else:
				# Mode Company (identitas resmi)
				from scrapling.fetchers import Fetcher
				req_headers = {"User-Agent": config.user_agent}
				if norm_method == "GET":
					res = Fetcher.get(
						url,
						impersonate=None,
						stealthy_headers=False,
						headers=req_headers,
						timeout=config.timeout_seconds,
					)
				elif norm_method == "HEAD":
					from scrapling.fetchers.requests import __FetcherClientInstance__
					res = __FetcherClientInstance__._make_request(
						"HEAD",
						url=url,
						impersonate=None,
						stealth=False,
						headers=req_headers,
						timeout=config.timeout_seconds,
					)
				else:
					res = Fetcher.get(
						url,
						impersonate=None,
						stealthy_headers=False,
						headers=req_headers,
						timeout=config.timeout_seconds,
					)

				status = res.status
				body = res.text if hasattr(res, "text") else str(getattr(res, "body", b""), errors="ignore")
				res_page = res

		except Exception as e:
			raise FetchNetworkError(f"Gagal mengambil {url}: {e}") from e

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

	# Buat Adaptor bila res_page belum memiliki selektor
	if res_page is None and Adaptor:
		res_page = Adaptor(body)

	# Simpan ke cache bila GET dan berhasil (status 200)
	if norm_method == "GET" and status == 200:
		cache.set(
			cache_key,
			{"status": status, "body": body, "robots_ignored": robots_ignored, "content": content_bytes},
			ttl=config.cache_ttl_seconds,
		)

	return FetchResult(
		url=url,
		status=status,
		body=body,
		mode_used=mode_used,
		robots_ignored=robots_ignored,
		from_cache=False,
		page=res_page,
		content=content_bytes,
	)


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
		)
	except Exception:
		return FetchConfig(blocked_domains=list(DEFAULT_BLOCKED_DOMAINS))
