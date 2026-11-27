# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

from __future__ import annotations

import html
import json
import re
from typing import Any

from sentra_ats.bgc.adaptive import create_adaptive_adaptor
from sentra_ats.bgc.providers.social.base import BaseSocialAdapter, clean_snippet
from sentra_ats.sentra_ats.doctype.background_check_settings.background_check_settings import (
	detect_login_page,
	extract_page_signals,
)


class FacebookAdapter(BaseSocialAdapter):
	platform_name: str = "Facebook"
	default_url_template: str = "https://www.facebook.com/{username}"

	def parse_profile(self, raw_html: str, url: str = "") -> dict[str, Any]:
		if not raw_html:
			return {"status": "Failed", "error": "empty response", "posts": []}

		signals = extract_page_signals(raw_html)
		lower_html = raw_html.lower()
		if "content not found" in lower_html or "halaman tidak tersedia" in lower_html:
			return {"status": "Failed", "error": "profile not found", "posts": []}

		if detect_login_page(url, raw_html, signals.get("preview", "")):
			return {
				"status": "Failed",
				"error": "login required",
				"posts": [],
				"hint": "use candidate export",
			}

		title = signals.get("title", "")
		display_name = ""
		# Contoh title: "Budi Santoso | Facebook" atau "Budi Santoso - Home | Facebook"
		m = re.search(r"^(.*?)(?:\s*[-|]\s*(?:Home|Beranda)?\s*\|\s*Facebook|\s*\|\s*Facebook)", title)
		if m:
			display_name = m.group(1).strip()
		elif signals.get("og_title"):
			og_m = re.search(r"^(.*?)(?:\s*[-|]\s*Facebook)", signals["og_title"])
			display_name = og_m.group(1).strip() if og_m else signals["og_title"]

		bio = signals.get("og_description", "") or signals.get("meta_description", "")

		posts: list[dict[str, Any]] = []

		# Story JSON di halaman hasil render: ada tanggal dan link post (tanpa login biasanya 1-3 post saja)
		from sentra_ats.bgc.providers.social.facebook_api import PROFILE_ID_RES, FacebookApiClient
		from sentra_ats.bgc.providers.social.facebook_browser import collect_blobs, story_nodes

		owner_id = next((m.group(1) for r in PROFILE_ID_RES if (m := r.search(raw_html))), None)
		if owner_id:
			helper = FacebookApiClient({})
			for st in story_nodes(collect_blobs(raw_html, [])):
				p = helper.normalize_story(st, {"id": owner_id, "url": url})
				if p and p["snippet"] and not any(x["snippet"] == p["snippet"] for x in posts):
					posts.append({k: p[k] for k in ("snippet", "published_on", "url", "media_type")})

		# Cari postingan dari embedded JSON story text
		for pm in [] if posts else re.finditer(r'"message":\s*\{\s*"text":\s*"([^"]+)"', raw_html):
			msg = clean_snippet(html.unescape(pm.group(1)))
			if msg and not any(p["snippet"] == msg for p in posts):
				posts.append({
					"snippet": msg,
					"published_on": None,
					"url": url,
					"media_type": "Text",
				})

		# Fallback: Cari div teks postingan menggunakan adaptor Scrapling
		adaptor = create_adaptive_adaptor(raw_html)
		if adaptor and not posts:
			for post_el in adaptor.css("div[data-ad-preview='message'], div[dir='auto']"):
				text = post_el.text.strip()
				if len(text) > 20 and not text.startswith(("Facebook", "Log In", "Sign Up", "Like", "Comment", "Share")):
					clean_text = clean_snippet(text)
					if not any(p["snippet"] == clean_text for p in posts):
						posts.append({
							"snippet": clean_text,
							"published_on": None,
							"url": url,
							"media_type": "Text",
						})

		return {
			"status": "Success",
			"error": None,
			"is_private": False,
			"display_name": display_name,
			"bio": bio,
			"location": "",
			"followers_count": None,
			"following_count": None,
			"posts_count": None,
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
			r'\{[^{}]*?"author":\s*\{[^{}]*?"name":\s*"([^"]+)"[^{}]*?\}[^{}]*?"body":\s*\{[^{}]*?"text":\s*"([^"]+)"[^{}]*?\}',
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
