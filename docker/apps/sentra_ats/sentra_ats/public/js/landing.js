// A menu opens on its dashboard instead of its Home page: when the desk lands on a menu's bare route, go to the target
// the server computed (sentra_ats.menu.set_landing). Hook: frappe.router "change" event. The router resolves a menu's
// own route either to [slug] or to ["Workspaces", <title>], so both shapes are matched.
frappe.router.on("change", () => {
	const route = frappe.router.current_route || [];
	const key = route.length === 1 ? route[0] : route.length === 2 && route[0] === "Workspaces" ? frappe.router.slug(route[1]) : null;
	const target = key && (frappe.boot.hris_landing || {})[key];
	if (target) frappe.set_re_route(...target);
});
