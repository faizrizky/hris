# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

from __future__ import annotations

import base64
import json
import os
import re
import shutil
import tempfile
import time
import uuid
from datetime import datetime
from urllib.parse import urlparse

import frappe
from frappe import _
from frappe.utils import add_days, now_datetime
from frappe.utils.password import decrypt, encrypt, set_encrypted_password


def get_redis_client():
	"""Returns Frappe's Redis cache client."""
	return frappe.cache()


def assert_crawler_admin():
	"""Ensures caller has System Manager role and permission on crawler accounts."""
	if "System Manager" not in frappe.get_roles() or not frappe.has_permission("Background Check Crawler Account", "write"):
		frappe.throw(_("Only System Manager can manage crawler accounts and sessions."), frappe.PermissionError)


@frappe.whitelist()
def start_login_session(account_name: str) -> dict:
	"""Initiates a remote interactive login session for a crawler account.

	Spawns a background browser process on queue-long and prepares Redis channels.
	"""
	assert_crawler_admin()

	from hris_ats.hris_ats.doctype.background_check_settings.background_check_settings import (
		get_scrapling_browser_status,
	)

	# 1. Check browser installed
	browser_status = get_scrapling_browser_status()
	if browser_status != "Installed":
		frappe.throw(
			_("Playwright/Chromium browser is not installed on the server. Run './dev-ats.sh --with-browsers' first."),
			title=_("Browser Not Installed"),
		)

	# 2. Check Settings risk acknowledged
	settings = frappe.get_single("Background Check Settings")
	if not bool(settings.fetch_risk_acknowledged):
		frappe.throw(
			_("Risk acknowledgment in Background Check Settings is required before using crawler accounts."),
			title=_("Risk Acknowledgment Required"),
		)

	# 3. Check account and its risk acknowledgment
	if not frappe.db.exists("Background Check Crawler Account", account_name):
		frappe.throw(_("Crawler Account {0} not found.").format(account_name))

	account = frappe.get_doc("Background Check Crawler Account", account_name)
	if not bool(account.enabled):
		frappe.throw(_("Crawler Account {0} is disabled.").format(account_name))

	if not bool(account.risk_acknowledged):
		frappe.throw(
			_("Account risk acknowledgment is required before starting login session."),
			title=_("Risk Acknowledgment Required"),
		)

	platform = frappe.get_doc("Background Check Platform", account.platform)
	if not platform.login_url:
		frappe.throw(_("Platform {0} does not have a login URL configured.").format(account.platform))

	redis = get_redis_client()
	user = frappe.session.user

	# 4. Terminate any previous active session for this user
	old_session = redis.get_value(f"crawler_active_session:{user}")
	if old_session:
		if isinstance(old_session, bytes):
			old_session = old_session.decode("utf-8")
		redis.set_value(f"crawler_cmd:{old_session}", "close", expires_in_sec=60)

	session_id = uuid.uuid4().hex
	meta = {
		"session_id": session_id,
		"account_name": account_name,
		"platform": account.platform,
		"login_url": platform.login_url,
		"user": user,
		"started_at": time.time(),
		"status": "starting",
		"url": platform.login_url,
		"title": "",
	}
	redis.set_value(f"crawler_meta:{session_id}", json.dumps(meta), expires_in_sec=630)
	redis.set_value(f"crawler_active_session:{user}", session_id, expires_in_sec=630)

	# 5. Enqueue background browser worker on dedicated 'browser' queue
	redis.set_value(f"crawler_heartbeat:{session_id}", time.time(), expires_in_sec=120)
	frappe.enqueue(
		"hris_ats.bgc.crawler_session.run_remote_browser_worker",
		queue="browser",
		session_id=session_id,
		account_name=account_name,
		now=False,
	)

	return {
		"session_id": session_id,
		"account_name": account_name,
		"platform": account.platform,
		"login_url": platform.login_url,
	}


def run_remote_browser_worker(session_id: str, account_name: str):
	"""Background worker loop managing headless Chromium browser for remote login.

	Terminates immediately when:
	- Session command 'close' or 'complete' is received.
	- Client heartbeat stops for > 30 seconds.
	- Total session duration reaches timeout (10 minutes).
	Saves encrypted session directly into DB; cookies NEVER pass through Redis.
	"""
	from playwright.sync_api import sync_playwright

	redis = get_redis_client()
	meta_raw = redis.get_value(f"crawler_meta:{session_id}", use_local_cache=False)
	if not meta_raw:
		return
	if isinstance(meta_raw, bytes):
		meta_raw = meta_raw.decode("utf-8")
	meta = json.loads(meta_raw)
	user = meta.get("user")

	account = frappe.get_doc("Background Check Crawler Account", account_name)
	platform = frappe.get_doc("Background Check Platform", account.platform)

	# Allowed domains for navigation
	login_parsed = urlparse(platform.login_url)
	allowed_domains = [login_parsed.netloc.lower().removeprefix("www.")]
	for line in (platform.session_domains or "").splitlines():
		dom = line.strip().lower().lstrip(".")
		if dom and dom not in allowed_domains:
			allowed_domains.append(dom)

	def is_domain_allowed(url: str) -> bool:
		try:
			parsed = urlparse(url)
			if parsed.scheme in ("about", "data", "blob", "javascript"):
				return True
			host = parsed.netloc.lower().removeprefix("www.")
			return any(host == ad or host.endswith("." + ad) for ad in allowed_domains)
		except Exception:
			return False

	temp_dir = tempfile.mkdtemp(prefix="hris_crawler_")
	playwright = None
	browser = None
	context = None
	cdp = None
	frame_seq = 0

	try:
		playwright = sync_playwright().start()
		browser = playwright.chromium.launch(
			headless=True,
			args=[
				"--no-sandbox",
				"--disable-dev-shm-usage",
				"--disable-blink-features=AutomationControlled",
			],
		)
		context = browser.new_context(
			viewport={"width": 1024, "height": 768},
			user_agent=(
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
				"AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
			),
		)
		page = context.new_page()

		from frappe.utils.local import _contextvar

		parent_ctx = _contextvar.get(None)

		# Setup Screencast via CDP if available
		try:
			cdp = context.new_cdp_session(page)

			def on_screencast_frame(event):
				if parent_ctx is not None:
					_contextvar.set(parent_ctx)
				nonlocal frame_seq
				frame_data = event.get("data")
				if frame_data:
					frame_seq += 1
					redis.set_value(f"crawler_frame:{session_id}", frame_data, expires_in_sec=20)
					meta["frame_seq"] = frame_seq
					redis.set_value(f"crawler_meta:{session_id}", json.dumps(meta), expires_in_sec=600)
				try:
					cdp.send("Page.screencastFrameAck", {"sessionId": event.get("sessionId")})
				except Exception:
					pass

			cdp.on("Page.screencastFrame", on_screencast_frame)
			cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 60, "everyNthFrame": 1})
		except Exception:
			cdp = None

		# Domain restriction: block navigation to unallowed domains
		def handle_route(route):
			try:
				if parent_ctx is not None:
					_contextvar.set(parent_ctx)
				req_url = route.request.url
				if not route.request.is_navigation_request() or is_domain_allowed(req_url):
					route.continue_()
				else:
					route.abort()
			except Exception:
				pass

		page.route("**/*", handle_route)

		# Initial navigation to login URL
		try:
			page.goto(platform.login_url, wait_until="domcontentloaded", timeout=25000)
		except Exception as e:
			frappe.log_error(title="Crawler Browser Goto Error", message=str(e))

		meta["status"] = "active"
		meta["url"] = page.url
		meta["title"] = page.title()
		meta["frame_seq"] = frame_seq
		redis.set_value(f"crawler_meta:{session_id}", json.dumps(meta), expires_in_sec=600)

		start_time = time.time()
		last_heartbeat_time = time.time()
		max_duration = 600  # 10 minutes timeout

		while time.time() - start_time < max_duration:
			# 1. Check client heartbeat (terminates if client disconnected > 30s)
			hb = redis.get_value(f"crawler_heartbeat:{session_id}", use_local_cache=False)
			if hb:
				try:
					last_heartbeat_time = float(hb)
				except Exception:
					pass

			if (time.time() - start_time > 10) and (time.time() - last_heartbeat_time > 30):
				meta["status"] = "closed"
				meta["closed_reason"] = "Client heartbeat timeout (> 30s)"
				redis.set_value(f"crawler_meta:{session_id}", json.dumps(meta), expires_in_sec=60)
				break

			# 2. Check commands
			cmd = redis.get_value(f"crawler_cmd:{session_id}", use_local_cache=False)
			if cmd:
				if isinstance(cmd, bytes):
					cmd = cmd.decode("utf-8")
				if cmd == "complete":
					# Extract storage state and save directly into DB inside worker!
					state = context.storage_state()
					try:
						save_res = save_crawler_storage_state(account_name, json.dumps(state))
						meta["status"] = "completed"
						meta["cookie_domains_found"] = save_res.get("cookie_domains_found", [])
						meta["session_expires_on"] = str(save_res.get("session_expires_on", ""))
					except Exception as err:
						meta["status"] = "error"
						meta["error"] = str(err)
					redis.set_value(f"crawler_meta:{session_id}", json.dumps(meta), expires_in_sec=300)
					break
				elif cmd == "close":
					meta["status"] = "closed"
					redis.set_value(f"crawler_meta:{session_id}", json.dumps(meta), expires_in_sec=60)
					break

			# 3. Process queued inputs
			inputs_key = f"crawler_inputs:{session_id}"
			while True:
				item = redis.lpop(inputs_key)
				if not item:
					break
				if isinstance(item, bytes):
					item = item.decode("utf-8")
				try:
					ev = json.loads(item)
					ev_type = ev.get("type")
					if ev_type == "click":
						page.mouse.click(ev["x"], ev["y"], button=ev.get("button", "left"))
					elif ev_type == "mousemove":
						page.mouse.move(ev["x"], ev["y"])
					elif ev_type == "scroll":
						page.mouse.wheel(ev.get("deltaX", 0), ev.get("deltaY", 0))
					elif ev_type == "keydown":
						key = ev.get("key")
						if key:
							page.keyboard.press(key)
					elif ev_type == "type":
						text = ev.get("text", "")
						if text:
							page.keyboard.type(text)
				except Exception:
					pass

			# 4. Fallback screenshot if CDP screencast is not active
			if not cdp:
				try:
					frame_bytes = page.screenshot(type="jpeg", quality=60)
					frame_b64 = base64.b64encode(frame_bytes).decode("ascii")
					frame_seq += 1
					meta["frame_seq"] = frame_seq
					redis.set_value(f"crawler_frame:{session_id}", frame_b64, expires_in_sec=20)
				except Exception:
					pass

			# 5. Update metadata
			try:
				meta["url"] = page.url
				meta["title"] = page.title()
				meta["frame_seq"] = frame_seq
				redis.set_value(f"crawler_meta:{session_id}", json.dumps(meta), expires_in_sec=600)
			except Exception:
				pass

			# Pump Playwright events
			page.wait_for_timeout(100)

	except Exception as err:
		meta["status"] = "error"
		meta["error"] = str(err)
		redis.set_value(f"crawler_meta:{session_id}", json.dumps(meta), expires_in_sec=60)
		frappe.log_error(title="Crawler Browser Worker Error", message=str(err))
	finally:
		if cdp:
			try:
				cdp.send("Page.stopScreencast")
			except Exception:
				pass
		if context:
			try:
				context.close()
			except Exception:
				pass
		if browser:
			try:
				browser.close()
			except Exception:
				pass
		if playwright:
			try:
				playwright.stop()
			except Exception:
				pass
		shutil.rmtree(temp_dir, ignore_errors=True)
		redis.delete_value(f"crawler_frame:{session_id}")
		redis.delete_value(f"crawler_heartbeat:{session_id}")
		redis.delete_value(f"crawler_cmd:{session_id}")
		redis.delete(f"crawler_inputs:{session_id}")
		if meta.get("status") == "closed":
			redis.delete_value(f"crawler_meta:{session_id}")
		if user:
			redis.delete_value(f"crawler_active_session:{user}")


@frappe.whitelist()
def send_crawler_input(session_id: str, input_event: str | dict | list) -> dict:
	"""Immediately queues an input event and updates client heartbeat for minimal latency."""
	assert_crawler_admin()
	redis = get_redis_client()
	ev = input_event
	if isinstance(ev, str):
		try:
			ev = json.loads(ev)
		except Exception:
			pass
	if isinstance(ev, list):
		for item in ev:
			redis.rpush(f"crawler_inputs:{session_id}", json.dumps(item))
	else:
		redis.rpush(f"crawler_inputs:{session_id}", json.dumps(ev))
	redis.set_value(f"crawler_heartbeat:{session_id}", time.time(), expires_in_sec=120)
	return {"ok": True}



@frappe.whitelist()
def poll_login_session(session_id: str, inputs: str | None = None, last_frame_seq: int = 0) -> dict:
	"""Polls live status and JPEG frame for remote browser login dialog."""
	assert_crawler_admin()
	redis = get_redis_client()

	meta_raw = redis.get_value(f"crawler_meta:{session_id}", use_local_cache=False)
	if not meta_raw:
		return {"status": "closed", "message": _("Login session has expired or closed.")}

	if isinstance(meta_raw, bytes):
		meta_raw = meta_raw.decode("utf-8")
	meta = json.loads(meta_raw)

	curr_status = meta.get("status", "active")
	if curr_status in ("closed", "completed", "error"):
		return {
			"status": curr_status,
			"frame_b64": None,
			"frame_seq": int(meta.get("frame_seq", 0)),
			"url": meta.get("url", ""),
			"title": meta.get("title", ""),
			"elapsed": int(time.time() - meta.get("started_at", time.time())),
			"remaining": 0,
		}

	# Refresh heartbeat only for active sessions
	redis.set_value(f"crawler_heartbeat:{session_id}", time.time(), expires_in_sec=120)

	# Queue any input events received
	if inputs:
		try:
			input_list = json.loads(inputs) if isinstance(inputs, str) else inputs
			for inp in input_list:
				redis.rpush(f"crawler_inputs:{session_id}", json.dumps(inp))
		except Exception:
			pass

	curr_frame_seq = int(meta.get("frame_seq", 0))
	last_frame_seq = int(last_frame_seq or 0)

	frame_b64 = None
	if curr_frame_seq != last_frame_seq or last_frame_seq == 0:
		raw_frame = redis.get_value(f"crawler_frame:{session_id}", use_local_cache=False)
		if isinstance(raw_frame, bytes):
			frame_b64 = raw_frame.decode("ascii")
		elif isinstance(raw_frame, str):
			frame_b64 = raw_frame

	elapsed = int(time.time() - meta.get("started_at", time.time()))
	remaining = max(0, 600 - elapsed)

	return {
		"status": curr_status,
		"frame_b64": frame_b64,
		"frame_seq": curr_frame_seq,
		"url": meta.get("url", ""),
		"title": meta.get("title", ""),
		"elapsed": elapsed,
		"remaining": remaining,
	}


@frappe.whitelist()
def complete_login_session(session_id: str) -> dict:
	"""Finalizes login session: worker saves session directly into Crawler Account,
	and this handler reads the resulting completion status.
	"""
	assert_crawler_admin()

	redis = get_redis_client()
	meta_raw = redis.get_value(f"crawler_meta:{session_id}", use_local_cache=False)
	if not meta_raw:
		frappe.throw(_("Session {0} not found or expired.").format(session_id))

	if isinstance(meta_raw, bytes):
		meta_raw = meta_raw.decode("utf-8")
	meta = json.loads(meta_raw)
	account_name = meta["account_name"]

	# Send complete command to worker
	redis.set_value(f"crawler_cmd:{session_id}", "complete", expires_in_sec=60)

	# Poll for completion status (saved directly by worker into DB)
	completed_meta = None
	for _attempt in range(80):
		time.sleep(0.05)
		m_raw = redis.get_value(f"crawler_meta:{session_id}", use_local_cache=False)
		if m_raw:
			if isinstance(m_raw, bytes):
				m_raw = m_raw.decode("utf-8")
			m = json.loads(m_raw)
			if m.get("status") == "completed":
				completed_meta = m
				break
			elif m.get("status") == "error":
				frappe.throw(_("Error saving crawler session: {0}").format(m.get("error", "Unknown error")))

	if not completed_meta:
		frappe.throw(_("Timeout waiting for crawler browser to capture session state."))

	account = frappe.get_doc("Background Check Crawler Account", account_name)

	# Clean up session keys from Redis
	user = getattr(frappe.session, "user", None)
	if user:
		redis.delete_value(f"crawler_active_session:{user}")
	redis.delete_value(f"crawler_meta:{session_id}")
	redis.delete_value(f"crawler_frame:{session_id}")
	redis.delete_value(f"crawler_cmd:{session_id}")
	redis.delete_value(f"crawler_heartbeat:{session_id}")

	return {
		"status": "Connected",
		"account_name": account_name,
		"platform": account.platform,
		"session_expires_on": str(account.session_expires_on),
		"cookie_domains_found": completed_meta.get("cookie_domains_found", []),
		"message": _("Crawler account session saved successfully."),
	}


@frappe.whitelist()
def close_login_session(session_id: str) -> dict:
	"""Closes remote login session and signals worker to terminate."""
	assert_crawler_admin()
	redis = get_redis_client()
	redis.set_value(f"crawler_cmd:{session_id}", "close", expires_in_sec=60)
	user = getattr(frappe.session, "user", None)
	if user:
		redis.delete_value(f"crawler_active_session:{user}")
	return {"status": "closing"}


@frappe.whitelist()
def import_manual_storage_state(account_name: str, raw_json: str) -> dict:
	"""Fallback mechanism: imports storage_state or cookies pasted manually by System Manager."""
	assert_crawler_admin()
	if not frappe.db.exists("Background Check Crawler Account", account_name):
		frappe.throw(_("Crawler Account {0} not found.").format(account_name))

	account = frappe.get_doc("Background Check Crawler Account", account_name)
	if not bool(account.risk_acknowledged):
		frappe.throw(
			_("Risk acknowledgment is required before saving crawler session."),
			title=_("Risk Acknowledgment Required"),
		)

	return save_crawler_storage_state(account_name, raw_json)


def filter_and_validate_cookies(storage_state_data: dict, session_domains_raw: str | None) -> tuple[dict, list[str], datetime]:
	"""Filters cookies strictly to session_domains, extracts unique domains, and computes earliest expiry."""
	allowed_domains = [d.strip().lower().lstrip(".") for d in (session_domains_raw or "").splitlines() if d.strip()]

	cookies = storage_state_data.get("cookies", [])
	filtered_cookies = []
	cookie_domains_found = set()

	for c in cookies:
		raw_dom = c.get("domain", "")
		clean_dom = raw_dom.lower().lstrip(".")
		if raw_dom:
			cookie_domains_found.add(raw_dom)

		if not allowed_domains or any(clean_dom == ad or clean_dom.endswith("." + ad) for ad in allowed_domains):
			filtered_cookies.append(c)

	storage_state_data["cookies"] = filtered_cookies

	# Compute expiration
	expirations = [c["expires"] for c in filtered_cookies if c.get("expires") and c["expires"] > 0]
	if expirations:
		min_exp = min(expirations)
		# Some platform cookies have far future or negative timestamps; guard sensible range
		if min_exp > time.time():
			session_expires_on = datetime.fromtimestamp(min_exp)
		else:
			session_expires_on = add_days(now_datetime(), 30)
	else:
		session_expires_on = add_days(now_datetime(), 30)

	return storage_state_data, sorted(cookie_domains_found), session_expires_on


def save_crawler_storage_state(account_name: str, raw_json: str) -> dict:
	"""Validates, filters to session_domains, encrypts, and stores session state on Crawler Account."""
	account = frappe.get_doc("Background Check Crawler Account", account_name)
	platform = frappe.get_doc("Background Check Platform", account.platform)

	try:
		parsed = json.loads(raw_json)
		if isinstance(parsed, list):
			# If user pasted array of cookies directly, wrap into storage_state dict
			parsed = {"cookies": parsed, "origins": []}
	except Exception as err:
		frappe.throw(_("Invalid JSON format for session storage state: {0}").format(err))

	filtered_state, found_domains, session_expires_on = filter_and_validate_cookies(
		parsed, platform.session_domains
	)

	if not filtered_state.get("cookies"):
		frappe.throw(
			_("No valid authentication cookies found matching platform session domains: {0}").format(
				platform.session_domains
			)
		)

	# Store encrypted session string using Frappe password field handler
	account.session = json.dumps(filtered_state)

	account.status = "Connected"
	account.connected_by = getattr(frappe.session, "user", None) or "Administrator"
	account.connected_on = now_datetime()
	account.session_expires_on = session_expires_on
	account.last_error = None
	account.last_error_template = None
	account.last_error_params = None
	account.save(ignore_permissions=True)

	return {
		"status": "Connected",
		"account_name": account_name,
		"platform": account.platform,
		"session_expires_on": str(session_expires_on),
		"cookie_domains_found": found_domains,
		"message": _("Crawler account session saved successfully."),
	}


def get_decrypted_storage_state(account_name: str) -> dict | None:
	"""Retrieves and decrypts the stored session storage_state for a Crawler Account.

	Only callable internally by authorized scraping routines; never exposed via API.
	"""
	if not frappe.db.exists("Background Check Crawler Account", account_name):
		return None

	account = frappe.get_doc("Background Check Crawler Account", account_name)
	if not account.enabled or account.status != "Connected":
		return None

	raw_json = account.get_password("session", raise_exception=False)
	if not raw_json:
		return None

	try:
		return json.loads(raw_json)
	except Exception:
		return None


@frappe.whitelist()
def disconnect_account(account_name: str) -> dict:
	"""Disconnects crawler account and erases session credentials."""
	assert_crawler_admin()
	if not frappe.db.exists("Background Check Crawler Account", account_name):
		frappe.throw(_("Crawler Account {0} not found.").format(account_name))

	account = frappe.get_doc("Background Check Crawler Account", account_name)
	account.disconnect()
	return {"status": "Not connected", "message": _("Crawler account disconnected.")}


@frappe.whitelist()
def test_account_session(account_name: str) -> dict:
	"""Tests the validity of a connected crawler account session."""
	assert_crawler_admin()
	if not frappe.db.exists("Background Check Crawler Account", account_name):
		frappe.throw(_("Crawler Account {0} not found.").format(account_name))

	account = frappe.get_doc("Background Check Crawler Account", account_name)
	if account.status != "Connected":
		return {
			"status": account.status,
			"message": _("Account is not connected (current status: {0}).").format(account.status),
		}

	state = get_decrypted_storage_state(account_name)
	if not state or not state.get("cookies"):
		account.status = "Expired"
		account.last_error = "Session storage state is empty or invalid"
		account.last_error_template = "Session storage state is empty or invalid"
		account.last_error_params = "{}"
		account.last_checked_on = now_datetime()
		account.save(ignore_permissions=True)
		return {"status": "Expired", "message": _("Stored session state is empty or invalid.")}

	# Check expiration of cookies
	now_ts = time.time()
	active_cookies = [c for c in state.get("cookies", []) if not c.get("expires") or c["expires"] > now_ts]
	if not active_cookies:
		account.status = "Expired"
		account.last_error = "All session cookies have expired"
		account.last_error_template = "All session cookies have expired"
		account.last_error_params = "{}"
		account.last_checked_on = now_datetime()
		account.save(ignore_permissions=True)
		return {"status": "Expired", "message": _("All session cookies have expired.")}

	account.last_checked_on = now_datetime()
	account.last_error = None
	account.last_error_template = None
	account.last_error_params = None
	account.save(ignore_permissions=True)

	return {
		"status": "Connected",
		"account_label": account.account_label,
		"platform": account.platform,
		"cookie_count": len(active_cookies),
		"session_expires_on": str(account.session_expires_on),
		"message": _("Session valid: {0} active cookies found.").format(len(active_cookies)),
	}


@frappe.whitelist()
def get_crawler_accounts_list() -> list[dict]:
	"""Returns safe metadata list of crawler accounts for Settings Social Accounts tab."""
	assert_crawler_admin()
	accounts = frappe.get_all(
		"Background Check Crawler Account",
		fields=[
			"name",
			"platform",
			"account_label",
			"account_handle",
			"enabled",
			"status",
			"risk_acknowledged",
			"connected_by",
			"connected_on",
			"session_expires_on",
			"last_checked_on",
			"last_used_on",
			"last_error",
		],
		order_by="platform asc, creation desc",
	)
	return accounts


def get_eligible_crawler_account_for_url(url: str) -> dict | None:
	"""Determines if there is a Connected crawler account eligible for fetching the given URL.
	Requires System Manager, platform match via session_domains, and risk_acknowledged.
	"""
	if "System Manager" not in frappe.get_roles():
		return None

	from hris_ats.bgc.fetch import get_domain
	domain = get_domain(url).lower().lstrip(".")

	platforms = frappe.get_all(
		"Background Check Platform",
		filters={"enabled": 1},
		fields=["name", "session_domains"],
	)

	matching_platform = None
	for p in platforms:
		allowed = [d.strip().lower().lstrip(".") for d in (p.session_domains or "").splitlines() if d.strip()]
		if any(domain == ad or domain.endswith("." + ad) for ad in allowed):
			matching_platform = p.name
			break

	if not matching_platform:
		return None

	# Find active crawler account
	accounts = frappe.get_all(
		"Background Check Crawler Account",
		filters={
			"platform": matching_platform,
			"status": "Connected",
			"enabled": 1,
			"risk_acknowledged": 1,
		},
		fields=[
			"name",
			"account_label",
			"platform",
			"hourly_limit",
			"daily_limit",
			"min_delay_seconds",
			"jitter_seconds",
			"last_used_on",
		],
		order_by="creation desc",
		limit=1,
	)

	if not accounts:
		return None

	return accounts[0]


def check_and_update_crawler_rate_limits(account_name: str) -> None:
	"""Enforces hourly and daily limits for a crawler account and records last_used_on."""
	account = frappe.get_doc("Background Check Crawler Account", account_name)
	hourly_limit = account.hourly_limit or 5
	daily_limit = account.daily_limit or 40

	redis = get_redis_client()
	hour_key = f"crawler_req_hour:{account_name}"
	day_key = f"crawler_req_day:{account_name}"

	h_val = redis.get_value(hour_key, use_local_cache=False) or 0
	d_val = redis.get_value(day_key, use_local_cache=False) or 0
	h_count = int(h_val)
	d_count = int(d_val)

	if h_count >= hourly_limit:
		frappe.throw(
			_("Hourly rate limit of {0} requests exceeded for crawler account {1}.").format(
				hourly_limit, account.account_label
			),
			title=_("Rate Limit Exceeded"),
		)
	if d_count >= daily_limit:
		frappe.throw(
			_("Daily rate limit of {0} requests exceeded for crawler account {1}.").format(
				daily_limit, account.account_label
			),
			title=_("Rate Limit Exceeded"),
		)

	# Increment counts
	redis.set_value(hour_key, h_count + 1, expires_in_sec=3600)
	redis.set_value(day_key, d_count + 1, expires_in_sec=86400)

	# Update last_used_on in DB
	frappe.db.set_value(
		"Background Check Crawler Account",
		account_name,
		{"last_used_on": now_datetime()},
		update_modified=False,
	)


def mark_crawler_account_challenge(account_name: str, reason: str) -> None:
	"""Updates crawler account status to Challenge on encountering checkpoint/challenge."""
	try:
		acc = frappe.get_doc("Background Check Crawler Account", account_name)
		acc.status = "Challenge"
		acc.last_error = reason
		acc.last_error_template = "Crawler encountered challenge or checkpoint: {reason}"
		acc.last_error_params = json.dumps({"reason": reason})
		acc.last_checked_on = now_datetime()
		acc.save(ignore_permissions=True)
	except Exception:
		pass


def extract_profile_data_summary(html: str) -> dict:
	"""Ekstrak ringkasan profil untuk perbandingan mode Session vs non-session."""
	from hris_ats.hris_ats.doctype.background_check_settings.background_check_settings import (
		extract_page_signals,
	)

	if not html:
		return {
			"posts_count": 0,
			"has_name": False,
			"name": None,
			"has_bio": False,
			"has_followers": False,
			"followers": None,
		}

	signals = extract_page_signals(html)
	og_desc = signals.get("og_description", "")
	full_text = signals.get("full_text", "")
	combined = f"{og_desc} {full_text}"

	# Followers
	followers_val = None
	has_followers = False
	m_f = re.search(r"([\d,.]+[kKmM]?)\s*(?:Followers|Pengikut)", combined, re.IGNORECASE)
	if m_f:
		has_followers = True
		followers_val = m_f.group(1)

	# Posts count
	posts_count = 0
	m_p = re.search(r"([\d,.]+)\s*(?:Posts|Postingan)", combined, re.IGNORECASE)
	if m_p:
		try:
			posts_count = int(m_p.group(1).replace(",", "").replace(".", ""))
		except Exception:
			pass
	else:
		p_links = re.findall(r'href=["\']/p/[A-Za-z0-9_-]+/?["\']', html)
		if p_links:
			posts_count = len(set(p_links))

	# Name
	has_name = False
	name_val = None
	title = signals.get("title", "")
	m_name = re.match(r"^([^•·|(\n]+?)(?:\s*\(@[a-zA-Z0-9._-]+\)|\s*•|\s*·|\s*\||\s*$)", title)
	if m_name and len(m_name.group(1).strip()) > 1:
		has_name = True
		name_val = m_name.group(1).strip()
	elif signals.get("og_title"):
		has_name = True
		name_val = signals["og_title"]

	# Bio
	has_bio = False
	if " - See Instagram photos and videos" in og_desc:
		has_bio = True
	elif len(signals.get("meta_description", "")) > 10:
		has_bio = True
	elif len(full_text) > 300:
		has_bio = True

	return {
		"posts_count": posts_count,
		"has_name": has_name,
		"name": name_val,
		"has_bio": has_bio,
		"has_followers": has_followers,
		"followers": followers_val,
	}
