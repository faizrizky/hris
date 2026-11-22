# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Tone of social posts from the IndoBERT sentiment service (docker service `sentiment`).

Optional: without `bgc_sentiment_url` in the site config, or when the service is down, callers
get None and the analysis falls back to the sentiment words in the lexicon.
"""

from __future__ import annotations

import re
from typing import Any

import frappe
import requests

from hris_ats.bgc.analysis.posts import PROFANITY_CATEGORIES

MAX_TEXT_CHARS = 2000
BATCH = 200
TIMEOUT_SECONDS = 120


def post_text(post: dict[str, Any]) -> str:
	return post.get("text") or post.get("snippet") or ""


def mask_profanity(text: str, lexicon_items: list[dict[str, Any]] | None) -> str:
	"""The model calls any sentence with a swear word negative, which would make every profane
	post an attack. It is asked about the rest of the sentence instead; the word lists already
	cover the profanity itself."""
	terms = [
		re.escape(i["term"]) for i in lexicon_items or [] if i.get("category") in PROFANITY_CATEGORIES and i.get("term")
	]
	if not terms:
		return text
	return re.sub(r"\b(?:" + "|".join(terms) + r")\b", " ", text, flags=re.IGNORECASE)


def fetch_sentiment_labels(
	posts: list[dict[str, Any]], lexicon_items: list[dict[str, Any]] | None = None
) -> list[str] | None:
	"""One of "positive", "neutral", "negative" per post, or None when the model is unavailable."""
	url = frappe.conf.get("bgc_sentiment_url")
	if not url or not posts:
		return None
	texts = [mask_profanity(post_text(p), lexicon_items)[:MAX_TEXT_CHARS] for p in posts]
	# The same posts are analysed per account and again for the whole check: ask the model once
	cache = getattr(frappe.local, "bgc_sentiment_cache", None)
	if cache is None:
		cache = frappe.local.bgc_sentiment_cache = {}
	missing = list(dict.fromkeys(t for t in texts if t not in cache))
	try:
		for i in range(0, len(missing), BATCH):
			chunk = missing[i : i + BATCH]
			res = requests.post(url.rstrip("/") + "/classify", json={"texts": chunk}, timeout=TIMEOUT_SECONDS)
			res.raise_for_status()
			labels = res.json()["labels"]
			if len(labels) != len(chunk):
				return None
			cache.update(zip(chunk, labels, strict=True))
	except Exception as e:
		# Post text is personal data: log the error type only, never the request
		frappe.log_error(title="Sentiment service unavailable", message=f"{type(e).__name__}: {url}")
		return None
	return [cache[t] for t in texts]
