const sourceOrigin = "https://learningseo.io";

export function localHref(href: string): string {
  if (!href.startsWith(sourceOrigin)) return href;
  return href.slice(sourceOrigin.length) || "/";
}

export function localHtml(html: string): string {
  return html.replace(
    /(href|action)=(['"])https:\/\/learningseo\.io([^'"]*)\2/gi,
    (_match, attribute, quote, pathname) => `${attribute}=${quote}${pathname || "/"}${quote}`,
  );
}
