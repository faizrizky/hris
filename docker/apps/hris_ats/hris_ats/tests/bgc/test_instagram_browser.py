# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

from __future__ import annotations

import json

from hris_ats.bgc.providers.social.instagram_browser import (
	TIMELINE_KEY,
	InstagramBrowserClient,
	comment_nodes,
	extract_embedded,
	post_from_node,
)

NOW = 1_790_000_000


def _comments_html(edges):
	conn = {"edges": [{"node": n} for n in edges], "page_info": {"has_next_page": False}}
	return f'<script>{{"require":[{{"xdt_api__v1__media__media_id__comments__connection":{json.dumps(conn)}}}]}}</script>'


class FakePage:
	def __init__(self, html):
		self.html = html
		self.url = ""

	def goto(self, url, **kw):
		self.url = url

	def wait_for_timeout(self, ms):
		pass

	def content(self):
		return self.html

	def evaluate(self, js, arg=None):
		return 0


def test_extract_embedded_and_post_from_node():
	node = {"code": "ABC", "pk": "9", "taken_at": NOW, "media_type": 2, "comment_count": 3,
	        "caption": {"text": "halo @teman"}}
	html = f'x{{"{TIMELINE_KEY}":{{"edges":[{{"node":{json.dumps(node)}}}]}}}}y'
	conn = extract_embedded(html, TIMELINE_KEY)[0]
	p = post_from_node(conn["edges"][0]["node"], "cand")
	assert p["url"] == "https://www.instagram.com/p/ABC/"
	assert p["media_type"] == "Video" and p["comment_count"] == 3
	assert p["snippet"] == "halo @[user]"


def test_only_candidate_comments_including_replies_are_returned():
	edges = [
		{"pk": "1", "text": "stranger", "created_at": NOW, "user": {"username": "other"}},
		{"pk": "2", "text": "makasih @other", "created_at": NOW, "user": {"username": "Cand"}, "parent_comment_id": "1"},
	]
	client = InstagramBrowserClient({"cookies": []})
	client.page = FakePage(_comments_html(edges))
	client.deadline = 10**12
	# A reply thread loaded later through GraphQL is also read, without duplicates
	client.payloads = []
	got = list(client.iter_candidate_comments({"url": "https://www.instagram.com/p/ABC/", "comment_count": 2}, "cand", 10))
	assert [c["snippet"] for c in got] == ["makasih @[user]"]
	assert got[0]["is_reply"] is True and got[0]["url"].endswith("/c/2/")


def test_comment_nodes_require_author_and_timestamp():
	payload = {"a": [{"pk": "1", "text": "x", "created_at": NOW, "user": {"username": "u"}}, {"pk": "2", "text": "no user"}]}
	assert [c["pk"] for c in comment_nodes(payload)] == ["1"]
