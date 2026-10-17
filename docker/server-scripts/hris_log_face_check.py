# Server Script (type: API, method: hris_log_face_check, allow_guest: 0)
# POST: log_type (IN|OUT), outcome (Passed|Rejected|Timeout), scores (JSON daftar skor anti-spoofing per frame).
# Mencatat percobaan verifikasi wajah untuk penyetelan ambang (hanya skor, tanpa foto). Tidak memengaruhi keputusan.
fd = frappe.form_dict
me = frappe.get_all("Employee", filters={"user_id": frappe.session.user, "status": "Active"}, fields=["name"],
                    limit_page_length=1)
if not me:
    frappe.throw("This account is not linked to an active employee")
lt = (fd.get("log_type") or "").upper()
oc = fd.get("outcome")
if lt not in ("IN", "OUT") or oc not in ("Passed", "Rejected", "Timeout"):
    frappe.throw("Invalid log_type or outcome")
sc = [frappe.utils.flt(x) for x in json.loads(fd.get("scores") or "[]")][:40]
frappe.get_doc({"doctype": "Face Check Attempt", "employee": me[0].name, "log_type": lt, "outcome": oc,
                "frames": len(sc), "mean_score": (sum(sc) / len(sc)) if sc else 0, "min_score": min(sc) if sc else 0,
                "scores": json.dumps(sc)}).insert(ignore_permissions=True)
frappe.response["message"] = {"ok": 1}
