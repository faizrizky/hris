# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Parser ekspor data resmi Instagram (Spesifikasi 5.3 & Fase 4).
Fungsi murni tanpa ketergantungan pada Frappe.
Membaca HANYA berkas yang di-allowlist (profil, post milik sendiri, komentar milik sendiri).
Pesan pribadi, direct messages, kontak, daftar pengikut/mengikuti, likes, dan data pihak ketiga TIDAK DIBACA.
"""

from __future__ import annotations

import datetime
import json
import re
from typing import Any

INSTAGRAM_ALLOWLIST_PATTERNS = [
	r"(?:^|/)(?:personal_information|account_information)/personal_information\.json$",
	r"(?:^|/)(?:your_instagram_activity/)?content/posts_\d+\.json$",
	r"(?:^|/)media\.json$",
	r"(?:^|/)(?:your_instagram_activity/)?comments/post_comments(?:_\d+)?\.json$",
]


def _is_allowed(filename: str) -> bool:
	norm = filename.replace("\\", "/").lower()
	return any(re.search(pat, norm) for pat in INSTAGRAM_ALLOWLIST_PATTERNS)


def _clean_snippet(text: str) -> str:
	if not text:
		return ""
	# Ganti mention @username menjadi @[user]
	cleaned = re.sub(r"@[\w.]+", "@[user]", text)
	cleaned = re.sub(r"\s+", " ", cleaned).strip()
	return cleaned[:500]


def _format_timestamp(ts: Any) -> str | None:
	if ts is None:
		return None
	try:
		if isinstance(ts, (int, float)):
			# Handle epoch seconds vs milliseconds
			if ts > 1e11:
				ts = ts / 1000.0
			dt = datetime.datetime.fromtimestamp(ts, tz=datetime.UTC)
			return dt.strftime("%Y-%m-%d %H:%M:%S")
		return str(ts)
	except Exception:
		return None


def parse_instagram_export(
	files: dict[str, bytes],
	username: str = "",
	lookback_months: int = 12,
	max_posts: int = 200,
	max_comments: int = 200,
) -> dict[str, Any]:
	"""Mengurai arsip ekspor resmi Instagram dan mengekstrak post dan komentar milik kandidat."""
	# 1. Verifikasi kecocokan format arsip dengan allowlist
	allowed_files = {k: v for k, v in files.items() if _is_allowed(k)}
	if not allowed_files:
		raise ValueError(
			"Invalid or unrecognized export archive format for Instagram. "
			"Please upload the official JSON archive from 'Download your information'."
		)

	profile: dict[str, Any] = {"username": username, "display_name": ""}
	raw_posts: list[dict[str, Any]] = []
	raw_comments: list[dict[str, Any]] = []

	now_dt = datetime.datetime.now(datetime.UTC)
	cutoff_dt = now_dt - datetime.timedelta(days=int(lookback_months or 12) * 30)

	for filepath, content in allowed_files.items():
		norm = filepath.replace("\\", "/").lower()
		try:
			data = json.loads(content.decode("utf-8", errors="replace"))
		except Exception:
			continue

		# A. Profil
		if "personal_information" in norm:
			profile_user = data.get("profile_user", [])
			if isinstance(profile_user, list) and profile_user:
				s_map = profile_user[0].get("string_map_data", {})
				if "Name" in s_map:
					profile["display_name"] = s_map["Name"].get("value", "")
				if "Username" in s_map and not profile["username"]:
					profile["username"] = s_map["Username"].get("value", "")

		# B. Postingan (posts_*.json atau media.json)
		elif "content/posts" in norm or norm.endswith("media.json"):
			items = data if isinstance(data, list) else data.get("items", [])
			for item in items:
				caption = ""
				ts = None
				uri = ""
				media_type = "Photo"

				media_list = item.get("media", [])
				if media_list and isinstance(media_list, list):
					first_m = media_list[0]
					caption = first_m.get("title", "")
					ts = first_m.get("creation_timestamp")
					uri = first_m.get("uri", "")
				else:
					caption = item.get("title") or item.get("caption") or ""
					ts = item.get("creation_timestamp") or item.get("timestamp")
					uri = item.get("uri") or ""

				if ".mp4" in uri.lower():
					media_type = "Video"

				pub_str = _format_timestamp(ts)
				cleaned_cap = _clean_snippet(caption)
				if cleaned_cap:
					raw_posts.append({
						"snippet": cleaned_cap,
						"published_on": pub_str,
						"url": uri,
						"media_type": media_type,
						"_ts": ts,
					})

		# C. Komentar milik kandidat (post_comments.json)
		elif "comments" in norm:
			comments_list = data if isinstance(data, list) else data.get("comments_media_comments", [])
			for item in comments_list:
				# Struktur Instagram comments export
				s_map = item.get("string_map_data", {})
				comment_info = s_map.get("Comment", {})
				comment_text = comment_info.get("value", "")
				ts = comment_info.get("timestamp")
				pub_str = _format_timestamp(ts)

				cleaned_comment = _clean_snippet(comment_text)
				if cleaned_comment:
					raw_comments.append({
						"snippet": cleaned_comment,
						"published_on": pub_str,
						"url": "",
						"_ts": ts,
					})

	# Filter lookback & batasi kuota
	posts: list[dict[str, Any]] = []
	for p in raw_posts:
		if len(posts) >= int(max_posts or 200):
			break
		ts = p.pop("_ts", None)
		if ts:
			try:
				dt = datetime.datetime.fromtimestamp(ts if ts < 1e11 else ts / 1000.0, tz=datetime.UTC)
				if dt < cutoff_dt:
					continue
			except Exception:
				pass
		posts.append(p)

	comments: list[dict[str, Any]] = []
	for c in raw_comments:
		if len(comments) >= int(max_comments or 200):
			break
		ts = c.pop("_ts", None)
		if ts:
			try:
				dt = datetime.datetime.fromtimestamp(ts if ts < 1e11 else ts / 1000.0, tz=datetime.UTC)
				if dt < cutoff_dt:
					continue
			except Exception:
				pass
		comments.append(c)

	return {
		"status": "Success",
		"platform": "Instagram",
		"profile": profile,
		"posts": posts,
		"comments": comments,
	}
