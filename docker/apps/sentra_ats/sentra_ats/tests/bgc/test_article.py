# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Unit test untuk ekstraksi artikel bersih ke Markdown (sentra_ats.bgc.article)."""

from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import pytest
from scrapling.parser import Adaptor

from sentra_ats.bgc.article import extract_article_text
from sentra_ats.bgc.fetch import FetchConfig, FetchResult

FIXTURE_HTML_PATH = os.path.join(
	os.path.dirname(os.path.dirname(__file__)),
	"fixtures",
	"articles",
	"sample_article.html",
)


def test_extract_article_text_with_sample_fixture():
	with open(FIXTURE_HTML_PATH, encoding="utf-8") as f:
		html_content = f.read()

	fake_page = Adaptor(html_content)
	fake_result = FetchResult(
		url="https://news.example.com/ronald-richard-juara",
		status=200,
		body=html_content,
		content=html_content.encode("utf-8"),
		page=fake_page,
		mode_used="company+robots",
		from_cache=False,
	)

	with patch("sentra_ats.bgc.article.fetch", return_value=fake_result) as mock_fetch:
		cfg = FetchConfig(identity="Company", respect_robots=True)
		md = extract_article_text("https://news.example.com/ronald-richard-juara", config=cfg)

		mock_fetch.assert_called_once_with("https://news.example.com/ronald-richard-juara", config=cfg)
		assert "Ronald Richard Raih Juara 1 Desain UI/UX Nasional" in md
		assert "mahasiswa berprestasi asal Jakarta Selatan" in md
		# Header & footer non-konten dibersihkan atau dipisahkan dari artikel utama
		assert len(md) > 100


def test_extract_article_text_fallback_when_page_markdown_missing():
	html_content = "<html><body><h1>Artikel Sederhana</h1><p>Konten artikel penting.</p></body></html>"

	fake_result = FetchResult(
		url="https://news.example.com/simple",
		status=200,
		body=html_content,
		content=html_content.encode("utf-8"),
		page=None,  # page bernilai None untuk memicu jalur fallback
		mode_used="company+robots",
		from_cache=False,
	)

	with patch("sentra_ats.bgc.article.fetch", return_value=fake_result):
		md = extract_article_text("https://news.example.com/simple")
		assert "Artikel Sederhana" in md
		assert "Konten artikel penting" in md
