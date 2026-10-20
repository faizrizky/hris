# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

from __future__ import annotations

import json

from hris_ats.bgc.providers.social.facebook_api import FacebookApiClient
from hris_ats.bgc.providers.social.facebook_browser import collect_blobs, comment_total, story_nodes

OWNER = "1000"


def _story(post_id, actor_id, text, comments=0, ts=1_790_000_000):
	return {
		"__typename": "Story",
		"post_id": post_id,
		"id": f"S{post_id}",
		"creation_time": ts,
		"actors": [{"id": actor_id, "name": "n"}],
		"message": {"text": text, "ranges": []},
		"feedback": {"comments": {"total_count": comments}, "inner": {"comments": {"total_count": 0}}},
	}


def test_blobs_from_html_scripts_and_newline_delimited_graphql():
	html = '<script type="application/json">' + json.dumps({"a": _story("1", OWNER, "from html")}) + "</script>"
	graphql = json.dumps({"data": {"node": _story("2", OWNER, "from graphql")}}) + "\n" + json.dumps({"x": 1})
	blobs = collect_blobs(html, [graphql])
	assert {s["post_id"] for s in story_nodes(blobs)} == {"1", "2"}


def test_comment_total_takes_largest_nested_count():
	assert comment_total(_story("1", OWNER, "t", comments=6)) == 6
	assert comment_total(_story("1", OWNER, "t", comments=0)) == 0


def test_owner_only_stories_and_candidate_comments():
	helper = FacebookApiClient({})
	page = {"id": OWNER, "url": "https://www.facebook.com/cand"}
	mine = helper.normalize_story(_story("1", OWNER, "my post"), page)
	other = helper.normalize_story(_story("2", "2000", "friend wrote on my wall"), page)
	assert mine and mine["snippet"] == "my post" and other is None

	comments_blob = [{
		"__typename": "Story",
		"c1": {"__typename": "Comment", "id": "c1", "author": {"id": OWNER}, "body": {"text": "my comment", "ranges": []}, "created_time": 1_790_000_100},
		"c2": {"__typename": "Comment", "id": "c2", "author": {"id": "2000"}, "body": {"text": "stranger", "ranges": []}, "created_time": 1_790_000_200},
	}]
	got = helper.candidate_comments({"_story": comments_blob, "url": "https://www.facebook.com/cand/posts/1"}, OWNER, 10)
	assert [c["snippet"] for c in got] == ["my comment"]
