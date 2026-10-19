# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

from __future__ import annotations

import csv
import json
import os
import re
from typing import Any
import frappe
from frappe import _

_CSV_TRANSLATIONS: dict[str, str] | None = None


def _load_csv_translations() -> dict[str, str]:
	global _CSV_TRANSLATIONS
	if _CSV_TRANSLATIONS is None:
		_CSV_TRANSLATIONS = {}
		try:
			csv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "translations", "id.csv")
			if os.path.exists(csv_path):
				with open(csv_path, "r", encoding="utf-8") as f:
					for row in csv.reader(f):
						if row and len(row) >= 2:
							_CSV_TRANSLATIONS[row[0]] = row[1]
		except Exception:
			pass
	return _CSV_TRANSLATIONS


class LocalizedText(str):
	"""A string subclass that retains its i18n template and parameters."""

	template: str
	params: dict[str, Any]

	def __new__(
		cls,
		content: str = "",
		template: str = "",
		params: dict[str, Any] | None = None,
		**kwargs: Any,
	):
		actual_content = content or kwargs.get("text", "")
		obj = super().__new__(cls, actual_content)
		obj.template = template or actual_content
		obj.params = params or {}
		return obj


def render(
	template: str | LocalizedText | None,
	params: dict[str, Any] | str | None = None,
	lang: str | None = None,
) -> str:
	"""Renders a dynamic message template in the requested or current user language.

	Handles:
	- LocalizedText instances (unpacks template and params)
	- params as dict, JSON string, or None
	- compound templates separated by '; ', newlines, or sentence boundaries
	- translates template strings against id.csv via frappe._() or direct CSV fallback
	"""
	if not template:
		return ""

	if not lang:
		if hasattr(frappe, "local") and getattr(frappe.local, "lang", None):
			lang = frappe.local.lang
		elif hasattr(frappe, "session") and getattr(frappe.session, "user", None) and frappe.session.user != "Guest":
			try:
				lang = frappe.get_user_lang(frappe.session.user)
			except Exception:
				lang = "en"
		else:
			lang = "en"

	if lang not in ("id", "en"):
		lang = "en"

	if isinstance(template, LocalizedText):
		if params is None or (isinstance(params, dict) and not params):
			params = template.params
		template = template.template

	if isinstance(params, str):
		try:
			params_dict = json.loads(params) if params.strip() else {}
		except Exception:
			params_dict = {}
	elif isinstance(params, dict):
		params_dict = params
	else:
		params_dict = {}

	if lang == "id":
		direct_trans = _translate_template_str(template)
		if direct_trans != template.strip():
			return _format_rendered(direct_trans, params_dict)

	if "; " in template:
		parts = template.split("; ")
		rendered_parts = []
		for part in parts:
			rendered_parts.append(_render_single_template(part, params_dict, lang=lang))
		return "; ".join(rendered_parts)

	if "\n" in template:
		lines = template.split("\n")
		rendered_lines = []
		for line in lines:
			rendered_lines.append(_render_single_template(line, params_dict, lang=lang))
		return "\n".join(rendered_lines)

	if ". " in template:
		parts = re.split(r"(?<=\.)\s+(?=[A-Z0-9{])", template)
		if len(parts) > 1:
			rendered_parts = []
			for part in parts:
				rendered_parts.append(_render_single_template(part, params_dict, lang=lang))
			return " ".join(rendered_parts)

	return _render_single_template(template, params_dict, lang=lang)


def _translate_template_str(tmpl: str) -> str:
	tmpl = tmpl.strip()
	if not tmpl:
		return ""

	try:
		translated = _(tmpl, lang="id")
	except Exception:
		translated = tmpl

	if translated == tmpl:
		csv_map = _load_csv_translations()
		translated = csv_map.get(tmpl, tmpl)

	if translated == tmpl and tmpl.endswith("."):
		try:
			sub_translated = _(tmpl[:-1], lang="id")
			if sub_translated != tmpl[:-1]:
				translated = sub_translated + "."
			else:
				csv_map = _load_csv_translations()
				if tmpl[:-1] in csv_map:
					translated = csv_map[tmpl[:-1]] + "."
		except Exception:
			pass

	return translated


def _format_rendered(text: str, params: dict[str, Any]) -> str:
	if params:
		try:
			return text.format(**params)
		except (KeyError, ValueError, IndexError):
			try:
				return text.format(*params.values())
			except Exception:
				return text
	return text


def _render_single_template(
	tmpl: str,
	params: dict[str, Any],
	lang: str = "en",
) -> str:
	tmpl = tmpl.strip()
	if not tmpl:
		return ""

	if lang == "id":
		translated = _translate_template_str(tmpl)
	else:
		translated = tmpl

	return _format_rendered(translated, params)


