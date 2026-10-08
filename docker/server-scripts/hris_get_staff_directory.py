# Server Script (type: API, method: hris_get_staff_directory, allow_guest: 0)
# Direktori karyawan. HR User / HR Manager: semua Employee Active. Selain itu: hanya
# bawahan langsung (reports_to = Employee pemanggil), tanpa dirinya sendiri.
# Memakai frappe.get_all (melewati User Permission); hanya field yang tercantum yang dikembalikan.
# Panggil: GET /api/method/hris_get_staff_directory
user = frappe.session.user
is_hr = user == "Administrator" or len(
    frappe.get_all(
        "Has Role",
        filters={
            "parent": user,
            "parenttype": "User",
            "role": ["in", ["HR User", "HR Manager"]],
        },
        limit_page_length=1,
    )
) > 0

total_active = frappe.db.count("Employee", {"status": "Active"})
me = frappe.get_all(
    "Employee",
    filters={"user_id": user, "status": "Active"},
    fields=["name"],
    limit_page_length=1,
)

filters = {"status": "Active"}
rows = []
if is_hr:
    rows = frappe.get_all(
        "Employee",
        filters=filters,
        fields=[
            "name", "employee_name", "designation", "department", "employee_number",
            "employment_type", "contract_end_date", "date_of_joining", "reports_to",
            "company_email", "cell_number",
        ],
        order_by="employee_name asc",
        limit_page_length=1000,
    )
elif me:
    filters["reports_to"] = me[0].name
    rows = frappe.get_all(
        "Employee",
        filters=filters,
        fields=[
            "name", "employee_name", "designation", "department", "employee_number",
            "employment_type", "contract_end_date", "date_of_joining", "reports_to",
            "company_email", "cell_number",
        ],
        order_by="employee_name asc",
        limit_page_length=1000,
    )

today = frappe.utils.nowdate()
items = []
for r in rows:
    if (not is_hr) and me and r.name == me[0].name:
        continue
    manager = None
    if r.reports_to:
        manager = frappe.db.get_value("Employee", r.reports_to, "employee_name")
    shift = None
    sa = frappe.get_all(
        "Shift Assignment",
        filters={
            "employee": r.name,
            "docstatus": 1,
            "status": "Active",
            "start_date": ["<=", today],
        },
        or_filters=[["end_date", ">=", today], ["end_date", "is", "not set"]],
        fields=["shift_type"],
        order_by="start_date desc",
        limit_page_length=1,
    )
    if sa:
        shift = sa[0].shift_type
    leave_left = None
    alloc = frappe.get_all(
        "Leave Allocation",
        filters={
            "employee": r.name,
            "leave_type": "Cuti Tahunan",
            "docstatus": 1,
            "from_date": ["<=", today],
            "to_date": [">=", today],
        },
        fields=["total_leaves_allocated", "from_date", "to_date"],
        limit_page_length=50,
    )
    if alloc:
        total = 0
        for a in alloc:
            total = total + a.total_leaves_allocated
        used = frappe.get_all(
            "Leave Application",
            filters={
                "employee": r.name,
                "leave_type": "Cuti Tahunan",
                "docstatus": 1,
                "status": "Approved",
                "from_date": [">=", alloc[0].from_date],
                "to_date": ["<=", alloc[0].to_date],
            },
            fields=["total_leave_days"],
            limit_page_length=500,
        )
        taken = 0
        for u in used:
            taken = taken + u.total_leave_days
        leave_left = total - taken
    items.append(
        {
            "name": r.name,
            "employee_name": r.employee_name,
            "designation": r.designation,
            "department": r.department,
            "employee_number": r.employee_number,
            "employment_type": r.employment_type,
            "contract_end_date": r.contract_end_date,
            "date_of_joining": r.date_of_joining,
            "reports_to_name": manager,
            "shift": shift,
            "company_email": r.company_email,
            "cell_number": r.cell_number,
            "leave_left": leave_left,
        }
    )

frappe.response["message"] = {"total_active": total_active, "items": items}
