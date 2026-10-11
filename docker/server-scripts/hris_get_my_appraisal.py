# Server Script (type: API, method: hris_get_my_appraisal, allow_guest: 0)
# Appraisal terbaru milik pemanggil (docstatus < 2), atau null bila belum ada.
# Hasil: {"cycle","method","score","max_score","rating","rating_tone":"ok|info|warn|bad",
#         "raters":[{"name","score","weight"}], "goals":[{"name","progress","note"}]}
# score = final_score Appraisal (skala 0-5). rating diturunkan dari score. weight = 100 / jumlah penilai.
result = None
me = frappe.get_all("Employee", filters={"user_id": frappe.session.user, "status": "Active"},
                    fields=["name"], limit_page_length=1)
if me:
    apr = frappe.get_all("Appraisal", filters={"employee": me[0].name, "docstatus": ["<", 2]},
                         fields=["name", "appraisal_cycle", "final_score"], order_by="creation desc",
                         limit_page_length=1)
    if apr:
        a = apr[0]
        method = frappe.db.get_value("Appraisal Cycle", a.appraisal_cycle, "kra_evaluation_method")
        score = round(a.final_score or 0, 2)
        if score >= 4.5:
            rating = "Excellent"
            tone = "ok"
        elif score >= 3.5:
            rating = "Good"
            tone = "ok"
        elif score >= 2.5:
            rating = "Fair"
            tone = "info"
        elif score >= 1.5:
            rating = "Needs Improvement"
            tone = "warn"
        else:
            rating = "Poor"
            tone = "bad"
        fbs = frappe.get_all("Employee Performance Feedback",
                             filters={"appraisal": a.name, "docstatus": 1},
                             fields=["reviewer_name", "total_score"], order_by="creation asc", limit_page_length=50)
        raters = []
        for f in fbs:
            raters.append({"name": f.reviewer_name, "score": round(f.total_score or 0, 2),
                           "weight": round(100.0 / len(fbs), 1)})
        goals = []
        for g in frappe.get_all("Goal", filters={"employee": me[0].name, "appraisal_cycle": a.appraisal_cycle},
                                fields=["goal_name", "progress", "description"], order_by="creation asc",
                                limit_page_length=100):
            goals.append({"name": g.goal_name, "progress": g.progress or 0,
                          "note": frappe.utils.strip_html(g.description) if g.description else ""})
        result = {"cycle": a.appraisal_cycle, "method": method, "score": score, "max_score": 5,
                  "rating": rating, "rating_tone": tone, "raters": raters, "goals": goals}
frappe.response["message"] = result
