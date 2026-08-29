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
  if (parsed.port === "443") parsed.port = "";
  parsed.hash = "";
  for (const key of [...parsed.searchParams.keys()]) {
    if (/^(?:utm_|fbclid$|gclid$)/i.test(key)) parsed.searchParams.delete(key);
  }
  const compareCodePoints = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
  const sorted = [...parsed.searchParams.entries()].sort(([leftKey], [rightKey]) =>
    compareCodePoints(leftKey, rightKey),
  );
  parsed.search = "";
  for (const [key, value] of sorted) parsed.searchParams.append(key, value);
  parsed.pathname = parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/+$/, "");
  return parsed.toString();
}
