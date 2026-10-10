# Server Script (type: API, method: hris_submit_travel_request, allow_guest: 0)
# Ajukan Travel Request (draft) untuk Employee pemanggil.
# POST body (JSON): destination, from_date, to_date (YYYY-MM-DD), transport (Flight|Train|Car|Bus),
#   purpose (teks), costs = [{"category","description","amount"}]  (daftar JSON), ATAU string
#   "category|description|amount;category|description|amount" (pemisah ; dan |).
# category: Travel | Food | Medical | Calls | Others (selain itu -> Others).
# custom_timezone diisi dari kota tujuan (default Asia/Jakarta); HR dapat mengubahnya di web.
# Hasil: {"name","destination","from_date","to_date","transport","purpose","timezone","costs":[...],"status":"pending"}
fd = frappe.form_dict
destination = (fd.get("destination") or "").strip()
from_date = fd.get("from_date")
to_date = fd.get("to_date")
transport = (fd.get("transport") or "").strip()
purpose = (fd.get("purpose") or "").strip()
raw_costs = fd.get("costs")

me = frappe.get_all(
    "Employee",
    filters={"user_id": frappe.session.user, "status": "Active"},
    fields=["name", "company", "reports_to", "employee_name"],
    limit_page_length=1,
)
if not me:
    frappe.throw("This account is not linked to an active employee")
if not destination or not from_date or not to_date or not purpose:
    frappe.throw("destination, from_date, to_date and purpose are required")
if frappe.utils.getdate(to_date) < frappe.utils.getdate(from_date):
    frappe.throw("End date cannot be before start date")
if frappe.utils.date_diff(to_date, from_date) > 60:
    frappe.throw("A trip cannot be longer than 60 days")
modes = {"flight": "Flight", "train": "Train", "car": "Rented Car", "bus": "Taxi", "taxi": "Taxi"}
mode = modes.get(transport.lower())
if transport and not mode:
    frappe.throw("transport must be one of Flight, Train, Car, Bus")

tz_map = {
    "jakarta": "Asia/Jakarta", "bandung": "Asia/Jakarta", "surabaya": "Asia/Jakarta", "medan": "Asia/Jakarta",
    "semarang": "Asia/Jakarta", "yogyakarta": "Asia/Jakarta", "bogor": "Asia/Jakarta", "depok": "Asia/Jakarta",
    "bekasi": "Asia/Jakarta", "tangerang": "Asia/Jakarta", "palembang": "Asia/Jakarta", "malang": "Asia/Jakarta",
    "makassar": "Asia/Makassar", "denpasar": "Asia/Makassar", "bali": "Asia/Makassar",
    "balikpapan": "Asia/Makassar", "manado": "Asia/Makassar", "banjarmasin": "Asia/Makassar",
    "mataram": "Asia/Makassar", "kupang": "Asia/Makassar", "samarinda": "Asia/Makassar",
    "jayapura": "Asia/Jayapura", "ambon": "Asia/Jayapura", "sorong": "Asia/Jayapura", "manokwari": "Asia/Jayapura",
    "merauke": "Asia/Jayapura", "ternate": "Asia/Jayapura",
    "singapore": "Asia/Singapore", "kuala lumpur": "Asia/Kuala_Lumpur", "bangkok": "Asia/Bangkok",
    "tokyo": "Asia/Tokyo", "seoul": "Asia/Seoul", "hong kong": "Asia/Hong_Kong", "manila": "Asia/Manila",
    "sydney": "Australia/Sydney", "london": "Europe/London", "dubai": "Asia/Dubai",
}
international = ["singapore", "kuala lumpur", "bangkok", "tokyo", "seoul", "hong kong", "manila", "sydney", "london", "dubai"]
key = destination.lower()
tz = tz_map.get(key, "Asia/Jakarta")

costs = []
if isinstance(raw_costs, list):
    for c in raw_costs:
        costs.append({"category": c.get("category"), "description": c.get("description"), "amount": c.get("amount")})
elif raw_costs:
    for part in str(raw_costs).split(";"):
        bits = part.split("|")
        if len(bits) >= 3:
            costs.append({"category": bits[0].strip(), "description": bits[1].strip(), "amount": bits[2].strip()})
cost_rows = []
for c in costs:
    cat = c["category"] if c["category"] in ("Travel", "Food", "Medical", "Calls", "Others") else "Others"
    amount = frappe.utils.flt(c["amount"])
    if amount < 0:
        frappe.throw("Cost amount cannot be negative")
    cost_rows.append({"expense_type": cat, "total_amount": amount, "comments": c["description"]})

if not frappe.db.exists("Purpose of Travel", "Business Trip"):
    frappe.get_doc({"doctype": "Purpose of Travel", "purpose_of_travel": "Business Trip"}).insert(ignore_permissions=True)

doc = frappe.get_doc(
    {
        "doctype": "Travel Request",
        "employee": me[0].name,
        "company": me[0].company,
        "travel_type": "International" if key in international else "Domestic",
        "purpose_of_travel": "Business Trip",
        "description": purpose,
        "custom_destination": destination,
        "custom_from_date": from_date,
        "custom_to_date": to_date,
        "custom_transport": transport or None,
        "custom_timezone": tz,
        "itinerary": [
            {
                "travel_to": destination,
                "mode_of_travel": mode,
                "departure_date": from_date + " 00:00:00",
                "arrival_date": to_date + " 23:59:00",
            }
        ],
        "costings": cost_rows,
    }
)
doc.insert(ignore_permissions=True)

if me[0].reports_to:
    boss = frappe.db.get_value("Employee", me[0].reports_to, "user_id")
    if boss:
        frappe.get_doc(
            {
                "doctype": "Notification Log",
                "type": "Alert",
                "for_user": boss,
                "subject": "Travel request from " + str(me[0].employee_name) + " is waiting for your approval",
                "email_content": destination + ": " + from_date + " to " + to_date,
                "document_type": "Travel Request",
                "document_name": doc.name,
            }
        ).insert(ignore_permissions=True)

frappe.response["message"] = {
    "name": doc.name,
    "destination": destination,
    "from_date": from_date,
    "to_date": to_date,
    "transport": transport or None,
    "purpose": purpose,
    "timezone": tz,
    "costs": [{"category": r["expense_type"], "description": r["comments"], "amount": r["total_amount"]} for r in cost_rows],
    "status": "pending",
}
