# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Paket Parser Ekspor Data Resmi Kandidat (Spesifikasi 5.3 & Fase 4).
Fungsi murni tanpa ketergantungan pada Frappe.
"""

from __future__ import annotations

from typing import Any

from sentra_ats.bgc.export_parsers.facebook import parse_facebook_export
from sentra_ats.bgc.export_parsers.instagram import parse_instagram_export
from sentra_ats.bgc.export_parsers.linkedin import parse_linkedin_export
from sentra_ats.bgc.export_parsers.security import (
	ArchiveSizeExceededError,
	ExportSecurityError,
	ZipBombError,
	ZipSlipError,
	safe_extract_export_archive,
)
from sentra_ats.bgc.export_parsers.tiktok import parse_tiktok_export


def parse_candidate_export(
	platform: str,
	files: dict[str, bytes],
	username: str = "",
	lookback_months: int = 12,
	max_posts: int = 200,
	max_comments: int = 200,
) -> dict[str, Any]:
	"""Memilih parser platform yang sesuai untuk mengurai arsip ekspor data resmi."""
	plat = (platform or "").lower().strip()
	if "instagram" in plat:
		return parse_instagram_export(
			files,
			username=username,
			lookback_months=lookback_months,
			max_posts=max_posts,
			max_comments=max_comments,
		)
	elif "facebook" in plat:
		return parse_facebook_export(
			files,
			username=username,
			lookback_months=lookback_months,
			max_posts=max_posts,
			max_comments=max_comments,
		)
	elif "tiktok" in plat:
		return parse_tiktok_export(
			files,
			username=username,
			lookback_months=lookback_months,
			max_posts=max_posts,
			max_comments=max_comments,
		)
	elif "linkedin" in plat:
		return parse_linkedin_export(
			files,
			username=username,
			lookback_months=lookback_months,
			max_posts=max_posts,
			max_comments=max_comments,
		)
	else:
		raise ValueError(f"Unsupported export platform: {platform}")


__all__ = [
	"ArchiveSizeExceededError",
	"ExportSecurityError",
	"ZipBombError",
	"ZipSlipError",
	"parse_candidate_export",
	"parse_facebook_export",
	"parse_instagram_export",
	"parse_linkedin_export",
	"parse_tiktok_export",
	"safe_extract_export_archive",
]
