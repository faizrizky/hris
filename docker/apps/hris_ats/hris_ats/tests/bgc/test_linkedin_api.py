# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

from __future__ import annotations

import json

import pytest

from hris_ats.bgc.providers.social.linkedin_api import (
	LinkedInApiClient,
	LinkedInNotFound,
	LinkedInRateLimited,
	LinkedInSessionError,
)

NOW = 1_790_000_000
DAY = 86400
PID = "ACoAAB123"


def _activity(days_ago, seq=1):
	return str((int((NOW - days_ago * DAY) * 1000) << 22) + seq)


def _update(days_ago, text, attrs=None, comments=0, reshared=None, video=False):
	aid = _activity(days_ago)
	el = {
		"updateMetadata": {"urn": f"urn:li:activity:{aid}"},
		"commentary": {"text": {"text": text, "attributes": attrs or []}} if text else None,
		"content": {"com.linkedin.voyager.feed.render.LinkedInVideoComponent": {}} if video else {},
		"socialDetail": {"totalSocialActivityCounts": {"numComments": comments}},
	}
	if reshared:
		el["resharedUpdate"] = {"commentary": {"text": {"text": reshared}}}
	return el


class FakeHttp:
	def __init__(self, routes):
		self.routes = routes
		self.calls = []

	def __call__(self, url, headers, cookies, timeout):
		self.calls.append((url, headers))
		path = url.split("/voyager/api", 1)[1]
		for (prefix, *needles), (status, payload) in self.routes.items():
			if path.startswith(prefix) and all(n in path for n in needles):
				return status, payload if isinstance(payload, str) else json.dumps(payload)
		return 404, "{}"


def _client(routes, cookies=None):
	http = FakeHttp(routes)
	cookies = cookies or {"li_at": "a", "JSESSIONID": '"ajax:123"'}
	return LinkedInApiClient(cookies, http_get=http, sleep_fn=lambda s: None), http


PROFILE = {
	"elements": [{
		"entityUrn": f"urn:li:fsd_profile:{PID}",
		"publicIdentifier": "cand",
		"firstName": "Cand",
		"lastName": "Idate",
		"headline": "Engineer at Acme",
		"geoLocation": {"geo": {"defaultLocalizedName": "Jakarta, Indonesia"}},
	}]
}


def test_profile_posts_pagination_mentions_and_lookback():
	mention = [{"start": 6, "length": 8, "type": {"com.linkedin.pemberly.text.Entity": {"urn": "urn:li:fs_miniProfile:X"}}},
	           {"start": 0, "length": 5, "type": {"com.linkedin.pemberly.text.Hashtag": {}}}]
	routes = {
		("/identity/dash/profiles",): (200, PROFILE),
		("/identity/profiles/cand/networkinfo",): (200, {"followersCount": 321}),
		("/identity/profileUpdatesV2", "paginationToken=T2"): (
			200, {"elements": [_update(40, "page two"), _update(800, "too old")], "metadata": {"paginationToken": "T3"}}
		),
		("/identity/profileUpdatesV2",): (
			200,
			{"elements": [_update(700, "pinned old"), _update(1, "Hello Jane Doe from #team", attrs=mention, comments=2), _update(2, "", reshared="shared @x"),
			              _update(3, "clip", video=True)],
			 "metadata": {"paginationToken": "T2"}},
		),
	}
	client, http = _client(routes)
	prof = client.profile("cand")
	assert prof["id"] == PID and prof["display_name"] == "Cand Idate" and prof["location"] == "Jakarta, Indonesia"
	assert prof["followers_count"] == 321
	assert http.calls[0][1]["csrf-token"] == "ajax:123"

	posts = list(client.iter_posts(PID, "cand", 50, NOW - 365 * DAY))
	assert [p["snippet"] for p in posts] == ["Hello @[user] from #team", "Repost: shared @[user]", "clip", "page two"]
	assert posts[0]["comment_count"] == 2 and posts[2]["media_type"] == "Video"
	assert posts[0]["published_on"] is not None and posts[0]["url"].startswith("https://www.linkedin.com/feed/update/urn:li:activity:")
	assert "urn:li:fsd_profile:" + PID in http.calls[2][0]
	assert not any("T3" in u for u, _ in http.calls)  # stops once the page ends past the window

	assert len(list(client.iter_posts(PID, "cand", 2, None))) == 2


def test_only_member_comments_and_replies_under_own_posts():
	post = {"pk": "99", "url": "https://www.linkedin.com/feed/update/urn:li:activity:99/", "comment_count": 3}

	def comment(pid, public_id, text, replies=()):
		return {
			"commenter": {"com.linkedin.voyager.feed.MemberActor": {"miniProfile": {
				"publicIdentifier": public_id, "entityUrn": f"urn:li:fs_miniProfile:{pid}"}}},
			"commentV2": {"text": text, "attributes": []},
			"createdTime": NOW * 1000,
			"permalink": f"https://www.linkedin.com/feed/update/urn:li:activity:99?commentUrn={text}",
			"socialDetail": {"comments": {"elements": list(replies)}},
		}

	routes = {
		("/feed/comments", "start=0"): (
			200,
			{"elements": [
				comment(PID, "cand", "my comment"),
				comment("OTHER", "other", "question", replies=[comment(PID, "renamed-vanity", "my reply"),
				                                             comment("OTHER", "other", "their reply")]),
			], "paging": {"start": 0, "count": 100, "total": 2}},
		),
	}
	client, http = _client(routes)
	got = list(client.iter_candidate_comments(post, "cand", 10, profile_id=PID))
	assert [(c["snippet"], c["is_reply"]) for c in got] == [("my comment", False), ("my reply", True)]
	assert "updateId=activity:99" in http.calls[0][0]


def test_crawl_profile_sets_limitation_and_counts():
	routes = {
		("/identity/dash/profiles",): (200, PROFILE),
		("/identity/profiles/cand/networkinfo",): (404, {}),
		("/identity/profileUpdatesV2",): (200, {"elements": [_update(1, "only post")], "metadata": {"paginationToken": ""}}),
	}
	client, _ = _client(routes)
	result = {"posts": [], "comments": []}
	client.crawl_profile("cand", 10, 10, None, result, lambda *a: None)
	assert result["posts_count"] == 1 and result["followers_count"] is None
	assert "own posts" in result["comment_limitation"]


def test_session_rate_limit_and_not_found():
	with pytest.raises(LinkedInSessionError):
		_client({}, cookies={"li_at": "a"})[0].profile("cand")
	for status, payload, exc in (
		(401, {}, LinkedInSessionError),
		(403, "CSRF check failed", LinkedInSessionError),
		(999, "", LinkedInRateLimited),
		(429, {}, LinkedInRateLimited),
		(200, "<html>authwall</html>", LinkedInSessionError),
	):
		client, _ = _client({("/identity/dash/profiles",): (status, payload)})
		with pytest.raises(exc):
			client.profile("cand")

	client, _ = _client({("/identity/dash/profiles",): (200, {"elements": []}),
	                     ("/identity/profiles/cand/profileView",): (410, {})})
	with pytest.raises(LinkedInNotFound):
		client.profile("cand")
