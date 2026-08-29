import type { Locale } from "@/lib/localization";
import { SITE_ORIGIN } from "@/components/sites/learningseo-io-071dae18/shared/links";

export const TUTORIAL_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const TUTORIAL_ROUTE_PREFIX = "/tutorials/";
export const ENGLISH_TUTORIAL_ROUTE_PREFIX = "/en/tutorials/";

export function isTutorialSlug(value: unknown): value is string {
  return typeof value === "string" && TUTORIAL_SLUG_PATTERN.test(value);
}

export function assertTutorialSlug(slug: string): string {
  if (!isTutorialSlug(slug)) {
    throw new Error(`Invalid tutorial slug: ${slug}`);
  }
  return slug;
}

export function tutorialPath(slug: string, locale: Locale): string {
  const safeSlug = assertTutorialSlug(slug);
  return locale === "en"
    ? `${ENGLISH_TUTORIAL_ROUTE_PREFIX}${safeSlug}/`
    : `${TUTORIAL_ROUTE_PREFIX}${safeSlug}/`;
}

export function tutorialUrl(
  slug: string,
  locale: Locale,
  origin: string = SITE_ORIGIN,
): string {
  const siteOrigin = new URL(origin).origin;
  return new URL(tutorialPath(slug, locale), `${siteOrigin}/`).toString();
}

export function tutorialAlternates(
  slug: string,
  origin: string = SITE_ORIGIN,
): Readonly<{ "zh-CN": string; en: string }> {
  return {
    "zh-CN": tutorialUrl(slug, "zh-CN", origin),
    en: tutorialUrl(slug, "en", origin),
  };
}

export function tutorialLocaleFromPath(pathname: string): Locale | null {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const match = normalized.match(/^\/(en\/)?tutorials\/([^/]+)\/?$/);
  if (!match || !isTutorialSlug(match[2])) return null;
  return match[1] ? "en" : "zh-CN";
}

export function safeTutorialRedirect(
  target: string,
  locale: Locale,
): string | null {
  try {
    const parsed = new URL(target, `${SITE_ORIGIN}/`);
    if (parsed.origin !== SITE_ORIGIN || parsed.protocol !== "https:") return null;
    const targetLocale = tutorialLocaleFromPath(parsed.pathname);
    if (targetLocale !== locale) return null;

    const normalizedPath = tutorialPath(
      parsed.pathname.split("/").filter(Boolean).at(-1) ?? "",
      locale,
    );
    return `${normalizedPath}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}
