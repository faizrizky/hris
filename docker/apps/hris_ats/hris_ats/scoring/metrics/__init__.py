# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

from typing import TypedDict


class MetricResult(TypedDict):
	score: float
	applicable: bool
	reason: str
