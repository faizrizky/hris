// A menu opens on its dashboard instead of its Home page: when the desk lands on a menu's bare route, go to the target
// the server computed (hris_ats.menu.set_landing). Hook: frappe.router "change" event.
frappe.router.on("change", () => {
	const route = frappe.router.current_route || [];
	const target = route.length === 1 && (frappe.boot.hris_landing || {})[route[0]];
	if (target) frappe.set_re_route(...target);
});
