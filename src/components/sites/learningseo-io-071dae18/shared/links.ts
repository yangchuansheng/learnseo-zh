import {
  DEFAULT_LOCALE,
  localizedPath,
  type Locale,
} from "@/lib/localization";

export const SITE_ORIGIN = "https://learningseo.io";

function isPublicPath(pathname: string): boolean {
  return pathname.startsWith("/sites/") || pathname.startsWith("/_next/");
}

function localPath(pathname: string, locale: Locale): string {
  if (isPublicPath(pathname)) return pathname;
  return localizedPath(pathname, locale);
}

export function localHref(href: string, locale: Locale = DEFAULT_LOCALE): string {
  if (href.startsWith(SITE_ORIGIN)) {
    const url = new URL(href);
    if (url.origin !== SITE_ORIGIN) return href;
    return `${localPath(url.pathname, locale)}${url.search}${url.hash}`;
  }

  if (href.startsWith("/") && !href.startsWith("//")) {
    return localPath(href, locale);
  }

  return href;
}

export function localHtml(
  html: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return html.replace(
    /(href|action)=(['"])([^'"]*)\2/gi,
    (_match, attribute: string, quote: string, href: string) =>
      `${attribute}=${quote}${localHref(href, locale)}${quote}`,
  );
}
