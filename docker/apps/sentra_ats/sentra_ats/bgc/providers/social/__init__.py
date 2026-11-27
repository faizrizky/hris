# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

from __future__ import annotations

from sentra_ats.bgc.providers.social.base import BaseSocialAdapter, anonymize_mentions, clean_snippet
from sentra_ats.bgc.providers.social.facebook import FacebookAdapter
from sentra_ats.bgc.providers.social.instagram import InstagramAdapter
from sentra_ats.bgc.providers.social.linkedin import LinkedInAdapter
from sentra_ats.bgc.providers.social.threads import ThreadsAdapter
from sentra_ats.bgc.providers.social.tiktok import TikTokAdapter

SOCIAL_ADAPTERS: dict[str, type[BaseSocialAdapter]] = {
	"Instagram": InstagramAdapter,
	"Facebook": FacebookAdapter,
	"TikTok": TikTokAdapter,
	"LinkedIn": LinkedInAdapter,
	"Threads": ThreadsAdapter,
}


def get_social_adapter(platform_name: str) -> BaseSocialAdapter | None:
	"""Mengembalikan instans adaptor untuk platform media sosial yang didukung."""
	adapter_cls = SOCIAL_ADAPTERS.get(platform_name)
	if adapter_cls:
		return adapter_cls()
	return None
