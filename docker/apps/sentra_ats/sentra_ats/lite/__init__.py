import frappe

# Menu milik tim kita (kontrol klien): hanya tampil di site yang ditandai `hris_control_plane` (sentra).
CONTROL_PLANE_MENUS = {"App Update", "Langganan HRIS", "HRIS Subscription"}
# The per-site single is superseded on the control plane by the HRIS Subscription list.
LEGACY_ON_CONTROL_PLANE = {"Langganan HRIS"}


def is_lite(lite_flag, roles) -> bool:
	"""Lite UI is for non-admins on sites that opted in with `hris_lite_ui`; System Manager keeps the full Desk."""
	return bool(lite_flag) and "System Manager" not in roles


def extend_bootinfo(bootinfo):
	from sentra_ats.lite.profile import SIDEBAR_HIDE, drop_reports_settings, filter_items
	from sentra_ats.subscription import live_conf

	conf = live_conf()  # frappe.conf is cached per worker and would miss a toggle made from the control plane

	# Client sites trim list and dashboard chrome (public/js/hris_lite.js); Framework's own pages keep it.
	if not conf.get("hris_control_plane"):
		modules = frappe.get_all("Module Def", filters={"app_name": "frappe"}, pluck="name")
		bootinfo.hris_trim_except = frappe.get_all("DocType", filters={"module": ("in", modules)}, pluck="name")

	sidebars = bootinfo.get("module_sidebars") or {}
	if sidebars.get("HR Setup"):
		hide = LEGACY_ON_CONTROL_PLANE if conf.get("hris_control_plane") else CONTROL_PLANE_MENUS
		sidebars["HR Setup"]["items"] = filter_items(sidebars["HR Setup"]["items"], hide)

	bootinfo.hris_lite = is_lite(conf.get("hris_lite_ui"), frappe.get_roles())
	if bootinfo.hris_lite:
		for name, hide in SIDEBAR_HIDE.items():
			if sidebars.get(name):
				sidebars[name]["items"] = filter_items(sidebars[name]["items"], hide)
		for sidebar in sidebars.values():
			sidebar["items"] = drop_reports_settings(sidebar["items"])
