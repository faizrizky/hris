# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

from __future__ import annotations

import re
from typing import Any

from hris_ats.bgc.providers.social.base import BaseSocialAdapter
from hris_ats.hris_ats.doctype.background_check_settings.background_check_settings import (
	detect_login_page,
	extract_page_signals,
)


class ThreadsAdapter(BaseSocialAdapter):
	"""Threads (Meta). Anonymous requests from a server get HTTP 429, so posts and replies are read
	from a signed-in browser session (see threads_browser.py); this adapter only handles the public
	profile page when it is reachable."""

	platform_name: str = "Threads"
	default_url_template: str = "https://www.threads.com/@{username}"

	def parse_profile(self, raw_html: str, url: str = "") -> dict[str, Any]:
		if not raw_html:
			return {"status": "Failed", "error": "empty response", "posts": []}
		signals = extract_page_signals(raw_html)
		if detect_login_page(url, raw_html, signals.get("preview", "")):
			return {"status": "Failed", "error": "login required", "posts": [], "hint": "use crawler account"}

		og_title = signals.get("og_title") or signals.get("title") or ""
		# "Name (@handle) • Threads, Say more"
		m = re.match(r"^(.*?)\s*\(@[^)]+\)", og_title)
		display_name = (m.group(1) if m else "").strip()
		desc = signals.get("og_description") or signals.get("meta_description") or ""
		followers = None
		fm = re.search(r"([\d.,]+[KMkm]?)\s*(?:Followers|Pengikut)", desc)
		if fm:
			followers = fm.group(1)
		return {
			"status": "Success",
			"error": None,
			"is_private": False,
			"display_name": display_name,
			"bio": desc.split(" - ", 1)[-1].strip() if " - " in desc else "",
			"location": "",
			"followers_count": followers if isinstance(followers, int) else None,
			"following_count": None,
			"posts_count": None,
			"posts": [],
		}
