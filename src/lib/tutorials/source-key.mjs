/**
 * @param {string} rawValue
 * @returns {string}
 */
export function normalizeSourceKey(rawValue) {
  const parsed = new URL(rawValue);
  if (parsed.protocol !== "https:") {
    throw new Error(`Source URL must use HTTPS: ${rawValue}`);
  }
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.port = "";
  parsed.hash = "";
  for (const key of [...parsed.searchParams.keys()]) {
    if (/^(?:utm_|fbclid$|gclid$)/i.test(key)) parsed.searchParams.delete(key);
  }
  const sorted = [...parsed.searchParams.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
  parsed.search = "";
  for (const [key, value] of sorted) parsed.searchParams.append(key, value);
  parsed.pathname = parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/+$/, "");
  return parsed.toString();
}
