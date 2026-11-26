"""Menu replacement: our own dock and sidebars stand in for ERPNext and Frappe HR, without touching their files.

How it stays upgrade-safe: nothing of the other apps is edited or overwritten. Their menus are removed from the desk
payload on the way out (`extend_bootinfo`) unless the site sets `hris_menu_replace` to 0, so a pull of an official update
only ever changes files we do not touch. Pages and DocTypes stay reachable by URL and search. Turn the switch off
and the original menus are back instantly.
"""

import json
import os

import frappe

HIDDEN_APPS = ()  # shortcut: default is rename-only; list apps in `hris_menu_hide_apps` to hide them
RENAMES = {"erpnext": "Sentra General", "hrms": "Sentra HR"}

# One home per shortcut: an entry that both menus carry stays only in the menu that owns it.
HR_OWNED = ("Branch", "Department", "Designation", "Holiday List", "Timesheet", "Activity Type")
GENERAL_OWNED = ("Company", "Payment Entry", "Journal Entry", "General Ledger", "Accounts Receivable", "Accounts Payable")
ROSTER = {"label": "Roster", "type": "Link", "link_type": "URL", "url": "/hr/roster", "icon": "calendar-duotone", "added": 0, "hidden": 0}


def rename_apps(bootinfo, names=RENAMES):
	"""Retitle app tiles in the payload only; the apps' own files stay untouched."""
	for entry in bootinfo.get("app_data") or []:
		if entry.get("app_name") in names:
			entry["app_title"] = names[entry["app_name"]]


def hide_apps(bootinfo, apps=HIDDEN_APPS):
	"""Drop the given apps' rails and tiles from the desk payload."""
	for app in apps:
		(bootinfo.get("dock") or {}).pop(app, None)
	bootinfo["apps"] = [a for a in bootinfo.get("apps") or [] if a.get("name") not in apps]
	for entry in bootinfo.get("app_data") or []:
		if entry.get("app_name") in apps:
			entry["on_apps_screen"] = False
			entry["dock"] = []


def hide_rails(bootinfo):
	"""Drop locked rails from the HR menu; their doctypes are also locked by permission (hris_ats.lock)."""
	from hris_ats.lock import HIDDEN_RAILS, enabled

	if not enabled():
		return
	keep = lambda entries: [e for e in entries or [] if e.get("link_to") not in HIDDEN_RAILS]
	if "hrms" in (bootinfo.get("dock") or {}):
		bootinfo["dock"]["hrms"] = keep(bootinfo["dock"]["hrms"])
	for entry in bootinfo.get("app_data") or []:
		if entry.get("app_name") == "hrms":
			entry["dock"] = keep(entry.get("dock"))


def hide_home(bootinfo, apps=("erpnext", "hrms")):
	"""Drop the workspace "Home" entry of these apps' menus, so a menu opens on its dashboard (or first real entry)."""
	sidebars = bootinfo.get("module_sidebars") or {}
	for app in apps:
		for entry in (bootinfo.get("dock") or {}).get(app) or []:
			sidebar = sidebars.get(entry.get("link_to"))
			if sidebar:
				sidebar["items"] = [i for i in sidebar["items"] if not (i.get("label") == "Home" and i.get("link_type") == "Workspace")]


def dedupe_shortcuts(bootinfo):
	"""Remove from each menu the shortcuts the other menu owns, and add the Roster page next to attendance."""
	from hris_ats.lite.profile import filter_items

	sidebars = bootinfo.get("module_sidebars") or {}
	for app, owned in (("erpnext", HR_OWNED), ("hrms", GENERAL_OWNED)):
		for entry in (bootinfo.get("dock") or {}).get(app) or []:
			sidebar = sidebars.get(entry.get("link_to"))
			if sidebar:
				labels = {i.get("label") for i in sidebar["items"] if i.get("link_to") in owned}
				sidebar["items"] = filter_items(sidebar["items"], labels)
	# Sentra People was the prototype's stand-in for HR; Sentra HR replaces it (a migrate does not drop a Dock row once synced).
	if "hris_ats" in (bootinfo.get("dock") or {}):
		bootinfo["dock"]["hris_ats"] = [e for e in bootinfo["dock"]["hris_ats"] if e.get("link_to") != "Sentra People"]
	attendance = sidebars.get("Shift & Attendance")
	if attendance and not any(i.get("label") == "Roster" for i in attendance["items"]):
		attendance["items"].append(dict(ROSTER))


def extend_bootinfo(bootinfo):
	from hris_ats.subscription import live_conf

	conf = live_conf()
	if conf.get("hris_menu_replace", 1):  # on by default for every site; set 0 in site_config to get the stock menus back
		hide_rails(bootinfo)
		hide_home(bootinfo)
		dedupe_shortcuts(bootinfo)
		rename_apps(bootinfo, conf.get("hris_menu_rename") or RENAMES)
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
