# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

from __future__ import annotations

import json

import pytest

from hris_ats.bgc.providers.social.facebook_api import (
	FacebookApiClient,
	FacebookNotFound,
	FacebookRateLimited,
	FacebookSessionError,
)

NOW = 1_790_000_000
DAY = 86400
OWNER = "100001"
VIEWER = "555"


def _story(post_id, days_ago, text, actor=OWNER, ranges=None, comments=None, pinned=False):
	st = {
		"__typename": "Story",
		"id": f"S:{post_id}",
		"post_id": post_id,
		"actors": [{"__typename": "User", "id": actor, "name": "Someone"}],
		"creation_time": NOW - days_ago * DAY,
		"url": f"https://www.facebook.com/cand/posts/{post_id}",
		"message": {"text": text, "ranges": ranges or []},
		"attachments": [{"media": {"__typename": "Photo"}}],
		"feedback": {"display_comments": {"edges": [{"node": c} for c in comments or []]}},
	}
	if pinned:
		st["is_pinned"] = True
	return st


def _comment(cid, author, text, depth=0):
	return {"__typename": "Comment", "id": cid, "author": {"id": author}, "body": {"text": text},
	        "created_time": NOW, "url": f"https://www.facebook.com/c/{cid}", "depth": depth}


def _page(stories, cursor="CUR1", has_next=True, extra=""):
	preload = {"require": [["ScheduledServerJS", "handle", None, [{"__bbox": {"result": {"data": {"node": {
		"timeline_list_feed_units": {
			"edges": [{"node": s} for s in stories],
			"page_info": {"end_cursor": cursor, "has_next_page": has_next},
		}}}}}}]]]}
	return (
		"<html><head><title>Cand Idate | Facebook</title></head><body>"
		'<script>["DTSGInitialData",[],{"token":"DTSG"}],["LSD",[],{"token":"LSDTOK"}]</script>'
		f'<script type="application/json" data-sjs>{{"props":{{"userID":"{OWNER}","userVanity":"cand"}}}}</script>'
		f'<script type="application/json" data-sjs>{json.dumps(preload)}</script>'
		f"{extra}</body></html>"
	)


class FakeHttp:
	def __init__(self, gets, posts=None):
		self.gets, self.posts = gets, list(posts or [])
		self.get_calls, self.post_calls = [], []

	def get(self, url, headers, cookies, timeout):
		self.get_calls.append((url, dict(cookies)))
		for prefix, (status, body) in self.gets.items():
			if url.startswith(prefix):
				return status, body
		return 404, ""

	def post(self, url, data, headers, cookies, timeout):
		self.post_calls.append(data)
		status, lines = self.posts.pop(0)
		return status, "\n".join(json.dumps(x) for x in lines)


def _client(gets, posts=None, doc_id="DOC1"):
	http = FakeHttp(gets, posts)
	client = FacebookApiClient(
		{"c_user": VIEWER, "xs": "x"}, doc_id=doc_id, http_get=http.get, http_post=http.post, sleep_fn=lambda s: None
	)
	return client, http


def _stream_line(story):
	return {"label": "ProfileCometTimelineFeed_user$stream$ProfileCometTimelineFeed_user_timeline_list_feed_units",
	        "path": ["node", "timeline_list_feed_units", "edges", 0], "data": {"node": story}}


def test_preloaded_and_paginated_posts_keep_owner_stories_and_mask_mentions():
	mention = [{"offset": 6, "length": 8, "entity": {"__typename": "User", "id": "777"}},
	           {"offset": 0, "length": 5, "entity": {"__typename": "Hashtag", "id": "h"}}]
	first = [
		_story("1", 1, "Hello John Doe and team", ranges=mention,
		       comments=[_comment("c1", OWNER, "thanks all"), _comment("c2", "999", "nice post"),
		                 _comment("c3", OWNER, "reply to @friend", depth=1)]),
		_story("2", 2, "posted on your wall", actor="999"),
	]
	page2 = [
		[_stream_line(_story("3", 30, "page two"))],
		[{"label": "ProfileCometTimelineFeed_user$defer$timeline_list_feed_units$page_info",
		  "data": {"page_info": {"end_cursor": "CUR2", "has_next_page": True}}}],
	]
	page3 = [[_stream_line(_story("4", 900, "too old"))]]
	client, http = _client(
		{"https://www.facebook.com/cand": (200, _page(first))},
		posts=[(200, [x for part in page2 for x in part]), (200, [x for part in page3 for x in part])],
	)
	result = {"posts": [], "comments": []}
	client.crawl_profile("cand", 50, 50, NOW - 365 * DAY, result, lambda *a: None)

	assert result["display_name"] == "Cand Idate" and result["_profile_loaded"]
	assert [p["pk"] for p in result["posts"]] == ["1", "3"]  # friend's wall post skipped, stops at window
	assert result["posts"][0]["snippet"] == "Hello @[user] and team"  # only the user mention is masked
	assert result["posts"][0]["media_type"] == "Photo"
	assert not any(k.startswith("_") for p in result["posts"] for k in p)
	assert [c["snippet"] for c in result["comments"]] == ["thanks all", "reply to @[user]"]
	assert [c["is_reply"] for c in result["comments"]] == [False, True]

	sent = http.post_calls[0]
	assert sent["doc_id"] == "DOC1" and sent["fb_dtsg"] == "DTSG" and sent["av"] == VIEWER
	assert json.loads(sent["variables"])["cursor"] == "CUR1" and json.loads(sent["variables"])["id"] == OWNER
	assert json.loads(http.post_calls[1]["variables"])["cursor"] == "CUR2"


def test_max_posts_and_pinned_old_story():
	stories = [_story("9", 800, "pinned old", pinned=True), _story("1", 1, "a"), _story("2", 2, "b")]
	client, http = _client({"https://www.facebook.com/cand": (200, _page(stories))})
	result = {"posts": [], "comments": []}
	client.crawl_profile("cand", 1, 5, NOW - 365 * DAY, result, lambda *a: None)
	assert [p["pk"] for p in result["posts"]] == ["1"]
	assert not http.post_calls


def test_doc_id_discovered_from_static_bundle_without_session_cookies():
	bundle = "https://static.xx.fbcdn.net/rsrc.php/v3/abc.js"
	js = '__d("ProfileCometTimelineFeedRefetchQuery_facebookRelayOperation",[],(function(a,b,c,d,e,f){e.exports="424242"}),null);'
	html = _page([_story("1", 1, "a")], extra=f'<link rel="preload" href="{bundle}" as="script"/>')
	client, http = _client(
		{bundle: (200, js), "https://www.facebook.com/cand": (200, html)},
		posts=[(200, [{"data": {"node": {"timeline_list_feed_units": {"edges": [], "page_info": {"has_next_page": False, "end_cursor": None}}}}}])],
		doc_id=None,
	)
	result = {"posts": [], "comments": []}
	client.crawl_profile("cand", 10, 10, None, result, lambda *a: None)
	assert client.doc_id == "424242" and http.post_calls[0]["doc_id"] == "424242"
	assert any(u == bundle and c == {} for u, c in http.get_calls)


def test_without_doc_id_only_preloaded_posts_with_limitation():
	client, http = _client({"https://www.facebook.com/cand": (200, _page([_story("1", 1, "a")]))}, doc_id=None)
	result = {"posts": [], "comments": []}
	client.crawl_profile("cand", 10, 10, None, result, lambda *a: None)
	assert [p["pk"] for p in result["posts"]] == ["1"]
	assert "timeline query id unavailable" in result["comment_limitation"]
	assert not http.post_calls


def test_login_wall_not_found_and_graphql_errors():
	client, _ = _client({"https://www.facebook.com/cand": (200, '<form id="login_form"></form>')})
	with pytest.raises(FacebookSessionError):
		client.load_profile_page("cand")

	client, _ = _client({"https://www.facebook.com/cand": (200, "<html>This content isn't available right now</html>")})
	with pytest.raises(FacebookNotFound):
		client.load_profile_page("cand")

	for err, exc in (({"error": 1357001, "errorSummary": "Not logged in"}, FacebookSessionError),
	                 ({"errors": [{"code": 1675004, "message": "Rate limit exceeded"}]}, FacebookRateLimited)):
		client, _ = _client({"https://www.facebook.com/cand": (200, _page([_story("1", 1, "a")]))}, posts=[(200, [err])])
		with pytest.raises(exc):
			client.crawl_profile("cand", 10, 10, None, {"posts": [], "comments": []}, lambda *a: None)


def test_numeric_id_uses_profile_php():
	assert FacebookApiClient.profile_url("100001") == "https://www.facebook.com/profile.php?id=100001"
