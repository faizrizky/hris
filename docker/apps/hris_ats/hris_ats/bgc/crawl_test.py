# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Crawl Test: run the real social crawl (profile, posts, the candidate's own comments) for one
account without creating a Background Check, so HR can see what the crawler retrieves, how long it
takes and which mode or account was used. Nothing is saved as a finding."""

from __future__ import annotations

import json
import time
import uuid
from types import SimpleNamespace
from typing import Any

import frappe
from frappe import _
from frappe.utils import cint

from hris_ats.bgc.consent import normalize_username

STATE_TTL = 3600
SOCIAL_PLATFORMS = ("Instagram", "Facebook", "TikTok", "LinkedIn", "Threads")


def _key(test_id: str) -> str:
	return f"hris_ats_crawl_test:{test_id}"


def _save(test_id: str, state: dict[str, Any]) -> None:
	frappe.cache.set_value(_key(test_id), json.dumps(state, default=str), expires_in_sec=STATE_TTL)


def _load(test_id: str) -> dict[str, Any] | None:
	raw = frappe.cache.get_value(_key(test_id), use_local_cache=False)
	if not raw:
		return None
	return json.loads(raw.decode() if isinstance(raw, bytes) else raw)


def _assert_admin() -> None:
	if "System Manager" not in frappe.get_roles():
		frappe.throw(_("Only System Manager can run a crawl test."), frappe.PermissionError)


@frappe.whitelist()
def get_crawl_test_defaults() -> dict[str, Any]:
	_assert_admin()
	settings = frappe.get_single("Background Check Settings")
	accounts = frappe.get_all(
		"Background Check Crawler Account",
		fields=["platform", "account_label", "status", "enabled", "risk_acknowledged"],
	)
	return {
		"platforms": [p for p in SOCIAL_PLATFORMS if frappe.db.exists("Background Check Platform", p)],
		"max_posts": settings.social_max_posts or 200,
		"max_comments": settings.social_max_comments or 200,
		"lookback_months": settings.social_lookback_months or 0,
		"use_login_session": bool(settings.fetch_use_login_session),
		"crawler_accounts": accounts,
	}


@frappe.whitelist()
def start_crawl_test(
	platform: str,
	username: str,
	consent_acknowledged: int = 0,
	max_posts: int | None = None,
	max_comments: int | None = None,
	lookback_months: int | None = None,
) -> dict[str, str]:
	_assert_admin()
	if not cint(consent_acknowledged):
		frappe.throw(
			_("You must confirm profile ownership or permission before proceeding."),
			title=_("Permission Required"),
		)
	if platform not in SOCIAL_PLATFORMS:
		frappe.throw(_("Unsupported social media platform: {0}").format(platform))
	clean_user = normalize_username(platform, username)

	settings = frappe.get_single("Background Check Settings")
	args = {
		"platform": platform,
		"username": clean_user,
		"max_posts": cint(max_posts) or settings.social_max_posts or 200,
		"max_comments": cint(max_comments) if max_comments not in (None, "") else (settings.social_max_comments or 200),
		"lookback_months": cint(lookback_months) if lookback_months not in (None, "") else (settings.social_lookback_months or 0),
	}
	test_id = uuid.uuid4().hex[:12]
	_save(test_id, {"status": "Queued", "log": [], "args": args, "started_by": frappe.session.user})
	frappe.enqueue(
		"hris_ats.bgc.crawl_test.run_crawl_test",
		queue="browser",
		timeout=900,
		test_id=test_id,
		user=frappe.session.user,
		**args,
	)
	return {"test_id": test_id, "username": clean_user}


@frappe.whitelist()
def poll_crawl_test(test_id: str) -> dict[str, Any]:
	_assert_admin()
	state = _load(test_id)
	if not state:
		return {"status": "Expired", "log": []}
	return state


def run_crawl_test(
	test_id: str, user: str, platform: str, username: str, max_posts: int, max_comments: int, lookback_months: int
) -> None:
	from hris_ats.bgc.fetch import get_fetch_config_from_settings
	from hris_ats.bgc.providers.social_public import SocialPublicProvider

	frappe.flags.in_bgc_runner = True
	started = time.time()
	state = _load(test_id) or {"log": [], "args": {}}
	state["status"] = "Running"

	def log(message: str) -> None:
		state["log"].append({"t": round(time.time() - started, 1), "message": str(message)})
		_save(test_id, state)

	log(_("Starting crawl test for {0} @{1}").format(platform, username))
	# Stand-ins that satisfy the same consent gate as a real Background Check
	bgc = SimpleNamespace(
		name="CRAWL-TEST",
		consent_status="Granted",
		consent_method="Web form",
		consent_file=None,
		consent_scope=[SimpleNamespace(source="Social Media", granted=1)],
	)
	account = SimpleNamespace(name="", platform=platform, username=username, social_consent=1, declared_by="Candidate")

	try:
		cfg = get_fetch_config_from_settings()
		res = SocialPublicProvider(config=cfg).crawl_account(
			bgc,
			account,
			max_posts=max_posts,
			max_comments=max_comments,
			lookback_months=lookback_months,
			progress=log,
		)
		state["status"] = "Done" if res.get("status") != "Failed" else "Failed"
		state["result"] = {
			"profile_url": res.get("profile_url"),
			"display_name": res.get("display_name"),
			"bio": res.get("bio"),
			"followers_count": res.get("followers_count"),
			"following_count": res.get("following_count"),
			"posts_count": res.get("posts_count"),
			"is_private": res.get("is_private"),
			"mode_used": res.get("mode_used"),
			"crawler_account": res.get("crawler_account"),
			"provenance": res.get("provenance"),
			"error": res.get("error"),
			"comment_limitation": res.get("comment_limitation"),
			"posts": res.get("posts", []),
			"comments": res.get("comments", []),
		}
		log(
			_("Finished: {0} posts, {1} comments").format(len(res.get("posts", [])), len(res.get("comments", [])))
		)
	except Exception as e:
		state["status"] = "Failed"
		state["result"] = {"error": str(e), "posts": [], "comments": []}
		log(_("Crawl failed: {0}").format(e))
		frappe.log_error(title="Crawl Test Error", message=frappe.get_traceback())
	state["seconds"] = round(time.time() - started, 1)
	_save(test_id, state)
