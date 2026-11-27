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

		followers_count = None
		posts: list[dict[str, Any]] = []

		# JSON-LD profil publik: Person + post (DiscussionForumPosting) + artikel (Article), sering di dalam @graph
		for match in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', raw_html, re.DOTALL):
			try:
				ld = json.loads(match.group(1))
			except Exception:
				continue
			items = ld.get("@graph", [ld]) if isinstance(ld, dict) else ld if isinstance(ld, list) else []
			for item in items:
				if not isinstance(item, dict):
					continue
				if item.get("@type") == "Person":
					if not display_name and item.get("name"):
						display_name = item["name"]
					if item.get("jobTitle") and not bio:
						bio = item["jobTitle"]
					addr = item.get("address", {})
					if isinstance(addr, dict) and addr.get("addressLocality"):
						location = addr["addressLocality"]
					stat = item.get("interactionStatistic")
					if isinstance(stat, dict) and stat.get("name") == "Follows":
						followers_count = stat.get("userInteractionCount")
				elif item.get("@type") in ("DiscussionForumPosting", "Article"):
					text = clean_snippet(item.get("text") or item.get("headline") or "")
					if text and not any(p["url"] == item.get("url") for p in posts):
						published = (item.get("datePublished") or "")[:19].replace("T", " ") or None
						posts.append({
							"snippet": text,
							"published_on": published,
							"url": item.get("url") or url,
							"media_type": "Article" if item["@type"] == "Article" else "Text",
						})

		# Cari postingan/aktivitas publik dari adaptor Scrapling
		adaptor = create_adaptive_adaptor(raw_html) if not posts else None
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
			"followers_count": followers_count,
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
			for item in adaptor.css(".comments-comment-item, .activity-comment-item, article[data-activity-type='comment'], .feed-shared-update-v2"):
				author_matches = item.css(".comments-post-meta__name-text, .actor-name, .author-name, .update-components-actor__name")
				author_name = author_matches[0].text.strip().lower() if author_matches else ""
				target_norm = re.sub(r"[\s\-_.]", "", clean_target)
				author_norm = re.sub(r"[\s\-_.]", "", author_name)
				if author_norm and (target_norm in author_norm or author_norm in target_norm):
					text_matches = item.css(".comments-comment-item__main-content, .comment-text, .feed-shared-update-v2__commentary, .feed-shared-text")
					if text_matches:
						c_text = clean_snippet(text_matches[0].text)
						if c_text and not any(c["snippet"] == c_text for c in comments):
							time_matches = item.css("time")
							c_pub = None
							if time_matches:
								c_pub = time_matches[0].attrib.get("datetime") or time_matches[0].text.strip() or None
							comments.append({
								"snippet": c_text,
								"published_on": c_pub,
								"url": url,
								"media_type": "Text",
							})

		limitation = None if comments else "not exposed by platform"
		return comments, limitation

	def post_page_comments(self, raw_html: str, candidate_username: str, url: str = "") -> list[dict[str, Any]]:
		"""Candidate's comments on a public post page (no login: LinkedIn shows the top ~10 comments).
		The author's /in/ link is only in the HTML comment block; text and date come from the JSON-LD."""
		target = candidate_username.strip().lstrip("@").lower()
		ld_comments: list[dict[str, Any]] = []
		for match in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', raw_html or "", re.DOTALL):
			try:
				ld = json.loads(match.group(1))
			except Exception:
				continue
			if isinstance(ld, dict) and isinstance(ld.get("comment"), list):
				ld_comments.extend(c for c in ld["comment"] if isinstance(c, dict))

		comments: list[dict[str, Any]] = []
		for block in re.split(r'class="comment flex', raw_html or "")[1:]:
			slug = re.search(r'linkedin\.com/in/([^"?/]+)', block)
			text_m = re.search(r'comment__text[^>]*>(.*?)</', block, re.DOTALL)
			if not slug or slug.group(1).lower() != target or not text_m:
				continue
			text = clean_snippet(html.unescape(re.sub(r"<[^>]+>", " ", text_m.group(1))))
			ld = next((c for c in ld_comments if clean_snippet(c.get("text") or "")[:40] == text[:40]), {})
			if text and not any(c["snippet"] == text for c in comments):
				comments.append({
					"snippet": text,
					"published_on": (ld.get("datePublished") or "")[:19].replace("T", " ") or None,
					"url": url,
					"media_type": "Text",
				})
		return comments
