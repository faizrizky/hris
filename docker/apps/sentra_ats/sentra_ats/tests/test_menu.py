import pytest

from sentra_ats.menu import hide_apps


def _boot():
	return {
		"dock": {"erpnext": [1], "hrms": [2], "sentra_ats": [3]},
		"apps": [{"name": "erpnext"}, {"name": "hrms"}, {"name": "sentra_ats"}],
		"app_data": [{"app_name": "hrms", "on_apps_screen": True, "dock": [2]}, {"app_name": "sentra_ats", "on_apps_screen": True, "dock": [3]}],
	}


def test_hide_apps_removes_only_the_replaced_apps():
	boot = _boot()
	hide_apps(boot, ("erpnext", "hrms"))
	assert set(boot["dock"]) == {"sentra_ats"}
	assert [a["name"] for a in boot["apps"]] == ["sentra_ats"]
	assert boot["app_data"][0] == {"app_name": "hrms", "on_apps_screen": False, "dock": []}
	assert boot["app_data"][1]["on_apps_screen"] is True  # our own app is untouched


def test_hide_apps_is_a_no_op_on_an_empty_payload():
	boot = {}
	hide_apps(boot, ("erpnext",))
	assert boot == {"apps": []}


def test_every_link_in_our_menu_still_opens_something():
	import frappe

	if not getattr(frappe.local, "site", None) or frappe.db is None:
		pytest.skip("needs a site with a database")
	from sentra_ats.menu import check_links

	assert check_links() == []


def test_rename_apps_changes_only_the_title():
	from sentra_ats.menu import rename_apps

	boot = {"app_data": [{"app_name": "erpnext", "app_title": "ERPNext"}, {"app_name": "frappe", "app_title": "Framework"}]}
	rename_apps(boot)
	assert [e["app_title"] for e in boot["app_data"]] == ["Sentra General", "Framework"]


def test_dedupe_keeps_each_shortcut_in_one_menu():
	from sentra_ats.menu import dedupe_shortcuts

	item = lambda name: {"label": name, "link_to": name, "type": "Link"}
	boot = {
		"dock": {"erpnext": [{"link_to": "Setup"}], "hrms": [{"link_to": "HR Setup"}]},
		"module_sidebars": {
			"Setup": {"items": [item("Company"), item("Department")]},
			"HR Setup": {"items": [item("Company"), item("Department")]},
			"Shift & Attendance": {"items": []},
		},
	}
	dedupe_shortcuts(boot)
	assert [i["label"] for i in boot["module_sidebars"]["Setup"]["items"]] == ["Company"]
	assert [i["label"] for i in boot["module_sidebars"]["HR Setup"]["items"]] == ["Department"]
	assert boot["module_sidebars"]["Shift & Attendance"]["items"][0]["label"] == "Roster"


def test_hide_rails_drops_only_the_locked_rails(monkeypatch):
	from sentra_ats import lock
	from sentra_ats.menu import hide_rails

	monkeypatch.setattr(lock, "enabled", lambda: True)

	boot = {"dock": {"hrms": [{"link_to": "Payroll"}, {"link_to": "Leaves"}]}, "app_data": [{"app_name": "hrms", "dock": [{"link_to": "Expenses"}, {"link_to": "Tenure"}]}]}
	hide_rails(boot)
	assert [e["link_to"] for e in boot["dock"]["hrms"]] == ["Leaves"]
	assert [e["link_to"] for e in boot["app_data"][0]["dock"]] == ["Tenure"]


def test_locked_doctypes_have_no_rights_left_for_other_roles():
	import frappe

	if not getattr(frappe.local, "site", None) or frappe.db is None:
		pytest.skip("needs a site with a database")
	from sentra_ats.lock import ADMIN, LOCKED_DOCTYPES, apply

	apply()
	for dt in LOCKED_DOCTYPES:
		if frappe.db.exists("DocType", dt):
			assert not frappe.get_all("Custom DocPerm", filters={"parent": dt, "role": ("!=", ADMIN), "read": 1}), dt


def test_hide_home_drops_only_the_workspace_home_of_those_apps():
	from sentra_ats.menu import hide_home

	home = {"label": "Home", "link_type": "Workspace"}
	dash = {"label": "Home", "link_type": "Dashboard"}  # CRM's home is a dashboard: kept
	boot = {"dock": {"hrms": [{"link_to": "A"}], "erpnext": [{"link_to": "B"}], "sentra_ats": [{"link_to": "C"}]},
		"module_sidebars": {"A": {"items": [dict(home), {"label": "Dashboard"}]}, "B": {"items": [dash]}, "C": {"items": [dict(home)]}}}
	hide_home(boot)
	assert [i["label"] for i in boot["module_sidebars"]["A"]["items"]] == ["Dashboard"]
	assert len(boot["module_sidebars"]["B"]["items"]) == 1 and len(boot["module_sidebars"]["C"]["items"]) == 1


def test_set_landing_prefers_a_dashboard_and_points_the_tile_at_it():
	from sentra_ats.menu import set_landing

	boot = {
		"dock": {"hrms": [{"link_to": "Leaves"}, {"link_to": "HR Setup"}]},
		"module_sidebars": {
			"Leaves": {"items": [{"link_type": "DocType", "link_to": "Leave Application", "type": "Link"}]},
			"HR Setup": {"items": [{"link_type": "Dashboard", "link_to": "Human Resource", "type": "Link"}]},
		},
		"app_data": [{"app_name": "hrms", "app_route": "/desk/hr-setup"}],
	}
	set_landing(boot)
	assert boot["hris_landing"]["leaves"] == ["leaves", "leave-application"]
	assert boot["hris_landing"]["hr-setup"] == ["hr-setup", "dashboard-view", "Human Resource"]
	assert boot["app_data"][0]["app_route"] == "/desk/hr-setup/dashboard-view/Human%20Resource"


def test_assignable_masters_answers_false_for_a_doctype_the_user_cannot_read(monkeypatch):
	import frappe

	from sentra_ats import overrides

	monkeypatch.setattr(frappe, "has_permission", lambda dt, ptype: dt != "Salary Structure", raising=False)
	monkeypatch.setattr(frappe, "get_list", lambda *a, **k: ["x"], raising=False)
	assert overrides.get_assignable_masters("Co") == {"Leave Policy": True, "Salary Structure": False, "Shift Schedule": True}


def test_menu_color_accepts_only_colours():
	from sentra_ats.menu_color import is_valid

	assert all(is_valid(v) for v in ("", None, "standard", "#467CF7"))  # "standard" = the default, kept for old values
	assert not any(is_valid(v) for v in ("red", "#fff", "#467CF7;}body{display:none", "url(x)"))


def test_prune_menus_keeps_partial_menus_and_drops_empty_ones(monkeypatch):
	import frappe

	from sentra_ats import menu

	monkeypatch.setattr(frappe, "has_permission", lambda dt, ptype: dt == "Job Opening", raising=False)
	monkeypatch.setattr(menu, "dashboard_has_content", lambda name: name == "Full")
	monkeypatch.setattr(frappe, "get_roles", lambda: ["HR User"], raising=False)
	link = lambda label, link_type, **extra: {"type": "Link", "label": label, "link_type": link_type, **extra}
	tile = lambda name: {"link_type": "Sidebar", "link_to": name}
	boot = {
		"module_sidebars": {
			"Partly": {"items": [link("Roster", "URL", url="/hr/roster"), link("Jobs", "URL", url="/jobs")]},
			"Empty": {"items": []},
			"Home only": {"items": [link("Home", "Workspace")]},
			"Denied": {"items": [{"type": "Section Break", "label": "S"}, link("D", "Dashboard", link_to="Blank")]},
		},
		"dock": {"hrms": [tile("Partly"), tile("Empty"), tile("Home only"), tile("Denied")]},
		"app_data": [
			{"app_name": "hrms", "dock": [tile("Partly"), tile("Empty")], "on_apps_screen": True},
			{"app_name": "other", "dock": [tile("Denied")], "on_apps_screen": True},
		],
	}
	menu.prune_menus(boot)
	assert [e["link_to"] for e in boot["dock"]["hrms"]] == ["Partly"]
	assert [i["label"] for i in boot["module_sidebars"]["Partly"]["items"]] == ["Jobs"]
	assert boot["module_sidebars"]["Denied"]["items"] == []
	assert [a["on_apps_screen"] for a in boot["app_data"]] == [True, False]


def test_sentra_people_is_dropped_from_the_dock_and_the_app_tile():
	from sentra_ats.menu import dedupe_shortcuts

	tiles = [{"link_to": "Sentra People"}, {"link_to": "Sentra ATS"}]
	boot = {"dock": {"sentra_ats": list(tiles)}, "app_data": [{"app_name": "sentra_ats", "dock": list(tiles)}]}
	dedupe_shortcuts(boot)
	assert boot["dock"]["sentra_ats"] == boot["app_data"][0]["dock"] == [{"link_to": "Sentra ATS"}]


def test_labels_are_matched_in_the_users_language_too(monkeypatch):
	import frappe

	from sentra_ats.lite.profile import filter_items
	from sentra_ats.menu import hide_home

	monkeypatch.setattr(frappe, "_", lambda s: {"Home": "Beranda", "Reports": "Laporan"}.get(s, s), raising=False)
	assert filter_items([{"label": "Laporan", "type": "Section Break"}, {"label": "X", "child": 1}, {"label": "Y"}], {"Reports"}) == [{"label": "Y"}]
	boot = {"app_data": [{"app_name": "hrms", "dock": [{"link_to": "A"}]}], "module_sidebars": {"A": {"items": [{"label": "Beranda", "link_type": "Workspace"}]}}}
	hide_home(boot)
	assert boot["module_sidebars"]["A"]["items"] == []


def test_a_doctype_everybody_may_read_is_not_a_menu_of_the_user(monkeypatch):
	import frappe

	from sentra_ats import menu

	meta = type("Meta", (), {"permissions": [{"role": "Desk User", "read": 1}, {"role": "Quality Manager", "read": 1}]})
	monkeypatch.setattr(frappe, "get_meta", lambda dt: meta, raising=False)
	item = {"link_type": "DocType", "link_to": "Quality Goal"}
	assert not menu.may_open(item, ["Employee", "Desk User", "All"])
	assert menu.may_open(item, ["Quality Manager", "Desk User"])
	assert menu.may_open(item, ["System Manager"])
