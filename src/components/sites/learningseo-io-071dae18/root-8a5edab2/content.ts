import englishContent from "./content.json";
import chineseContent from "./content.zh-CN.json";

import type { Locale } from "@/lib/localization";

export type SiteContent = typeof englishContent;

export const siteContent: Record<Locale, SiteContent> = {
  en: englishContent,
  "zh-CN": chineseContent,
};

export function getSiteContent(locale: Locale): SiteContent {
  return siteContent[locale];
}
