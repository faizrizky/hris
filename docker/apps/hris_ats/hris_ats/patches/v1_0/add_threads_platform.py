# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

import frappe

THREADS_DOMAINS = ("threads.net", "threads.com")


def execute():
	"""Adds the Threads platform and, when the blocked-domain list is in use, its domains."""
	from hris_ats.setup import setup_default_platforms

	setup_default_platforms()
	if frappe.db.exists("Background Check Platform", "Threads"):
		frappe.db.set_value(
			"Background Check Platform", "Threads", "requires_social_consent", 1, update_modified=False
		)

	if not frappe.db.exists("DocType", "Background Check Settings"):
		return
	from hris_ats.bgc.fetch import read_stored_blocked_domains

	# None = never saved (the built-in list already includes Threads); "" = deliberately emptied
	current = read_stored_blocked_domains() or ""
	lines = [x.strip() for x in current.splitlines() if x.strip()]
	# An empty list is a deliberate choice (domains can be crawled); only extend a list that is in use
	if lines:
		for dom in THREADS_DOMAINS:
			if dom not in [x.lower() for x in lines]:
				lines.append(dom)
		frappe.db.set_single_value("Background Check Settings", "fetch_blocked_domains", "\n".join(lines))
