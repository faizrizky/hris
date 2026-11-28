# Teks notifikasi bawaan Frappe berisi HTML (mis. penugasan: "<strong>X</strong> assigned a new task ...").
# Disisipkan lewat "# @include: _lib/notif_lib.py".
def nt_teks(value):
    text = frappe.utils.strip_html(value or "")
    for code, char in (("&nbsp;", " "), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"'), ("&#39;", "'"), ("&amp;", "&")):
        text = text.replace(code, char)
    text = " ".join(text.split())
    if " assigned a new task Task " in text and text.endswith(" to you"):
        text = text.replace(" assigned a new task Task ", " assigned you a task: ")[:-len(" to you")]
    return text
