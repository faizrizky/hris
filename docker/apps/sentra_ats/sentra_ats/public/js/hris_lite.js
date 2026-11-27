// On client sites (boot.hris_trim_except is only sent there) list and dashboard pages hide the view switcher, the "..."
// menu and the like hearts; css/hris_lite.css does the hiding. Framework's own doctypes and the control-plane site keep
// them. Cosmetic only: permissions are what restrict access. Hook: frappe.router "change".
function hrisTrim() {
	const except = frappe.boot.hris_trim_except;
	const route = frappe.router.current_route || [];
	const page = (route[0] === "List" && !(except || []).includes(route[1])) || route[0] === "dashboard-view";
	document.documentElement.classList.toggle("hris-trim", Boolean(except) && page);
}
frappe.router.on("change", hrisTrim);
$(document).on("app_ready", hrisTrim);
