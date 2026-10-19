# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any


def anonymize_mentions(text: str) -> str:
	"""Mengganti sebutan akun pihak ketiga (@username) dengan @[user] untuk menjaga privasi."""
	if not text:
		return ""
	return re.sub(r"@[a-zA-Z0-9._-]+", "@[user]", text)


def clean_snippet(text: str, max_chars: int = 500) -> str:
	"""Membersihkan teks dan memotong hingga maksimal 500 karakter."""
	if not text:
		return ""
	cleaned = " ".join(text.split())
	cleaned = anonymize_mentions(cleaned)
	if len(cleaned) > max_chars:
		return cleaned[: max_chars - 3] + "..."
	return cleaned


class BaseSocialAdapter:
	"""Kelas dasar adaptor per platform media sosial untuk ekstraksi profil & postingan."""

	platform_name: str = ""
	default_url_template: str = ""

	def build_profile_url(self, username: str) -> str:
		clean_user = username.strip().lstrip("@")
		if self.default_url_template:
			return self.default_url_template.replace("{username}", clean_user)
		return ""

	def parse_profile(self, html: str, url: str = "") -> dict[str, Any]:
		"""Mengekstrak profil dan daftar postingan dari HTML."""
		raise NotImplementedError

	def extract_candidate_comments(
		self,
		html: str,
		candidate_username: str,
		url: str = "",
	) -> tuple[list[dict[str, Any]], str | None]:
		"""Mengekstrak komentar yang ditulis kandidat sendiri dari HTML.
		Hanya menyimpan komentar dengan kepastian penulis (author == candidate_username).
		Komentar orang lain dibuang, mention disamarkan (@[user]).
		Return: (comments, limitation_note)
		"""
		return [], "not exposed by platform"
