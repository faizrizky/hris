// Copyright (c) 2026, HRIS Team and contributors
// For license information, please see license.txt

window.hris_ats = window.hris_ats || {};

// Scoring sentences are stored as an English template plus its parameters, so they are
// translated when shown: parameter values that are themselves known words (operators,
// section names) are translated too.
hris_ats.translate_message = function (template, params, fallback) {
	if (!template) return fallback || "";
	let values = {};
	try {
		values = typeof params === "string" ? JSON.parse(params || "{}") : params || {};
	} catch (e) {
		values = {};
	}
	// Filled in here rather than through __(text, values), which only knows {0}-style slots
	return __(template).replace(/\{(\w+)\}/g, (slot, key) => {
		if (!(key in values)) return slot;
		return typeof values[key] === "string" ? __(values[key]) : values[key];
	});
};
