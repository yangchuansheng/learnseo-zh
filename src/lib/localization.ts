export const LOCALES = ["zh-CN", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "zh-CN";

export function localeFromPathname(pathname: string): Locale {
  return /^\/en(?:\/|$)/.test(pathname) ? "en" : DEFAULT_LOCALE;
}

export function stripLocalePrefix(pathname: string): string {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (normalized === "/en" || normalized.startsWith("/en/")) {
    return normalized.slice(3) || "/";
  }
  return normalized;
}

export function localizedPath(pathname: string, locale: Locale): string {
  const normalized = stripLocalePrefix(pathname);
  if (locale === "en") return normalized === "/" ? "/en/" : `/en${normalized}`;
  return normalized;
}

function isTutorialRoute(pathname: string): boolean {
  return /^\/(?:en\/)?tutorials\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/.test(pathname);
}

export function resolveLocalizedPath(
  pathname: string,
  targetLocale: Locale,
  availablePaths?: ReadonlySet<string>,
): string {
  const candidate = localizedPath(pathname, targetLocale);
  if (isTutorialRoute(candidate)) return candidate;
  if (!availablePaths || availablePaths.has(candidate)) return candidate;
  return localizedPath(pathname, DEFAULT_LOCALE);
}
