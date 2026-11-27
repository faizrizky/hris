"""One-off rename of the custom app in a site database: hris_ats ("HRIS ATS") -> sentra_ats ("Sentra ATS").

Frappe has no command to rename an installed app, so every stored text that mentions the old name is rewritten: installed
apps, Module Def, the `module` columns, patch log, scheduled job methods, menus, workspaces, server scripts, and the
site_config. Run by release.sh before `bench migrate` with the new image; `--reverse` undoes it (rollback).

    ../env/bin/python - <site> [--reverse] < rename_app.py     (working directory: frappe-bench/sites)

Prints RENAMED when it changed the database, SKIP when there was nothing to do.
"""

import json
import sys

import frappe

PAIRS = [("hris_ats", "sentra_ats"), ("HRIS ATS", "Sentra ATS"), ("HRIS_ATS", "SENTRA_ATS"), ("hris-ats", "sentra-ats")]
TEXT_TYPES = ("char", "varchar", "tinytext", "text", "mediumtext", "longtext")


def main(site, reverse=False):
	pairs = [(new, old) for old, new in PAIRS] if reverse else PAIRS
	source = pairs[0][0]
	frappe.init(site=site, sites_path=".")
	frappe.connect()
	installed = frappe.db.sql("select defvalue from `tabDefaultValue` where defkey = 'installed_apps'")
	if not installed or source not in json.loads(installed[0][0]):
		print("SKIP", site)
		return
	columns = frappe.db.sql(
		"""select c.table_name, c.column_name from information_schema.columns c
		join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
		where c.table_schema = database() and t.table_type = 'BASE TABLE' and c.data_type in %s
		and coalesce(c.generation_expression, '') = ''""",
		(TEXT_TYPES,),
	)
	changed = 0
	frappe.db.begin()
	for table, column in columns:
		for old, new in pairs:
			# instr on the binary value: case-sensitive, and "_" is not a wildcard
			frappe.db.sql(
				f"update `{table}` set `{column}` = replace(`{column}`, %s, %s) where instr(binary `{column}`, %s) > 0",
				(old, new, old),
			)
			changed += frappe.db._cursor.rowcount
	frappe.db.commit()
	config = f"{site}/site_config.json"
	with open(config) as f:
		text = f.read()
	for old, new in pairs:
		text = text.replace(old, new)
	json.loads(text)  # never write a broken config
	with open(config, "w") as f:
		f.write(text)
	print("RENAMED", site, "rows changed:", changed)


if __name__ == "__main__":
	main(sys.argv[1], "--reverse" in sys.argv[2:])
