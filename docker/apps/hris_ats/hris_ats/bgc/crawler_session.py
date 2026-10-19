# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

from __future__ import annotations

import base64
import json
import os
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
		redis.set_value(f"crawler_cmd:{old_session}", "close", expires_in_sec=15)

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

	# 5. Enqueue background browser worker
	frappe.enqueue(
		"hris_ats.bgc.crawler_session.run_remote_browser_worker",
		queue="long",
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
	"""Background worker loop managing headless Chromium browser for remote login."""
	from playwright.sync_api import sync_playwright

	redis = get_redis_client()
	meta_raw = redis.get_value(f"crawler_meta:{session_id}")
	if not meta_raw:
		return
	if isinstance(meta_raw, bytes):
		meta_raw = meta_raw.decode("utf-8")
	meta = json.loads(meta_raw)

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

		# Domain restriction: block navigation to unallowed domains
		def handle_route(route):
			req_url = route.request.url
			if not route.request.is_navigation_request() or is_domain_allowed(req_url):
				route.continue_()
			else:
				route.abort()

		page.route("**/*", handle_route)

		# Initial navigation to login URL
		try:
			page.goto(platform.login_url, wait_until="domcontentloaded", timeout=25000)
		except Exception as e:
			frappe.log_error(title="Crawler Browser Goto Error", message=str(e))

		meta["status"] = "active"
		meta["url"] = page.url
		meta["title"] = page.title()
		redis.set_value(f"crawler_meta:{session_id}", json.dumps(meta), expires_in_sec=600)

		start_time = time.time()
		max_duration = 600  # 10 minutes timeout

		while time.time() - start_time < max_duration:
			# Check commands
			cmd = redis.get_value(f"crawler_cmd:{session_id}")
			if cmd:
				if isinstance(cmd, bytes):
					cmd = cmd.decode("utf-8")
				if cmd == "complete":
					# Extract storage state
					state = context.storage_state()
					redis.set_value(f"crawler_result:{session_id}", json.dumps(state), expires_in_sec=60)
					meta["status"] = "completed"
					redis.set_value(f"crawler_meta:{session_id}", json.dumps(meta), expires_in_sec=60)
					break
				elif cmd == "close":
					meta["status"] = "closed"
					redis.set_value(f"crawler_meta:{session_id}", json.dumps(meta), expires_in_sec=60)
					break

			# Process queued inputs
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

			# Capture frame JPEG
			try:
				frame_bytes = page.screenshot(type="jpeg", quality=60)
				frame_b64 = base64.b64encode(frame_bytes).decode("ascii")
				redis.set_value(f"crawler_frame:{session_id}", frame_b64, expires_in_sec=20)
			except Exception:
				pass

			# Update metadata
			try:
				meta["url"] = page.url
				meta["title"] = page.title()
				redis.set_value(f"crawler_meta:{session_id}", json.dumps(meta), expires_in_sec=600)
			except Exception:
				pass

			time.sleep(0.5)

	except Exception as err:
		meta["status"] = "error"
		meta["error"] = str(err)
		redis.set_value(f"crawler_meta:{session_id}", json.dumps(meta), expires_in_sec=60)
		frappe.log_error(title="Crawler Browser Worker Error", message=str(err))
	finally:
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
		redis.delete(f"crawler_frame:{session_id}")
		redis.delete(f"crawler_inputs:{session_id}")


@frappe.whitelist()
def poll_login_session(session_id: str, inputs: str | None = None) -> dict:
	"""Polls live status and JPEG frame for remote browser login dialog."""
	assert_crawler_admin()

	redis = get_redis_client()

	# Queue any input events received
	if inputs:
		try:
			input_list = json.loads(inputs) if isinstance(inputs, str) else inputs
			for inp in input_list:
				redis.rpush(f"crawler_inputs:{session_id}", json.dumps(inp))
		except Exception:
			pass

	meta_raw = redis.get_value(f"crawler_meta:{session_id}")
	if not meta_raw:
		return {"status": "closed", "message": _("Login session has expired or closed.")}

	if isinstance(meta_raw, bytes):
		meta_raw = meta_raw.decode("utf-8")
	meta = json.loads(meta_raw)

	frame_b64 = redis.get_value(f"crawler_frame:{session_id}")
	if isinstance(frame_b64, bytes):
		frame_b64 = frame_b64.decode("ascii")

	elapsed = int(time.time() - meta.get("started_at", time.time()))
	remaining = max(0, 600 - elapsed)

	return {
		"status": meta.get("status", "active"),
		"frame_b64": frame_b64 or "",
		"url": meta.get("url", ""),
		"title": meta.get("title", ""),
		"elapsed": elapsed,
		"remaining": remaining,
	}


@frappe.whitelist()
def complete_login_session(session_id: str) -> dict:
	"""Finalizes login session, verifies session, encrypts storage state into Crawler Account."""
	assert_crawler_admin()

	redis = get_redis_client()
	meta_raw = redis.get_value(f"crawler_meta:{session_id}")
	if not meta_raw:
		frappe.throw(_("Session {0} not found or expired.").format(session_id))

	if isinstance(meta_raw, bytes):
		meta_raw = meta_raw.decode("utf-8")
	meta = json.loads(meta_raw)
	account_name = meta["account_name"]

	# Send complete command to worker
	redis.set_value(f"crawler_cmd:{session_id}", "complete", expires_in_sec=15)

	# Poll for storage state result
	result_raw = None
	for _attempt in range(20):
		time.sleep(0.5)
		result_raw = redis.get_value(f"crawler_result:{session_id}")
		if result_raw:
			break

	if not result_raw:
		frappe.throw(_("Timeout waiting for crawler browser to capture session state."))

	if isinstance(result_raw, bytes):
		result_raw = result_raw.decode("utf-8")

	return save_crawler_storage_state(account_name, result_raw)


@frappe.whitelist()
def close_login_session(session_id: str) -> dict:
	"""Closes remote login session and signals worker to terminate."""
	assert_crawler_admin()
	redis = get_redis_client()
	redis.set_value(f"crawler_cmd:{session_id}", "close", expires_in_sec=15)
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
