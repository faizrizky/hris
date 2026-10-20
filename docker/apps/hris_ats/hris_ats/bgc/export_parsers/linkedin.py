# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Parser ekspor data resmi LinkedIn (Spesifikasi 5.3 & Fase 4).
Fungsi murni tanpa ketergantungan pada Frappe.
Membaca HANYA berkas yang di-allowlist (Profile.csv, Shares.csv, Comments.csv).
Connections.csv, Messages.csv, Invitations.csv, Riwayat pencarian, dan data iklan TIDAK DIBACA.
"""

from __future__ import annotations

import csv
import datetime
import io
import re
from typing import Any

LINKEDIN_ALLOWLIST_PATTERNS = [
	r"(?:^|/)profile\.csv$",
	r"(?:^|/)shares\.csv$",
	r"(?:^|/)comments\.csv$",
]


def _is_allowed(filename: str) -> bool:
	norm = filename.replace("\\", "/").lower()
	return any(re.search(pat, norm) for pat in LINKEDIN_ALLOWLIST_PATTERNS)


def _clean_snippet(text: str) -> str:
	if not text:
		return ""
	cleaned = re.sub(r"@[\w.]+", "@[user]", text)
	cleaned = re.sub(r"\s+", " ", cleaned).strip()
	return cleaned[:500]


def _parse_csv_rows(content: bytes) -> list[dict[str, str]]:
	text = content.decode("utf-8", errors="replace")
	reader = csv.DictReader(io.StringIO(text))
	return list(reader)


def parse_linkedin_export(
	files: dict[str, bytes],
	username: str = "",
	lookback_months: int = 12,
	max_posts: int = 200,
	max_comments: int = 200,
) -> dict[str, Any]:
	"""Mengurai arsip ekspor resmi LinkedIn (CSV) dan mengekstrak post & komentar kandidat."""
	allowed_files = {k: v for k, v in files.items() if _is_allowed(k)}
	if not allowed_files:
		raise ValueError(
			"Invalid or unrecognized export archive format for LinkedIn. "
			"Please upload the official archive containing Profile.csv, Shares.csv, or Comments.csv."
		)

	profile: dict[str, Any] = {"username": username, "display_name": ""}
	raw_posts: list[dict[str, Any]] = []
	raw_comments: list[dict[str, Any]] = []

	now_dt = datetime.datetime.now(datetime.UTC)
	cutoff_dt = now_dt - datetime.timedelta(days=int(lookback_months) * 30) if lookback_months else datetime.datetime.min.replace(tzinfo=datetime.UTC)

	for filepath, content in allowed_files.items():
		norm = filepath.replace("\\", "/").lower()

		# A. Profil (Profile.csv)
		if norm.endswith("profile.csv"):
			rows = _parse_csv_rows(content)
			if rows:
				first_row = rows[0]
				first_name = first_row.get("First Name", "").strip()
				last_name = first_row.get("Last Name", "").strip()
				full = f"{first_name} {last_name}".strip()
				if full:
					profile["display_name"] = full

		# B. Postingan / Shares (Shares.csv)
		elif norm.endswith("shares.csv"):
			rows = _parse_csv_rows(content)
			for r in rows:
				date_str = r.get("Date", "").strip()
				commentary = r.get("ShareCommentary", "").strip()
				link = r.get("ShareLink", "").strip()
				media_url = r.get("MediaUrl", "").strip()

				media_type = "Photo" if media_url else "Text"
				if ".mp4" in media_url.lower():
					media_type = "Video"

				cleaned = _clean_snippet(commentary)
				if cleaned:
					raw_posts.append({
						"snippet": cleaned,
						"published_on": date_str,
						"url": link,
						"media_type": media_type,
						"_date_str": date_str,
					})

		# C. Komentar milik kandidat (Comments.csv)
		elif norm.endswith("comments.csv"):
			rows = _parse_csv_rows(content)
			for r in rows:
				date_str = r.get("Date", "").strip()
				comment_text = r.get("Comment", "").strip()
				link = r.get("Link", "").strip()

				cleaned = _clean_snippet(comment_text)
				if cleaned:
					raw_comments.append({
						"snippet": cleaned,
						"published_on": date_str,
						"url": link,
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
		"platform": "LinkedIn",
		"profile": profile,
		"posts": posts,
		"comments": comments,
	}
