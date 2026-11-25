"""Menu replacement: our own dock and sidebars stand in for ERPNext and Frappe HR, without touching their files.

How it stays upgrade-safe: nothing of the other apps is edited or overwritten. Their menus are removed from the desk
payload on the way out (`extend_bootinfo`) while the switch `hris_menu_replace` is on, so a pull of an official update
only ever changes files we do not touch. Pages and DocTypes stay reachable by URL and search. Turn the switch off
and the original menus are back instantly.
"""

import json
import os

import frappe

HIDDEN_APPS = ("erpnext", "hrms")


def hide_apps(bootinfo, apps=HIDDEN_APPS):
	"""Drop the given apps' rails and tiles from the desk payload."""
	for app in apps:
		(bootinfo.get("dock") or {}).pop(app, None)
	bootinfo["apps"] = [a for a in bootinfo.get("apps") or [] if a.get("name") not in apps]
	for entry in bootinfo.get("app_data") or []:
		if entry.get("app_name") in apps:
			entry["on_apps_screen"] = False
			entry["dock"] = []


def extend_bootinfo(bootinfo):
	from hris_ats.subscription import live_conf

	conf = live_conf()
	if conf.get("hris_menu_replace"):
		hide_apps(bootinfo, tuple(conf.get("hris_menu_hide_apps") or HIDDEN_APPS))


def _app_files(*parts):
	root = frappe.get_app_path("hris_ats")
	for base, _dirs, files in os.walk(os.path.join(root, *parts)):
		for name in files:
			if name.endswith(".json"):
				yield os.path.join(base, name)


def check_links() -> list[str]:
	"""Every entry of our own docks and sidebars must still open something. Run after each upstream update."""
	broken = []
	exists = frappe.db.exists
	for path in list(_app_files("dock")) + list(_app_files("hris_ats", "sidebar")):
		doc = json.load(open(path))
		for item in doc.get("items", []):
			link_type, link_to = item.get("link_type"), item.get("link_to")
			if item.get("type") == "Section Break" or link_type == "URL" or not link_to:
				continue
			ok = exists(link_type, link_to) or (link_type == "Sidebar" and exists("Module Def", link_to))
			if not ok:
				broken.append(f"{doc.get('name')}: {link_type} {link_to}")
	return broken
