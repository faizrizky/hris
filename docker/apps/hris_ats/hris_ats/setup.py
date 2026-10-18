# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

CUSTOM_FIELDS = {
	"Job Opening": [
		{
			"fieldname": "screening_criteria_section",
			"label": "Kriteria Screening",
			"fieldtype": "Section Break",
			"insert_after": "description",
			"collapsible": 0,
		},
		{
			"fieldname": "screening_template",
			"label": "Template Screening",
			"fieldtype": "Link",
			"options": "Resume Screening Template",
			"insert_after": "screening_criteria_section",
		},
		{
			"fieldname": "min_education",
			"label": "Pendidikan Minimal",
			"fieldtype": "Select",
			"options": "\nSMA/SMK\nD3\nD4/S1\nS2\nS3",
			"insert_after": "screening_template",
		},
		{
			"fieldname": "min_years_experience",
			"label": "Minimal Pengalaman (Tahun)",
			"fieldtype": "Float",
			"insert_after": "min_education",
		},
		{
			"fieldname": "column_break_screening",
			"fieldtype": "Column Break",
			"insert_after": "min_years_experience",
		},
		{
			"fieldname": "education_majors",
			"label": "Jurusan Pendidikan",
			"fieldtype": "Small Text",
			"description": "Pisahkan dengan koma atau baris baru",
			"insert_after": "column_break_screening",
		},
		{
			"fieldname": "relevant_titles",
			"label": "Judul Jabatan Relevan",
			"fieldtype": "Small Text",
			"description": "Pisahkan dengan koma atau baris baru",
			"insert_after": "education_majors",
		},
		{
			"fieldname": "section_break_skills",
			"label": "Keahlian & Sertifikasi",
			"fieldtype": "Section Break",
			"insert_after": "relevant_titles",
		},
		{
			"fieldname": "required_skills",
			"label": "Keahlian Wajib",
			"fieldtype": "Small Text",
			"description": "Satu keahlian per baris",
			"insert_after": "section_break_skills",
		},
		{
			"fieldname": "preferred_skills",
			"label": "Keahlian Tambahan",
			"fieldtype": "Small Text",
			"description": "Satu keahlian per baris",
			"insert_after": "required_skills",
		},
		{
			"fieldname": "certification_keywords",
			"label": "Kata Kunci Sertifikasi",
			"fieldtype": "Small Text",
			"description": "Satu kata kunci per baris",
			"insert_after": "preferred_skills",
		},
	],
	"Job Applicant": [
		{
			"fieldname": "recruitment_stage",
			"label": "Tahap Rekrutmen",
			"fieldtype": "Select",
			"options": "New Applied\nScreening\nBackground Check\nInterview\nOffer\nHired\nRejected",
			"default": "New Applied",
			"insert_after": "status",
			"in_standard_filter": 1,
			"in_list_view": 1,
		},
		{
			"fieldname": "city",
			"label": "Kota / Region",
			"fieldtype": "Data",
			"insert_after": "country",
		},
		{
			"fieldname": "address",
			"label": "Alamat",
			"fieldtype": "Data",
			"insert_after": "city",
		},
		{
			"fieldname": "postal_code",
			"label": "Kode Pos",
			"fieldtype": "Data",
			"insert_after": "address",
		},
		{
			"fieldname": "resume_screening",
			"label": "Resume Screening",
			"fieldtype": "Link",
			"options": "Resume Screening",
			"read_only": 1,
			"insert_after": "resume_attachment",
		},
		{
			"fieldname": "resume_score",
			"label": "Skor Resume",
			"fieldtype": "Float",
			"read_only": 1,
			"insert_after": "resume_screening",
			"in_list_view": 1,
		},
		{
			"fieldname": "screening_status",
			"label": "Status Screening",
			"fieldtype": "Select",
			"options": "\nQueued\nScreening\nDone\nFailed",
			"read_only": 1,
			"insert_after": "resume_score",
			"in_list_view": 1,
		},
	],
}


def setup_custom_fields():
	create_custom_fields(CUSTOM_FIELDS, update=True)


def after_install():
	setup_custom_fields()


def after_migrate():
	setup_custom_fields()
