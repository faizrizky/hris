# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Unit test murni untuk parser ekspor data kandidat dan pengaman arsip (Spesifikasi 5.3 & Fase 4).
Dijalankan dengan pytest tanpa ketergantungan pada database Frappe.
"""

from __future__ import annotations

import io
import os
import zipfile

import pytest

from sentra_ats.bgc.export_parsers import (
	ArchiveSizeExceededError,
	ExportSecurityError,
	ZipBombError,
	ZipSlipError,
	parse_candidate_export,
	parse_facebook_export,
	parse_instagram_export,
	parse_linkedin_export,
	parse_tiktok_export,
	safe_extract_export_archive,
)
from sentra_ats.bgc.export_parsers.instagram import _clean_snippet

FIXTURE_DIR = os.path.join(os.path.dirname(__file__), "..", "fixtures", "export")


def test_clean_snippet():
	raw = "Hello @john.doe and @jane_smith! Check this out   with   extra   spaces."
	cleaned = _clean_snippet(raw)
	assert "@[user]" in cleaned
	assert "@john.doe" not in cleaned
	assert "@jane_smith" not in cleaned
	assert "   " not in cleaned

	long_text = "a" * 600
	assert len(_clean_snippet(long_text)) == 500


def test_instagram_export_parsing():
	zip_path = os.path.join(FIXTURE_DIR, "instagram_export.zip")
	files = safe_extract_export_archive(zip_path, max_size_mb=100)

	# Pastikan berkas terlarang (messages, likes) tidak masuk ke data parsing
	assert "personal_information/personal_information.json" in files
	assert "your_instagram_activity/content/posts_1.json" in files
	assert "your_instagram_activity/comments/post_comments_1.json" in files

	res = parse_instagram_export(files, username="baguspratama", lookback_months=120)
	assert res["status"] == "Success"
	assert res["platform"] == "Instagram"
	assert res["profile"]["display_name"] == "Bagus Pratama"

	# Posts
	posts = res["posts"]
	assert len(posts) == 2
	assert "@[user]" in posts[0]["snippet"]
	assert "@alex.dev" not in posts[0]["snippet"]
	assert posts[1]["media_type"] == "Video"

	# Comments
	comments = res["comments"]
	assert len(comments) == 1
	assert "@[user]" in comments[0]["snippet"]
	assert "Looking forward to collaborating" in comments[0]["snippet"]


def test_facebook_export_parsing():
	zip_path = os.path.join(FIXTURE_DIR, "facebook_export.zip")
	files = safe_extract_export_archive(zip_path, max_size_mb=100)

	res = parse_facebook_export(files, username="baguspratama", lookback_months=120)
	assert res["status"] == "Success"
	assert res["platform"] == "Facebook"
	assert res["profile"]["display_name"] == "Bagus Pratama"

	assert len(res["posts"]) == 1
	assert "TechConf 2026" in res["posts"][0]["snippet"]
	assert "@[user]" in res["posts"][0]["snippet"]

	assert len(res["comments"]) == 1
	assert "Insightful presentation" in res["comments"][0]["snippet"]


def test_tiktok_export_parsing():
	zip_path = os.path.join(FIXTURE_DIR, "tiktok_export.zip")
	files = safe_extract_export_archive(zip_path, max_size_mb=100)

	res = parse_tiktok_export(files, username="baguspratama", lookback_months=120)
	assert res["status"] == "Success"
	assert res["platform"] == "TikTok"
	assert res["profile"]["display_name"] == "Bagus Pratama"

	assert len(res["posts"]) == 1
	assert res["posts"][0]["media_type"] == "Video"
	assert "@[user]" in res["posts"][0]["snippet"]

	assert len(res["comments"]) == 1
	assert "Thanks for watching" in res["comments"][0]["snippet"]


def test_linkedin_export_parsing():
	zip_path = os.path.join(FIXTURE_DIR, "linkedin_export.zip")
	files = safe_extract_export_archive(zip_path, max_size_mb=100)

	res = parse_linkedin_export(files, username="baguspratama", lookback_months=120)
	assert res["status"] == "Success"
	assert res["platform"] == "LinkedIn"
	assert res["profile"]["display_name"] == "Bagus Pratama"

	assert len(res["posts"]) == 1
	assert "Design system architecture" in res["posts"][0]["snippet"]
	assert "@[user]" in res["posts"][0]["snippet"]

	assert len(res["comments"]) == 1
	assert "Congratulations on the milestone!" in res["comments"][0]["snippet"]


def test_dispatcher_parse_candidate_export():
	zip_path = os.path.join(FIXTURE_DIR, "instagram_export.zip")
	files = safe_extract_export_archive(zip_path, max_size_mb=100)

	res = parse_candidate_export("Instagram", files, username="baguspratama", lookback_months=120)
	assert res["platform"] == "Instagram"

	with pytest.raises(ValueError, match="Unsupported export platform"):
		parse_candidate_export("UnknownPlatform", files)


def test_security_zip_slip_rejected():
	zip_path = os.path.join(FIXTURE_DIR, "zip_slip.zip")
	with pytest.raises(ZipSlipError, match="Potential zip-slip"):
		safe_extract_export_archive(zip_path)


def test_security_archive_size_exceeded():
	zip_path = os.path.join(FIXTURE_DIR, "instagram_export.zip")
	# Batasi max_size_mb ke 0 (menolak berkas apa pun di atas 0 MB)
	with pytest.raises(ArchiveSizeExceededError, match="exceeds maximum limit"):
		safe_extract_export_archive(zip_path, max_size_mb=0)


def test_security_zip_bomb_file_count_rejected():
	# Buat zip dengan > 1000 berkas
	buf = io.BytesIO()
	with zipfile.ZipFile(buf, "w") as zf:
		for i in range(1005):
			zf.writestr(f"file_{i}.txt", "test")
	with pytest.raises(ZipBombError, match="Archive file count"):
		safe_extract_export_archive(buf.getvalue())


def test_unrecognized_format_rejected():
	buf = io.BytesIO()
	with zipfile.ZipFile(buf, "w") as zf:
		zf.writestr("random_file.json", '{"foo": "bar"}')

	files = safe_extract_export_archive(buf.getvalue())
	with pytest.raises(ValueError, match="Invalid or unrecognized export archive format for Instagram"):
		parse_instagram_export(files)
