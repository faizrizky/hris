# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

import os
import zipfile
import io
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors


def create_single_column_pdf(path: str):
	c = canvas.Canvas(path, pagesize=letter)
	y = 750

	c.setFont("Helvetica-Bold", 16)
	c.drawString(50, y, "Budi Santoso")
	y -= 20
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "budi.santoso@example.com | 081234567890 | Jakarta Selatan, DKI Jakarta")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Ringkasan Profesional")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "Software engineer berpengalaman 5 tahun dalam pengembangan sistem ERP dan web backend.")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Pengalaman Kerja")
	y -= 15
	c.setFont("Helvetica-Bold", 10)
	c.drawString(50, y, "Senior Backend Developer - PT Maju Bersama")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "Jan 2022 - Sekarang")
	y -= 15
	c.drawString(50, y, "- Memimpin tim 6 orang dalam implementasi arsitektur microservices.")
	y -= 15
	c.drawString(50, y, "- Berhasil meningkatkan performa database sebesar 35% dan efisiensi query.")
	y -= 25

	c.setFont("Helvetica-Bold", 10)
	c.drawString(50, y, "Software Engineer - PT Solusi Digital")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "Jan 2019 - Des 2021")
	y -= 15
	c.drawString(50, y, "- Mengembangkan modul rekrutmen dan penggajian yang melayani 10000 pengguna aktif.")
	y -= 15
	c.drawString(50, y, "- Menghemat biaya server hingga Rp 25 juta per bulan dengan optimasi cache.")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Pendidikan")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "S1 Teknik Informatika - Universitas Indonesia (2015 - 2019)")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Keahlian")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "Python, SQL, ERPNext, Docker, Git, REST API, Redis, JavaScript")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Sertifikasi")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "Certified Scrum Master (CSM), AWS Certified Solutions Architect")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Prestasi")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "Juara 1 Hackathon Nasional 2021 kategori Solusi Enterprise.")
	c.save()


def create_two_column_pdf(path: str):
	c = canvas.Canvas(path, pagesize=letter)
	# Kolom Kiri (x: 40 sampai 220)
	c.setFont("Helvetica-Bold", 14)
	c.drawString(40, 750, "Jessica Tan")
	c.setFont("Helvetica", 9)
	c.drawString(40, 735, "jessica.tan@example.com")
	c.drawString(40, 720, "081987654321")
	c.drawString(40, 705, "Bandung, Jawa Barat")

	c.setFont("Helvetica-Bold", 11)
	c.drawString(40, 660, "Keahlian")
	c.setFont("Helvetica", 9)
	skills = ["Figma", "UI/UX Design", "Wireframing", "User Research", "Prototyping", "Design System", "CSS"]
	y = 645
	for s in skills:
		c.drawString(40, y, f"• {s}")
		y -= 15

	c.setFont("Helvetica-Bold", 11)
	c.drawString(40, y - 10, "Pendidikan")
	c.setFont("Helvetica", 9)
	c.drawString(40, y - 25, "S1 Desain Komunikasi Visual")
	c.drawString(40, y - 40, "ITB (2018 - 2022)")

	# Kolom Kanan (x: 270 sampai 570)
	c.setFont("Helvetica-Bold", 12)
	c.drawString(270, 750, "Ringkasan Profesional")
	c.setFont("Helvetica", 9)
	c.drawString(270, 735, "Product designer dengan pengalaman 3 tahun mendesain produk digital.")
	c.drawString(270, 720, "Fokus pada antarmuka intuitif dan kemudahan akses pengguna.")

	c.setFont("Helvetica-Bold", 12)
	c.drawString(270, 680, "Pengalaman Kerja")
	c.setFont("Helvetica-Bold", 10)
	c.drawString(270, 660, "UI/UX Designer - PT Kreatif Nusantara")
	c.setFont("Helvetica", 9)
	c.drawString(270, 645, "Jan 2022 - Sekarang")
	c.drawString(270, 630, "- Mendesain ulang aplikasi mobile dan meningkatkan konversi sebesar 25%.")
	c.drawString(270, 615, "- Memimpin riset pengguna terhadap 50 responden untuk produk baru.")

	c.setFont("Helvetica-Bold", 10)
	c.drawString(270, 580, "Junior Designer - Studio Desain Bandung")
	c.setFont("Helvetica", 9)
	c.drawString(270, 565, "Jan 2021 - Des 2021")
	c.drawString(270, 550, "- Membuat design system komprehensif untuk 3 proyek klien enterprise.")

	c.setFont("Helvetica-Bold", 12)
	c.drawString(270, 510, "Prestasi")
	c.setFont("Helvetica", 9)
	c.drawString(270, 495, "Finalis Lomba Desain Antarmuka Nasional 2022.")

	c.save()


def create_scanned_image_pdf(path: str):
	c = canvas.Canvas(path, pagesize=letter)
	# Hanya menggambar kotak/gambar tanpa teks yang cukup
	c.setFillColor(colors.lightgrey)
	c.rect(50, 100, 500, 650, fill=1, stroke=1)
	c.setFillColor(colors.black)
	c.setFont("Helvetica", 8)
	c.drawString(60, 120, "Scan dokumen")  # kurang dari 20 karakter
	c.save()


def create_docx(path: str):
	# Buat DOCX sederhana yang valid
	doc_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Mega Wulandari</w:t></w:r></w:p>
    <w:p><w:r><w:t>mega.wulandari@example.com | 081345678901 | Surabaya, Jawa Timur</w:t></w:r></w:p>
    <w:p><w:r><w:t>Ringkasan Profesional</w:t></w:r></w:p>
    <w:p><w:r><w:t>Quality Assurance Engineer berpengalaman dalam pengujian manual dan otomatisasi.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Pengalaman Kerja</w:t></w:r></w:p>
    <w:p><w:r><w:t>QA Engineer - PT Fintek Bersama</w:t></w:r></w:p>
    <w:p><w:r><w:t>Jan 2021 - Sekarang</w:t></w:r></w:p>
    <w:p><w:r><w:t>Mengembangkan suite pengujian otomatisasi menggunakan Python dan Selenium.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Pendidikan</w:t></w:r></w:p>
    <w:p><w:r><w:t>S1 Sistem Informasi - Institut Teknologi Sepuluh Nopember (2016 - 2020)</w:t></w:r></w:p>
    <w:p><w:r><w:t>Keahlian</w:t></w:r></w:p>
    <w:p><w:r><w:t>Selenium, Python, Cypress, API Testing, Postman, SQL, JIRA</w:t></w:r></w:p>
    <w:p><w:r><w:t>Sertifikasi</w:t></w:r></w:p>
    <w:p><w:r><w:t>ISTQB Certified Tester Foundation Level</w:t></w:r></w:p>
  </w:body>
</w:document>"""

	content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"""

	rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""

	with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
		zf.writestr("[Content_Types].xml", content_types)
		zf.writestr("_rels/.rels", rels)
		zf.writestr("word/document.xml", doc_xml)


def create_english_pdf(path: str):
	c = canvas.Canvas(path, pagesize=letter)
	y = 750
	c.setFont("Helvetica-Bold", 16)
	c.drawString(50, y, "Michael Chen")
	y -= 20
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "michael.chen@example.com | +6281234567800 | Jakarta, Indonesia")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Professional Summary")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "Senior Fullstack Developer with 4 years of experience building scalable web applications.")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Work Experience")
	y -= 15
	c.setFont("Helvetica-Bold", 10)
	c.drawString(50, y, "Senior Developer - Global Tech Ltd")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "Jan 2022 - Present")
	y -= 15
	c.drawString(50, y, "- Led a team of 4 engineers to deliver enterprise portals for 50000 active users.")
	y -= 15
	c.drawString(50, y, "- Reduced system latency by 45% through database optimization and Redis caching.")
	y -= 25

	c.setFont("Helvetica-Bold", 10)
	c.drawString(50, y, "Software Engineer - Indo Apps")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "Jan 2020 - Dec 2021")
	y -= 15
	c.drawString(50, y, "- Developed RESTful APIs using Python, FastAPI, and PostgreSQL.")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Education")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "Bachelor of Computer Science - Nanyang Technological University (2016 - 2020)")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Technical Skills")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "Python, TypeScript, React, Docker, Kubernetes, PostgreSQL, Git, AWS")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Certifications")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "AWS Certified Developer, Certified Kubernetes Administrator (CKA)")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Achievements")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "Published open-source library with over 1500 stars on GitHub.")
	c.save()


def create_indonesian_pdf(path: str):
	c = canvas.Canvas(path, pagesize=letter)
	y = 750
	c.setFont("Helvetica-Bold", 16)
	c.drawString(50, y, "Siti Nurhaliza")
	y -= 20
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "siti.nurhaliza@example.com | 081298765432 | Jakarta Pusat, DKI Jakarta")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Ringkasan Profesional")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "Spesialis SDM dengan pengalaman 4 tahun dalam rekrutmen, kompensasi, dan kepatuhan ketenagakerjaan.")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Pengalaman Kerja")
	y -= 15
	c.setFont("Helvetica-Bold", 10)
	c.drawString(50, y, "HR Generalist - PT Cahaya Abadi")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "Jan 2021 - Sekarang")
	y -= 15
	c.drawString(50, y, "- Mengelola proses end-to-end rekrutmen untuk 80 posisi baru setiap tahun.")
	y -= 15
	c.drawString(50, y, "- Memangkas waktu pemrosesan seleksi pelamar sebesar 30% menggunakan sistem ATS.")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Riwayat Pendidikan")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "S1 Psikologi - Universitas Gadjah Mada (2016 - 2020)")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Keahlian")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "Talent Acquisition, ERPNext HRMS, Payroll, Interviewing, Employee Relations")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Sertifikasi")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "Certified Human Resource Professional (CHRP)")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Prestasi")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "Menerima penghargaan Karyawan Terbaik Kuartal 3 tahun 2022.")
	c.save()


def create_no_phone_pdf(path: str):
	c = canvas.Canvas(path, pagesize=letter)
	y = 750
	c.setFont("Helvetica-Bold", 16)
	c.drawString(50, y, "Rudi Hermawan")
	y -= 20
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "rudi.hermawan@example.com | Tangerang Selatan, Banten")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Ringkasan")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "Data Analyst berpengalaman dalam pengolahan data tabular dan visualisasi dashboard.")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Pengalaman Kerja")
	y -= 15
	c.setFont("Helvetica-Bold", 10)
	c.drawString(50, y, "Data Analyst - PT Data Prima")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "Jan 2022 - Sekarang")
	y -= 15
	c.drawString(50, y, "- Membangun 15 dashboard interaktif menggunakan Tableau dan Metabase.")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Pendidikan")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "S1 Statistika - Institut Pertanian Bogor (2017 - 2021)")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Keahlian")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "SQL, Python, Pandas, Tableau, Data Warehousing, Power BI")
	c.save()


def create_mixed_dates_pdf(path: str):
	c = canvas.Canvas(path, pagesize=letter)
	y = 750
	c.setFont("Helvetica-Bold", 16)
	c.drawString(50, y, "Ahmad Fauzi")
	y -= 20
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "ahmad.fauzi@example.com | 081234567899 | Semarang, Jawa Tengah")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Pengalaman Kerja")
	y -= 15
	c.setFont("Helvetica-Bold", 10)
	c.drawString(50, y, "Senior Programmer - PT Maju")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "06/2023 - Sekarang")
	y -= 15
	c.drawString(50, y, "Mengembangkan aplikasi web portal.")
	y -= 25

	c.setFont("Helvetica-Bold", 10)
	c.drawString(50, y, "Junior Programmer - CV Berkah")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "Januari 2021 - Mei 2022")
	y -= 15
	c.drawString(50, y, "Membantu pembuatan API sistem transaksi.")
	y -= 25

	c.setFont("Helvetica-Bold", 10)
	c.drawString(50, y, "Intern Developer - PT Kreasi")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "2019 - 2020")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Pendidikan")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "S1 Teknik Informatika - Universitas Diponegoro (2016 - 2020)")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Keahlian")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "PHP, Laravel, MySQL, JavaScript, Git")
	c.save()


def create_overlapping_roles_pdf(path: str):
	c = canvas.Canvas(path, pagesize=letter)
	y = 750
	c.setFont("Helvetica-Bold", 16)
	c.drawString(50, y, "Doni Pratama")
	y -= 20
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "doni.pratama@example.com | 081233344455 | Yogyakarta")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Pengalaman Kerja")
	y -= 15
	c.setFont("Helvetica-Bold", 10)
	c.drawString(50, y, "Lead Developer - PT Bintang Timur")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "Jun 2021 - Sekarang")
	y -= 15
	c.drawString(50, y, "- Mengelola tim pengembang sistem ERP internal.")
	y -= 25

	c.setFont("Helvetica-Bold", 10)
	c.drawString(50, y, "Software Engineer - PT Alpha Cipta")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "Jan 2021 - Des 2022")
	y -= 15
	c.drawString(50, y, "- Membangun API backend untuk platform logistik.")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Pendidikan")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "S1 Ilmu Komputer - Universitas Gadjah Mada (2016 - 2020)")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Keahlian")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "Python, Django, PostgreSQL, Docker, Redis")
	c.save()


def create_fresh_graduate_pdf(path: str):
	c = canvas.Canvas(path, pagesize=letter)
	y = 750
	c.setFont("Helvetica-Bold", 16)
	c.drawString(50, y, "Rian Pratama")
	y -= 20
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "rian.pratama@example.com | 081255566677 | Depok, Jawa Barat")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Ringkasan")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "Fresh graduate Sarjana Sistem Informasi dengan ketertarikan tinggi pada analisis sistem.")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Pendidikan")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "S1 Sistem Informasi - Universitas Indonesia (2022 - 2026)")
	c.drawString(50, y - 15, "IPK: 3.82 / 4.00")
	y -= 40

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Pengalaman Kerja")
	y -= 15
	c.setFont("Helvetica-Bold", 10)
	c.drawString(50, y, "Magang Web Developer - PT Startup Solusi")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "Jan 2026 - Mar 2026")
	y -= 15
	c.drawString(50, y, "- Membantu perbaikan bug antarmuka frontend dan dokumentasi API.")
	y -= 30

	c.setFont("Helvetica-Bold", 12)
	c.drawString(50, y, "Keahlian")
	y -= 15
	c.setFont("Helvetica", 10)
	c.drawString(50, y, "HTML, CSS, JavaScript, React, Python Dasar, SQL")
	c.save()


def generate_all(target_dir: str):
	os.makedirs(target_dir, exist_ok=True)
	create_single_column_pdf(os.path.join(target_dir, "cv_01_single_column.pdf"))
	create_two_column_pdf(os.path.join(target_dir, "cv_02_two_column.pdf"))
	create_scanned_image_pdf(os.path.join(target_dir, "cv_03_scanned_image.pdf"))
	create_docx(os.path.join(target_dir, "cv_04_sample.docx"))
	create_english_pdf(os.path.join(target_dir, "cv_05_english.pdf"))
	create_indonesian_pdf(os.path.join(target_dir, "cv_06_indonesian.pdf"))
	create_no_phone_pdf(os.path.join(target_dir, "cv_07_no_phone.pdf"))
	create_mixed_dates_pdf(os.path.join(target_dir, "cv_08_mixed_dates.pdf"))
	create_overlapping_roles_pdf(os.path.join(target_dir, "cv_09_overlapping_roles.pdf"))
	create_fresh_graduate_pdf(os.path.join(target_dir, "cv_10_fresh_graduate.pdf"))
	print("Berhasil membuat 10 fixture CV di", target_dir)


if __name__ == "__main__":
	target_dir = os.path.dirname(__file__)
	generate_all(target_dir)
