import {
  DEFAULT_LOCALE,
  localizedPath,
  type Locale,
} from "@/lib/localization";
import { normalizeSourceKey } from "@/lib/tutorials/source-key.mjs";

export const SITE_ORIGIN = "https://learningseo.io";

const publishedTutorialResourcePaths = new Map([
  [
    normalizeSourceKey("https://developers.google.com/search/docs/fundamentals/seo-starter-guide"),
    "/tutorials/google-seo-starter-guide/",
  ],
  [
    normalizeSourceKey("https://developers.google.com/search/docs/fundamentals/how-search-works"),
    "/tutorials/google-search-works/",
  ],
  [
    normalizeSourceKey("https://developers.google.com/search/docs/essentials"),
    "/tutorials/google-search-essentials/",
  ],
  [
    normalizeSourceKey("https://ahrefs.com/seo/seo-basics"),
    "/tutorials/ahrefs-seo-basics/",
  ],
  [
    normalizeSourceKey("https://ahrefs.com/blog/seo-basics/"),
    "/tutorials/ahrefs-seo-basics/",
  ],
  [
    normalizeSourceKey("https://mangools.com/blog/learn-seo/"),
    "/tutorials/mangools-complete-seo-guide/",
  ],
]);

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
  const localized = html.replace(
    /(href|action)=(['"])([^'"]*)\2/gi,
    (_match, attribute: string, quote: string, href: string) =>
      `${attribute}=${quote}${localHref(href, locale)}${quote}`,
  );
  return localized.replace(
    /(<div\b[^>]*\bclass=(['"])resource\2[^>]*>)([\s\S]*?)(<\/div>)/gi,
    (_match, opening: string, _quote: string, body: string, closing: string) => {
      const resource = body.replace(
        /(href=)(['"])([^'"]*)\2/i,
        (anchor, attribute: string, quote: string, href: string) => {
          try {
            const target = publishedTutorialResourcePaths.get(
              normalizeSourceKey(href.replace(/^http:/i, "https:")),
            );
            return target
              ? `${attribute}${quote}${localHref(target, locale)}${quote}`
              : anchor;
          } catch {
            return anchor;
          }
        },
      );
      return `${opening}${resource}${closing}`;
    },
  );
}
