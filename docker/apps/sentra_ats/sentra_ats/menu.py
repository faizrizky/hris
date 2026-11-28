"""Menu replacement: our own dock and sidebars stand in for ERPNext and Frappe HR, without touching their files.

How it stays upgrade-safe: nothing of the other apps is edited or overwritten. Their menus are removed from the desk
payload on the way out (`extend_bootinfo`) unless the site sets `hris_menu_replace` to 0, so a pull of an official update
only ever changes files we do not touch. Pages and DocTypes stay reachable by URL and search. Turn the switch off
and the original menus are back instantly.
"""

import json
import os
from urllib.parse import quote

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
	"""Drop locked rails from the HR menu; their doctypes are also locked by permission (sentra_ats.lock)."""
	from sentra_ats.lock import HIDDEN_RAILS, enabled

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
	from sentra_ats.lite.profile import in_both_languages

	sidebars = bootinfo.get("module_sidebars") or {}
	home = in_both_languages({"Home"})
	for app in apps:
		# the app's own tiles as well as the arrangement: an app without one is absent from `dock`
		tiles = list((bootinfo.get("dock") or {}).get(app) or [])
		for data in bootinfo.get("app_data") or []:
			if data.get("app_name") == app:
				tiles += data.get("dock") or []
		for entry in tiles:
			sidebar = sidebars.get(entry.get("link_to"))
			if sidebar:
				sidebar["items"] = [i for i in sidebar["items"] if not (i.get("label") in home and i.get("link_type") == "Workspace")]


def slug(name: str) -> str:
	"""Route segment for a sidebar or doctype, the same rule as frappe.router.slug in the desk."""
	return name.lower().replace(" ", "-")


def landing_parts(title, items):
	"""Route segments of what a menu should open on: its dashboard, else its first doctype. None when it has neither."""
	for item in items:
		if item.get("link_type") == "Dashboard":
			return [slug(title), "dashboard-view", item["link_to"]]
	for item in items:
		if item.get("link_type") == "DocType" and item.get("type") != "Section Break" and item.get("link_to"):
			return [slug(title), slug(item["link_to"])]
	return None


def set_landing(bootinfo, apps=("erpnext", "hrms")):
	"""`hris_landing` maps a menu's own route (slug) to where it should open (read by public/js/landing.js), and each
	app tile opens its first menu that has a dashboard."""
	sidebars = bootinfo.get("module_sidebars") or {}
	landing = {}
	for app in apps:
		first = None
		for entry in (bootinfo.get("dock") or {}).get(app) or []:
			title = entry.get("link_to")
			parts = landing_parts(title, (sidebars.get(title) or {}).get("items") or [])
			if parts:
				landing[slug(title)] = parts
				if first is None or (first[1][1] != "dashboard-view" and parts[1] == "dashboard-view"):
					first = (title, parts)
		for tile in bootinfo.get("app_data") or []:
			if first and tile.get("app_name") == app:
				tile["app_route"] = "/desk/" + "/".join(quote(p, safe="") for p in first[1])
	bootinfo["hris_landing"] = landing


def dedupe_shortcuts(bootinfo):
	"""Remove from each menu the shortcuts the other menu owns, and add the Roster page next to attendance."""
	from sentra_ats.lite.profile import filter_items

	sidebars = bootinfo.get("module_sidebars") or {}
	for app, owned in (("erpnext", HR_OWNED), ("hrms", GENERAL_OWNED)):
		for entry in (bootinfo.get("dock") or {}).get(app) or []:
			sidebar = sidebars.get(entry.get("link_to"))
			if sidebar:
				labels = {i.get("label") for i in sidebar["items"] if i.get("link_to") in owned}
				sidebar["items"] = filter_items(sidebar["items"], labels)
	# Sentra People was the prototype's stand-in for HR; Sentra HR replaces it (a migrate does not drop a Dock row once synced).
	# The desk builds its tiles from app_data[].dock; `dock` only carries the arrangement, so both are filtered.
	keep = lambda entries: [e for e in entries or [] if e.get("link_to") != "Sentra People"]
	if "sentra_ats" in (bootinfo.get("dock") or {}):
		bootinfo["dock"]["sentra_ats"] = keep(bootinfo["dock"]["sentra_ats"])
	for entry in bootinfo.get("app_data") or []:
		if entry.get("app_name") == "sentra_ats":
			entry["dock"] = keep(entry.get("dock"))
	attendance = sidebars.get("Shift & Attendance")
	if attendance and not any(i.get("label") == "Roster" for i in attendance["items"]):
		attendance["items"].append(dict(ROSTER))


# Frappe hides DocType, Report and Page entries the user may not open, but not plain links: each of ours needs a right.
URL_NEEDS = {
	"/hr/roster": ("Shift Assignment", "create"),
	"/desk/job-applicant/view/kanban": ("Job Applicant", "read"),
	"/jobs": ("Job Opening", "read"),
	"/banking": ("Bank Transaction", "read"),
}


def dashboard_has_content(name) -> bool:
	"""A dashboard is worth listing only if the user may see at least one of its charts or number cards."""
	from frappe.desk.doctype.dashboard.dashboard import get_permitted_cards, get_permitted_charts

	try:
		return bool(get_permitted_charts(name) or get_permitted_cards(name))
	except (frappe.PermissionError, frappe.DoesNotExistError):
		frappe.clear_last_message()
		return False


# Roles every desk user carries. A menu entry readable only through these was never assigned to the user's job.
GENERIC_ROLES = {"All", "Desk User", "Guest"}


def granted_by_own_role(doctype, roles) -> bool:
	"""Whether one of the user's job roles (not a role everybody has) may read the doctype."""
	own = set(roles) - GENERIC_ROLES
	return any(p.get("read") and p.get("role") in own for p in frappe.get_meta(doctype).permissions)


def may_open(item, roles=()) -> bool:
	if item.get("link_type") == "DocType" and item.get("link_to") and "System Manager" not in roles:
		return granted_by_own_role(item["link_to"], roles)
	if item.get("link_type") == "URL":
		need = URL_NEEDS.get(item.get("url") or item.get("link_to"))
		return not need or bool(frappe.has_permission(*need))
	if item.get("link_type") == "Dashboard":
		return dashboard_has_content(item.get("link_to"))
	return True


def prune_menus(bootinfo):
	"""Show only what the user can open: drop denied links (and doctypes readable only because everybody may), then every dock tile whose menu has nothing left (a lone
	"Home" workspace counts as nothing), then every app tile without a dock tile. A menu with some rights keeps those."""
	from sentra_ats.lite.profile import filter_items

	usable = set()
	roles = frappe.get_roles()
	for name, sidebar in (bootinfo.get("module_sidebars") or {}).items():
		sidebar["items"] = filter_items([i for i in sidebar.get("items") or [] if may_open(i, roles)], set())
		if any(i.get("type") != "Section Break" and i.get("link_type") != "Workspace" for i in sidebar["items"]):
			usable.add(name)

	keep = lambda entries: [e for e in entries or [] if e.get("link_type") != "Sidebar" or e.get("link_to") in usable]
	dock = bootinfo.get("dock") or {}
	for app in list(dock):
		dock[app] = keep(dock[app])
	for entry in bootinfo.get("app_data") or []:
		had = entry.get("dock")
		entry["dock"] = keep(had)
		if had and not entry["dock"]:
			entry["on_apps_screen"] = False


def extend_bootinfo(bootinfo):
	from sentra_ats.subscription import live_conf

	conf = live_conf()
	if not conf.get("hris_menu_replace", 1):
		prune_menus(bootinfo)  # also with the stock menus
	if conf.get("hris_menu_replace", 1):  # on by default for every site; set 0 in site_config to get the stock menus back
		hide_rails(bootinfo)
		hide_home(bootinfo)
		dedupe_shortcuts(bootinfo)
		prune_menus(bootinfo)  # after the Roster link is added, before the landing pages are chosen
		set_landing(bootinfo)
		rename_apps(bootinfo, conf.get("hris_menu_rename") or RENAMES)
		hide_apps(bootinfo, tuple(conf.get("hris_menu_hide_apps") or HIDDEN_APPS))


def _app_files(*parts):
	root = frappe.get_app_path("sentra_ats")
	for base, _dirs, files in os.walk(os.path.join(root, *parts)):
		for name in files:
			if name.endswith(".json"):
				yield os.path.join(base, name)


def check_links() -> list[str]:
	"""Every entry of our own docks and sidebars must still open something. Run after each upstream update."""
	broken = []
	exists = frappe.db.exists
	for path in list(_app_files("dock")) + list(_app_files("sentra_ats", "sidebar")):
		doc = json.load(open(path))
		for item in doc.get("items", []):
			link_type, link_to = item.get("link_type"), item.get("link_to")
			if item.get("type") == "Section Break" or link_type == "URL" or not link_to:
				continue
			ok = exists(link_type, link_to) or (link_type == "Sidebar" and exists("Module Def", link_to))
			if not ok:
				broken.append(f"{doc.get('name')}: {link_type} {link_to}")
	return broken
