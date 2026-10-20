# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

from __future__ import annotations

import html
import json
import re
from typing import Any

from hris_ats.bgc.adaptive import create_adaptive_adaptor
from hris_ats.bgc.providers.social.base import BaseSocialAdapter, clean_snippet
from hris_ats.hris_ats.doctype.background_check_settings.background_check_settings import (
	detect_login_page,
	extract_page_signals,
)


class TikTokAdapter(BaseSocialAdapter):
	platform_name: str = "TikTok"
	default_url_template: str = "https://www.tiktok.com/@{username}"

	def parse_profile(self, raw_html: str, url: str = "") -> dict[str, Any]:
		if not raw_html:
			return {"status": "Failed", "error": "empty response", "posts": []}

		signals = extract_page_signals(raw_html)
		lower_html = raw_html.lower()
		# The public profile ships as structured JSON; its presence means the page is not a login wall
		has_profile_json = "__universal_data_for_rehydration__" in lower_html and '"uniqueid"' in lower_html
		if not has_profile_json and detect_login_page(url, raw_html, signals.get("preview", "")):
			return {
				"status": "Failed",
				"error": "login required",
				"posts": [],
				"hint": "use candidate export",
			}

		# The page's translation bundle contains the "private account" strings for every visitor, so the
		# text check is only used when the structured profile JSON is absent.
		if not has_profile_json and ("this account is private" in lower_html or "akun ini bersifat privat" in lower_html):
			return {
				"status": "Failed",
				"error": "private profile",
				"is_private": True,
				"posts": [],
			}

		title = signals.get("title", "")
		display_name = ""
		# Format: "Nama (@handle) | TikTok"
		m = re.search(r"^(.*?)(?:\s*\(@[a-zA-Z0-9._-]+\))?\s*\|\s*TikTok", title)
		if m:
			display_name = m.group(1).strip()
		elif signals.get("og_title"):
			m2 = re.search(r"^(.*?)(?:\s*\(@[a-zA-Z0-9._-]+\))?", signals["og_title"])
			display_name = m2.group(1).strip() if m2 else signals["og_title"]

		bio = signals.get("og_description", "") or signals.get("meta_description", "")
		followers_count = None
		following_count = None
		posts_count_total = None

		# Profil publik TikTok ada di JSON hydration (nickname, bio, statistik), bukan di <title>
		for script_match in re.finditer(r'<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)</script>', raw_html, re.DOTALL):
			try:
				scope = json.loads(script_match.group(1)).get("__DEFAULT_SCOPE__", {})
				detail = scope.get("webapp.user-detail", {}) or {}
				info = detail.get("userInfo") or {}
				user = info.get("user") or {}
				stats = info.get("stats") or {}
				if user.get("uniqueId"):
					display_name = user.get("nickname") or display_name
					bio = user.get("signature") or bio
					if user.get("privateAccount"):
						return {"status": "Failed", "error": "private profile", "is_private": True, "posts": []}
					followers_count = stats.get("followerCount", followers_count)
					following_count = stats.get("followingCount", following_count)
					posts_count_total = stats.get("videoCount")
				elif detail.get("statusCode") not in (None, 0):
					return {"status": "Failed", "error": "not found", "posts": []}
			except Exception:
				pass

		# Cek follower count dari meta description
		fol_m = re.search(r"([\d,.]+)\s*(?:Followers|Pengikut)", bio, re.IGNORECASE) if followers_count is None else None
		if fol_m:
			try:
				followers_count = int(fol_m.group(1).replace(",", "").replace(".", ""))
			except Exception:
				pass

		posts: list[dict[str, Any]] = []

		# Ekstrak caption video dari embedded SIGI_STATE atau JSON hydration
		for script_match in re.finditer(r'<script id="(?:SIGI_STATE|__UNIVERSAL_DATA_FOR_REHYDRATION__)"[^>]*>(.*?)</script>', raw_html):
			try:
				data = json.loads(script_match.group(1))
				item_module = data.get("ItemModule", {})
				for _id, item in item_module.items():
					desc = item.get("desc", "")
					if desc:
						clean_desc = clean_snippet(desc)
						if clean_desc and not any(p["snippet"] == clean_desc for p in posts):
							posts.append({
								"snippet": clean_desc,
								"published_on": None,
								"url": f"{url}/video/{item.get('id', '')}" if item.get("id") else url,
								"media_type": "Video",
							})
			except Exception:
				pass

		# Fallback: cari tag video / deskripsi dari HTML
		# Skipped when the structured profile exists: the page's generic "desc" strings are SEO text, not videos
		if not posts and not has_profile_json:
			for m_desc in re.finditer(r'"desc":\s*"([^"]+)"', raw_html):
				desc_str = clean_snippet(html.unescape(m_desc.group(1)))
				if desc_str and len(desc_str) > 10 and not any(p["snippet"] == desc_str for p in posts):
					posts.append({
						"snippet": desc_str,
						"published_on": None,
						"url": url,
						"media_type": "Video",
					})

		return {
			"status": "Success",
			"error": None,
			"is_private": False,
			"display_name": display_name,
			"bio": bio,
			"location": "",
			"followers_count": followers_count,
			"following_count": following_count,
			"posts_count": posts_count_total if posts_count_total is not None else (len(posts) if posts else None),
			"posts": posts,
		}

	def extract_candidate_comments(
		self,
		raw_html: str,
		candidate_username: str,
		url: str = "",
	) -> tuple[list[dict[str, Any]], str | None]:
		if not raw_html or not candidate_username:
			return [], "not exposed by platform"

		clean_target = candidate_username.strip().lstrip("@").lower()
		comments: list[dict[str, Any]] = []

		for match in re.finditer(
			r'\{[^{}]*?"unique_id":\s*"([^"]+)"[^{}]*?"text":\s*"([^"]+)"[^{}]*?\}',
			raw_html,
		):
			author = match.group(1).strip().lower()
			text_raw = match.group(2)
			if author == clean_target:
				clean_text = clean_snippet(html.unescape(text_raw))
				if clean_text and not any(c["snippet"] == clean_text for c in comments):
					comments.append({
						"snippet": clean_text,
						"published_on": None,
						"url": url,
						"media_type": "Text",
					})

		return comments, "not exposed by platform"
