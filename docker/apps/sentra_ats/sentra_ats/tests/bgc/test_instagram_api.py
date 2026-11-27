# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

from __future__ import annotations

import json

import pytest

from sentra_ats.bgc.crawler_session import has_auth_cookies
from sentra_ats.bgc.providers.social.instagram_api import (
	InstagramApiClient,
	InstagramRateLimited,
	InstagramSessionError,
)

NOW = 1_790_000_000


def _feed(items, more=False, next_max_id=""):
	return {"items": items, "more_available": more, "next_max_id": next_max_id, "status": "ok"}


def _item(pk, code, days_ago, caption, comments=0, pinned=False):
	it = {
		"pk": pk,
		"code": code,
		"taken_at": NOW - days_ago * 86400,
		"caption": {"text": caption},
		"media_type": 1,
		"comment_count": comments,
	}
	if pinned:
		it["timeline_pinned_user_ids"] = [1]
	return it


class FakeHttp:
	def __init__(self, routes):
		self.routes = routes
		self.calls = []

	def __call__(self, url, headers, cookies, timeout):
		self.calls.append(url)
		for prefix, (status, payload) in self.routes.items():
			if url.split("instagram.com", 1)[1].startswith(prefix):
				return status, json.dumps(payload)
		return 404, "{}"


def _client(routes):
	http = FakeHttp(routes)
	return InstagramApiClient({"sessionid": "x", "csrftoken": "t"}, http_get=http, sleep_fn=lambda s: None), http


def test_profile_and_paginated_posts_respect_limits_and_lookback():
	routes = {
		"/api/v1/users/web_profile_info/": (
			200,
			{"data": {"user": {"id": "42", "username": "cand", "full_name": "Cand Idate", "biography": "Hi @someone",
			                   "is_private": False, "edge_followed_by": {"count": 10}, "edge_follow": {"count": 5},
			                   "edge_owner_to_timeline_media": {"count": 4}}}},
		),
		"/api/v1/feed/user/42/?count=12&max_id=P2": (200, _feed([_item(3, "C3", 30, "third"), _item(4, "C4", 500, "too old")])),
		"/api/v1/feed/user/42/?count=12": (
			200,
			_feed([_item(9, "PIN", 900, "old pinned", pinned=True), _item(1, "C1", 1, "hello @friend"), _item(2, "C2", 2, "")], True, "P2"),
		),
	}
	client, http = _client(routes)
	prof = client.profile("cand")
	assert prof["id"] == "42" and prof["display_name"] == "Cand Idate" and prof["followers_count"] == 10

	posts = list(client.iter_posts("42", "cand", max_posts=50, earliest_ts=NOW - 365 * 86400))
	assert [p["url"].rstrip("/").rsplit("/", 1)[1] for p in posts] == ["C1", "C2", "C3"]
	assert posts[0]["snippet"] == "hello @[user]"  # third-party mentions anonymized
	assert len([c for c in http.calls if "/feed/user/" in c]) == 2

	limited = list(client.iter_posts("42", "cand", max_posts=1, earliest_ts=None))
	assert len(limited) == 1


def test_only_candidate_comments_and_replies_are_kept():
	post = {"pk": "1", "url": "https://www.instagram.com/p/C1/", "comment_count": 3}
	routes = {
		"/api/v1/media/1/comments/7/child_comments/": (
			200,
			{"child_comments": [
				{"pk": 71, "text": "thanks @other", "created_at": NOW, "user": {"username": "cand"}},
				{"pk": 72, "text": "not mine", "created_at": NOW, "user": {"username": "other"}},
			]},
		),
		"/api/v1/media/1/comments/": (
			200,
			{"comments": [
				{"pk": 5, "text": "my own comment", "created_at": NOW, "user": {"username": "Cand"}},
				{"pk": 7, "text": "stranger question", "created_at": NOW, "user": {"username": "other"},
				 "child_comment_count": 2, "preview_child_comments": []},
			]},
		),
	}
	client, _ = _client(routes)
	got = list(client.iter_candidate_comments(post, "cand", limit=10))
	assert [c["snippet"] for c in got] == ["my own comment", "thanks @[user]"]
	assert got[1]["is_reply"] is True


def test_login_wall_and_rate_limit_are_reported():
	client, _ = _client({"/api/v1/users/web_profile_info/": (401, {"require_login": True, "message": "login_required"})})
	with pytest.raises(InstagramSessionError):
		client.profile("cand")

	client, _ = _client({"/api/v1/users/web_profile_info/": (401, {"message": "Please wait a few minutes before you try again."})})
	with pytest.raises(InstagramRateLimited):
		client.profile("cand")


def test_auth_cookie_detection():
	anon_fb = {"cookies": [{"name": n, "value": "v"} for n in ("datr", "fr", "sb")]}
	assert not has_auth_cookies("Facebook", anon_fb)
	assert has_auth_cookies("Facebook", {"cookies": [{"name": "c_user", "value": "1"}, {"name": "xs", "value": "2"}]})
	assert not has_auth_cookies("Instagram", None)
	assert has_auth_cookies("Instagram", {"cookies": [{"name": "sessionid", "value": "s"}]})
	assert has_auth_cookies("SomeOtherPlatform", {"cookies": []})
