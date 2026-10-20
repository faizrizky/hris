# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

from __future__ import annotations

import json

import pytest

from hris_ats.bgc.providers.social.api_base import ApiUnavailable
from hris_ats.bgc.providers.social.tiktok_api import (
	TikTokApiClient,
	TikTokNotFound,
	TikTokRateLimited,
	TikTokSessionError,
)

NOW = 1_790_000_000
DAY = 86400


class FakeHttp:
	"""Routes by path prefix plus optional query fragments; payload may be a dict or a raw string."""

	def __init__(self, routes):
		self.routes = routes
		self.calls = []

	def __call__(self, url, headers, cookies, timeout):
		self.calls.append(url)
		path = url.split("tiktok.com", 1)[1]
		for (prefix, *needles), (status, payload) in self.routes.items():
			if path.startswith(prefix) and all(n in path for n in needles):
				return status, payload if isinstance(payload, str) else json.dumps(payload)
		return 404, "{}"


def _client(routes):
	http = FakeHttp(routes)
	return TikTokApiClient({"sessionid": "s", "msToken": "m"}, http_get=http, sleep_fn=lambda s: None), http


USER = {
	"userInfo": {
		"user": {"id": "7", "uniqueId": "cand", "secUid": "SEC", "nickname": "Cand Idate", "signature": "hi @pal",
		         "privateAccount": False},
		"stats": {"followerCount": 120, "followingCount": 30, "videoCount": 4},
	},
	"statusCode": 0,
}


def _video(vid, days_ago, desc, comments=0, pinned=False):
	return {"id": vid, "desc": desc, "createTime": NOW - days_ago * DAY, "stats": {"commentCount": comments},
	        "isPinnedItem": pinned}


def test_profile_and_paginated_videos_respect_limits_lookback_and_pins():
	routes = {
		("/api/user/detail/",): (200, USER),
		("/api/post/item_list/", "cursor=C2"): (
			200, {"itemList": [_video("3", 20, "third"), _video("4", 900, "too old")], "hasMore": True, "cursor": "C3"}
		),
		("/api/post/item_list/",): (
			200,
			{"itemList": [_video("9", 800, "old pinned", pinned=True), _video("1", 1, "hello @friend"), _video("2", 2, "")],
			 "hasMore": True, "cursor": "C2"},
		),
	}
	client, http = _client(routes)
	prof = client.profile("cand")
	assert prof["sec_uid"] == "SEC" and prof["followers_count"] == 120 and prof["display_name"] == "Cand Idate"
	assert "msToken=m" in http.calls[0] and "aid=1988" in http.calls[0]

	posts = list(client.iter_posts("SEC", "cand", max_posts=50, earliest_ts=NOW - 365 * DAY))
	assert [p["pk"] for p in posts] == ["1", "2", "3"]  # stops at first unpinned video older than the window
	assert posts[0]["snippet"] == "hello @[user]"
	assert posts[0]["url"] == "https://www.tiktok.com/@cand/video/1"
	assert len([c for c in http.calls if "item_list" in c]) == 2

	assert len(list(client.iter_posts("SEC", "cand", max_posts=1, earliest_ts=None))) == 1


def test_profile_falls_back_to_rehydration_json_when_api_is_unsigned():
	page = (
		'<html><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">'
		+ json.dumps({"__DEFAULT_SCOPE__": {"webapp.user-detail": {"statusCode": 0, **USER}}})
		+ "</script></html>"
	)
	client, _ = _client({("/api/user/detail/",): (200, ""), ("/@cand",): (200, page)})
	assert client.profile("cand")["sec_uid"] == "SEC"

	client, _ = _client({("/api/post/item_list/",): (200, "")})
	with pytest.raises(ApiUnavailable):
		list(client.iter_posts("SEC", "cand", 10, None))


def test_only_candidate_comments_and_replies_are_kept():
	post = {"pk": "1", "url": "https://www.tiktok.com/@cand/video/1", "comment_count": 3}
	routes = {
		("/api/comment/list/reply/", "comment_id=c7"): (
			200,
			{"comments": [
				{"cid": "r1", "text": "thanks @other", "create_time": NOW, "user": {"unique_id": "cand"}},
				{"cid": "r2", "text": "not mine", "create_time": NOW, "user": {"unique_id": "other"}},
			], "has_more": 0, "status_code": 0},
		),
		("/api/comment/list/", "cursor=0"): (
			200,
			{"comments": [
				{"cid": "c5", "text": "my own comment", "create_time": NOW, "user": {"unique_id": "Cand"}},
				{"cid": "c7", "text": "stranger question", "create_time": NOW, "user": {"unique_id": "other"},
				 "reply_comment_total": 2, "reply_comment": []},
			], "has_more": 1, "cursor": 2, "status_code": 0},
		),
		("/api/comment/list/", "cursor=2"): (
			200,
			{"comments": [{"cid": "c9", "text": "second page mine", "create_time": NOW, "user": {"unique_id": "cand"}}],
			 "has_more": 0, "status_code": 0},
		),
	}
	client, _ = _client(routes)
	got = list(client.iter_candidate_comments(post, "cand", limit=10))
	assert [c["snippet"] for c in got] == ["my own comment", "thanks @[user]", "second page mine"]
	assert [c["is_reply"] for c in got] == [False, True, False]
	assert got[0]["url"].endswith("?comment_id=c5")

	client, _ = _client(routes)
	assert len(list(client.iter_candidate_comments(post, "cand", limit=1))) == 1


def test_crawl_profile_fills_result_and_private_profile_stops_early():
	private = json.loads(json.dumps(USER))
	private["userInfo"]["user"]["privateAccount"] = True
	client, http = _client({("/api/user/detail/",): (200, private)})
	result = {"posts": [], "comments": []}
	client.crawl_profile("cand", 10, 10, None, result, lambda *a: None)
	assert result["is_private"] and result["_profile_loaded"] and "Private" in result["comment_limitation"]
	assert not any("item_list" in c for c in http.calls)


def test_session_rate_limit_and_not_found_are_reported():
	for payload, status, exc in (
		({"statusCode": 8, "statusMsg": "user not login"}, 200, TikTokSessionError),
		({}, 403, TikTokSessionError),
		({"statusCode": 10000, "statusMsg": "captcha"}, 200, TikTokSessionError),
		({}, 429, TikTokRateLimited),
		({"statusCode": 10202, "statusMsg": "user not exist"}, 200, TikTokNotFound),
	):
		client, _ = _client({("/api/user/detail/",): (status, payload)})
		with pytest.raises(exc):
			client.profile("cand")
