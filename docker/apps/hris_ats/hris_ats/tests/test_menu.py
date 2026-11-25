import pytest

from hris_ats.menu import hide_apps


def _boot():
	return {
		"dock": {"erpnext": [1], "hrms": [2], "hris_ats": [3]},
		"apps": [{"name": "erpnext"}, {"name": "hrms"}, {"name": "hris_ats"}],
		"app_data": [{"app_name": "hrms", "on_apps_screen": True, "dock": [2]}, {"app_name": "hris_ats", "on_apps_screen": True, "dock": [3]}],
	}


def test_hide_apps_removes_only_the_replaced_apps():
	boot = _boot()
	hide_apps(boot)
	assert set(boot["dock"]) == {"hris_ats"}
	assert [a["name"] for a in boot["apps"]] == ["hris_ats"]
	assert boot["app_data"][0] == {"app_name": "hrms", "on_apps_screen": False, "dock": []}
	assert boot["app_data"][1]["on_apps_screen"] is True  # our own app is untouched


def test_hide_apps_is_a_no_op_on_an_empty_payload():
	boot = {}
	hide_apps(boot)
	assert boot == {"apps": []}


def test_every_link_in_our_menu_still_opens_something():
	import frappe

	if not getattr(frappe.local, "site", None) or frappe.db is None:
		pytest.skip("needs a site with a database")
	from hris_ats.menu import check_links

	assert check_links() == []
