from hris_ats.hr_compliance import MESSAGES, thr_amount, thr_months, validate_contract, validate_identity


def test_identity_numbers():
	assert validate_identity("3174.0123.4567.8901", "12.345.678.9-012.345", "", "") == []  # separators are ignored
	assert validate_identity("1234", "", "", "") == [MESSAGES[0]]
	assert validate_identity("", "12345", "", "") == [MESSAGES[1]]
	assert validate_identity("", "", "12ab", "x") == [MESSAGES[2], MESSAGES[3]]
	assert validate_identity("", "", "", "") == []  # blank is allowed


def test_contract_rules():
	assert validate_contract("PKWTT", "2026-01-01", None, 3) == []
	assert validate_contract("PKWTT", "2026-01-01", None, 4) == [MESSAGES[8]]
	assert validate_contract("PKWT", "2026-01-01", "2027-01-01", 0) == []
	assert validate_contract("PKWT", "2026-01-01", "2031-01-01", 0) == []  # exactly 5 years is allowed
	assert validate_contract("PKWT", "2026-01-01", "2031-01-02", 0) == [MESSAGES[6]]
	assert validate_contract("PKWT", "2026-01-01", None, 0) == [MESSAGES[5]]
	assert validate_contract("PKWT", "2026-01-01", "2026-06-01", 1) == [MESSAGES[4]]
	assert validate_contract("PKWT", "2026-06-01", "2026-01-01", 0) == [MESSAGES[7]]


def test_thr_follows_permenaker_6_2016():
	assert thr_months("2025-01-15", "2026-03-20") == 12  # a year or more is capped at 12
	assert thr_months("2026-01-15", "2026-06-14") == 4  # whole months only
	assert thr_months("2026-06-01", "2026-06-20") == 0  # under one month earns nothing
	assert thr_amount(6_000_000, 12) == 6_000_000
	assert thr_amount(6_000_000, 5) == 2_500_000  # 5/12 x one month's wage
	assert thr_amount(6_000_000, 0) == 0
