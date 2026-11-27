# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Modul ekstraksi isi artikel bersih ke dalam format Markdown menggunakan Scrapling page.markdown().
Disiapkan untuk integrasi pencocokan artikel di masa depan (belum disambungkan ke runner).
"""

from __future__ import annotations

from typing import Any

from sentra_ats.bgc.fetch import FetchConfig, fetch


def extract_article_text(url: str, config: FetchConfig | None = None) -> str:
	"""Mengambil halaman artikel web dan mengubah kontennya menjadi Markdown bersih.

	Menggunakan bgc/fetch.py untuk pengambilan aman dan Scrapling page.markdown()
	untuk pembersihan noise, skrip, dan penataan teks.
	"""
	fetch_res = fetch(url, config=config)

	# 1. Jika page sudah mendukung markdown() langsung
	page = fetch_res.page
	if page is not None and hasattr(page, "markdown") and callable(page.markdown):
		try:
			return page.markdown(main_content_only=True)
		except Exception:
			pass

	# 2. Gunakan Scrapling Response converter
	try:
		from scrapling.engines.toolbelt.custom import Response
		resp = Response(
			url=url,
			content=fetch_res.body or "",
			status=fetch_res.status,
			reason="OK",
			cookies={},
			headers={},
			request_headers={},
		)
		return resp.markdown(main_content_only=True)
	except Exception:
		# Fallback text bila toolbelt tidak tersedia
		if page is not None and hasattr(page, "get_all_text"):
			return page.get_all_text().strip()
		return (fetch_res.body or "").strip()
