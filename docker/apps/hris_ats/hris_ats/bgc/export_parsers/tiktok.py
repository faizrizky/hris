# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Parser ekspor data resmi TikTok (Spesifikasi 5.3 & Fase 4).
Fungsi murni tanpa ketergantungan pada Frappe.
Membaca HANYA berkas yang di-allowlist (user_data.json: profil, daftar video postingan, komentar milik sendiri).
Direct messages, riwayat pencarian, login history, dan data iklan TIDAK DIBACA.
"""

from __future__ import annotations

import datetime
import json
import re
from typing import Any

TIKTOK_ALLOWLIST_PATTERNS = [
	r"(?:^|/)user_data(?:_tiktok)?\.json$",
	r"^data\.json$",
]


def _is_allowed(filename: str) -> bool:
	norm = filename.replace("\\", "/").lower()
	return any(re.search(pat, norm) for pat in TIKTOK_ALLOWLIST_PATTERNS)


def _clean_snippet(text: str) -> str:
	if not text:
		return ""
	cleaned = re.sub(r"@[\w.]+", "@[user]", text)
	cleaned = re.sub(r"\s+", " ", cleaned).strip()
	return cleaned[:500]


def parse_tiktok_export(
	files: dict[str, bytes],
	username: str = "",
	lookback_months: int = 12,
	max_posts: int = 200,
	max_comments: int = 200,
) -> dict[str, Any]:
	"""Mengurai arsip ekspor resmi TikTok (user_data.json) dan mengekstrak postingan & komentar."""
	allowed_files = {k: v for k, v in files.items() if _is_allowed(k)}
	if not allowed_files:
		raise ValueError(
			"Invalid or unrecognized export archive format for TikTok. "
			"Please upload the official 'user_data.json' file from 'Download your data'."
		)

	# Ambil konten JSON pertama yang cocok
	content = next(iter(allowed_files.values()))
	try:
		data = json.loads(content.decode("utf-8", errors="replace"))
	except Exception as err:
		raise ValueError(f"Corrupt or invalid TikTok JSON file: {err}")

	profile: dict[str, Any] = {"username": username, "display_name": ""}
	raw_posts: list[dict[str, Any]] = []
	raw_comments: list[dict[str, Any]] = []

	now_dt = datetime.datetime.now(datetime.UTC)
	cutoff_dt = now_dt - datetime.timedelta(days=int(lookback_months) * 30) if lookback_months else datetime.datetime.min.replace(tzinfo=datetime.UTC)

	# A. Profil
	prof_map = data.get("Profile", {}).get("Profile Information", {}).get("ProfileMap", {})
	if prof_map:
		profile["display_name"] = prof_map.get("nickName") or prof_map.get("userName") or ""
		if not profile["username"]:
			profile["username"] = prof_map.get("userName") or ""

	# B. Video / Postingan
	video_list = data.get("Video", {}).get("Videos", {}).get("VideoList", [])
	for v in video_list:
		date_str = v.get("Date", "")
		link = v.get("Link") or v.get("Video") or ""
		desc = v.get("Description") or v.get("Title") or f"TikTok Video: {link}"
		cleaned = _clean_snippet(desc)
		if cleaned:
			raw_posts.append({
				"snippet": cleaned,
				"published_on": date_str,
				"url": link,
				"media_type": "Video",
				"_date_str": date_str,
			})

	# C. Komentar milik kandidat
	comment_list = data.get("Comment", {}).get("Comments", {}).get("CommentsList", [])
	for c in comment_list:
		date_str = c.get("Date", "")
		c_text = c.get("Comment", "")
		cleaned = _clean_snippet(c_text)
		if cleaned:
			raw_comments.append({
				"snippet": cleaned,
				"published_on": date_str,
				"url": "",
				"_date_str": date_str,
			})

	# Filter lookback & batasi kuota
	posts: list[dict[str, Any]] = []
	for p in raw_posts:
		if len(posts) >= int(max_posts or 200):
			break
		d_str = p.pop("_date_str", "")
		if d_str:
			try:
				dt = datetime.datetime.strptime(d_str[:19], "%Y-%m-%d %H:%M:%S").replace(tzinfo=datetime.UTC)
				if dt < cutoff_dt:
					continue
			except Exception:
				pass
		posts.append(p)

	comments: list[dict[str, Any]] = []
	for c in raw_comments:
		if len(comments) >= int(max_comments or 200):
			break
		d_str = c.pop("_date_str", "")
		if d_str:
			try:
				dt = datetime.datetime.strptime(d_str[:19], "%Y-%m-%d %H:%M:%S").replace(tzinfo=datetime.UTC)
				if dt < cutoff_dt:
					continue
			except Exception:
				pass
		comments.append(c)

	return {
		"status": "Success",
		"platform": "TikTok",
		"profile": profile,
		"posts": posts,
		"comments": comments,
	}
