"""Client subscriptions, managed from the control-plane site (sentra) and enforced on every client site.

Sentra keeps one `HRIS Subscription` row per client. Saving a row writes the plan, expiry and on/off state into the
client site's own site_config (the keys below) and into the mobile registry. Each client site then checks its own
config on every request, so it locks itself on the expiry date even when sentra is down.

Site config keys on a client site:
  hris_subscription_active  1/0   (absent = site is not managed, never locked)
  hris_subscription_until   YYYY-MM-DD or "" (no expiry)
Kill switch for the whole bench: `bench set-config -g hris_subscription_enforce 0`.
The control-plane site (`hris_control_plane`) is never locked.
"""

import os
import re
import subprocess

import frappe
from frappe import _
from frappe.utils import add_days, getdate, now, nowdate

SITE_RE = re.compile(r"^[a-z0-9-]+(\.[a-z0-9-]+)+$")
MANAGED_DOCTYPES = ("HRIS Subscription", "App Update")


class SubscriptionInactive(frappe.ValidationError):
	http_status_code = 402


def compute_status(enabled, valid_until, on_date) -> str:
	if not enabled:
		return "Inactive"
	until = getdate(valid_until) if valid_until else None  # getdate() is None for an empty date such as 0001-01-01
	if until and until < getdate(on_date):
		return "Inactive"
	return "Active"


def is_locked(conf, on_date) -> bool:
	if conf.get("hris_control_plane") or conf.get("hris_subscription_enforce") == 0:
		return False
	if "hris_subscription_active" not in conf:
		return False
	return (
		compute_status(conf.get("hris_subscription_active"), conf.get("hris_subscription_until"), on_date)
		== "Inactive"
	)


def live_conf() -> dict:
	"""Site + common config read from disk on every call: web workers keep a cached `frappe.conf` that misses changes."""
	conf = {}
	for path in (
		os.path.join(frappe.local.sites_path, "common_site_config.json"),
		os.path.join(frappe.local.site_path, "site_config.json"),
	):
		try:
			conf.update(frappe.get_file_json(path))
		except Exception:
			pass
	return conf


def wants_json(path, accept, is_ajax) -> bool:
	"""Same rule Frappe uses to choose between a JSON error (mobile app, XHR) and an HTML error page."""
	return bool((accept and (is_ajax or "application/json" in accept)) or (path.startswith("/api/") and not accept.startswith("text")))


def inactive_page() -> str:
	title = frappe.utils.escape_html(_("Subscription inactive"))
	text = frappe.utils.escape_html(_("This subscription is inactive. Contact your HRIS administrator."))
	return (
		'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
		f"<title>{title}</title><style>body{{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;"
		"font-family:system-ui,sans-serif;background:#f7f7f7;color:#1f1f1f}main{max-width:420px;padding:32px;text-align:center}"
		"h1{font-size:20px;margin:0 0 12px}p{margin:0;color:#555;line-height:1.5}</style></head>"
		f"<body><main><h1>{title}</h1><p>{text}</p></main></body></html>"
	)


def before_request():
	if not is_locked(live_conf(), nowdate()):
		return
	request = frappe.local.request
	if not wants_json(request.path, frappe.get_request_header("Accept") or "", frappe.local.is_ajax):
		from werkzeug.exceptions import HTTPException
		from werkzeug.wrappers import Response

		# Frappe returns werkzeug HTTP exceptions as the response, so a browser gets a readable page.
		raise HTTPException(response=Response(inactive_page(), status=402, mimetype="text/html"))
	frappe.throw(_("This subscription is inactive. Contact your HRIS administrator."), SubscriptionInactive)


def has_permission(doc, ptype=None, user=None, debug=False):
	"""Subscriptions are only usable on the control-plane site, whatever the roles say.

	Frappe v16 treats a controller hook as a denial unless it returns True."""
	return bool(frappe.conf.get("hris_control_plane"))


def registry_site() -> str:
	return frappe.conf.get("hris_registry_site") or "admin.localhost"


# Run on the target site (see run_on_site). Every client site keeps exactly one HRIS Subscription row: its own.
def apply_local(active, plan, until="", code="", name="", site="", hr_focus=0):
	from frappe.installer import update_site_config

	update_site_config("hris_subscription_active", int(active))
	update_site_config("hris_subscription_until", until or "")
	values = {
		"company_name": name, "code": code, "site": site, "plan": plan, "enabled": int(active),
		"valid_until": until or None, "status": "Active" if active else "Inactive", "hr_focus": int(hr_focus),
	}
	frappe.db.delete("HRIS Subscription", {"name": ("!=", code)})
	if frappe.db.exists("HRIS Subscription", code):
		frappe.db.set_value("HRIS Subscription", code, values)
	else:
		row = frappe.get_doc({"doctype": "HRIS Subscription", **values})
		row.name = code
		row.set_user_and_timestamp()
		row.db_insert()  # skips validate/hooks: this row is data pushed from the control plane, not an edit
	frappe.db.commit()
	# HR Focus: the flag is read from disk on each request (live_conf), the profile itself is applied or taken back here.
	from hris_ats.lite.profile import apply, revert

	update_site_config("hris_lite_ui", 1 if hr_focus else "None")
	(apply if hr_focus else revert)()
	frappe.db.commit()


def remove_legacy_langganan():
	"""The per-site single "Langganan HRIS" is replaced by the HRIS Subscription row; drop it once that row exists."""
	if frappe.db.exists("DocType", "Langganan HRIS") and (
		frappe.conf.get("hris_control_plane") or frappe.db.count("HRIS Subscription")
	):
		frappe.delete_doc("DocType", "Langganan HRIS", force=True, ignore_permissions=True)


def apply_registry(code, name, site, active):
	values = {"nama_company": name, "site": site, "aktif": int(active)}
	if frappe.db.exists("HRIS Tenant", code):
		frappe.db.set_value("HRIS Tenant", code, values)
	else:
		frappe.get_doc({"doctype": "HRIS Tenant", "kode": code, **values}).insert(ignore_permissions=True)
	frappe.db.commit()


def sites_path() -> str:
	return os.path.join(frappe.utils.get_bench_path(), "sites")


def site_exists(site) -> bool:
	return bool(SITE_RE.match(site)) and os.path.isfile(os.path.join(sites_path(), site, "site_config.json"))


@frappe.whitelist()
def list_sites(current=None):
	"""Every site on this server except the control plane and registry, for the Site picker; registered ones are marked."""
	frappe.only_for("System Manager")
	if not frappe.conf.get("hris_control_plane"):
		return []
	taken = set(frappe.get_all("HRIS Subscription", pluck="site")) - {current}
	rows = [
		{"value": d, "label": d, "description": _("Already registered") if d in taken else ""}
		for d in os.listdir(sites_path())
		if d not in {frappe.local.site, registry_site()} and site_exists(d)
	]
	return sorted(rows, key=lambda r: (bool(r["description"]), r["value"]))


def run_on_site(site, method, kwargs):
	"""Call `module.function(**kwargs)` inside another site's context (works on sites without this app installed)."""
	if not site_exists(site):
		raise FileNotFoundError(f"Site {site} not found")
	sites = sites_path()
	bench = frappe.utils.get_bench_path()
	module, _sep, function = method.rpartition(".")
	code = (
		"import frappe, importlib\n"
		f"frappe.init(site={site!r}, sites_path={sites!r})\n"
		"frappe.connect()\n"
		f"getattr(importlib.import_module({module!r}), {function!r})(**{kwargs!r})\n"
	)
	result = subprocess.run(
		[os.path.join(bench, "env", "bin", "python"), "-c", code],
		cwd=sites, capture_output=True, text=True, timeout=180,
	)
	if result.returncode:
		raise RuntimeError((result.stderr or result.stdout).strip().splitlines()[-1][:300])


def sync_one(subscription):
	doc = frappe.get_doc("HRIS Subscription", subscription)
	status = compute_status(doc.enabled, doc.valid_until, nowdate())
	active = int(status == "Active")
	errors = []
	for site, method, kwargs in (
		(doc.site, "hris_ats.subscription.apply_local",
			{"active": active, "plan": doc.plan, "until": str(doc.valid_until or ""),
				"code": doc.code, "name": doc.company_name, "site": doc.site, "hr_focus": int(doc.hr_focus or 0)}),
		(registry_site(), "hris_ats.subscription.apply_registry",
			{"code": doc.code, "name": doc.company_name, "site": doc.site, "active": active}),
	):
		try:
			run_on_site(site, method, kwargs)
		except Exception as e:
			errors.append(f"{site}: {e}")
	doc.db_set({"status": status, "last_synced": now(), "sync_error": "\n".join(errors)[:1000]}, update_modified=False)


@frappe.whitelist()
def sync_now(subscription):
	frappe.only_for("System Manager")
	if not frappe.conf.get("hris_control_plane"):
		frappe.throw(_("Subscriptions can only be managed on the control-plane site."))
	sync_one(subscription)


def refresh_all():
	"""Daily: expire subscriptions whose date has passed (and push the change to their sites)."""
	if not frappe.conf.get("hris_control_plane"):
		return
	for name, status, enabled, valid_until in frappe.get_all(
		"HRIS Subscription", fields=["name", "status", "enabled", "valid_until"], as_list=True
	):
		if compute_status(enabled, valid_until, nowdate()) != status:
			sync_one(name)


@frappe.whitelist()
def summary():
	"""Counts for the header of the subscription list."""
	frappe.only_for("System Manager")
	rows = frappe.get_all("HRIS Subscription", fields=["status", "valid_until", "sync_error"])
	soon = getdate(add_days(nowdate(), 30))
	return {
		"active": sum(r.status == "Active" for r in rows),
		"inactive": sum(r.status == "Inactive" for r in rows),
		"expiring": sum(r.status == "Active" and bool(r.valid_until) and getdate(r.valid_until) <= soon for r in rows),
		"errors": sum(bool(r.sync_error) for r in rows),
	}
