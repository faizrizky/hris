# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Modul pembuatan ringkasan profil otomatis murni (tanpa import frappe).
Menyusun paragraf faktual sesuai templat bagian 6.7 SPEC-BACKGROUND-CHECK.md,
dengan menghilangkan klausa bernilai nol.
"""

from __future__ import annotations

from typing import Any

from hris_ats.i18n import LocalizedText


def generate_automated_summary(
	candidate_name: str,
	job_title: str,
	accounts: list[str] | list[dict[str, Any]] | None = None,
	article_count: int = 0,
	achievement_count: int = 0,
	case_count: int = 0,
	posts_count: int = 0,
	politeness_score: int = 100,
	risk_posts_count: int = 0,
) -> LocalizedText:
	"""Generates factual candidate profile automated summary based on factual data."""
	name = candidate_name or "Candidate"
	title = job_title or "the applied position"

	sentences: list[str] = []
	template_sentences: list[str] = []
	params: dict[str, Any] = {"name": name, "title": title}

	# Sentence 1: Application intro
	template_sentences.append("{name} applied for {title}.")
	sentences.append(f"{name} applied for {title}.")

	# Sentence 2: Public accounts
	platform_list = []
	if accounts:
		for a in accounts:
			if isinstance(a, str):
				platform_list.append(a)
			elif isinstance(a, dict) and a.get("platform"):
				platform_list.append(a["platform"])

	if platform_list:
		p_str = ", ".join(sorted(set(platform_list)))
		params["n"] = len(platform_list)
		params["platforms"] = p_str
		template_sentences.append("{n} public accounts were found ({platforms}).")
		sentences.append(f"{len(platform_list)} public accounts were found ({p_str}).")

	# Sentence 3: Articles & achievements
	if article_count > 0:
		params["a"] = article_count
		if achievement_count > 0:
			params["p"] = achievement_count
			template_sentences.append("{a} articles are likely related, {p} of them about achievements.")
			sentences.append(
				f"{article_count} articles are likely related, {achievement_count} of them about achievements."
			)
		else:
			template_sentences.append("{a} articles are likely related.")
			sentences.append(f"{article_count} articles are likely related.")

	# Sentence 4: Case records
	if case_count > 0:
		params["c"] = case_count
		template_sentences.append("{c} case records need verification.")
		sentences.append(f"{case_count} case records need verification.")

	# Sentence 5: Social media posts
	if posts_count > 0:
		params["m"] = posts_count
		params["score"] = politeness_score
		if risk_posts_count > 0:
			params["r"] = risk_posts_count
			template_sentences.append(
				"Analysis of {m} posts shows a language politeness score of {score}/100 and {r} posts flagged as risky."
			)
			sentences.append(
				f"Analysis of {posts_count} posts shows a language politeness score of {politeness_score}/100 and {risk_posts_count} posts flagged as risky."
			)
		else:
			template_sentences.append(
				"Analysis of {m} posts shows a language politeness score of {score}/100 with no posts flagged as risky."
			)
			sentences.append(
				f"Analysis of {posts_count} posts shows a language politeness score of {politeness_score}/100 with no posts flagged as risky."
			)

	# If no findings other than job application
	if len(sentences) == 1:
		template_sentences.append("No specific case records or significant risk findings were found in the initial screening.")
		sentences.append("No specific case records or significant risk findings were found in the initial screening.")

	content = " ".join(sentences)
	template = " ".join(template_sentences)
	return LocalizedText(content, template=template, params=params)
