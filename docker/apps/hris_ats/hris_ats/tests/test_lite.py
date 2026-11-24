from hris_ats.lite import is_lite


def test_lite_only_for_non_admins_on_opted_in_sites():
	assert is_lite(1, ["HR Manager", "Employee"])
	assert not is_lite(1, ["System Manager", "HR Manager"])
	assert not is_lite(0, ["Employee"])
	assert not is_lite(None, ["Employee"])


def test_filter_items_drops_named_links_and_whole_hidden_sections():
	from hris_ats.lite.profile import filter_items

	items = [
		{"type": "Link", "label": "Home", "child": 0},
		{"type": "Link", "label": "Roster", "child": 0},
		{"type": "Section Break", "label": "Reports", "child": 0},
		{"type": "Link", "label": "Leave Balance", "child": 1},
		{"type": "Section Break", "label": "Setup", "child": 0},
		{"type": "Link", "label": "Leave Type", "child": 1},
		{"type": "Link", "label": "Settings", "child": 0},
	]
	kept = [i["label"] for i in filter_items(items, {"Home", "Settings", "Reports"})]
	assert kept == ["Roster", "Setup", "Leave Type"]


def test_subscription_status_and_lock():
	from hris_ats.subscription import compute_status, is_locked

	assert compute_status(1, None, "2026-12-01") == "Active"
	assert compute_status(1, "2026-12-01", "2026-12-01") == "Active"  # valid through the date itself
	assert compute_status(1, "2026-11-30", "2026-12-01") == "Inactive"
	assert compute_status(0, None, "2026-12-01") == "Inactive"
	assert compute_status(1, "0001-01-01", "2026-12-01") == "Active"  # how an empty date comes back from the old single

	managed = {"hris_subscription_active": 1, "hris_subscription_until": "2026-11-30"}
	assert is_locked(managed, "2026-12-01")
	assert not is_locked(managed, "2026-11-30")
	assert is_locked({"hris_subscription_active": 0}, "2026-01-01")
	assert not is_locked({}, "2026-12-01")  # unmanaged site is never locked
	assert not is_locked({**managed, "hris_control_plane": 1}, "2026-12-01")
	assert not is_locked({**managed, "hris_subscription_enforce": 0}, "2026-12-01")


def test_wants_json_matches_frappe_rule():
	from hris_ats.subscription import wants_json

	assert wants_json("/api/method/ping", "application/json", False)  # mobile app
	assert wants_json("/api/method/x", "*/*", False)  # API call without a text accept header
	assert wants_json("/app", "text/html", True)  # XHR
	assert not wants_json("/login", "text/html,application/xhtml+xml", False)  # browser navigation


def test_filter_items_drops_a_section_with_nothing_left_under_it():
	from hris_ats.lite.profile import filter_items

	items = [
		{"type": "Link", "label": "Expense Claim", "child": 0},
		{"type": "Section Break", "label": "Travel", "child": 0},  # its children were removed by permissions
		{"type": "Section Break", "label": "Accounting Entries", "child": 0},
		{"type": "Link", "label": "Journal Entry", "child": 1},
		{"type": "Section Break", "label": "Trailing", "child": 0},
	]
	assert [i["label"] for i in filter_items(items, set())] == ["Expense Claim", "Accounting Entries", "Journal Entry"]
