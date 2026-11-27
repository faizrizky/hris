# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

from __future__ import annotations

from sentra_ats.bgc.providers.social import get_social_adapter
from sentra_ats.bgc.providers.social.threads_browser import (
	ThreadsBrowserClient,
	is_reply,
	thread_posts,
	user_info,
)

NOW = 1_790_000_000


def _post(code, user, text, reply=False, taken=NOW):
	d = {"code": code, "user": {"username": user}, "caption": {"text": text}, "taken_at": taken, "text_post_app_info": {}}
	if reply:
		d["text_post_app_info"]["reply_to_author"] = {"username": "other"}
	return d


def test_threads_adapter_registered_with_url_template():
	adapter = get_social_adapter("Threads")
	assert adapter is not None
	assert adapter.build_profile_url("@faiz.rizky") == "https://www.threads.com/@faiz.rizky"


def test_threads_posts_and_replies_are_separated_by_author():
	payloads = [
		{"data": {"mediaData": {"edges": [{"node": {"thread_items": [{"post": _post("A1", "cand", "post one")}]}}]}}},
		{"data": {"mediaData": {"edges": [{"node": {"thread_items": [
			{"post": _post("B1", "other", "parent")},
			{"post": _post("B2", "cand", "my reply @other", reply=True)},
			{"post": _post("B3", "stranger", "not mine", reply=True)},
		]}}]}}},
		{"user": {"username": "cand", "full_name": "Cand", "biography": "bio", "follower_count": 7}},
	]
	posts = thread_posts(payloads)
	assert {p["code"] for p in posts} == {"A1", "B1", "B2", "B3"}
	client = ThreadsBrowserClient({"cookies": []})
	client.payloads = payloads
	assert [p["code"] for p in client._own("cand", replies=False)] == ["A1"]
	assert [p["code"] for p in client._own("cand", replies=True)] == ["B2"]
	assert is_reply(_post("x", "u", "t", reply=True)) and not is_reply(_post("x", "u", "t"))
	info = user_info(payloads, "Cand")
	assert info["full_name"] == "Cand" and info["follower_count"] == 7
	item = client._item(client._own("cand", True)[0], "cand", "Comment")
	assert item["snippet"] == "my reply @[user]" and item["url"].endswith("/@cand/post/B2") and item["is_reply"]
