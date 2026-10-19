# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

import frappe


def execute():
	"""Idempotently sets default values for newly added social media and export settings
	on existing Single doctype Background Check Settings if uninitialized, null, or 0.
	Preserves any customized positive values.
	"""
	if not frappe.db.exists("DocType", "Background Check Settings"):
		return

	settings = frappe.get_single("Background Check Settings")
	dirty = False

	# Social Max Posts (default 200, must be >= 1)
	if settings.social_max_posts is None or settings.social_max_posts <= 0:
		settings.social_max_posts = 200
		dirty = True

	# Social Lookback Months (default 12, must be >= 1)
	if settings.social_lookback_months is None or settings.social_lookback_months <= 0:
		settings.social_lookback_months = 12
		dirty = True

	# Max Candidate Export Size (default 100, must be >= 1)
	if settings.export_max_mb is None or settings.export_max_mb <= 0:
		settings.export_max_mb = 100
		dirty = True

	# Enable Social Media (default 1)
	if settings.enable_social_media is None or settings.enable_social_media == 0:
		settings.enable_social_media = 1
		dirty = True

	# Audit other Phase 1 & 2 fields for existing single instances
	if settings.enable_posts is None:
		settings.enable_posts = 1
		dirty = True

	if settings.min_match_confidence is None or settings.min_match_confidence <= 0:
		settings.min_match_confidence = 50
		dirty = True

	if settings.max_results_per_source is None or settings.max_results_per_source <= 0:
		settings.max_results_per_source = 50
		dirty = True

	if settings.rate_limit_per_minute is None or settings.rate_limit_per_minute <= 0:
		settings.rate_limit_per_minute = 30
		dirty = True

	if settings.retention_days is None or settings.retention_days <= 0:
		settings.retention_days = 90
		dirty = True

	if not settings.fetch_identity:
		settings.fetch_identity = "Company"
		dirty = True

	if settings.fetch_respect_robots is None:
		settings.fetch_respect_robots = 1
		dirty = True

	if dirty:
		settings.flags.ignore_permissions = True
		settings.save()
