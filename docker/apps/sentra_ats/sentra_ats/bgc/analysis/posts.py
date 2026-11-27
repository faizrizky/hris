# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Modul analisis post media sosial murni (tanpa import frappe).
Hanya mengevaluasi fakta aktivitas, kesantunan bahasa, konten berisiko, relevansi profesional, dan sentimen.
TIDAK ADA analisis pandangan politik, afiliasi partai, atau profiling psikologis.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

POSITIVE_WORDS = ["senang", "bangga", "terima kasih", "sukses", "hebat", "berhasil", "grateful", "happy", "congratulations", "proud", "amazing", "good"]
NEGATIVE_WORDS = ["kecewa", "buruk", "rusak", "parah", "hancur", "menyesal", "bad", "terrible", "disappointed", "worst", "fail", "sad"]

# Toxicity matrix (TalentaKu social media blueprint), judged per post so long polite posts cannot
# dilute an attack: layer 1 = profanity weight / word count, layer 2 = tone from sentiment words.
PROFANITY_WEIGHT = 5.0
TOXIC_THRESHOLD = -0.05
PROFANITY_CATEGORIES = ("Kata kasar", "Profanity")
SENTIMENT_CATEGORIES = ("Positive sentiment", "Negative sentiment")


def _count(term: str, text: str) -> int:
	return len(re.findall(r"\b" + re.escape(term) + r"\b", text))


def classify_tone(
	text: str,
	profanity: dict[str, float],
	positive: dict[str, float],
	negative: dict[str, float],
	label: str | None = None,
) -> dict[str, Any]:
	"""One post through the 2x2 matrix. Returns cell, toxicity score and the profanity terms found.

	Cells: Safe, Warning (negative tone, no profanity: information only, never a risk),
	Slang (profanity in a positive post: ignored), Red flag (profanity in a negative post),
	Unclear (profanity, tone unknown: the word lists cannot tell, so it is not flagged as an attack).

	`label` is the tone from the sentiment model ("positive", "neutral", "negative"). When given it
	replaces the word lists, and a neutral tone is a real answer: profanity in it is Slang.
	"""
	clean = (text or "").lower()
	words = len(clean.split())
	hits = {t: _count(t, clean) for t in profanity}
	terms = [t for t, n in hits.items() if n]
	weight = sum(n * profanity[t] * PROFANITY_WEIGHT for t, n in hits.items())
	score = -weight / words if words else 0.0
	pos = sum(_count(t, clean) * w for t, w in positive.items())
	neg = sum(_count(t, clean) * w for t, w in negative.items())
	# The model reads profanity itself as negative ("anjing, keren banget!"), so when the words
	# in the post are clearly positive the two disagree and the post is not called an attack
	disagree = label == "negative" and pos > neg
	if label:
		pos, neg = float(label == "positive"), float(label == "negative")
	tone = "Negative" if neg > pos else "Positive" if pos > neg else "Neutral"
	if score < TOXIC_THRESHOLD:
		cell = "Unclear" if disagree else "Red flag" if neg > pos else "Slang" if pos > neg or label else "Unclear"
	else:
		cell = "Warning" if neg > pos else "Safe"
	return {"cell": cell, "tone": tone, "score": score, "terms": terms, "weight": weight, "words": words}


def analyze_posts(
	posts: list[dict[str, Any]],
	required_skills: list[str] | None = None,
	preferred_skills: list[str] | None = None,
	lexicon_items: list[dict[str, Any]] | None = None,
	sentiment_labels: list[str] | None = None,
) -> dict[str, Any]:
	"""Menganalisis daftar post publik secara faktual dan berbasis aturan."""
	if not posts:
		return {
			"total_posts": 0,
			"last_active": None,
			"avg_posts_per_week": 0.0,
			"hour_distribution": {},
			"politeness_score": 100,
			"abusive_posts_count": 0,
			"abusive_pct": 0.0,
			"risk_posts": [],
			"professional_relevance_pct": 0.0,
			"sentiment_ratio": {"positive": 0, "negative": 0},
			"toxicity_score": 0.0,
			"tone_counts": {},
			"tones": [],
		}

	total_posts = len(posts)
	lexicon = lexicon_items or []

	# Pisahkan leksikon berdasarkan kategori
	def weighted(categories: tuple[str, ...]) -> dict[str, float]:
		return {
			item["term"].lower(): float(item.get("weight") or 1.0)
			for item in lexicon
			if item.get("enabled", 1) and item.get("category") in categories and item.get("term")
		}

	profanity = weighted(PROFANITY_CATEGORIES)
	# The built-in words keep tone detection working on sites that have no sentiment words yet
	positive = {**dict.fromkeys(POSITIVE_WORDS, 1.0), **weighted(("Positive sentiment",))}
	negative = {**dict.fromkeys(NEGATIVE_WORDS, 1.0), **weighted(("Negative sentiment",))}
	tone_counts: dict[str, int] = {}
	tones: list[dict[str, Any]] = []
	# Model labels are used only when there is exactly one per post
	labels = sentiment_labels if sentiment_labels and len(sentiment_labels) == len(posts) else None
	total_weight = 0.0
	total_words = 0

	risk_items = [
		item
		for item in lexicon
		if item.get("enabled", 1)
		and item.get("category") not in PROFANITY_CATEGORIES + SENTIMENT_CATEGORIES
		and item.get("severity") in ("Sedang", "Tinggi", "Medium", "High")
	]

	all_skills = [
		s.strip().lower()
		for s in (required_skills or []) + (preferred_skills or [])
		if s and len(s.strip()) >= 2
	]

	hour_distribution: dict[int, int] = {}
	dates = []
	abusive_count = 0
	abusive_replies_count = 0
	total_replies_count = 0
	risk_posts = []
	skills_mention_count = 0
	pos_count = 0
	neg_count = 0

	for index, post in enumerate(posts):
		text = post.get("text") or post.get("snippet", "")
		clean_text = text.lower()
		is_reply = post.get("is_reply", False)
		if is_reply:
			total_replies_count += 1

		# Analisis tanggal & jam
		created_at = post.get("created_at") or post.get("published_on")
		if created_at:
			if isinstance(created_at, str):
				try:
					dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
				except Exception:
					dt = None
			elif isinstance(created_at, datetime):
				dt = created_at
			else:
				dt = None

			if dt:
				dates.append(dt)
				hour = dt.hour
				hour_distribution[hour] = hour_distribution.get(hour, 0) + 1

		# 1. Kesantunan: matriks kata kasar x nada. Slang bernada positif tidak dihitung.
		tone = classify_tone(text, profanity, positive, negative, labels[index] if labels else None)
		tones.append({"cell": tone["cell"], "tone": tone["tone"], "terms": tone["terms"]})
		tone_counts[tone["cell"]] = tone_counts.get(tone["cell"], 0) + 1
		# Slang in a positive post is ignored, so it must not raise the toxicity score either
		total_weight += 0.0 if tone["cell"] == "Slang" else tone["weight"]
		total_words += tone["words"]

		if tone["cell"] in ("Red flag", "Unclear"):
			abusive_count += 1
			if is_reply:
				abusive_replies_count += 1

		# 2. Konten berisiko (Hate speech, Threats/violence, Pornography, Online gambling, Narcotics, Fraud, etc.)
		matched_risks = []
		highest_sev = "Low"
		if tone["cell"] == "Red flag":
			# High = "Needs verification" until HR reviews it; the system never rejects on its own
			matched_risks.append("Toxic language: " + ", ".join(tone["terms"]))
			highest_sev = "High"
		for item in risk_items:
			term = item.get("term", "").lower()
			if not term:
				continue
			item_sev = item.get("severity")
			if item.get("is_regex"):
				try:
					if re.search(term, clean_text):
						matched_risks.append(f"{item.get('category')}: {term}")
						if item_sev in ("Tinggi", "High"):
							highest_sev = "High"
						elif item_sev in ("Sedang", "Medium") and highest_sev != "High":
							highest_sev = "Medium"
				except re.error:
					pass
			else:
				if re.search(r"\b" + re.escape(term) + r"\b", clean_text):
					matched_risks.append(f"{item.get('category')}: {term}")
					if item_sev in ("Tinggi", "High"):
						highest_sev = "High"
					elif item_sev in ("Sedang", "Medium") and highest_sev != "High":
						highest_sev = "Medium"

		if matched_risks:
			risk_posts.append({
				"text": text,
				"url": post.get("url"),
				"created_at": created_at,
				"risk_flags": ", ".join(matched_risks),
				"severity": highest_sev,
				"finding_type": post.get("finding_type", "Post"),
				"provenance": post.get("provenance", "Crawled"),
				"media_type": post.get("media_type", "Text"),
				"account": post.get("account", ""),
				"match_confidence": post.get("match_confidence", 100),
			})

		# 3. Relevansi profesional
		if any(re.search(r"\b" + re.escape(s) + r"\b", clean_text) for s in all_skills):
			skills_mention_count += 1

		# 4. Sentimen kata
		if any(re.search(r"\b" + re.escape(w) + r"\b", clean_text) for w in POSITIVE_WORDS):
			pos_count += 1
		if any(re.search(r"\b" + re.escape(w) + r"\b", clean_text) for w in NEGATIVE_WORDS):
			neg_count += 1

	# Hitung skor kesantunan: 100 - (% post kasar * 5)
	abusive_pct = (abusive_count / total_posts) * 100 if total_posts else 0.0
	politeness_score = max(0, min(100, round(100 - (abusive_pct * 5))))

	# Rata-rata post per minggu
	avg_posts_per_week = 0.0
	last_active = None
	if dates:
		dates.sort()
		last_active = dates[-1].isoformat()
		days = max(1, (dates[-1] - dates[0]).days)
		weeks = max(1.0, days / 7.0)
		avg_posts_per_week = round(total_posts / weeks, 2)

	prof_pct = round((skills_mention_count / total_posts) * 100, 1) if total_posts else 0.0

	return {
		"total_posts": total_posts,
		"last_active": last_active,
		"avg_posts_per_week": avg_posts_per_week,
		"hour_distribution": hour_distribution,
		"politeness_score": politeness_score,
		"abusive_posts_count": abusive_count,
		"abusive_pct": round(abusive_pct, 1),
		"risk_posts": risk_posts,
		"professional_relevance_pct": prof_pct,
		"sentiment_ratio": {"positive": pos_count, "negative": neg_count},
		# Blueprint display value: (profanity weight / all words) x 100, e.g. -5.0 at the threshold
		"toxicity_score": round(-total_weight / total_words * 100, 1) if total_words else 0.0,
		"tone_counts": tone_counts,
		# One entry per post, in the order given: matrix cell, tone, profanity terms found
		"tones": tones,
	}
