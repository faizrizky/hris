# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Parser ekspor data resmi Facebook (Spesifikasi 5.3 & Fase 4).
Fungsi murni tanpa ketergantungan pada Frappe.
Membaca HANYA berkas yang di-allowlist (profil, post milik sendiri, komentar milik sendiri).
Pesan Messenger, pertemanan, grup, lokasi, iklan, like/reaksi, dan komentar orang lain TIDAK DIBACA.
"""

from __future__ import annotations

import datetime
import json
import re
from typing import Any

FACEBOOK_ALLOWLIST_PATTERNS = [
	r"(?:^|/)profile_information/profile_information\.json$",
	r"(?:^|/)(?:your_facebook_activity/)?posts/(?:your_posts_\d+|your_posts__check_ins__photos_and_videos_\d+)\.json$",
	r"(?:^|/)(?:your_facebook_activity/)?comments_and_reactions/comments\.json$",
	r"(?:^|/)comments/comments\.json$",
]


def _is_allowed(filename: str) -> bool:
	norm = filename.replace("\\", "/").lower()
	return any(re.search(pat, norm) for pat in FACEBOOK_ALLOWLIST_PATTERNS)


def _clean_snippet(text: str) -> str:
	if not text:
		return ""
	from sentra_ats.bgc.providers.social.base import mentions_anonymized

	cleaned = re.sub(r"@[\w.]+", "@[user]", text) if mentions_anonymized() else text
	cleaned = re.sub(r"\s+", " ", cleaned).strip()
	return cleaned[:500]


def _format_timestamp(ts: Any) -> str | None:
	if ts is None:
		return None
	try:
		if isinstance(ts, (int, float)):
			if ts > 1e11:
				ts = ts / 1000.0
			dt = datetime.datetime.fromtimestamp(ts, tz=datetime.UTC)
			return dt.strftime("%Y-%m-%d %H:%M:%S")
		return str(ts)
	except Exception:
		return None


def parse_facebook_export(
	files: dict[str, bytes],
	username: str = "",
	lookback_months: int = 12,
	max_posts: int = 200,
	max_comments: int = 200,
) -> dict[str, Any]:
	"""Mengurai arsip ekspor resmi Facebook dan mengekstrak post dan komentar milik kandidat."""
	allowed_files = {k: v for k, v in files.items() if _is_allowed(k)}
	if not allowed_files:
		raise ValueError(
			"Invalid or unrecognized export archive format for Facebook. "
			"Please upload the official JSON archive from 'Download your information'."
		)

	profile: dict[str, Any] = {"username": username, "display_name": ""}
	raw_posts: list[dict[str, Any]] = []
	raw_comments: list[dict[str, Any]] = []

	now_dt = datetime.datetime.now(datetime.UTC)
	cutoff_dt = now_dt - datetime.timedelta(days=int(lookback_months) * 30) if lookback_months else datetime.datetime.min.replace(tzinfo=datetime.UTC)

	for filepath, content in allowed_files.items():
		norm = filepath.replace("\\", "/").lower()
		try:
			data = json.loads(content.decode("utf-8", errors="replace"))
		except Exception:
			continue

		# A. Profil
		if "profile_information" in norm:
			pv2 = data.get("profile_v2", {})
			name_info = pv2.get("name", {})
			if name_info.get("full_name"):
				profile["display_name"] = name_info["full_name"]

		# B. Postingan
		elif "posts" in norm:
			items = data if isinstance(data, list) else data.get("status_updates", [])
			for item in items:
				ts = item.get("timestamp")
				post_text = ""
				# Meta export structure: data array contains post text
				d_list = item.get("data", [])
				if d_list and isinstance(d_list, list):
					post_text = d_list[0].get("post", "")
				if not post_text:
					post_text = item.get("title", "")

				cleaned_post = _clean_snippet(post_text)
				if cleaned_post:
					raw_posts.append({
						"snippet": cleaned_post,
						"published_on": _format_timestamp(ts),
						"url": "",
						"media_type": "Text",
						"_ts": ts,
					})

		# C. Komentar milik kandidat (comments.json)
		elif "comments" in norm:
			comments_list = data.get("comments_v2", []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
			for item in comments_list:
				ts = item.get("timestamp")
				c_text = ""
				d_list = item.get("data", [])
				if d_list and isinstance(d_list, list):
					c_info = d_list[0].get("comment", {})
					c_text = c_info.get("comment", "")
				if not c_text:
					c_text = item.get("title", "")

				cleaned_comment = _clean_snippet(c_text)
				if cleaned_comment:
					raw_comments.append({
						"snippet": cleaned_comment,
						"published_on": _format_timestamp(ts),
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
		"platform": "Facebook",
		"profile": profile,
		"posts": posts,
		"comments": comments,
	}
