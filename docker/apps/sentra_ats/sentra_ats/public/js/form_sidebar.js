// The right-hand form sidebar starts hidden; "Toggle Sidebar" in the form menu still shows it, and it stays shown
// for the rest of the session (Frappe re-shows it on every refresh, so the state is kept here).
// Hook: the jQuery event "form-refresh" fired by the Form class (frappe/public/js/frappe/form/form.js).
(function () {
	let shown = false;
	$(document.body).on("toggleSidebar", () => {
		shown = !shown;
	});
	$(document).on("form-refresh", (_event, frm) => {
		if (!shown && frm && frm.sidebar && frm.sidebar.sidebar) frm.sidebar.sidebar.parent().hide();
	});
})();
