# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Unit test untuk lapisan media sosial Fase 3:
- Penjaga persetujuan kandidat (assert_social_consent)
- Adaptor platform (Instagram, Facebook, TikTok, LinkedIn) terhadap fixture sintetis
- Kepastian penulis komentar dan penyamaran mention (@[user])
- Batasan max_posts dan max_comments
- Manajemen sesi crawler (lock, rate limit, dan penanganan challenge)
"""

from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import pytest

from hris_ats.bgc.consent import SocialConsentError, assert_social_consent
from hris_ats.bgc.crawler_session import (
	acquire_crawler_account_lock,
	enforce_crawler_delay,
	mark_crawler_account_challenge,
	release_crawler_account_lock,
)
from hris_ats.bgc.fetch import FetchConfig, FetchResult
from hris_ats.bgc.providers.social import get_social_adapter
from hris_ats.bgc.providers.social.base import clean_snippet
from hris_ats.bgc.providers.social.facebook import FacebookAdapter
from hris_ats.bgc.providers.social.instagram import InstagramAdapter
from hris_ats.bgc.providers.social.linkedin import LinkedInAdapter
from hris_ats.bgc.providers.social.tiktok import TikTokAdapter
from hris_ats.bgc.providers.social_public import SocialPublicProvider

FIXTURES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "fixtures", "social")


@pytest.fixture(autouse=True)
def setup_test_site_env(monkeypatch):
	import frappe
	if hasattr(frappe, "local"):
		if not getattr(frappe.local, "conf", None):
			frappe.local.conf = {}
		frappe.local.conf["secret_key"] = "test_pytest_hmac_secret_key"
		frappe.local.site = "ats-test.localhost"
		frappe.local.flags = getattr(frappe.local, "flags", None) or frappe._dict()
		frappe.local.flags.in_test = True
		frappe.local.message_log = []
		frappe.local.system_settings = frappe._dict({"time_zone": "Asia/Jakarta"})
	# Mock frappe._ to avoid translation DB queries in pure pytest
	monkeypatch.setattr(frappe, "_", lambda msg, *args, **kwargs: str(msg))


def _read_fixture(platform: str, filename: str) -> str:
	path = os.path.join(FIXTURES_DIR, platform, filename)
	with open(path, encoding="utf-8") as f:
		return f.read()


# ---------------------------------------------------------------------------
# 1. Penjaga Persetujuan Terpusat (Spesifikasi 3.1 & 3b)
# ---------------------------------------------------------------------------

class DummyScopeRow:
	def __init__(self, source: str, granted: int = 1):
		self.source = source
		self.granted = granted


class DummyAccount:
	def __init__(self, platform: str, username: str, social_consent: int = 1, profile_url: str = ""):
		self.platform = platform
		self.username = username
		self.social_consent = social_consent
		self.profile_url = profile_url


class DummyBGC:
	def __init__(self, consent_status: str = "Granted", sources: list[str] | None = None, method: str = "Candidate signature", file: str = ""):
		self.consent_status = consent_status
		sources = sources or ["Social Media"]
		self.consent_scope = [DummyScopeRow(s, 1) for s in sources]
		self.consent_method = method
		self.consent_file = file


def test_assert_social_consent_granted():
	bgc = DummyBGC(consent_status="Granted", sources=["Social Media"])
	acc = DummyAccount(platform="Instagram", username="robbyimamp", social_consent=1)
	# Harus lulus tanpa melempar SocialConsentError
	assert_social_consent(bgc, acc)


def test_assert_social_consent_rejected_status():
	bgc = DummyBGC(consent_status="Rejected", sources=["Social Media"])
	acc = DummyAccount(platform="Instagram", username="robbyimamp", social_consent=1)
	with pytest.raises(SocialConsentError, match="status: Rejected"):
		assert_social_consent(bgc, acc)


def test_assert_social_consent_missing_scope():
	bgc = DummyBGC(consent_status="Granted", sources=["Platform", "Article"])
	acc = DummyAccount(platform="Instagram", username="robbyimamp", social_consent=1)
	with pytest.raises(SocialConsentError, match="not granted"):
		assert_social_consent(bgc, acc)


def test_assert_social_consent_account_not_checked():
	bgc = DummyBGC(consent_status="Granted", sources=["Social Media"])
	acc = DummyAccount(platform="Instagram", username="robbyimamp", social_consent=0)
	with pytest.raises(SocialConsentError, match="did not consent"):
		assert_social_consent(bgc, acc)


def test_assert_social_consent_uploaded_document_missing_file():
	bgc = DummyBGC(consent_status="Granted", sources=["Social Media"], method="Uploaded document", file="")
	acc = DummyAccount(platform="Instagram", username="robbyimamp", social_consent=1)
	with pytest.raises(SocialConsentError, match="document file is missing"):
		assert_social_consent(bgc, acc)


def test_assert_social_consent_forbidden_domain():
	bgc = DummyBGC(consent_status="Granted", sources=["Social Media"])
	acc = DummyAccount(platform="DarkWeb", username="test", social_consent=1, profile_url="http://torhidden.onion")
	with pytest.raises(SocialConsentError, match="currently blocked"):
		assert_social_consent(bgc, acc, blocked_domains=["torhidden.onion"])


# ---------------------------------------------------------------------------
# 2. Instagram Adapter (Spesifikasi 5.5, 5.6 & Fixture Sintetis)
# ---------------------------------------------------------------------------

def test_instagram_adapter_profile_and_posts():
	html_content = _read_fixture("instagram", "profile_with_posts.html")
	adapter = InstagramAdapter()
	res = adapter.parse_profile(html_content, url="https://www.instagram.com/robbyimamp/")

	assert res["status"] == "Success"
	assert res["is_private"] is False
	assert res["display_name"] == "Robby Imam Prakoso"
	assert res["followers_count"] == 1367
	assert res["following_count"] == 414
	assert res["posts_count"] == 25
	assert len(res["posts"]) >= 2
	assert "Excited to launch our new HRIS screening engine" in res["posts"][0]["snippet"]


def test_instagram_adapter_login_wall():
	html_content = _read_fixture("instagram", "login_wall.html")
	adapter = InstagramAdapter()
	res = adapter.parse_profile(html_content, url="https://www.instagram.com/accounts/login/")

	assert res["status"] == "Failed"
	assert res["error"] == "login required"
	assert res["hint"] == "use candidate export"


def test_instagram_adapter_private_profile():
	html_content = _read_fixture("instagram", "private_or_empty.html")
	adapter = InstagramAdapter()
	res = adapter.parse_profile(html_content, url="https://www.instagram.com/janedoe/")

	assert res["status"] == "Failed"
	assert res["error"] == "private profile"
	assert res["is_private"] is True


def test_instagram_author_certainty_comments():
	html_content = _read_fixture("instagram", "profile_with_posts.html")
	adapter = InstagramAdapter()

	# Komentar milik kandidat (@robbyimamp) harus diambil
	candidate_comments, limitation = adapter.extract_candidate_comments(html_content, "robbyimamp")
	assert len(candidate_comments) == 1
	assert "Thank you everyone for the great feedback" in candidate_comments[0]["snippet"]
	assert limitation == "not exposed by platform"

	# Komentar dari pihak ketiga (stranger99) tidak boleh diambil bila username adalah kandidat
	stranger_comments, _ = adapter.extract_candidate_comments(html_content, "othercandidate")
	assert len(stranger_comments) == 0


# ---------------------------------------------------------------------------
# 3. Facebook Adapter
# ---------------------------------------------------------------------------

def test_facebook_adapter_profile_and_posts():
	html_content = _read_fixture("facebook", "profile_with_posts.html")
	adapter = FacebookAdapter()
	res = adapter.parse_profile(html_content, url="https://www.facebook.com/budisantoso")

	assert res["status"] == "Success"
	assert res["display_name"] == "Budi Santoso"
	assert len(res["posts"]) >= 1
	assert "open source ATS pipeline" in res["posts"][0]["snippet"]


def test_facebook_adapter_login_wall():
	html_content = _read_fixture("facebook", "login_wall.html")
	adapter = FacebookAdapter()
	res = adapter.parse_profile(html_content, url="https://www.facebook.com/login/")

	assert res["status"] == "Failed"
	assert res["error"] == "login required"


def test_facebook_adapter_not_found():
	html_content = _read_fixture("facebook", "private_or_empty.html")
	adapter = FacebookAdapter()
	res = adapter.parse_profile(html_content, url="https://www.facebook.com/unknown")

	assert res["status"] == "Failed"
	assert res["error"] == "profile not found"


def test_facebook_author_certainty_comments():
	html_content = _read_fixture("facebook", "profile_with_posts.html")
	adapter = FacebookAdapter()

	comments, limitation = adapter.extract_candidate_comments(html_content, "budisantoso")
	assert len(comments) == 1
	assert "Appreciate all the positive feedback" in comments[0]["snippet"]
	assert limitation == "not exposed by platform"

	# Komentar randomperson tidak boleh masuk untuk budisantoso
	assert not any("Is this open source?" in c["snippet"] for c in comments)


# ---------------------------------------------------------------------------
# 4. TikTok Adapter
# ---------------------------------------------------------------------------

def test_tiktok_adapter_profile_and_posts():
	html_content = _read_fixture("tiktok", "profile_with_posts.html")
	adapter = TikTokAdapter()
	res = adapter.parse_profile(html_content, url="https://www.tiktok.com/@sitirahma")

	assert res["status"] == "Success"
	assert res["display_name"] == "Siti Rahma"
	assert res["followers_count"] == 8500
	assert len(res["posts"]) == 2
	assert "Top 3 tips for software engineer" in res["posts"][0]["snippet"]
	assert res["posts"][0]["media_type"] == "Video"


def test_tiktok_adapter_login_wall():
	html_content = _read_fixture("tiktok", "login_wall.html")
	adapter = TikTokAdapter()
	res = adapter.parse_profile(html_content, url="https://www.tiktok.com/login")

	assert res["status"] == "Failed"
	assert res["error"] == "login required"


def test_tiktok_author_certainty_comments():
	html_content = _read_fixture("tiktok", "profile_with_posts.html")
	adapter = TikTokAdapter()

	comments, limitation = adapter.extract_candidate_comments(html_content, "sitirahma")
	assert len(comments) == 1
	assert "Check out the link in my bio" in comments[0]["snippet"]
	assert limitation == "not exposed by platform"


# ---------------------------------------------------------------------------
# 5. LinkedIn Adapter
# ---------------------------------------------------------------------------

def test_linkedin_adapter_profile_and_posts():
	html_content = _read_fixture("linkedin", "profile_with_posts.html")
	adapter = LinkedInAdapter()
	res = adapter.parse_profile(html_content, url="https://www.linkedin.com/in/ahmadfaiz/")

	assert res["status"] == "Success"
	assert res["display_name"] == "Ahmad Faiz"
	assert "Lead Software Architect" in res["bio"]
	assert res["location"] == "Jakarta"
	assert len(res["posts"]) >= 1
	assert "high-throughput background processing" in res["posts"][0]["snippet"]


def test_linkedin_adapter_comments_fixture():
	html_content = _read_fixture("linkedin", "comments.html")
	adapter = LinkedInAdapter()

	# Kandidat "Ahmad Faiz"
	comments, limitation = adapter.extract_candidate_comments(html_content, "ahmad faiz")
	assert len(comments) == 2
	assert "Great article on database isolation levels" in comments[0]["snippet"]
	assert "Honored to be part of the open source initiative" in comments[1]["snippet"]
	assert limitation is None

	# Komentar pihak ketiga "John Doe" wajib terbuang
	assert not any("Irrelevant third-party comment" in c["snippet"] for c in comments)


# ---------------------------------------------------------------------------
# 6. Mention Anonymization & Candidate Restrictions
# ---------------------------------------------------------------------------

def test_clean_snippet_anonymizes_mentions():
	raw = "Collab with @johndoe and @sarah_99 on the new project! Check @company/team."
	cleaned = clean_snippet(raw)
	assert "@johndoe" not in cleaned
	assert "@sarah_99" not in cleaned
	assert "@[user]" in cleaned


def test_clean_snippet_length_cap():
	long_text = "A" * 700
	cleaned = clean_snippet(long_text)
	assert len(cleaned) <= 500


# ---------------------------------------------------------------------------
# 7. SocialPublicProvider Integration & Max Limit Guards
# ---------------------------------------------------------------------------

def test_social_public_provider_mock_mode():
	bgc = DummyBGC(consent_status="Granted")
	acc = DummyAccount(platform="Instagram", username="robbyimamp", social_consent=1)

	provider = SocialPublicProvider()
	res = provider.crawl_account(bgc, acc, is_mock=True, max_posts=10, max_comments=10)

	assert res["status"] == "Success"
	assert res["mode_used"] == "mock"
	assert len(res["posts"]) == 1
	assert len(res["comments"]) == 1
	assert res["posts"][0]["finding_type"] == "Post"
	assert res["comments"][0]["finding_type"] == "Comment"


def test_social_public_provider_enforces_limits():
	bgc = DummyBGC(consent_status="Granted")
	acc = DummyAccount(platform="Instagram", username="robbyimamp", social_consent=1)

	fake_html = _read_fixture("instagram", "profile_with_posts.html")
	cfg = FetchConfig(blocked_domains=[])
	provider = SocialPublicProvider(config=cfg)

	def mock_fetch_fn(url, **kwargs):
		return FetchResult(
			url=url,
			status=200,
			body=fake_html,
			mode_used="company",
		)

	# Batasi ke 1 post
	res = provider.crawl_account(
		bgc,
		acc,
		is_mock=False,
		max_posts=1,
		max_comments=1,
		raw_fetch_fn=mock_fetch_fn,
	)

	assert len(res["posts"]) <= 1
	assert len(res["comments"]) <= 1


def test_candidate_comments_lookback_and_author_filter():
	"""Memastikan komentar kandidat menyaring lookback_months, kepastian penulis, dan max_comments."""
	from frappe.utils import add_months, now_datetime

	from hris_ats.bgc.providers.social.linkedin import LinkedInAdapter

	adapter = LinkedInAdapter()
	# Komentar dengan tanggal baru dan lama
	recent_date = str(now_datetime())
	old_date = str(add_months(now_datetime(), -24))  # 24 bulan lalu (di luar default 12 bulan)

	fake_comments_html = f"""
	<div class="comments-container">
		<article class="feed-shared-update-v2">
			<a class="update-components-actor__name">Ahmad Faiz</a>
			<time datetime="{recent_date}"></time>
			<div class="feed-shared-text">Recent comment by candidate @team.</div>
		</article>
		<article class="feed-shared-update-v2">
			<a class="update-components-actor__name">Ahmad Faiz</a>
			<time datetime="{old_date}"></time>
			<div class="feed-shared-text">Old comment from two years ago.</div>
		</article>
		<article class="feed-shared-update-v2">
			<a class="update-components-actor__name">Other Person</a>
			<time datetime="{recent_date}"></time>
			<div class="feed-shared-text">Comment by someone else.</div>
		</article>
		<article class="feed-shared-update-v2">
			<div class="feed-shared-text">Comment with missing author element.</div>
		</article>
	</div>
	"""

	# 1. Adaptor membuang penulis yang bukan kandidat dan tanpa penulis
	extracted, _ = adapter.extract_candidate_comments(fake_comments_html, "ahmad faiz")
	assert len(extracted) == 2
	assert all("Ahmad Faiz" in c.get("author", "Ahmad Faiz") for c in extracted)
	assert not any("someone else" in c["snippet"] for c in extracted)
	assert not any("missing author" in c["snippet"] for c in extracted)

	# 2. SocialPublicProvider memfilter lookback_months dan membatasi max_comments
	bgc = DummyBGC(consent_status="Granted")
	acc = DummyAccount(platform="LinkedIn", username="ahmadfaiz", social_consent=1)
	provider = SocialPublicProvider(config=FetchConfig(blocked_domains=[]))

	def mock_fetch(url, **kwargs):
		return FetchResult(url=url, status=200, body=fake_comments_html, mode_used="company")

	res = provider.crawl_account(
		bgc,
		acc,
		is_mock=False,
		max_posts=50,
		max_comments=10,
		lookback_months=12,
		raw_fetch_fn=mock_fetch,
	)

	# Hanya komentar dalam rentang 12 bulan yang masuk
	assert len(res["comments"]) == 1
	assert "Recent comment by candidate @[user]" in res["comments"][0]["snippet"]
	assert "Old comment" not in res["comments"][0]["snippet"]


# ---------------------------------------------------------------------------
# 8. Crawler Session Management (Rate Limits, Locks, Checkpoints)
# ---------------------------------------------------------------------------

def test_crawler_session_locks():
	account_name = "CRAWLER-TEST-001"
	# Lock pertama harus berhasil
	assert acquire_crawler_account_lock(account_name, timeout=10) is True
	# Lock kedua saat masih aktif harus gagal
	assert acquire_crawler_account_lock(account_name, timeout=10) is False
	# Release lock
	release_crawler_account_lock(account_name)
	# Lock berikutnya harus berhasil kembali
	assert acquire_crawler_account_lock(account_name, timeout=10) is True
	release_crawler_account_lock(account_name)


def test_crawler_delay_enforcement():
	mock_doc = MagicMock()
	mock_doc.name = "CRAWLER-DELAY-TEST"
	mock_doc.min_delay_seconds = 2
	mock_doc.jitter_seconds = 1
	mock_doc.last_used_on = None

	sleeps = []
	clock = [1000.0]
	# First request after a quiet period must not stall
	first = enforce_crawler_delay(mock_doc, sleep_fn=sleeps.append, time_fn=lambda: clock[0])
	assert first == 0.0
	assert sleeps == []

	# A follow-up right after must wait at least min_delay
	second = enforce_crawler_delay(mock_doc, sleep_fn=sleeps.append, time_fn=lambda: clock[0])
	assert second >= 2.0
	assert sleeps == [second]


def test_crawler_checkpoint_challenge_marks_account():
	account_name = "CRAWLER-TEST-002"
	mock_account_doc = MagicMock()
	mock_account_doc.name = account_name
	mock_account_doc.status = "Connected"

	with patch("frappe.get_doc", return_value=mock_account_doc), \
	     patch("frappe.get_all", return_value=["admin@example.com"]), \
	     patch("frappe.new_doc") as mock_new_doc:

		notif_mock = MagicMock()
		mock_new_doc.return_value = notif_mock

		mark_crawler_account_challenge(
			account_name,
			reason="Bot checkpoint encountered on profile request",
		)

		assert mock_account_doc.status == "Challenge"
		assert "Bot checkpoint" in mock_account_doc.last_error
		assert mock_account_doc.save.called
		assert notif_mock.insert.called
