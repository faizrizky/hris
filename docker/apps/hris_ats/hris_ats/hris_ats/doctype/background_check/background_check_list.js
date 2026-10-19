// Copyright (c) 2026, HRIS Team and contributors
// For license information, please see license.txt

frappe.listview_settings["Background Check"] = {
	add_fields: ["status", "risk_level_auto", "risk_level_final", "full_name", "job_applicant", "consent_status"],
	get_indicator(doc) {
		let level = doc.risk_level_final || doc.risk_level_auto;
		if (doc.status === "Done") {
			if (level === "High" || level === "Tinggi") {
				return [__("Done (High)"), "red", "status,=,Done|risk_level_final,=,High"];
			} else if (level === "Needs verification" || level === "Perlu verifikasi") {
				return [__("Done (Needs verification)"), "purple", "status,=,Done|risk_level_final,=,Needs verification"];
			} else if (level === "Medium" || level === "Sedang") {
				return [__("Done (Medium)"), "orange", "status,=,Done|risk_level_final,=,Medium"];
			} else {
				return [__("Done (Low)"), "green", "status,=,Done|risk_level_final,=,Low"];
			}
		} else if (doc.status === "Crawling") {
			return [__("Crawling..."), "blue", "status,=,Crawling"];
		} else if (doc.status === "Queued") {
			return [__("Queued"), "orange", "status,=,Queued"];
		} else if (doc.status === "Waiting Consent") {
			return [__("Waiting Consent"), "grey", "status,=,Waiting Consent"];
		} else {
			return [__("Failed"), "red", "status,=,Failed"];
		}
	}
};
