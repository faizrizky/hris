# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Unit test untuk lapisan bgc/fetch.py (tanpa dependensi frappe, berbasis pytest)."""

from __future__ import annotations

import pytest

from hris_ats.bgc.fetch import (
	FetchConfig,
	FetchResult,
	ForbiddenDomainError,
	MemoryCacheBackend,
	RobotsDisallowedError,
	StealthBrowserNotInstalledError,
	determine_mode,
	fetch,
	get_domain,
	is_forbidden_domain,
)


def test_domain_extraction_and_forbidden_check():
	assert get_domain("https://sub.instagram.com/user") == "sub.instagram.com"
	assert get_domain("https://Facebook.COM:8080/path") == "facebook.com"
	assert get_domain("https://github.com/torvalds") == "github.com"

	assert is_forbidden_domain("https://www.instagram.com/test") is True
	assert is_forbidden_domain("https://instagr.am/p/123") is True
	assert is_forbidden_domain("https://m.facebook.com/user") is True
	assert is_forbidden_domain("https://fb.com/user") is True
	assert is_forbidden_domain("https://tiktok.com/@user") is True
	assert is_forbidden_domain("https://id.linkedin.com/in/user") is True
	assert is_forbidden_domain("https://lnkd.in/abc") is True

	# Domain legal
	assert is_forbidden_domain("https://github.com/user") is False
	assert is_forbidden_domain("https://putusan3.mahkamahagung.go.id/direktori") is False


def test_forbidden_domains_always_rejected():
	cache = MemoryCacheBackend()

	# Coba berbagai kombinasi config
	configs = [
		FetchConfig(identity="Company", respect_robots=True, stealth=False),
		FetchConfig(identity="Browser", respect_robots=False, stealth=False),
		FetchConfig(identity="Browser", respect_robots=True, stealth=True, stealth_domains=["instagram.com"]),
	]

	for cfg in configs:
		with pytest.raises(ForbiddenDomainError):
			fetch("https://www.instagram.com/john_doe", config=cfg, cache_backend=cache)

		with pytest.raises(ForbiddenDomainError):
			fetch("https://facebook.com/profile.php", config=cfg, cache_backend=cache)

		with pytest.raises(ForbiddenDomainError):
			fetch("https://tiktok.com/@test", config=cfg, cache_backend=cache)

		with pytest.raises(ForbiddenDomainError):
			fetch("https://www.linkedin.com/in/candidate", config=cfg, cache_backend=cache)


def test_determine_mode_combinations():
	# 1. Company default
	c1 = FetchConfig(identity="Company", respect_robots=True, stealth=False)
	assert determine_mode(c1, "example.com") == ("company", "company+robots")

	c2 = FetchConfig(identity="Company", respect_robots=False, stealth=False)
	assert determine_mode(c2, "example.com") == ("company", "company")

	# 2. Browser
	b1 = FetchConfig(identity="Browser", respect_robots=True, stealth=False)
	assert determine_mode(b1, "example.com") == ("browser", "browser+robots")

	b2 = FetchConfig(identity="Browser", respect_robots=False, stealth=False)
	assert determine_mode(b2, "example.com") == ("browser", "browser")

	# 3. Stealth dengan domain spesifik
	s1 = FetchConfig(
		identity="Company",
		respect_robots=True,
		stealth=True,
		stealth_domains=["mahkamahagung.go.id"],
	)
	assert determine_mode(s1, "putusan3.mahkamahagung.go.id") == ("stealth", "stealth+robots")
	# Domain lain jatuh ke identity Company
	assert determine_mode(s1, "github.com") == ("company", "company+robots")

	# 4. Stealth untuk semua domain (daftar kosong)
	s2 = FetchConfig(identity="Browser", respect_robots=False, stealth=True, stealth_domains=[])
	assert determine_mode(s2, "anydomain.org") == ("stealth", "stealth")


def test_robots_txt_enforcement():
	cache = MemoryCacheBackend()
	robots_content = """
User-agent: *
Disallow: /private/
Disallow: /secret
"""
	# Pre-populate robots.txt cache untuk domain target
	cache.set("hris_ats:robots_txt:targetsite.org", robots_content, ttl=86400)

	call_count = 0

	def mock_raw_fetch(url, mode, config, method):
		nonlocal call_count
		call_count += 1
		return 200, "<html>OK</html>", None

	# Kasus 1: respect_robots = True, path dilarang -> Raises RobotsDisallowedError
	cfg_strict = FetchConfig(respect_robots=True)
	with pytest.raises(RobotsDisallowedError):
		fetch(
			"https://targetsite.org/private/data",
			config=cfg_strict,
			cache_backend=cache,
			raw_fetch_fn=mock_raw_fetch,
		)
	assert call_count == 0  # Halaman target tidak boleh diambil

	# Kasus 2: respect_robots = False, path dilarang -> Berhasil diambil, robots_ignored = True
	cfg_loose = FetchConfig(respect_robots=False)
	res = fetch(
		"https://targetsite.org/private/data",
		config=cfg_loose,
		cache_backend=cache,
		raw_fetch_fn=mock_raw_fetch,
	)
	assert res.status == 200
	assert res.robots_ignored is True
	assert call_count == 1

	# Kasus 3: path diizinkan -> Berhasil diambil, robots_ignored = False
	res_allowed = fetch(
		"https://targetsite.org/public/data",
		config=cfg_strict,
		cache_backend=cache,
		raw_fetch_fn=mock_raw_fetch,
	)
	assert res_allowed.status == 200
	assert res_allowed.robots_ignored is False


def test_stealth_without_browser_raises_exception(monkeypatch):
	cache = MemoryCacheBackend()
	# Paksa status browser terdeteksi belum terpasang
	monkeypatch.setattr("hris_ats.bgc.fetch.is_scrapling_browser_installed", lambda: False)

	cfg = FetchConfig(stealth=True, stealth_domains=[])
	with pytest.raises(StealthBrowserNotInstalledError) as exc_info:
		fetch("https://cloudflare-protected.org", config=cfg, cache_backend=cache)

	assert "Stealth mode active but browser is not installed" in str(exc_info.value)


def test_cache_hit_does_not_hit_network():
	cache = MemoryCacheBackend()
	cfg = FetchConfig(respect_robots=False, cache_ttl_seconds=86400)

	network_calls = 0

	def mock_raw_fetch(url, mode, config, method):
		nonlocal network_calls
		network_calls += 1
		return 200, "<html><body><h1>Fresh Data</h1></body></html>", None

	# Panggilan 1: Ambil dari network
	res1 = fetch(
		"https://api.github.com/users/octocat",
		config=cfg,
		cache_backend=cache,
		raw_fetch_fn=mock_raw_fetch,
	)
	assert res1.from_cache is False
	assert network_calls == 1
	assert "Fresh Data" in res1.body

	# Panggilan 2: Harus dari cache, network_calls tetap 1
	res2 = fetch(
		"https://api.github.com/users/octocat",
		config=cfg,
		cache_backend=cache,
		raw_fetch_fn=mock_raw_fetch,
	)
	assert res2.from_cache is True
	assert network_calls == 1
	assert "Fresh Data" in res2.body
	assert res2.page is not None
	assert res2.page.css("h1::text").get() == "Fresh Data"


def test_rate_limiting_enforced():
	cache = MemoryCacheBackend()
	cfg = FetchConfig(rate_limit_per_minute=30, respect_robots=False)
	# min_interval = 60 / 30 = 2.0 detik

	slept_durations = []
	current_time = 1000.0

	def mock_sleep(duration):
		nonlocal current_time
		slept_durations.append(duration)
		current_time += duration

	def mock_time():
		return current_time

	def mock_raw_fetch(url, mode, config, method):
		return 200, "OK", None

	# Panggilan 1 pada t = 1000.0
	fetch(
		"https://rate-test.org/page1",
		config=cfg,
		cache_backend=cache,
		raw_fetch_fn=mock_raw_fetch,
		sleep_fn=mock_sleep,
		time_fn=mock_time,
	)
	assert len(slept_durations) == 0

	# Panggilan 2 setelah 0.5 detik (t = 1000.5) ke domain yang sama
	current_time = 1000.5
	fetch(
		"https://rate-test.org/page2",
		config=cfg,
		cache_backend=cache,
		raw_fetch_fn=mock_raw_fetch,
		sleep_fn=mock_sleep,
		time_fn=mock_time,
	)
	# Harus tidur selama 2.0 - 0.5 = 1.5 detik
	assert len(slept_durations) == 1
	assert pytest.approx(slept_durations[0], 0.01) == 1.5


def test_dynamic_blocked_domains_and_subdomains():
	"""Pengujian 3a: domain dikeluarkan -> bisa diambil, ditambahkan lagi -> ditolak, subdomain ikut."""
	# 1. Custom list memblokir linkedin.com dan instagram.com
	custom_blocked = ["instagram.com", "linkedin.com"]

	# Subdomain harus ikut terblokir
	assert is_forbidden_domain("https://sub.instagram.com/user", blocked_domains=custom_blocked) is True
	assert is_forbidden_domain("https://api.linkedin.com/v1", blocked_domains=custom_blocked) is True
	assert is_forbidden_domain("https://instagram.com/user", blocked_domains=custom_blocked) is True

	# Domain yang dikeluarkan dari daftar (misal facebook.com tidak ada di custom_blocked) -> BISA diambil
	assert is_forbidden_domain("https://facebook.com/profile", blocked_domains=custom_blocked) is False

	# Ditambahkan lagi -> Ditolak
	updated_blocked = [*custom_blocked, "facebook.com"]
	assert is_forbidden_domain("https://facebook.com/profile", blocked_domains=updated_blocked) is True
	assert is_forbidden_domain("https://m.facebook.com/profile", blocked_domains=updated_blocked) is True

	# 2. Pengujian integrasi fetch() dengan blocked_domains di FetchConfig
	cache = MemoryCacheBackend()

	def fake_raw_fetch(url, mode, config, method):
		return 200, "<html><title>Profile</title><body>Public User Profile</body></html>", None

	# Saat instagram.com terdaftar di config -> ditolak
	cfg_blocked = FetchConfig(identity="Company", blocked_domains=["instagram.com"])
	with pytest.raises(ForbiddenDomainError):
		fetch("https://instagram.com/user", config=cfg_blocked, cache_backend=cache, raw_fetch_fn=fake_raw_fetch)

	# Saat instagram.com dikeluarkan dari blocked_domains -> berhasil diambil
	cfg_allowed = FetchConfig(identity="Company", blocked_domains=["tiktok.com"])
	res = fetch("https://instagram.com/user", config=cfg_allowed, cache_backend=cache, raw_fetch_fn=fake_raw_fetch)
	assert res.status == 200
	assert "Public User Profile" in res.body


def test_login_page_detection_and_title_extraction():
	"""Pengujian 3c: deteksi halaman login dan ekstraksi title serta 300 char display text."""
	from hris_ats.hris_ats.doctype.background_check_settings.background_check_settings import (
		detect_login_page,
		extract_title_and_text,
	)

	# 1. Deteksi berbasis URL login/checkpoint
	assert detect_login_page("https://www.instagram.com/accounts/login/", "any content", "any text") is True
	assert detect_login_page("https://linkedin.com/checkpoint/challenge", "any content", "any text") is True
	assert detect_login_page("https://example.com/authwall", "any content", "any text") is True
	assert detect_login_page("https://example.com/signin", "any content", "any text") is True

	# 2. Deteksi berbasis teks pendek berisi instruksi login tanpa profil
	short_login_page = "Please log in to continue or sign in with your username and password."
	assert detect_login_page("https://example.com/user", short_login_page, short_login_page) is True

	# 3. Halaman profil normal dengan posts dan bio BUKAN halaman login
	profile_html = "<html><title>Budi Santoso (@budis)</title><body><h1>Budi Santoso</h1><p>Software Engineer in Jakarta. Posts: 120. Followers: 1500.</p></body></html>"
	title, preview = extract_title_and_text(profile_html)
	assert title == "Budi Santoso (@budis)"
	assert "Software Engineer in Jakarta" in preview
	assert detect_login_page("https://example.com/budis", profile_html, preview) is False

	# 4. Cuplikan teks bersih terpotong pada maksimal 300 karakter tanpa script/style
	long_html = "<html><style>.btn{color:red}</style><script>alert(1)</script><body>" + ("Kata " * 100) + "</body></html>"
	_, clean_300 = extract_title_and_text(long_html)
	assert len(clean_300) <= 300
	assert ".btn" not in clean_300
	assert "alert" not in clean_300


def test_hmac_cache_key_generation():
	"""Pengujian kunci cache HMAC-SHA256: tidak membocorkan nama kandidat / URL mentah ke Redis."""
	from hris_ats.bgc.fetch import get_cache_key, hash_url

	url1 = "https://putusan3.mahkamahagung.go.id/direktori/search/q/Budi%20Santoso.html"
	url2 = "https://putusan3.mahkamahagung.go.id/direktori/search/q/Joko%20Widodo.html"

	key1 = get_cache_key(url1, "company", "GET")
	key2 = get_cache_key(url2, "company", "GET")

	# Pastikan format kunci terstruktur
	assert key1.startswith("hris_ats:fetch_cache:company:GET:")
	assert key2.startswith("hris_ats:fetch_cache:company:GET:")

	# Pastikan nama kandidat dan URL mentah TIDAK muncul dalam kunci cache
	assert "Budi" not in key1
	assert "Santoso" not in key1
	assert "mahkamahagung" not in key1
	assert "http" not in key1.split(":", 4)[-1]

	# Pastikan hash adalah SHA-256 (64 hex characters)
	hash_part1 = key1.split(":")[-1]
	assert len(hash_part1) == 64
	assert int(hash_part1, 16) > 0

	# URL berbeda menghasilkan hash berbeda
	assert key1 != key2

	# URL sama menghasilkan hash yang identik
	assert get_cache_key(url1, "company", "GET") == key1


def test_get_default_cache_backend_fail_closed_in_live():
	"""Pengujian fallback cache: live mode gagal tertutup (fail-closed), test/mock fallback ke memory."""
	import types
	from unittest.mock import patch

	from hris_ats.bgc.fetch import (
		MemoryCacheBackend,
		RedisUnavailableError,
		get_default_cache_backend,
	)

	# 1. Saat mock=True -> MemoryCacheBackend diizinkan
	with patch("hris_ats.bgc.fetch.is_redis_available", return_value=False):
		backend_mock = get_default_cache_backend(is_mock=True)
		assert isinstance(backend_mock, MemoryCacheBackend)

	# 2. Saat in_test=True -> MemoryCacheBackend diizinkan
	fake_frappe = types.ModuleType("frappe")
	fake_frappe.flags = types.SimpleNamespace(in_test=True)
	with patch("hris_ats.bgc.fetch.is_redis_available", return_value=False):
		with patch.dict("sys.modules", {"frappe": fake_frappe}):
			backend_test = get_default_cache_backend(is_mock=False)
			assert isinstance(backend_test, MemoryCacheBackend)

	# 3. Saat mode live (bukan mock, bukan in_test) dan Redis mati -> RedisUnavailableError
	with patch("hris_ats.bgc.fetch.is_redis_available", return_value=False):
		with pytest.raises(RedisUnavailableError) as exc_info:
			get_default_cache_backend(is_mock=False)
		assert "Redis not available" in str(exc_info.value)


