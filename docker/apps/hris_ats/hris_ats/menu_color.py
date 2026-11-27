"""Per-user colour of the selected sidebar item (Settings > Appearance > Menu Color, public/js/menu_color.js).

Stored in User.custom_menu_color: empty = the Sentra default, "standard" = Frappe's own look, or "#rrggbb".
"""

import re

import frappe
from frappe import _

HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def is_valid(value) -> bool:
	return not value or value == "standard" or bool(HEX.match(value))


def validate_user(doc, method=None):
	# The value is written into CSS in the browser, so only a colour may be stored.
	if not is_valid(doc.get("custom_menu_color")):
		frappe.throw(_("Menu Color must be a colour such as #467CF7."))


def extend_bootinfo(bootinfo):
	bootinfo.hris_menu_color = frappe.db.get_value("User", frappe.session.user, "custom_menu_color") or ""
