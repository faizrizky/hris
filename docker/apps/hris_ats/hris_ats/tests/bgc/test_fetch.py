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


@pytest.fixture(autouse=True)
def setup_test_site_secret(monkeypatch):
	"""Pastikan terdapat secret_key di conf untuk pengetesan HMAC saat isolasi pytest murni."""
	import frappe

	if hasattr(frappe, "local"):
		if not getattr(frappe.local, "conf", None):
			frappe.local.conf = {}
		frappe.local.conf["secret_key"] = "test_pytest_hmac_secret_key"


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

	# 4. Halaman publik panjang dengan tautan 'Sign in' di navigasi (seperti GitHub) BUKAN halaman login
	github_profile_html = """
	<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="utf-8">
		<title>The Octocat (octocat) · GitHub</title>
	</head>
	<body>
		<header>
			<nav>
				<a href="/login" class="HeaderMenu-link">Sign in</a>
				<a href="/signup" class="HeaderMenu-link">Sign up</a>
			</nav>
		</header>
		<main>
			<div class="h-card">
				<img alt="Avatar" src="https://avatars.githubusercontent.com/u/583231" />
				<h1>The Octocat</h1>
				<span>octocat</span>
				<div class="user-profile-bio">GitHub's mascot and open-source enthusiast.</div>
				<div class="user-profile-location">San Francisco, CA</div>
				<div>followers: 12000, following: 9, repositories: 8</div>
				<div>contributions: 540 in the last year, starred: 42</div>
			</div>
		</main>
	</body>
	</html>
	"""
	gh_title, gh_preview = extract_title_and_text(github_profile_html)
	assert "The Octocat" in gh_title
	assert detect_login_page("https://github.com/octocat", github_profile_html, gh_preview) is False

	# 5. Halaman login asli (ada tag title login dan form password)
	github_login_html = """
	<!DOCTYPE html>
	<html>
	<head><title>Sign in to GitHub · GitHub</title></head>
	<body>
		<form action="/session" method="post">
			<input type="text" name="login" id="login_field" />
			<input type="password" name="password" id="password" />
			<input type="submit" value="Sign in" />
		</form>
	</body>
	</html>
	"""
	_gh_login_title, gh_login_preview = extract_title_and_text(github_login_html)
	assert detect_login_page("https://github.com/login", github_login_html, gh_login_preview) is True
	# Bahkan jika URL tidak ada kata login, form password tetap terdeteksi
	assert detect_login_page("https://github.com/session_check", github_login_html, gh_login_preview) is True

	# 6. Cuplikan teks bersih terpotong pada maksimal 300 karakter tanpa script/style
	long_html = "<html><style>.btn{color:red}</style><script>alert(1)</script><body>" + ("Kata " * 100) + "</body></html>"
	_, clean_300 = extract_title_and_text(long_html)
	assert len(clean_300) <= 300
	assert ".btn" not in clean_300
	assert "alert" not in clean_300


def test_instagram_and_social_login_detection_signals():
	"""Pengujian deteksi login bertingkat: fixture profil bergaya Instagram dengan form login tersembunyi,
	halaman login sungguhan, LinkedIn authwall, Facebook checkpoint, dan decoding entitas HTML.
	"""
	from hris_ats.hris_ats.doctype.background_check_settings.background_check_settings import (
		detect_login_page,
		extract_page_signals,
	)

	# 1. Profil publik bergaya Instagram
	instagram_profile_html = """
	<!DOCTYPE html>
	<html>
	<head>
		<title>Nama (&#064;handle) &amp; Co • Instagram photos and videos</title>
		<meta property="og:title" content="Nama (&#064;handle) • Instagram photos and videos">
		<meta property="og:description" content="1,367 Followers, 414 Following, 25 Posts - See Instagram photos and videos from Nama (@handle)">
	</head>
	<body>
		<header>
			Instagram Log In Sign Up Meta About Blog Jobs Help API Privacy Terms
		</header>
		<div style="display:none" class="login-dialog-modal">
			<form action="/accounts/login" method="post">
				<input type="text" name="username">
				<input type="password" name="password">
				<button type="submit">Log in</button>
			</form>
		</div>
		<main>
			<h1>Nama</h1>
			<span>@handle</span>
			<div class="user-bio">Product Designer based in Jakarta. Creating user-centric experiences.</div>
			<div>1,367 followers, 414 following, 25 posts</div>
			<div>""" + ("Public post caption and media details for candidate. " * 100) + """</div>
		</main>
		<footer>
			Meta About Blog Jobs Help API Privacy Terms
		</footer>
	</body>
	</html>
	"""
	signals = extract_page_signals(instagram_profile_html)
	# Judul ter-unescape dengan benar
	assert signals["title"] == "Nama (@handle) & Co • Instagram photos and videos"
	assert "&#064;" not in signals["title"]
	assert "&amp;" not in signals["title"]
	assert "@handle" in signals["title"]
	# og:description ter-unescape
	assert "1,367 Followers, 414 Following, 25 Posts" in signals["og_description"]
	# Preview diambil dari konten utama (<main>), bukan menu awal
	assert "Instagram Log In Sign Up" not in signals["preview"]
	assert "Nama" in signals["preview"] or "Product Designer" in signals["preview"]
	# Form password terdeteksi di DOM
	assert signals["has_password_input"] is True
	# Teks penuh > 5000 karakter
	assert signals["text_len"] > 5000
	# Profil publik bukan halaman login
	assert detect_login_page("https://www.instagram.com/handle/", instagram_profile_html, signals["preview"]) is False

	# 2. Halaman login sungguhan Instagram
	real_ig_login_html = """
	<!DOCTYPE html>
	<html>
	<head><title>Login • Instagram</title></head>
	<body>
		<form action="/accounts/login" method="post">
			<input type="text" name="username">
			<input type="password" name="password">
			<button type="submit">Log in</button>
		</form>
		<p>Don't have an account? Sign up</p>
	</body>
	</html>
	"""
	ig_signals = extract_page_signals(real_ig_login_html)
	assert detect_login_page("https://www.instagram.com/accounts/login/", real_ig_login_html, ig_signals["preview"]) is True
	assert detect_login_page("https://www.instagram.com/", real_ig_login_html, ig_signals["preview"]) is True

	# 3. Authwall LinkedIn
	linkedin_authwall_html = """
	<!DOCTYPE html>
	<html>
	<head><title>Sign Up | LinkedIn</title></head>
	<body>
		<h2>Join LinkedIn or sign in to view this profile</h2>
		<p>Sign in to see full profile, connections, and posts.</p>
	</body>
	</html>
	"""
	assert detect_login_page("https://www.linkedin.com/authwall", linkedin_authwall_html, "Join LinkedIn") is True

	# 4. Checkpoint Facebook
	fb_checkpoint_html = """
	<!DOCTYPE html>
	<html>
	<head><title>Security Check Required | Facebook</title></head>
	<body>
		<h2>Please confirm your identity to continue</h2>
	</body>
	</html>
	"""
	assert detect_login_page("https://www.facebook.com/checkpoint/12345", fb_checkpoint_html, "Security Check") is True


def test_hmac_cache_key_generation():
	"""Pengujian kunci cache HMAC-SHA256: tidak membocorkan nama kandidat / URL mentah ke Redis, dan gagal tertutup bila rahasia tidak ada."""
	import types
	from unittest.mock import patch

	import pytest

	from hris_ats.bgc.fetch import get_cache_key, get_site_secret, hash_url

	# 1. Gagal tertutup (fail-closed) jika tidak ada secret_key maupun encryption_key
	fake_empty_local = types.SimpleNamespace(conf={})
	with patch("frappe.local", fake_empty_local):
		with pytest.raises(RuntimeError, match="fail-closed"):
			get_site_secret()

	# 2. Berhasil jika secret_key atau encryption_key tersedia
	fake_valid_local = types.SimpleNamespace(conf={"secret_key": "my_super_secret_key"})
	with patch("frappe.local", fake_valid_local):
		secret = get_site_secret()
		assert secret == b"my_super_secret_key"

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


def test_get_blocked_domains_honors_intentionally_empty_list(monkeypatch):
	"""Belum pernah disimpan -> bawaan; sengaja dikosongkan -> kosong; selain itu -> isi daftar."""
	import frappe

	import hris_ats.bgc.fetch as fetch_mod

	monkeypatch.setattr(frappe, "db", object(), raising=False)

	monkeypatch.setattr(fetch_mod, "read_stored_blocked_domains", lambda: None)
	assert fetch_mod.get_blocked_domains() == list(fetch_mod.DEFAULT_BLOCKED_DOMAINS)

	monkeypatch.setattr(fetch_mod, "read_stored_blocked_domains", lambda: "")
	assert fetch_mod.get_blocked_domains() == []

	monkeypatch.setattr(fetch_mod, "read_stored_blocked_domains", lambda: "Facebook.com\n\n tiktok.com ")
	assert fetch_mod.get_blocked_domains() == ["facebook.com", "tiktok.com"]


def test_auto_escalation_chain_resolution():
	"""Pengujian 3a: auto-escalate menghasilkan rantai yang tepat:
	Company -> Browser -> stealth -> session.
	"""
	cache = MemoryCacheBackend()
	profile_html = "<html><head><title>Budi (@budi) • Instagram photos and videos</title><meta property='og:description' content='1,000 Followers, 500 Following, 10 Posts'></head><body><h1>Budi</h1></body></html>"
	login_html = "<html><head><title>Login • Instagram</title></head><body><form><input type='password'></form></body></html>"

	# 1. Company succeeds directly
	calls_1 = []
	def mock_fetch_1(url, mode, config, method):
		calls_1.append(mode)
		return 200, profile_html, None

	cfg1 = FetchConfig(auto_escalate=True, respect_robots=False, stealth=True, blocked_domains=[])
	res1 = fetch("https://example.com/user", config=cfg1, cache_backend=cache, raw_fetch_fn=mock_fetch_1, sleep_fn=lambda _: None, is_mock=True)
	assert res1.mode_used == "company"
	assert calls_1 == ["company"]
	assert res1.is_login_wall is False
	assert res1.is_blocked is False

	# 2. Company 403 -> Browser succeeds
	calls_2 = []
	def mock_fetch_2(url, mode, config, method):
		calls_2.append(mode)
		if mode == "company":
			return 403, "Forbidden", None
		return 200, profile_html, None

	cfg2 = FetchConfig(auto_escalate=True, respect_robots=False, stealth=True, blocked_domains=[])
	res2 = fetch("https://example.com/user", config=cfg2, cache_backend=cache, raw_fetch_fn=mock_fetch_2, sleep_fn=lambda _: None, is_mock=True)
	assert res2.mode_used == "company>browser"
	assert calls_2 == ["company", "browser"]
	assert res2.is_login_wall is False

	# 3. Company 403 -> Browser login page -> Stealth succeeds
	calls_3 = []
	def mock_fetch_3(url, mode, config, method):
		calls_3.append(mode)
		if mode == "company":
			return 403, "Forbidden", None
		if mode == "browser":
			return 200, login_html, None
		return 200, profile_html, None

	cfg3 = FetchConfig(auto_escalate=True, respect_robots=False, stealth=True, blocked_domains=[])
	res3 = fetch("https://example.com/user", config=cfg3, cache_backend=cache, raw_fetch_fn=mock_fetch_3, sleep_fn=lambda _: None, is_mock=True)
	assert res3.mode_used == "company>browser>stealth"
	assert calls_3 == ["company", "browser", "stealth"]
	assert res3.is_login_wall is False

	# 4. Company 403 -> Browser login -> Stealth login -> Session succeeds
	calls_4 = []
	def mock_fetch_4(url, mode, config, method):
		calls_4.append(mode)
		if mode == "company":
			return 403, "Forbidden", None
		if mode in ("browser", "stealth"):
			return 200, login_html, None
		return 200, profile_html, None

	cfg4 = FetchConfig(
		auto_escalate=True,
		respect_robots=False,
		stealth=True,
		storage_state={"cookies": [{"name": "sessionid", "value": "123"}]},
		blocked_domains=[],
	)
	res4 = fetch("https://example.com/user", config=cfg4, cache_backend=cache, raw_fetch_fn=mock_fetch_4, sleep_fn=lambda _: None, is_mock=True)
	assert res4.mode_used == "company>browser>stealth>session"
	assert calls_4 == ["company", "browser", "stealth", "session"]
	assert res4.is_login_wall is False


def test_auto_escalation_stops_at_highest_allowed_mode():
	"""Eskalasi berhenti pada mode tertinggi yang diizinkan Settings."""
	cache = MemoryCacheBackend()
	calls = []

	def mock_fetch_fail(url, mode, config, method):
		calls.append(mode)
		return 403, "Blocked", None

	# Stealth=False, use_login_session=False -> berhenti di Browser
	cfg = FetchConfig(auto_escalate=True, respect_robots=False, stealth=False, use_login_session=False, blocked_domains=[])
	res = fetch("https://example.com/user", config=cfg, cache_backend=cache, raw_fetch_fn=mock_fetch_fail, sleep_fn=lambda _: None, is_mock=True)
	assert res.mode_used == "company>browser"
	assert calls == ["company", "browser"]
	assert res.is_blocked is True


def test_no_auto_escalate_without_flag():
	"""Tanpa fetch_auto_escalate=1, tidak ada eskalasi."""
	cache = MemoryCacheBackend()
	calls = []

	def mock_fetch(url, mode, config, method):
		calls.append(mode)
		return 403, "Blocked", None

	cfg = FetchConfig(auto_escalate=False, respect_robots=False, blocked_domains=[])
	res = fetch("https://example.com/user", config=cfg, cache_backend=cache, raw_fetch_fn=mock_fetch, sleep_fn=lambda _: None, is_mock=True)
	assert calls == ["company"]
	assert res.is_blocked is True


def test_repeated_login_pages_bounded_by_mode_count():
	"""Halaman login berulang tidak menghasilkan percobaan lebih dari jumlah mode yang ada."""
	cache = MemoryCacheBackend()
	login_html = "<html><head><title>Login • Instagram</title></head><body><form action='/login'><input type='password'></form></body></html>"
	calls = []

	def mock_fetch_login(url, mode, config, method):
		calls.append(mode)
		return 200, login_html, None

	cfg = FetchConfig(
		auto_escalate=True,
		respect_robots=False,
		stealth=True,
		storage_state={"cookies": [{"name": "sessionid", "value": "123"}]},
		blocked_domains=[],
	)
	res = fetch("https://example.com/user", config=cfg, cache_backend=cache, raw_fetch_fn=mock_fetch_login, sleep_fn=lambda _: None, is_mock=True)
	assert len(calls) == 4
	assert calls == ["company", "browser", "stealth", "session"]
	assert res.mode_used == "company>browser>stealth>session"
	assert res.is_login_wall is True

