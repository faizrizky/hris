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


class InstagramAdapter(BaseSocialAdapter):
	platform_name: str = "Instagram"
	default_url_template: str = "https://www.instagram.com/{username}/"

	def parse_profile(self, raw_html: str, url: str = "") -> dict[str, Any]:
		if not raw_html:
			return {"status": "Failed", "error": "empty response", "posts": []}

		# Cek login wall
		signals = extract_page_signals(raw_html)
		if detect_login_page(url, raw_html, signals.get("preview", "")):
			return {
				"status": "Failed",
				"error": "login required",
				"posts": [],
				"hint": "use candidate export",
			}

		# Cek akun privat
		lower_html = raw_html.lower()
		if "this account is private" in lower_html or "akun ini bersifat pribadi" in lower_html:
			return {
				"status": "Failed",
				"error": "private profile",
				"is_private": True,
				"posts": [],
			}

		title = signals.get("title", "")
		og_desc = signals.get("og_description", "")
		meta_desc = signals.get("meta_description", "")

		# Ekstrak display name dari title atau og:title
		# Contoh format: "Robby Imam Prakoso (@robbyimamp) • Instagram photos and videos"
		display_name = ""
		name_match = re.search(r"^(.*?)(?:\s*\(@[a-zA-Z0-9._-]+\))?\s*•\s*Instagram", title)
		if name_match:
			display_name = name_match.group(1).strip()
		elif signals.get("og_title"):
			og_match = re.search(r"^(.*?)(?:\s*\(@[a-zA-Z0-9._-]+\))?\s*•", signals["og_title"])
			if og_match:
				display_name = og_match.group(1).strip()

		# Ekstrak follower/following/posts count dari og_desc
		# Contoh: "1,367 Followers, 414 Following, 25 Posts - See Instagram photos and videos from ..."
		followers_count = None
		following_count = None
		posts_count = None
		bio = ""

		desc_text = og_desc or meta_desc
		if desc_text:
			fol_m = re.search(r"([\d,.]+)\s*(?:Followers|Pengikut)", desc_text, re.IGNORECASE)
			if fol_m:
				try:
					followers_count = int(fol_m.group(1).replace(",", "").replace(".", ""))
				except Exception:
					pass

			flg_m = re.search(r"([\d,.]+)\s*(?:Following|Mengikuti)", desc_text, re.IGNORECASE)
			if flg_m:
				try:
					following_count = int(flg_m.group(1).replace(",", "").replace(".", ""))
				except Exception:
					pass

			pst_m = re.search(r"([\d,.]+)\s*(?:Posts|Postingan)", desc_text, re.IGNORECASE)
			if pst_m:
				try:
					posts_count = int(pst_m.group(1).replace(",", "").replace(".", ""))
				except Exception:
					pass

			# Bio sering kali setelah tanda strip "-"
			parts = desc_text.split(" - ", 1)
			if len(parts) > 1:
				bio = parts[1].strip()

		# Ekstrak postingan dari JSON tertanam atau meta atau tag artikel
		posts: list[dict[str, Any]] = []

		# 1. Cari data JSON di tag <script type="application/ld+json"> atau window._sharedData
		for match in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', raw_html, re.DOTALL):
			try:
				ld_data = json.loads(match.group(1))
				if isinstance(ld_data, dict):
					if ld_data.get("@type") == "Person":
						if not display_name and ld_data.get("name"):
							display_name = ld_data["name"]
						if not bio and ld_data.get("description"):
							bio = ld_data["description"]
			except Exception:
				pass

		# 2. Cari blok postingan dari pattern JSON Instagram yang tertanam
		# Pattern post caption/edge_media_to_caption
		post_matches = re.finditer(r'"caption":\s*"([^"\\]*(?:\\.[^"\\]*)*)"', raw_html)
		for pm in post_matches:
			caption_raw = pm.group(1)
			clean_cap = clean_snippet(html.unescape(caption_raw))
			if clean_cap and not any(p["snippet"] == clean_cap for p in posts):
				posts.append({
					"snippet": clean_cap,
					"published_on": None,
					"url": url,
					"media_type": "Photo",
				})

		# 3. Fallback: Ekstrak dari elemen meta atau artikel jika Scrapling terpasang
		adaptor = create_adaptive_adaptor(raw_html)
		if adaptor and not posts:
			for post_el in adaptor.css("article a, div[role='presentation'] img[alt]"):
				alt_text = post_el.attrib.get("alt", "")
				if alt_text and len(alt_text) > 10:
					clean_alt = clean_snippet(alt_text)
					if not any(p["snippet"] == clean_alt for p in posts):
						posts.append({
							"snippet": clean_alt,
							"published_on": None,
							"url": url,
							"media_type": "Photo",
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
			"posts_count": posts_count,
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
			r'"owner":\s*\{[^}]*?"username":\s*"([^"]+)"[^}]*\}.*?"text":\s*"([^"\\]*(?:\\.[^"\\]*)*)"',
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
