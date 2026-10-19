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


class LinkedInAdapter(BaseSocialAdapter):
	platform_name: str = "LinkedIn"
	default_url_template: str = "https://www.linkedin.com/in/{username}/"

	def parse_profile(self, raw_html: str, url: str = "") -> dict[str, Any]:
		if not raw_html:
			return {"status": "Failed", "error": "empty response", "posts": []}

		signals = extract_page_signals(raw_html)
		if detect_login_page(url, raw_html, signals.get("preview", "")):
			return {
				"status": "Failed",
				"error": "login required",
				"posts": [],
				"hint": "use candidate export",
			}

		lower_html = raw_html.lower()
		if "page not found" in lower_html or "profile not found" in lower_html:
			return {"status": "Failed", "error": "profile not found", "posts": []}

		title = signals.get("title", "")
		display_name = ""
		# Format title: "Nama - Title/Headline | LinkedIn" atau "Nama | LinkedIn"
		m = re.search(r"^(.*?)(?:\s*-\s*[^|]+)?\s*\|\s*LinkedIn", title)
		if m:
			display_name = m.group(1).strip()
		elif signals.get("og_title"):
			m2 = re.search(r"^(.*?)(?:\s*-\s*[^|]+)?\s*\|\s*LinkedIn", signals["og_title"])
			display_name = m2.group(1).strip() if m2 else signals["og_title"]

		bio = signals.get("og_description", "") or signals.get("meta_description", "")
		location = ""

		# Cari JSON-LD Person
		for match in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', raw_html, re.DOTALL):
			try:
				ld = json.loads(match.group(1))
				if isinstance(ld, dict) and ld.get("@type") == "Person":
					if not display_name and ld.get("name"):
						display_name = ld["name"]
					if ld.get("jobTitle") and not bio:
						bio = ld["jobTitle"]
					addr = ld.get("address", {})
					if isinstance(addr, dict) and addr.get("addressLocality"):
						location = addr["addressLocality"]
			except Exception:
				pass

		posts: list[dict[str, Any]] = []

		# Cari postingan/aktivitas publik dari adaptor Scrapling
		adaptor = create_adaptive_adaptor(raw_html)
		if adaptor:
			for post_el in adaptor.css(".feed-shared-update-v2__description, .attributed-text-segment-list__content, .activity-card__text"):
				text = post_el.text.strip()
				clean_text = clean_snippet(text)
				if clean_text and not any(p["snippet"] == clean_text for p in posts):
					posts.append({
						"snippet": clean_text,
						"published_on": None,
						"url": url,
						"media_type": "Text",
					})

		# Fallback: cari update-text di dalam HTML mentah
		if not posts:
			for p_match in re.finditer(r'"commentary":\s*\{\s*"text":\s*"([^"]+)"', raw_html):
				clean_comm = clean_snippet(html.unescape(p_match.group(1)))
				if clean_comm and not any(p["snippet"] == clean_comm for p in posts):
					posts.append({
						"snippet": clean_comm,
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
			"location": location,
			"followers_count": None,
			"following_count": None,
			"posts_count": len(posts) if posts else None,
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

		# 1. Cari via embedded JSON
		for match in re.finditer(
			r'\{[^{}]*?"author":\s*\{[^{}]*?"(?:username|identifier)":\s*"([^"]+)"[^{}]*?\}[^{}]*?"text":\s*"([^"]+)"[^{}]*?\}',
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

		# 2. Cari via parser adaptor Scrapling jika ada comment card
		adaptor = create_adaptive_adaptor(raw_html)
		if adaptor:
			for item in adaptor.css(".comments-comment-item, .activity-comment-item, article[data-activity-type='comment']"):
				author_matches = item.css(".comments-post-meta__name-text, .actor-name, .author-name")
				author_name = author_matches[0].text.strip().lower() if author_matches else ""
				if author_name and (clean_target in author_name or author_name in clean_target):
					text_matches = item.css(".comments-comment-item__main-content, .comment-text, .feed-shared-update-v2__commentary")
					if text_matches:
						c_text = clean_snippet(text_matches[0].text)
						if c_text and not any(c["snippet"] == c_text for c in comments):
							comments.append({
								"snippet": c_text,
								"published_on": None,
								"url": url,
								"media_type": "Text",
							})

		limitation = None if comments else "not exposed by platform"
		return comments, limitation
