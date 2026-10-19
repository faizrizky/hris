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


def analyze_posts(
	posts: list[dict[str, Any]],
	required_skills: list[str] | None = None,
	preferred_skills: list[str] | None = None,
	lexicon_items: list[dict[str, Any]] | None = None,
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
		}

	total_posts = len(posts)
	lexicon = lexicon_items or []

	# Pisahkan leksikon berdasarkan kategori
	abusive_terms = [
		item["term"].lower()
		for item in lexicon
		if item.get("enabled", 1) and item.get("category") in ("Kata kasar", "Profanity")
	]

	risk_items = [
		item
		for item in lexicon
		if item.get("enabled", 1)
		and item.get("category") not in ("Kata kasar", "Profanity")
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

	for post in posts:
		text = post.get("text", "")
		clean_text = text.lower()
		is_reply = post.get("is_reply", False)
		if is_reply:
			total_replies_count += 1

		# Analisis tanggal & jam
		created_at = post.get("created_at")
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

		# 1. Kesantunan (Profanity / Kata kasar)
		has_abuse = False
		matched_abusive = []
		for term in abusive_terms:
			if re.search(r"\b" + re.escape(term) + r"\b", clean_text):
				has_abuse = True
				matched_abusive.append(term)

		if has_abuse:
			abusive_count += 1
			if is_reply:
				abusive_replies_count += 1

		# 2. Konten berisiko (Hate speech, Threats/violence, Pornography, Online gambling, Narcotics, Fraud, etc.)
		matched_risks = []
		highest_sev = "Low"
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
				"created_at": post.get("created_at"),
				"risk_flags": ", ".join(matched_risks),
				"severity": highest_sev,
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
	}
