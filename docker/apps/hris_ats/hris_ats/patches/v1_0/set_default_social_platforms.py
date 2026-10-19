import frappe

def execute():
	"""Pastikan platform media sosial bawaan memiliki requires_social_consent = 1."""
	social_platforms = ("Instagram", "Facebook", "TikTok", "LinkedIn", "Twitter/X")
	for plat in social_platforms:
		if frappe.db.exists("Background Check Platform", plat):
			frappe.db.set_value("Background Check Platform", plat, "requires_social_consent", 1, update_modified=False)
