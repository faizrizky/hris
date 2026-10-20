# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""SocialPublicProvider routing to the signed-in web API clients (TikTok used as the example)."""

from __future__ import annotations

import json
import time

import pytest

from hris_ats.bgc import consent, crawler_session
from hris_ats.bgc.consent import SocialConsentError
from hris_ats.bgc.fetch import FetchConfig, FetchResult
from hris_ats.bgc.providers import social_public
from hris_ats.bgc.providers.social.tiktok_api import TikTokApiClient
from hris_ats.bgc.providers.social_public import SocialPublicProvider
from hris_ats.tests.bgc.test_social import DummyAccount, DummyBGC, setup_test_site_env

NOW = int(time.time())
USER = {"userInfo": {"user": {"id": "7", "uniqueId": "cand", "secUid": "SEC", "nickname": "Cand"},
                     "stats": {"followerCount": 5}}, "statusCode": 0}
VIDEOS = {"itemList": [{"id": "1", "desc": "hi @pal", "createTime": NOW - 86400, "stats": {"commentCount": 1}},
                       {"id": "2", "desc": "", "createTime": NOW - 2 * 86400, "stats": {"commentCount": 0}}],
          "hasMore": False}
COMMENTS = {"comments": [{"cid": "c1", "text": "mine", "create_time": NOW, "user": {"unique_id": "cand"}}],
            "has_more": 0, "status_code": 0}


class Calls:
	def __init__(self):
		self.challenges = []
		self.locks = []
		self.html_fetches = 0
		self.clients = 0


@pytest.fixture
def env(monkeypatch):
	calls = Calls()
	for mod in (social_public, consent):
		monkeypatch.setattr(mod, "_", lambda msg, *a, **k: str(msg), raising=False)
	state = {"cookies": [{"name": "sessionid", "value": "s"}, {"name": "msToken", "value": "m"}]}
	monkeypatch.setattr(crawler_session, "get_eligible_crawler_account_for_url",
	                    lambda url: {"name": "CA-1", "account_label": "crawler-tt"})
	monkeypatch.setattr(crawler_session, "get_decrypted_storage_state", lambda name: state)
	monkeypatch.setattr(crawler_session, "check_and_update_crawler_rate_limits", lambda name: None)
	monkeypatch.setattr(crawler_session, "acquire_crawler_account_lock", lambda name, timeout=30: calls.locks.append("+") or True)
	monkeypatch.setattr(crawler_session, "release_crawler_account_lock", lambda name: calls.locks.append("-"))
	monkeypatch.setattr(crawler_session, "enforce_crawler_delay", lambda name, **kw: None)
	monkeypatch.setattr(crawler_session, "mark_crawler_account_challenge",
	                    lambda name, reason, status="Challenge": calls.challenges.append(reason))
	monkeypatch.setattr(crawler_session, "get_crawler_account_for_platform", lambda p: None)

	def fake_fetch(url, config=None, raw_fetch_fn=None):
		calls.html_fetches += 1
		return FetchResult(url=url, status=200, body="<html><title>Cand (@cand) | TikTok</title></html>", mode_used="company")

	monkeypatch.setattr(social_public.bgc_fetch, "fetch", fake_fetch)
	calls.state = state
	calls.routes = {}

	def make_client(platform, cookies, state=None):
		calls.clients += 1
		assert platform == "TikTok" and cookies["sessionid"] == "s"

		def http(url, headers, cookies, timeout):
			for key, (status, payload) in calls.routes.items():
				if key in url:
					return status, json.dumps(payload)
			return 404, "{}"

		return TikTokApiClient(cookies, http_get=http, sleep_fn=lambda s: None)

	monkeypatch.setattr(social_public, "_make_api_client", make_client)
	return calls


def _crawl(**kw):
	provider = SocialPublicProvider(config=FetchConfig(blocked_domains=[], use_login_session=True))
	acc = DummyAccount(platform="TikTok", username="@cand", social_consent=1)
	acc.name = "ACC-1"
	return provider.crawl_account(DummyBGC(consent_status="Granted"), acc, max_posts=10, max_comments=10, **kw)


def test_tiktok_routes_through_session_api(env):
	env.routes = {"/api/user/detail/": (200, USER), "/api/post/item_list/": (200, VIDEOS), "/api/comment/list/": (200, COMMENTS)}
	messages = []
	res = _crawl(progress=messages.append)
	assert res["status"] == "Success" and res["mode_used"] == "session-api" and res["crawler_account"] == "crawler-tt"
	assert [p["snippet"] for p in res["posts"]] == ["hi @[user]", "(post without caption)"]
	assert res["comments"][0]["snippet"] == "mine" and res["comments"][0]["finding_type"] == "Comment"
	for item in res["posts"] + res["comments"]:
		assert item["platform"] == "TikTok" and item["account"] == "ACC-1" and item["provenance"] == "Crawled (session)"
		assert not ({"pk", "comment_count", "author"} & set(item)) and not any(k.startswith("_") for k in item)
	assert res["followers_count"] == 5 and "_profile_loaded" not in res
	assert messages and messages[0] == "TikTok @cand: reading profile"
	assert env.locks == ["+", "-"] and env.html_fetches == 0


def test_consent_checked_before_any_network(env, monkeypatch):
	def throw(msg, exc=Exception, *a, **k):
		raise exc(msg)

	monkeypatch.setattr(consent.frappe, "throw", throw)
	provider = SocialPublicProvider(config=FetchConfig(blocked_domains=[], use_login_session=True))
	acc = DummyAccount(platform="TikTok", username="cand", social_consent=0)
	with pytest.raises(SocialConsentError):
		provider.crawl_account(DummyBGC(consent_status="Granted"), acc)
	assert env.clients == 0 and env.html_fetches == 0


def test_session_rejection_marks_challenge_and_falls_back_to_html(env):
	env.routes = {"/api/user/detail/": (200, {"statusCode": 8, "statusMsg": "user not login"})}
	res = _crawl()
	assert env.challenges and "TikTok session rejected" in env.challenges[0]
	assert env.html_fetches == 1 and res["mode_used"] == "company" and env.locks == ["+", "-"]


def test_without_auth_cookies_html_path_is_used(env):
	env.state["cookies"] = [{"name": "ttwid", "value": "anon"}]
	_crawl()
	assert env.clients == 0 and env.html_fetches == 1


def test_rate_limit_mid_crawl_keeps_partial_data(env):
	env.routes = {"/api/user/detail/": (200, USER), "/api/post/item_list/": (200, VIDEOS), "/api/comment/list/": (429, {})}
	res = _crawl()
	assert res["status"] == "Success" and len(res["posts"]) == 2 and res["comments"] == []
	assert "rate limit reached, partial data" in res["comment_limitation"]


def test_rate_limit_before_profile_fails(env):
	env.routes = {"/api/user/detail/": (429, {})}
	res = _crawl()
	assert res["status"] == "Failed" and "rate limit" in res["error"] and env.html_fetches == 0
