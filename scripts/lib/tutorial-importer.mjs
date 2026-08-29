import crypto from "node:crypto";
import dns from "node:dns/promises";
import fs from "node:fs/promises";
import https from "node:https";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";

import { normalizeSourceKey } from "../../src/lib/tutorials/source-key.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fixtureMediaRoot = path.join(repositoryRoot, "scripts/fixtures/tutorial-importer/media");
const jiti = createJiti(import.meta.url, {
  alias: { "@": path.join(repositoryRoot, "src") },
});
const model = await jiti.import(path.join(repositoryRoot, "src/lib/tutorials/model.ts"));

export const importerDefaults = Object.freeze({
  contentRoot: path.join(repositoryRoot, "src/content/tutorials"),
  publicRoot: path.join(repositoryRoot, "public"),
  mediaPathPrefix: "/sites/learningseo-io-071dae18/tutorials/",
});

const snapshotKind = "learningseo-tutorial-snapshot";
const operationIdPattern = /^tutorial-import-[a-z0-9-]+$/;
const maxRedirects = 5;
const htmlSizeLimit = 4 * 1024 * 1024;
const mediaSizeLimit = 8 * 1024 * 1024;
const httpsRequestTimeoutMs = 15_000;
const importLockStaleMs = 5 * 60 * 1000;
const sha256Pattern = /^[a-f0-9]{64}$/;
const isoDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const committedBackupRetainSets = 2;
const committedBackupRelatives = ["manifest.json", "manifest.en.json", "import-generation.json"];
const semanticTags = new Set([
  "a",
  "article",
  "blockquote",
  "br",
  "cite",
  "code",
  "div",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "iframe",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "q",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "time",
  "tr",
  "ul",
]);
const voidTags = new Set(["br", "img"]);
const dangerousTagPattern = /<(?:script|style|object|embed|base|meta|link|form)\b/i;
const executableAttributePattern = /\s(?:on[a-z-]+|srcdoc|style)\s*=/i;
const safeGlobalAttributes = new Set([
  "aria-describedby",
  "aria-label",
  "class",
  "id",
  "lang",
  "title",
]);
const safeAttributesByTag = new Map([
  ["a", new Set(["href", "rel", "target"])],
  ["blockquote", new Set(["cite"])],
  ["code", new Set([])],
  ["iframe", new Set(["allow", "allowfullscreen", "frameborder", "height", "referrerpolicy", "src", "title", "width"])],
  ["img", new Set(["alt", "decoding", "height", "loading", "src", "width"])],
  ["td", new Set(["colspan", "rowspan"])],
  ["th", new Set(["colspan", "rowspan", "scope"])],
  ["time", new Set(["datetime"])],
]);
const imageContentTypes = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
]);
const extensionByContentType = new Map([
  ["image/avif", ".avif"],
  ["image/gif", ".gif"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/svg+xml", ".svg"],
  ["image/webp", ".webp"],
]);
const extensionContentType = new Map([
  [".avif", "image/avif"],
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

export class TutorialImportError extends Error {
  constructor(code, message, operationId = null) {
    super(message);
    this.name = "TutorialImportError";
    this.code = code;
    this.operationId = operationId;
  }
}

export function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new TutorialImportError("usage", `Unexpected argument: ${token}`);
    const key = token.slice(2);
    if (!key) throw new TutorialImportError("usage", "Empty option is invalid");
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function logFailure(error) {
  const code = error instanceof TutorialImportError ? error.code : "unavailable";
  const operation = error instanceof TutorialImportError && error.operationId
    ? ` operation=${error.operationId}`
    : "";
  console.error(`[tutorial-importer] ${code}${operation}: ${error.message}`);
}

export function tutorialImportResultMessage(result) {
  if (result.resultKind === "refresh-candidate") {
    return `[tutorial-importer] staged refresh candidate for ${result.slug} as ${result.status}; live route remains ${result.liveRouteStatus} pending review`;
  }
  return `[tutorial-importer] imported ${result.slug} as ${result.status}`;
}

function fail(code, message, operationId = null) {
  throw new TutorialImportError(code, message, operationId);
}

function requireOption(args, key) {
  const value = args[key];
  if (typeof value !== "string" || !value.trim()) fail("usage", `Missing required --${key}`);
  return value.trim();
}

function assertOperationId(value) {
  if (typeof value !== "string" || !operationIdPattern.test(value)) {
    fail("usage", `Invalid operation id: ${value}`);
  }
  return value;
}

function importGenerationMarker(operationId, slug, sourceKey, committedAt = null) {
  return {
    operationId,
    generation: operationId,
    slug,
    sourceKey,
    locales: ["zh-CN", "en"],
    ...(committedAt ? { committedAt } : {}),
  };
}

function importMarkerMatches(value, expected) {
  return value &&
    typeof value === "object" &&
    value.operationId === expected.operationId &&
    value.generation === expected.generation &&
    value.slug === expected.slug &&
    value.sourceKey === expected.sourceKey &&
    JSON.stringify(value.locales) === JSON.stringify(expected.locales);
}

export function validateCollectOptions(args) {
  if (args.fixture !== undefined) fail("usage", "--fixture is available through the programmatic fixture harness");
  return {
    url: requireOption(args, "url"),
    slug: requireOption(args, "slug"),
    sourcePath: requireOption(args, "source-path"),
    output: requireOption(args, "output"),
    fixture: null,
  };
}

export function validateImportOptions(args) {
  if (args["content-root"] !== undefined || args["public-root"] !== undefined) {
    fail("usage", "--content-root and --public-root are available through the programmatic fixture harness");
  }
  const translatedAt = optionalIsoDateTime(args["translated-at"], "--translated-at");
  return {
    input: requireOption(args, "input"),
    translation: requireOption(args, "translation"),
    translator: optionalNonEmptyString(args.translator, "--translator"),
    translatedAt,
    contentRoot: importerDefaults.contentRoot,
    publicRoot: importerDefaults.publicRoot,
  };
}

function optionalNonEmptyString(value, label) {
  if (value === undefined) return null;
  if (typeof value !== "string" || !value.trim()) fail("usage", `${label} must be a non-empty string`);
  return value.trim();
}

function optionalIsoDateTime(value, label) {
  if (value === undefined) return null;
  if (typeof value !== "string" || !isoDateTimePattern.test(value) || Number.isNaN(Date.parse(value))) {
    fail("usage", `${label} must be an ISO-8601 timestamp`);
  }
  return new Date(value).toISOString();
}

function assertPublicHttps(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    fail("unavailable", `Source URL is invalid: ${rawUrl}`);
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    fail("unavailable", `Source URL must be a public HTTPS URL: ${rawUrl}`);
  }
  if (!isPublicHostname(parsed.hostname)) {
    fail("unavailable", `Source host is not public: ${parsed.hostname}`);
  }
  return parsed;
}

function isPublicHostname(hostname) {
  const lower = hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  if (lower === "localhost" || lower.endsWith(".local")) return false;
  const ipVersion = net.isIP(lower);
  if (ipVersion === 4) return !isPrivateIpv4(lower);
  if (ipVersion === 6) return !isPrivateIpv6(lower);
  return /^[a-z0-9.-]+$/i.test(hostname) && hostname.includes(".");
}

function isPrivateIpv4(value) {
  const parts = value.split(".").map(Number);
  return parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 192 && parts[1] === 0 && parts[2] === 0) ||
    (parts[0] === 192 && parts[1] === 0 && parts[2] === 2) ||
    (parts[0] === 192 && parts[1] === 88 && parts[2] === 99) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) ||
    (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) ||
    (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) ||
    parts[0] === 0 ||
    parts[0] >= 224 ||
    value === "255.255.255.255";
}

function isPrivateIpv6(value) {
  const lower = value.toLowerCase();
  const mappedIpv4 = ipv4FromMappedIpv6(lower);
  if (mappedIpv4) return isPrivateIpv4(mappedIpv4);
  const firstHextet = Number.parseInt(lower.split(":", 1)[0] || "0", 16);
  return lower === "::1" ||
    lower === "::" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    (Number.isFinite(firstHextet) && firstHextet >= 0xfe80 && firstHextet <= 0xfebf) ||
    lower.startsWith("ff") ||
    lower.startsWith("2001:db8:");
}

function ipv4FromMappedIpv6(value) {
  const normalized = normalizeIpv6(value);
  if (!normalized) return null;
  const parts = normalized.split(":");
  if (parts.length !== 8 || parts.slice(0, 5).some((part) => part !== "0") || parts[5] !== "ffff") {
    return null;
  }
  const high = Number.parseInt(parts[6], 16);
  const low = Number.parseInt(parts[7], 16);
  if (!Number.isFinite(high) || !Number.isFinite(low) || high > 0xffff || low > 0xffff) return null;
  return [
    (high >> 8) & 0xff,
    high & 0xff,
    (low >> 8) & 0xff,
    low & 0xff,
  ].join(".");
}

function normalizeIpv6(value) {
  const lower = value.toLowerCase();
  const dotted = lower.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  let source = lower;
  if (dotted) {
    const parts = dotted[2].split(".").map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
      return null;
    }
    source = `${dotted[1]}${((parts[0] << 8) | parts[1]).toString(16)}:${((parts[2] << 8) | parts[3]).toString(16)}`;
  }
  if (!/^[0-9a-f:]+$/.test(source)) return null;
  if ((source.match(/::/g) ?? []).length > 1) return null;
  const sides = source.split("::");
  const left = sides[0] ? sides[0].split(":") : [];
  const right = sides[1] ? sides[1].split(":") : [];
  if ([...left, ...right].some((part) => !part || part.length > 4)) return null;
  const fill = sides.length === 2 ? 8 - left.length - right.length : 0;
  if (fill < 0 || (sides.length === 1 && left.length !== 8)) return null;
  const expanded = [...left, ...Array(fill).fill("0"), ...right];
  if (expanded.length !== 8) return null;
  return expanded.map((part) => Number.parseInt(part, 16).toString(16)).join(":");
}

async function publicDnsRecords(hostname) {
  const lookupHost = hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  const records = await dns.lookup(lookupHost, { all: true, verbatim: true });
  if (!records.length) fail("unavailable", `Source host has no DNS records: ${hostname}`);
  for (const { address } of records) {
    if (!isPublicHostname(address)) fail("unavailable", `Source DNS resolves to a private address: ${address}`);
  }
  return records;
}

function assertSamePolicyHost(initialUrl, nextUrl) {
  if (new URL(initialUrl).hostname.toLowerCase() !== new URL(nextUrl).hostname.toLowerCase()) {
    fail("canonical-mismatch", `Cross-host redirect is outside source policy: ${initialUrl} -> ${nextUrl}`);
  }
}

function responseHeader(headers, name) {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value ?? "";
}

async function pinnedHttpsRequest(rawUrl, label, code = "unavailable") {
  const parsed = assertPublicHttps(rawUrl);
  const records = await publicDnsRecords(parsed.hostname);
  const { address, family } = records[0];
  return new Promise((resolve, reject) => {
    const request = https.request({
      protocol: "https:",
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: `${parsed.pathname}${parsed.search}`,
      method: "GET",
      servername: parsed.hostname,
      lookup: (_hostname, _options, callback) => callback(null, address, family),
      headers: {
        host: parsed.host,
        "user-agent": "learnseo-tutorial-importer/1.0",
      },
    }, resolve);
    request.setTimeout(httpsRequestTimeoutMs, () => {
      request.destroy(new Error(`${label} request timed out`));
    });
    request.on("error", (error) => {
      reject(new TutorialImportError(code, `${label} request failed for ${rawUrl}: ${error.message}`));
    });
    request.end();
  });
}

async function nodeResponseBytes(response, limit, label, code = "unavailable") {
  const chunks = [];
  let size = 0;
  for await (const chunk of response) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.byteLength;
    if (size > limit) fail(code, `${label} exceeds importer size limit`);
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, size);
}

function decodeUtf8Strict(bytes, label, code) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(code, `${label} must be valid UTF-8`);
  }
}

function parseAttributes(source) {
  const attrs = new Map();
  const body = source
    .replace(/^<\/?[a-z][\w:-]*/i, "")
    .replace(/\/?>\s*$/, "");
  for (const match of body.matchAll(/(?:^|\s)([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    attrs.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attrs;
}

function escapeAttribute(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function decodeBasicEntities(value) {
  return value
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function visibleText(html) {
  return decodeBasicEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function canonicalFromHtml(html, fallbackUrl) {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = parseAttributes(match[0]);
    if (attrs.get("rel")?.toLowerCase().split(/\s+/).includes("canonical")) {
      return new URL(attrs.get("href") ?? "", fallbackUrl).toString();
    }
  }
  return null;
}

function titleFromHtml(html, articleHtml) {
  const heading = articleHtml.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (heading) return visibleText(heading[1]);
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return title ? visibleText(title[1]).replace(/\s+\|\s+.*$/, "") : "Untitled tutorial";
}

function metaContent(html, name) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = parseAttributes(match[0]);
    const attrName = attrs.get("name") ?? attrs.get("property");
    if (attrName?.toLowerCase() === name.toLowerCase()) return attrs.get("content") ?? "";
  }
  return "";
}

function sourceUpdatedAtFromHtml(html) {
  const timeTag = html.match(/<time\b[^>]*datetime\s*=\s*(["'])(.*?)\1[^>]*>/i);
  if (timeTag && Number.isFinite(Date.parse(timeTag[2]))) return new Date(timeTag[2]).toISOString();
  const updated = visibleText(html).match(/Last updated\s+(\d{4}-\d{2}-\d{2})\s+UTC/i);
  if (updated) return `${updated[1]}T00:00:00.000Z`;
  return undefined;
}

function licenseFromHtml(html, finalUrl) {
  if (/creativecommons\.org\/licenses\/by\/4\.0/i.test(html)) {
    return { text: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" };
  }
  if (new URL(finalUrl).hostname.endsWith("developers.google.com")) {
    return { text: "CC BY 4.0 and Apache 2.0 code samples", url: "https://developers.google.com/terms/site-policies" };
  }
  return "Source attribution required";
}

function providerFromUrl(finalUrl) {
  const hostname = new URL(finalUrl).hostname;
  if (hostname === "developers.google.com") return "Google Search Central / Google for Developers";
  return hostname;
}

function extractElementByClass(html, className) {
  const tagPattern = /<!--[\s\S]*?(?:-->|$)|<\/?([a-z][\w:-]*)\b[^>]*>/gi;
  let captureTag = null;
  let start = -1;
  let depth = 0;
  for (const match of html.matchAll(tagPattern)) {
    const token = match[0];
    if (token.startsWith("<!--")) continue;
    const tag = match[1]?.toLowerCase();
    if (!tag) continue;
    const closing = /^<\//.test(token);
    if (!captureTag && !closing) {
      const classes = (parseAttributes(token).get("class") ?? "").split(/\s+/);
      if (classes.includes(className)) {
        captureTag = tag;
        start = match.index ?? -1;
        depth = voidTags.has(tag) ? 0 : 1;
        if (depth === 0) return token;
      }
      continue;
    }
    if (!captureTag) continue;
    if (tag !== captureTag || voidTags.has(tag)) continue;
    depth += closing ? -1 : 1;
    if (depth === 0) return html.slice(start, (match.index ?? 0) + token.length);
  }
  return null;
}

function extractElementByTag(html, wantedTag) {
  const tagPattern = /<!--[\s\S]*?(?:-->|$)|<\/?([a-z][\w:-]*)\b[^>]*>/gi;
  let start = -1;
  let depth = 0;
  for (const match of html.matchAll(tagPattern)) {
    const token = match[0];
    if (token.startsWith("<!--")) continue;
    const tag = match[1]?.toLowerCase();
    if (tag !== wantedTag) continue;
    const closing = /^<\//.test(token);
    if (start < 0 && !closing) {
      start = match.index ?? -1;
      depth = 1;
      continue;
    }
    if (start < 0) continue;
    depth += closing ? -1 : 1;
    if (depth === 0) return html.slice(start, (match.index ?? 0) + token.length);
  }
  return null;
}

function normalizeBodyRoot(html) {
  return html.replace(/<([a-z][\w:-]*)\b([^>]*)class\s*=\s*(["'])[^"']*\bdevsite-article-body\b[^"']*\3([^>]*)>/i, "<article$2$4>");
}

function detectBotChallenge(html, finalUrl) {
  return /(?:captcha|recaptcha|cf-chl|bot challenge|enable javascript and cookies|unusual traffic)/i.test(html) ||
    new URL(finalUrl).pathname.includes("/sorry/");
}

function failOnUnsafeSourceHtml(html, label) {
  if (dangerousTagPattern.test(html)) fail("unsafe-markup", `${label} contains dangerous markup`);
  if (executableAttributePattern.test(html)) fail("unsafe-markup", `${label} contains executable or inline-style attributes`);
  if (/(?:javascript|vbscript|data:text\/html):/i.test(html)) fail("unsafe-markup", `${label} contains an unsafe URL protocol`);
}

function resolveHtmlUrls(html, baseUrl) {
  return html.replace(/<([a-z][\w:-]*)\b[^>]*>/gi, (tagSource, tagName) => {
    const tag = tagName.toLowerCase();
    const attrs = parseAttributes(tagSource);
    if (tag === "a" && attrs.has("href")) attrs.set("href", resolveLink(attrs.get("href"), baseUrl));
    if (tag === "img" && attrs.has("src")) attrs.set("src", resolveAbsoluteUrl(attrs.get("src"), baseUrl));
    if (tag === "iframe" && attrs.has("src")) attrs.set("src", resolveAbsoluteUrl(attrs.get("src"), baseUrl));
    attrs.delete("srcset");
    return rebuildOpeningTag(tag, attrs, tagSource.endsWith("/>"));
  });
}

function resolveLink(raw, baseUrl) {
  const value = raw.trim();
  if (value.startsWith("#")) return value;
  if (/^(?:mailto|tel):/i.test(value)) return value;
  return resolveAbsoluteUrl(value, baseUrl);
}

function resolveAbsoluteUrl(raw, baseUrl) {
  try {
    return new URL(raw.trim(), baseUrl).toString();
  } catch {
    fail("unsafe-markup", `Unable to resolve URL: ${raw}`);
  }
}

function rebuildOpeningTag(tag, attrs, selfClosing = false) {
  const attrText = [...attrs.entries()]
    .filter(([key]) => key)
    .map(([key, value]) => value === "" ? key : `${key}="${escapeAttribute(value)}"`)
    .join(" ");
  return `<${tag}${attrText ? ` ${attrText}` : ""}${selfClosing && !voidTags.has(tag) ? " /" : ""}>`;
}

function mediaEntriesFromHtml(articleHtml, baseUrl, fixtureFile) {
  const fixtureBase = fixtureFile ? path.dirname(fixtureFile) : null;
  return [...articleHtml.matchAll(/<img\b[^>]*>/gi)].map((match) => {
    const attrs = parseAttributes(match[0]);
    const sourceUrl = resolveAbsoluteUrl(attrs.get("src") ?? "", baseUrl);
    const fixtureRelative = attrs.get("data-fixture-file");
    return {
      sourceUrl,
      alt: attrs.get("alt") ?? "",
      ...(positiveAttr(attrs.get("width")) ? { width: positiveAttr(attrs.get("width")) } : {}),
      ...(positiveAttr(attrs.get("height")) ? { height: positiveAttr(attrs.get("height")) } : {}),
      ...(fixtureBase && fixtureRelative ? { fixtureFile: safeFixturePath(fixtureBase, fixtureRelative) } : {}),
    };
  });
}

function safeFixturePath(fixtureBase, relativePath) {
  const target = path.resolve(fixtureBase, relativePath);
  const relative = path.relative(fixtureBase, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    fail("unsupported-media", `Fixture media path escapes its fixture root: ${relativePath}`);
  }
  return target;
}

function positiveAttr(value) {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return parsed > 0 ? parsed : undefined;
}

async function fetchSourceHtml(initialUrl) {
  let current = initialUrl;
  const seen = new Set();
  const redirects = [];

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    if (seen.has(current)) fail("redirect-loop", `Redirect loop detected at ${current}`);
    seen.add(current);
    let response;
    try {
      response = await pinnedHttpsRequest(current, "Source HTML");
    } catch (error) {
      if (error instanceof TutorialImportError) throw error;
      fail("unavailable", `Fetch failed for ${current}: ${error.message}`);
    }
    const status = response.statusCode ?? 0;
    if ([301, 302, 303, 307, 308].includes(status)) {
      const location = responseHeader(response.headers, "location");
      if (!location) fail("unavailable", `Redirect missing Location header at ${current}`);
      const next = new URL(location, current).toString();
      assertPublicHttps(next);
      assertSamePolicyHost(initialUrl, next);
      response.resume();
      redirects.push({ from: current, to: next, status });
      current = next;
      continue;
    }
    if (status === 401 || status === 403 || status === 407) fail("authentication", `Source requires authentication: ${status}`);
    if (status < 200 || status >= 300) fail("unavailable", `Source returned HTTP ${status}`);
    const contentType = responseHeader(response.headers, "content-type").toLowerCase();
    if (!contentType.startsWith("text/html")) fail("non-html", `Source content type is ${contentType || "unknown"}`);
    const body = await nodeResponseBytes(response, htmlSizeLimit, "Source HTML");
    return {
      html: decodeUtf8Strict(body, "Source HTML", "non-html"),
      finalUrl: current,
      contentType,
      status,
      redirects,
    };
  }
  fail("redirect-loop", `Redirect limit exceeded after ${maxRedirects} hops`);
}

async function fixtureSourceHtml(fixture, requestedUrl, options = {}) {
  const html = decodeUtf8Strict(await fs.readFile(fixture), "Fixture HTML", "non-html");
  return {
    html,
    finalUrl: requestedUrl,
    contentType: options.fixtureContentType ?? "text/html; charset=utf-8",
    status: options.fixtureStatus ?? 200,
    redirects: [],
  };
}

export async function collectTutorialSnapshot(options) {
  model.assertTutorialSlug(options.slug);
  assertPublicHttps(options.url);
  const sourcePath = assertSourcePath(options.sourcePath);
  const source = options.fixture
    ? await fixtureSourceHtml(options.fixture, options.url, options)
    : await fetchSourceHtml(options.url);
  if ([401, 403, 407].includes(source.status)) fail("authentication", `Source requires authentication: ${source.status}`);
  if (source.status < 200 || source.status >= 300) fail("unavailable", `Source returned HTTP ${source.status}`);
  if (!source.contentType.toLowerCase().startsWith("text/html")) fail("non-html", `Source content type is ${source.contentType || "unknown"}`);
  if (detectBotChallenge(source.html, source.finalUrl)) fail("bot-challenge", "Source returned a bot challenge page");
  const canonicalUrl = canonicalFromHtml(source.html, source.finalUrl);
  if (!canonicalUrl) fail("canonical-mismatch", "Source canonical link is missing");
  if (normalizeSourceKey(canonicalUrl) !== normalizeSourceKey(options.url)) {
    fail("canonical-mismatch", `Canonical ${canonicalUrl} does not match requested URL ${options.url}`);
  }
  const extraction = [
    [".devsite-article-body", extractElementByClass(source.html, "devsite-article-body")],
    ["article", extractElementByTag(source.html, "article")],
    ["main", extractElementByTag(source.html, "main")],
  ].find(([, value]) => value);
  const rawArticle = extraction?.[1];
  if (!rawArticle) fail("extraction-failure", "Google adapter could not find .devsite-article-body");
  failOnUnsafeSourceHtml(rawArticle, "Extracted article");
  const article = resolveHtmlUrls(normalizeBodyRoot(rawArticle), canonicalUrl);
  const media = mediaEntriesFromHtml(article, canonicalUrl, options.fixture);
  for (const entry of media) {
    if (!entry.alt.trim()) fail("unsupported-media", `Image alt text is missing for ${entry.sourceUrl}`);
  }
  return {
    schemaVersion: 1,
    kind: snapshotKind,
    adapter: "google-devsite",
    slug: options.slug,
    sourcePath,
    requestedUrl: options.url,
    finalUrl: source.finalUrl,
    canonicalUrl,
    sourceKey: normalizeSourceKey(canonicalUrl),
    canonicalMatched: true,
    contentType: "text/html",
    title: titleFromHtml(source.html, article),
    description: metaContent(source.html, "description") || "Imported tutorial draft for review.",
    provider: providerFromUrl(source.finalUrl),
    author: null,
    sourceUpdatedAt: sourceUpdatedAtFromHtml(source.html),
    license: licenseFromHtml(source.html, source.finalUrl),
    capturedAt: new Date().toISOString(),
    sourceContentHash: sha256(article),
    html: article,
    media,
    provenance: {
      requestedUrl: options.url,
      finalUrl: source.finalUrl,
      canonicalUrl,
      contentType: source.contentType,
      extractionSelector: extraction[0],
      redirects: source.redirects,
    },
  };
}

function assertSourcePath(value) {
  if (!value.startsWith("/") || /[\u0000-\u001f\u007f\\?#]/.test(value) || value.includes("..") || value.includes("//")) {
    fail("usage", `Invalid --source-path: ${value}`);
  }
  return value.endsWith("/") ? value : `${value}/`;
}

export async function writeJsonFile(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJsonFile(filePath) {
  try {
    return JSON.parse(decodeUtf8Strict(await fs.readFile(filePath), `JSON ${filePath}`, "usage"));
  } catch (error) {
    if (error instanceof TutorialImportError) throw error;
    fail("usage", `Unable to read JSON ${filePath}: ${error.message}`);
  }
}

async function readManifest(contentRoot, locale) {
  const file = path.join(contentRoot, locale === "en" ? "manifest.en.json" : "manifest.json");
  try {
    const data = JSON.parse(await fs.readFile(file, "utf8"));
    return model.parseTutorialManifest(data, locale, file);
  } catch (error) {
    if (error.code !== "ENOENT") fail("manifest-invalid", error.message);
    return {
      schemaVersion: model.TUTORIAL_SCHEMA_VERSION,
      locale,
      generation: "tutorial-generation-0",
      activeVersion: null,
      available: true,
      routes: [],
      aliases: [],
    };
  }
}

function manifestJson(manifest, routes, generation) {
  return {
    $schema: model.TUTORIAL_MANIFEST_SCHEMA.$id,
    schemaVersion: model.TUTORIAL_SCHEMA_VERSION,
    locale: manifest.locale,
    generation,
    activeVersion: manifest.activeVersion,
    routes,
    aliases: manifest.aliases,
    ...(manifest.resourceLinkReport ? { resourceLinkReport: manifest.resourceLinkReport } : {}),
  };
}

async function readSnapshot(filePath) {
  const snapshot = await readJsonFile(filePath);
  if (snapshot?.kind !== snapshotKind || snapshot.schemaVersion !== 1) {
    fail("snapshot-invalid", "Input is not a tutorial collector snapshot");
  }
  if (typeof snapshot.html !== "string" || typeof snapshot.sourceContentHash !== "string") {
    fail("snapshot-invalid", "Snapshot is missing source HTML provenance fields");
  }
  if (sha256(snapshot.html) !== snapshot.sourceContentHash) {
    fail("snapshot-invalid", "Snapshot sourceContentHash does not match snapshot.html");
  }
  if (!Array.isArray(snapshot.media)) fail("snapshot-invalid", "Snapshot media must be an array");
  return snapshot;
}

async function readTranslation(filePath) {
  let source;
  try {
    source = decodeUtf8Strict(await fs.readFile(filePath), "Translation file", "translation-missing");
  } catch (error) {
    if (error instanceof TutorialImportError) throw error;
    if (error.code === "ENOENT") fail("translation-missing", `Translation file is missing: ${filePath}`);
    fail("translation-missing", `Unable to read translation file: ${error.message}`);
  }
  if (!source.trim()) fail("translation-missing", "Translation file is empty");
  return source;
}

function assertFixtureMediaAllowed(filePath) {
  const target = path.resolve(filePath);
  const relative = path.relative(fixtureMediaRoot, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    fail("unsupported-media", `Fixture media path is outside the controlled fixture root: ${filePath}`);
  }
}

function assertSafeSvg(bytes, label) {
  const source = decodeUtf8Strict(bytes, `${label} SVG`, "unsupported-media");
  if (
    /<(?:script|foreignObject|iframe|object|embed|audio|video|canvas|style|link|meta)\b/i.test(source) ||
    /\s(?:on[a-z-]+|href|xlink:href)\s*=/i.test(source) ||
    /(?:javascript|vbscript|data:text\/html):/i.test(source)
  ) {
    fail("unsupported-media", `${label} SVG contains active content`);
  }
}

async function fetchMediaBytes(sourceUrl) {
  let current = assertPublicHttps(sourceUrl).toString();
  const seen = new Set();

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    if (seen.has(current)) fail("redirect-loop", `Media redirect loop detected at ${current}`);
    seen.add(current);
    let response;
    try {
      response = await pinnedHttpsRequest(current, `Media ${current}`, "media-download");
    } catch (error) {
      if (error instanceof TutorialImportError) throw error;
      fail("media-download", `Unable to download media ${current}: ${error.message}`);
    }
    const status = response.statusCode ?? 0;
    if ([301, 302, 303, 307, 308].includes(status)) {
      const location = responseHeader(response.headers, "location");
      if (!location) fail("media-download", `Media redirect missing Location header at ${current}`);
      const next = new URL(location, current).toString();
      assertPublicHttps(next);
      response.resume();
      current = next;
      continue;
    }
    if (status < 200 || status >= 300) fail("media-download", `Media returned HTTP ${status}: ${current}`);
    const contentType = responseHeader(response.headers, "content-type").split(";", 1)[0].toLowerCase();
    if (!imageContentTypes.has(contentType)) fail("unsupported-media", `Unsupported media type ${contentType || "unknown"}: ${current}`);
    const bytes = await nodeResponseBytes(response, mediaSizeLimit, `Media ${current}`, "unsupported-media");
    if (contentType === "image/svg+xml") assertSafeSvg(bytes, `Media ${current}`);
    return { bytes, contentType };
  }
  fail("redirect-loop", `Media redirect limit exceeded after ${maxRedirects} hops`);
}

async function mediaBytes(entry, options = {}) {
  if (entry.fixtureFile) {
    if (!options.allowFixtureMedia) {
      fail("unsupported-media", `Snapshot fixture media is not allowed during import: ${entry.sourceUrl}`);
    }
    assertFixtureMediaAllowed(entry.fixtureFile);
    const bytes = await fs.readFile(entry.fixtureFile);
    const contentType = contentTypeFromPath(entry.fixtureFile);
    if (bytes.byteLength > mediaSizeLimit) fail("unsupported-media", `Media exceeds importer size limit: ${entry.sourceUrl}`);
    if (contentType === "image/svg+xml") assertSafeSvg(bytes, `Fixture media ${entry.fixtureFile}`);
    return { bytes, contentType };
  }
  return fetchMediaBytes(entry.sourceUrl);
}

function contentTypeFromPath(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = extensionContentType.get(extension);
  if (!contentType) fail("unsupported-media", `Unsupported fixture media extension: ${extension || filePath}`);
  return contentType;
}

async function localizeMedia(snapshot, publicRoot, options = {}) {
  const entries = [];
  const map = new Map();
  for (const media of snapshot.media ?? []) {
    const { bytes, contentType } = await mediaBytes(media, options);
    if (!imageContentTypes.has(contentType)) fail("unsupported-media", `Unsupported media type ${contentType}: ${media.sourceUrl}`);
    const hash = sha256(bytes);
    const extension = extensionByContentType.get(contentType) ?? (path.extname(new URL(media.sourceUrl).pathname) || ".bin");
    const localPath = `${importerDefaults.mediaPathPrefix}${snapshot.slug}/${hash}${extension}`;
    const target = path.join(publicRoot, localPath.slice(1));
    entries.push({
      target,
      bytes,
      manifest: {
        path: localPath,
        sha256: hash,
        alt: media.alt,
        sourceUrl: media.sourceUrl,
        ...(media.width ? { width: media.width } : {}),
        ...(media.height ? { height: media.height } : {}),
        id: hash.slice(0, 12),
      },
    });
    map.set(normalizeMediaKey(media.sourceUrl, snapshot.canonicalUrl), localPath);
  }
  return { entries, map };
}

function normalizeMediaKey(raw, baseUrl) {
  return new URL(raw, baseUrl).toString();
}

function safeUrl(raw, baseUrl, kind, mediaMap) {
  const value = raw.trim();
  if (!value || /[\u0000-\u001f\u007f]/.test(value)) fail("unsafe-markup", `${kind} URL contains control characters`);
  if (/^(?:javascript|vbscript|data):/i.test(value)) fail("unsafe-markup", `${kind} URL uses an unsafe protocol`);
  if (kind === "href") {
    if (value.startsWith("#")) return value;
    if (/^(?:mailto|tel):/i.test(value)) return value;
    const parsed = new URL(value, baseUrl);
    if (["http:", "https:"].includes(parsed.protocol)) return parsed.toString();
    if (parsed.pathname.startsWith("/")) return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }
  if (kind === "img") {
    if (value.startsWith(importerDefaults.mediaPathPrefix)) return value;
    const local = mediaMap.get(normalizeMediaKey(value, baseUrl));
    if (!local) fail("unsupported-media", `Image is not in the collected media list: ${value}`);
    return local;
  }
  if (kind === "iframe") {
    const parsed = new URL(value, baseUrl);
    if (parsed.protocol === "https:" && model.TUTORIAL_ALLOWED_EMBED_HOSTS.includes(parsed.hostname.toLowerCase())) {
      return parsed.toString();
    }
    fail("unsupported-media", `Iframe host is outside the allowlist: ${value}`);
  }
  fail("unsafe-markup", `${kind} URL is outside policy: ${value}`);
}

function sanitizeAttributes(tag, attrs, baseUrl, mediaMap) {
  const safe = new Map();
  const tagSafe = safeAttributesByTag.get(tag) ?? new Set();
  for (const [key, value] of attrs.entries()) {
    if (key.startsWith("on") || key === "srcdoc" || key === "style") {
      fail("unsafe-markup", `Unsafe attribute ${key} on <${tag}>`);
    }
    if (!safeGlobalAttributes.has(key) && !tagSafe.has(key)) continue;
    safe.set(key, value);
  }
  if (tag === "a" && safe.has("href")) {
    safe.set("href", safeUrl(safe.get("href"), baseUrl, "href", mediaMap));
    if (safe.get("target") === "_blank") safe.set("rel", "noopener noreferrer");
  }
  if (tag === "img") {
    const source = safe.get("src");
    if (!source) fail("unsupported-media", "Image src is missing");
    safe.set("src", safeUrl(source, baseUrl, "img", mediaMap));
    if (!safe.get("alt")?.trim()) fail("unsupported-media", `Image alt text is missing for ${source}`);
  }
  if (tag === "iframe") {
    const source = safe.get("src");
    if (!source) fail("unsupported-media", "Iframe src is missing");
    safe.set("src", safeUrl(source, baseUrl, "iframe", mediaMap));
    if (!safe.get("title")?.trim()) safe.set("title", "Embedded content");
    safe.set("referrerpolicy", "strict-origin-when-cross-origin");
  }
  for (const numeric of ["width", "height", "colspan", "rowspan"]) {
    if (safe.has(numeric) && !/^[1-9]\d*$/.test(safe.get(numeric))) safe.delete(numeric);
  }
  return safe;
}

export function sanitizeTutorialHtml(html, snapshot, mediaMap, label) {
  if (!html.trim()) fail("translation-missing", `${label} HTML is empty`);
  failOnUnsafeSourceHtml(html, label);
  let result = "";
  let cursor = 0;
  const tagPattern = /<!--[\s\S]*?(?:-->|$)|<\/?([a-z][\w:-]*)\b[^>]*>/gi;
  for (const match of html.matchAll(tagPattern)) {
    const index = match.index ?? 0;
    result += html.slice(cursor, index);
    cursor = index + match[0].length;
    if (match[0].startsWith("<!--")) continue;
    const tag = match[1].toLowerCase();
    const closing = /^<\//.test(match[0]);
    if (!semanticTags.has(tag)) {
      if (!closing && /\/>\s*$/.test(match[0])) continue;
      continue;
    }
    if (closing) {
      if (!voidTags.has(tag)) result += `</${tag}>`;
      continue;
    }
    const attrs = sanitizeAttributes(tag, parseAttributes(match[0]), snapshot.canonicalUrl, mediaMap);
    result += rebuildOpeningTag(tag, attrs, /\/>\s*$/.test(match[0]));
  }
  result += html.slice(cursor);
  return result.trim();
}

function semanticOrder(html) {
  return [...html.matchAll(/<([a-z][\w:-]*)\b[^>]*>/gi)]
    .map((match) => match[1].toLowerCase())
    .filter((tag) => model.TUTORIAL_SEMANTIC_TAGS.includes(tag));
}

function attributeValues(html, tag, attribute) {
  return [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, "gi"))].map((match) =>
    parseAttributes(match[0]).get(attribute) ?? null,
  );
}

function numericFacts(html) {
  return [...visibleText(html).matchAll(/\d[\d,]*(?:\.\d+)?%?/g)].map((match) => match[0]);
}

function assertTranslationHandoff(englishHtml, chineseHtml, enValidation, zhValidation) {
  if (!/[\u3400-\u9fff]/.test(visibleText(chineseHtml))) {
    fail("translation-missing", "Chinese translation does not contain Simplified Chinese text");
  }
  if (sha256(englishHtml) === sha256(chineseHtml)) {
    fail("translation-missing", "Chinese translation matches the English source");
  }
  if (JSON.stringify(semanticOrder(englishHtml)) !== JSON.stringify(semanticOrder(chineseHtml))) {
    fail("extraction-failure", "Chinese translation semantic tag order does not match English");
  }
  if (JSON.stringify(enValidation.headingEntries) !== JSON.stringify(zhValidation.headingEntries)) {
    fail("extraction-failure", "Chinese translation heading ids/order do not match English");
  }
  if (JSON.stringify(numericFacts(englishHtml)) !== JSON.stringify(numericFacts(chineseHtml))) {
    fail("extraction-failure", "Chinese translation numeric facts do not match English");
  }
  for (const [tag, attr] of [["a", "href"], ["img", "src"], ["iframe", "src"]]) {
    if (JSON.stringify(attributeValues(englishHtml, tag, attr)) !== JSON.stringify(attributeValues(chineseHtml, tag, attr))) {
      fail("extraction-failure", `Chinese translation ${tag}.${attr} order does not match English`);
    }
  }
}

function refreshHistoryEntry(snapshot, hashes, operationId, version) {
  return {
    version,
    canonicalUrl: snapshot.canonicalUrl,
    sourceContentHash: snapshot.sourceContentHash,
    contentHash: hashes.english,
    translationContentHash: hashes.chinese,
    contentFile: `${hashes.english}.html`,
    translationContentFile: `${hashes.chinese}.html`,
    pageCanonicalUrl: snapshot.canonicalUrl,
    canonicalMatched: true,
    requestedUrl: snapshot.requestedUrl,
    finalUrl: snapshot.finalUrl,
    capturedAt: snapshot.capturedAt,
    ...(snapshot.sourceUpdatedAt ? { sourceUpdatedAt: snapshot.sourceUpdatedAt } : {}),
    recordedAt: new Date().toISOString(),
    operationId,
  };
}

function refreshCandidateFromSnapshot(snapshot, locale, hashes, validation, media, operationId, version) {
  const localizedTitle = firstTagText(validation.zhHtml, "h1");
  const localizedDescription = firstTagText(validation.zhHtml, "p");
  const title = locale === "en" ? snapshot.title : localizedTitle;
  const description = locale === "en" ? snapshot.description : localizedDescription;
  return {
    status: "draft",
    version,
    operationId,
    createdAt: new Date().toISOString(),
    title,
    description,
    sourceContentHash: snapshot.sourceContentHash,
    contentHash: hashes.english,
    translationContentHash: hashes.chinese,
    contentFile: locale === "en" ? `${hashes.english}.html` : `${hashes.chinese}.html`,
    translationContentFile: `${hashes.chinese}.html`,
    toc: validation.en.headingEntries.map(({ id, level }) => ({
      id,
      level,
      title: headingTitleById(locale === "en" ? validation.enHtml : validation.zhHtml, id),
    })),
    media,
    contentMetrics: validation.en.metrics,
    seo: {
      title,
      description,
      indexable: false,
      ...(snapshot.sourceUpdatedAt ? { dateModified: snapshot.sourceUpdatedAt } : {}),
    },
  };
}

function routeWithPublishedRefreshCandidate(existing, snapshot, locale, hashes, validation, media, operationId) {
  const candidateVersion = Math.max(
    existing.snapshot.version,
    existing.refreshCandidate?.version ?? existing.snapshot.version,
  ) + 1;
  return {
    ...existing,
    refreshCandidate: refreshCandidateFromSnapshot(snapshot, locale, hashes, validation, media, operationId, candidateVersion),
    snapshot: {
      ...existing.snapshot,
      history: [
        ...existing.snapshot.history,
        refreshHistoryEntry(snapshot, hashes, operationId, candidateVersion),
      ],
    },
    review: {
      ...existing.review,
      history: [
        ...existing.review.history,
        {
          decision: "pending",
          reviewer: null,
          reviewedAt: null,
          notes: "Refresh candidate imported; review required before publication.",
          version: candidateVersion,
          operationId,
        },
      ],
    },
  };
}

function routeFromSnapshot(snapshot, locale, hashes, validation, media, manifests, operationId, translationMeta) {
  const existing = manifests[locale].routes.find((route) => route.slug === snapshot.slug);
  if (existing?.status === "published") {
    return routeWithPublishedRefreshCandidate(existing, snapshot, locale, hashes, validation, media, operationId);
  }
  const version = existing ? existing.snapshot.version + 1 : 1;
  const activeVersion = existing?.activeVersion ?? version;
  const history = existing ? [
    ...existing.snapshot.history,
    {
      version: existing.snapshot.version,
      canonicalUrl: existing.source.canonicalUrl,
      sourceContentHash: existing.snapshot.sourceContentHash,
      contentHash: existing.snapshot.contentHash,
      translationContentHash: existing.snapshot.translationContentHash,
      contentFile: existing.snapshot.contentHash ? `${existing.snapshot.contentHash}.html` : undefined,
      translationContentFile: existing.snapshot.translationContentHash ? `${existing.snapshot.translationContentHash}.html` : undefined,
      pageCanonicalUrl: existing.snapshot.pageCanonicalUrl,
      canonicalMatched: existing.snapshot.canonicalMatched,
      requestedUrl: existing.snapshot.requestedUrl,
      finalUrl: existing.snapshot.finalUrl,
      capturedAt: existing.snapshot.capturedAt,
      sourceUpdatedAt: existing.snapshot.sourceUpdatedAt,
      recordedAt: new Date().toISOString(),
      operationId,
    },
  ] : [];
  const localizedTitle = firstTagText(validation.zhHtml, "h1");
  const localizedDescription = firstTagText(validation.zhHtml, "p");
  const title = locale === "en" ? snapshot.title : localizedTitle;
  const description = locale === "en" ? snapshot.description : localizedDescription;
  const contentFile = locale === "en" ? `${hashes.english}.html` : `${hashes.chinese}.html`;
  return {
    slug: snapshot.slug,
    path: locale === "en" ? `/en/tutorials/${snapshot.slug}/` : `/tutorials/${snapshot.slug}/`,
    title,
    description,
    provider: snapshot.provider,
    status: "draft",
    sourceKey: snapshot.sourceKey,
    source: {
      title: snapshot.title,
      provider: snapshot.provider,
      author: snapshot.author ?? null,
      canonicalUrl: snapshot.canonicalUrl,
      sourcePath: snapshot.sourcePath,
      requestedUrl: snapshot.requestedUrl,
      finalUrl: snapshot.finalUrl,
      contentType: "text/html",
      license: snapshot.license,
    },
    snapshot: {
      version,
      capturedAt: snapshot.capturedAt,
      ...(snapshot.sourceUpdatedAt ? { sourceUpdatedAt: snapshot.sourceUpdatedAt } : {}),
      pageCanonicalUrl: snapshot.canonicalUrl,
      canonicalMatched: true,
      requestedUrl: snapshot.requestedUrl,
      finalUrl: snapshot.finalUrl,
      sourceContentHash: snapshot.sourceContentHash,
      contentHash: hashes.english,
      translationContentHash: hashes.chinese,
      history,
    },
    activeVersion,
    translation: {
      sourceLanguage: "en",
      language: "zh-CN",
      translator: translationMeta.translator,
      translatedAt: translationMeta.translatedAt,
      reviewedAt: null,
      sourceSections: validation.en.headingEntries.length,
      translatedSections: validation.zh.headingEntries.length,
      contentHash: hashes.chinese,
      contentFile: `${hashes.chinese}.html`,
    },
    review: {
      decision: "pending",
      reviewer: null,
      reviewedAt: null,
      notes: "Draft import created by tutorials:import; review and publication remain manual.",
      checklist: Object.fromEntries(model.TUTORIAL_REVIEW_CHECKLIST_KEYS.map((key) => [key, false])),
      history: [{
        decision: "pending",
        reviewer: null,
        reviewedAt: null,
        notes: "Draft import awaiting editorial review.",
        version,
        operationId,
      }],
    },
    qualification: {
      decision: "pending",
      reviewer: null,
      reviewedAt: null,
      checklist: Object.fromEntries(model.TUTORIAL_QUALIFICATION_CHECKLIST_KEYS.map((key) => [key, false])),
    },
    contentFile,
    toc: validation.en.headingEntries.map(({ id, level }) => ({
      id,
      level,
      title: headingTitleById(locale === "en" ? validation.enHtml : validation.zhHtml, id),
    })),
    media,
    contentMetrics: validation.en.metrics,
    seo: {
      title,
      description,
      indexable: false,
      ...(snapshot.sourceUpdatedAt ? { dateModified: snapshot.sourceUpdatedAt } : {}),
    },
  };
}

function firstTagText(html, tag) {
  const match = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  const text = visibleText(match?.[1] ?? "");
  if (!text) fail("translation-missing", `Chinese translation is missing <${tag}> text`);
  return text;
}

function headingTitleById(html, id) {
  const pattern = new RegExp(`<h[1-6]\\b[^>]*\\bid\\s*=\\s*(["'])${escapeRegExp(id)}\\1[^>]*>([\\s\\S]*?)<\\/h[1-6]>`, "i");
  return visibleText(html.match(pattern)?.[2] ?? id);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertOwnership(snapshot, manifests) {
  for (const manifest of Object.values(manifests)) {
    for (const route of manifest.routes) {
      if (route.slug === snapshot.slug && route.sourceKey !== snapshot.sourceKey) {
        fail("duplicate-slug", `Slug ${snapshot.slug} is already owned by ${route.sourceKey}`);
      }
      if (route.sourceKey === snapshot.sourceKey && route.slug !== snapshot.slug) {
        fail("duplicate-source", `Source ${snapshot.sourceKey} is already owned by ${route.slug}`);
      }
    }
  }
}

function replaceRoute(routes, record) {
  return [...routes.filter((route) => route.slug !== record.slug), record]
    .sort((left, right) => left.slug.localeCompare(right.slug));
}

async function stageFile(stagingRoot, relative, value, encoding) {
  const target = path.join(stagingRoot, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, value, encoding);
  return { relative, target, sha256: sha256(value) };
}

async function stageText(stagingRoot, relative, value) {
  return stageFile(stagingRoot, relative, value, "utf8");
}

async function stageBytes(stagingRoot, relative, value) {
  return stageFile(stagingRoot, relative, value);
}

async function renameStagedFile(file, roots) {
  assertSafeStagedRelative(file.relative);
  const root = file.relative.startsWith("public/") ? roots.publicRoot : roots.contentRoot;
  const relative = file.relative.startsWith("public/")
    ? file.relative.slice("public/".length)
    : file.relative;
  const target = path.join(root, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.rename(file.target, target);
  return target;
}

function assertSafeStagedRelative(relative) {
  if (typeof relative !== "string" || path.isAbsolute(relative) || relative.includes("\\") || relative.includes("\0")) {
    throw new Error(`Unsafe staged file path: ${relative}`);
  }
  const parts = relative.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error(`Unsafe staged file path: ${relative}`);
  }
  if (["manifest.json", "manifest.en.json", "import-generation.json", "journal.json"].includes(relative)) return;
  if (/^content\/[a-f0-9]{64}\.html$/.test(relative)) return;
  const mediaPrefix = `public${importerDefaults.mediaPathPrefix}`;
  if (relative.startsWith(mediaPrefix) && !relative.slice(mediaPrefix.length).includes("..")) return;
  throw new Error(`Unsafe staged file path: ${relative}`);
}

async function replaceManifestsAtomic(manifestFiles, roots, operationId, updatePhase, hooks = {}) {
  const backups = [];
  const replaced = [];
  try {
    for (const file of manifestFiles) {
      const target = path.join(roots.contentRoot, file.relative);
      const backup = `${target}.backup-${operationId}`;
      if (hooks.failBeforeManifestRelative === file.relative) {
        throw new Error(`Injected commit failure before manifest replace for ${file.relative}`);
      }
      await updatePhase("manifest-backup", file.relative);
      try {
        await fs.rename(target, backup);
        backups.push({ target, backup, relative: file.relative });
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      if (hooks.failAfterBackupRelative === file.relative) {
        throw new Error(`Injected commit failure after backup for ${file.relative}`);
      }
      await updatePhase("manifest-replace", file.relative);
      await fs.rename(file.target, target);
      replaced.push(target);
    }
  } catch (error) {
    for (const target of replaced.reverse()) await fs.rm(target, { force: true });
    for (const { target, backup } of backups.reverse()) {
      try {
        await fs.rename(backup, target);
      } catch (restoreError) {
        if (restoreError.code !== "ENOENT") throw restoreError;
      }
    }
    throw error;
  }
  for (const { backup, relative } of backups) {
    if (hooks.failCleanupBackupRelative === relative) {
      console.warn(`[tutorial-importer] backup cleanup warning operation=${operationId}: injected cleanup failure for ${hooks.failCleanupBackupRelative}`);
      continue;
    }
    try {
      await fs.access(backup);
    } catch (error) {
      console.warn(`[tutorial-importer] backup cleanup warning operation=${operationId}: ${error.message}`);
    }
  }
}

async function readCommittedBackupSets(contentRoot) {
  const entries = await fs.readdir(contentRoot).catch(() => []);
  const backupsByOperation = new Map();
  for (const entry of entries) {
    for (const relative of committedBackupRelatives) {
      const prefix = `${relative}.backup-`;
      if (!entry.startsWith(prefix)) continue;
      const operationId = entry.slice(prefix.length);
      if (!operationIdPattern.test(operationId)) continue;
      const group = backupsByOperation.get(operationId) ?? {
        operationId,
        paths: new Map(),
        committedAt: 0,
      };
      group.paths.set(relative, path.join(contentRoot, entry));
      backupsByOperation.set(operationId, group);
    }
  }

  const committedSets = [];
  for (const group of backupsByOperation.values()) {
    const journal = await readJsonFileOrNull(path.join(contentRoot, ".import-journal", `${group.operationId}.json`));
    if (journal?.phase !== "committed") continue;
    const committedAt = typeof journal.committedAt === "string" ? Date.parse(journal.committedAt) : NaN;
    group.committedAt = Number.isFinite(committedAt) ? committedAt : 0;
    committedSets.push(group);
  }
  return committedSets.sort((left, right) =>
    right.committedAt - left.committedAt || right.operationId.localeCompare(left.operationId));
}

async function pruneCommittedBackups(contentRoot) {
  const committedSets = await readCommittedBackupSets(contentRoot);
  for (const group of committedSets.slice(committedBackupRetainSets)) {
    for (const backupPath of group.paths.values()) {
      await fs.rm(backupPath, { force: true });
    }
  }
}

async function commitDraftFiles(staged, roots, operationId, updatePhase = async () => {}, hooks = {}) {
  const manifestFiles = staged.filter((file) => ["manifest.json", "manifest.en.json", "import-generation.json"].includes(file.relative));
  const contentAndMedia = staged.filter((file) => !["manifest.json", "manifest.en.json", "import-generation.json", "journal.json"].includes(file.relative));
  for (const file of contentAndMedia) {
    await updatePhase("content-replace", file.relative);
    if (hooks.failBeforeFirstContent || hooks.failBeforeContentRelative === file.relative) {
      throw new Error(`Injected commit failure before content replace for ${file.relative}`);
    }
    await renameStagedFile(file, roots);
  }
  await replaceManifestsAtomic(manifestFiles, roots, operationId, updatePhase, hooks);
}

async function readJsonFileOrNull(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

async function acquireReclaimGuard(lockPath) {
  const guardPath = `${lockPath}.reclaiming`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await fs.mkdir(guardPath);
      return guardPath;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const stat = await fs.stat(guardPath).catch(() => null);
      if (attempt === 0 && stat && Date.now() - stat.mtimeMs >= importLockStaleMs) {
        await fs.rm(guardPath, { recursive: true, force: true });
        continue;
      }
      return null;
    }
  }
  return null;
}

async function tryReclaimImportLock(lockPath) {
  const guardPath = await acquireReclaimGuard(lockPath);
  if (!guardPath) return false;
  try {
    return await tryReclaimImportLockWithGuard(lockPath);
  } finally {
    await fs.rm(guardPath, { recursive: true, force: true });
  }
}

async function tryReclaimImportLockWithGuard(lockPath) {
  const lock = await readJsonFileOrNull(lockPath);
  if (
    !lock ||
    !Number.isInteger(lock.pid) ||
    typeof lock.token !== "string" ||
    typeof lock.createdAt !== "string"
  ) {
    const stat = await fs.stat(lockPath).catch(() => null);
    if (!stat || Date.now() - stat.mtimeMs < importLockStaleMs) return false;
    const reclaimPath = `${lockPath}.reclaim-${process.pid}-${crypto.randomUUID()}`;
    try {
      await fs.rename(lockPath, reclaimPath);
    } catch {
      return false;
    }
    await fs.rm(reclaimPath, { force: true });
    return true;
  }
  if (isProcessAlive(lock.pid)) return false;
  const reclaimPath = `${lockPath}.reclaim-${process.pid}-${crypto.randomUUID()}`;
  try {
    await fs.rename(lockPath, reclaimPath);
  } catch {
    return false;
  }
  const current = await readJsonFileOrNull(reclaimPath);
  if (!current || current.pid !== lock.pid || current.token !== lock.token) {
    await fs.rename(reclaimPath, lockPath).catch(() => fs.rm(reclaimPath, { force: true }));
    return false;
  }
  await fs.rm(reclaimPath, { force: true });
  return true;
}

async function acquireImportLock(contentRoot) {
  const lockPath = path.join(contentRoot, ".tutorial-import.lock");
  await fs.mkdir(contentRoot, { recursive: true });
  const token = crypto.randomUUID();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let handle;
    try {
      handle = await fs.open(lockPath, "wx");
      await handle.writeFile(`${JSON.stringify({
        pid: process.pid,
        token,
        createdAt: new Date().toISOString(),
      }, null, 2)}\n`, "utf8");
      return { lockPath, token };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (attempt === 0 && await tryReclaimImportLock(lockPath)) continue;
      fail("unavailable", `Tutorial import lock is already held: ${lockPath}`);
    } finally {
      await handle?.close();
    }
  }
  fail("unavailable", `Tutorial import lock is already held: ${lockPath}`);
}

async function releaseImportLock(lock) {
  const current = await readJsonFileOrNull(lock.lockPath);
  if (current?.pid === process.pid && current?.token === lock.token) {
    await fs.rm(lock.lockPath, { force: true });
  }
}

async function withImportLock(contentRoot, callback) {
  const lock = await acquireImportLock(contentRoot);
  try {
    return await callback();
  } finally {
    await releaseImportLock(lock);
  }
}

async function writeJsonFileAtomic(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  const handle = await fs.open(temporary, "wx");
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(temporary, filePath);
}

async function updateJournal(contentRoot, operationId, value) {
  const target = path.join(contentRoot, ".import-journal", `${operationId}.json`);
  await writeJsonFileAtomic(target, value);
}

async function readJournal(contentRoot, operationId) {
  try {
    return await readJsonFile(path.join(contentRoot, ".import-journal", `${operationId}.json`));
  } catch (error) {
    const message = error instanceof TutorialImportError ? error.message : error.message;
    fail("recovery-conflict", `Journal is missing or corrupt for ${operationId}: ${message}`, operationId);
  }
}

function safeStagedTarget(stagingRoot, relative, operationId = null) {
  try {
    assertSafeStagedRelative(relative);
  } catch (error) {
    fail("recovery-conflict", error.message, operationId);
  }
  const target = path.resolve(stagingRoot, relative);
  const relativeFromRoot = path.relative(stagingRoot, target);
  if (!relativeFromRoot || relativeFromRoot.startsWith("..") || path.isAbsolute(relativeFromRoot)) {
    fail("recovery-conflict", `Staged file escapes operation root: ${relative}`, operationId);
  }
  return target;
}

function liveTargetForRelative(roots, relative) {
  if (relative.startsWith("public/")) return path.join(roots.publicRoot, relative.slice("public/".length));
  return path.join(roots.contentRoot, relative);
}

function parseRecoveryJson(bytes, label, operationId) {
  try {
    return JSON.parse(decodeUtf8Strict(bytes, label, "recovery-conflict"));
  } catch (error) {
    if (error instanceof TutorialImportError) {
      fail("recovery-conflict", error.message, operationId);
    }
    fail("recovery-conflict", `${label} is invalid JSON: ${error.message}`, operationId);
  }
}

function assertRecoveryJournal(journal, operationId) {
  const expectedMarker = importGenerationMarker(operationId, journal.slug, journal.sourceKey);
  if (
    journal.operationId !== operationId ||
    journal.generation !== operationId ||
    !Number.isInteger(journal.candidateVersion) ||
    journal.candidateVersion < 1 ||
    typeof journal.slug !== "string" ||
    typeof journal.sourceKey !== "string" ||
    !journal.hashes ||
    typeof journal.hashes !== "object" ||
    !sha256Pattern.test(journal.hashes.sourceContentHash ?? "") ||
    !sha256Pattern.test(journal.hashes.contentHash ?? "") ||
    !sha256Pattern.test(journal.hashes.translationContentHash ?? "") ||
    !journal.marker ||
    typeof journal.marker !== "object" ||
    !importMarkerMatches(journal.marker, expectedMarker) ||
    !journal.validation ||
    typeof journal.validation !== "object" ||
    !journal.validation.en ||
    typeof journal.validation.en !== "object" ||
    !journal.validation.zh ||
    typeof journal.validation.zh !== "object"
  ) {
    fail("recovery-conflict", `Journal operation or candidate identity is incomplete for ${operationId}`, operationId);
  }
}

function journalFileEntries(journal, operationId) {
  if (!Array.isArray(journal.files)) fail("recovery-conflict", "Journal files are missing", operationId);
  const entries = [];
  const seen = new Set();
  for (const entry of journal.files) {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof entry.relative !== "string" ||
      !sha256Pattern.test(entry.sha256 ?? "")
    ) {
      fail("recovery-conflict", "Journal files must contain object entries with relative and sha256", operationId);
    }
    if (entry.relative === "journal.json") continue;
    if (seen.has(entry.relative)) fail("recovery-conflict", `Journal contains duplicate file entry: ${entry.relative}`, operationId);
    seen.add(entry.relative);
    entries.push({ relative: entry.relative, sha256: entry.sha256 });
  }
  return entries;
}

async function recoveryFilesFromLiveJournal(roots, operationId, journal) {
  const files = new Map();
  for (const { relative, sha256: expectedHash } of journalFileEntries(journal, operationId)) {
    let bytes;
    try {
      bytes = await fs.readFile(liveTargetForRelative(roots, relative));
    } catch (error) {
      fail("recovery-conflict", `Live file is missing: ${relative}; ${error.message}`, operationId);
    }
    if (sha256(bytes) !== expectedHash) {
      fail("recovery-conflict", `Live file hash mismatch: ${relative}`, operationId);
    }
    files.set(relative, { bytes, sha256: expectedHash, target: liveTargetForRelative(roots, relative), live: true });
  }
  return files;
}

async function recoveryFilesFromJournal(roots, operationId, journal) {
  const entries = journalFileEntries(journal, operationId);
  const stagingRoot = path.join(roots.contentRoot, ".import-staging", operationId);
  const staged = [];
  const files = new Map();
  for (const { relative, sha256: expectedHash } of entries) {
    const target = safeStagedTarget(stagingRoot, relative, operationId);
    let bytes;
    try {
      bytes = await fs.readFile(target);
    } catch (error) {
      const liveBytes = await fs.readFile(liveTargetForRelative(roots, relative)).catch(() => null);
      if (liveBytes && sha256(liveBytes) === expectedHash) {
        files.set(relative, { bytes: liveBytes, sha256: expectedHash, target: liveTargetForRelative(roots, relative), live: true });
        continue;
      }
      fail("recovery-conflict", `Staged file is missing: ${relative}; ${error.message}`, operationId);
    }
    if (sha256(bytes) !== expectedHash) {
      fail("recovery-conflict", `Staged file hash mismatch: ${relative}`, operationId);
    }
    files.set(relative, { bytes, sha256: expectedHash, target, live: false });
    staged.push({ relative, target, sha256: sha256(bytes) });
  }
  return { staged, files };
}

function contentReferencesFromRecord(route) {
  return [
    route.contentFile ? { relative: `content/${route.contentFile}`, sha256: route.contentFile.replace(/\.html$/, "") } : null,
    route.refreshCandidate?.contentFile ? { relative: `content/${route.refreshCandidate.contentFile}`, sha256: route.refreshCandidate.contentHash } : null,
    route.refreshCandidate?.translationContentFile ? {
      relative: `content/${route.refreshCandidate.translationContentFile}`,
      sha256: route.refreshCandidate.translationContentHash,
    } : null,
    ...route.snapshot.history.flatMap((entry) => [
      entry.contentFile && entry.contentHash ? { relative: `content/${entry.contentFile}`, sha256: entry.contentHash } : null,
      entry.translationContentFile && entry.translationContentHash ? {
        relative: `content/${entry.translationContentFile}`,
        sha256: entry.translationContentHash,
      } : null,
    ]),
  ].filter(Boolean);
}

function mediaReferencesFromRecord(route) {
  const media = [
    ...route.media,
    ...(route.refreshCandidate?.media ?? []),
  ];
  return media.map((entry) => ({
    relative: `public/${entry.path.replace(/^\//, "")}`,
    sha256: entry.sha256,
  }));
}

async function validateReferencedFile(roots, files, reference, operationId) {
  let bytes = files.get(reference.relative)?.bytes;
  if (!bytes) {
    try {
      bytes = await fs.readFile(liveTargetForRelative(roots, reference.relative));
    } catch (error) {
      fail("recovery-conflict", `Referenced file is missing: ${reference.relative}; ${error.message}`, operationId);
    }
  }
  let actualHash;
  try {
    actualHash = reference.relative.startsWith("content/")
      ? sha256(decodeUtf8Strict(bytes, `Referenced file ${reference.relative}`, "recovery-conflict").trim())
      : sha256(bytes);
  } catch (error) {
    if (error instanceof TutorialImportError) fail("recovery-conflict", error.message, operationId);
    throw error;
  }
  if (actualHash !== reference.sha256) {
    fail("recovery-conflict", `Referenced file hash mismatch: ${reference.relative}`, operationId);
  }
}

async function recoveryTextContent(roots, files, relative, operationId) {
  let bytes = files.get(relative)?.bytes;
  if (!bytes) {
    try {
      bytes = await fs.readFile(liveTargetForRelative(roots, relative));
    } catch (error) {
      fail("recovery-conflict", `Recovery content is missing: ${relative}; ${error.message}`, operationId);
    }
  }
  return decodeUtf8Strict(bytes, `Recovery content ${relative}`, "recovery-conflict").trim();
}

async function validateRecoveryContentValidation(roots, files, journal, operationId) {
  const enHtml = await recoveryTextContent(roots, files, `content/${journal.hashes.contentHash}.html`, operationId);
  const zhHtml = await recoveryTextContent(
    roots,
    files,
    `content/${journal.hashes.translationContentHash}.html`,
    operationId,
  );
  const validation = {
    en: model.validateTutorialHtml(enHtml, "Recovery English tutorial"),
    zh: model.validateTutorialHtml(zhHtml, "Recovery Chinese tutorial"),
  };
  if (
    JSON.stringify(validation.en) !== JSON.stringify(journal.validation.en) ||
    JSON.stringify(validation.zh) !== JSON.stringify(journal.validation.zh)
  ) {
    fail("recovery-conflict", `Recovery validation results do not match journal ${operationId}`, operationId);
  }
}

function tupleMatches(route, journal) {
  const hashes = journal.hashes;
  if (route.sourceKey !== journal.sourceKey || route.slug !== journal.slug) return null;
  if (
    route.snapshot.sourceContentHash === hashes.sourceContentHash &&
    route.snapshot.contentHash === hashes.contentHash &&
    route.snapshot.translationContentHash === hashes.translationContentHash
  ) {
    return { kind: "snapshot", version: route.snapshot.version };
  }
  const candidate = route.refreshCandidate;
  if (
    candidate?.sourceContentHash === hashes.sourceContentHash &&
    candidate.contentHash === hashes.contentHash &&
    candidate.translationContentHash === hashes.translationContentHash
  ) {
    return { kind: "refresh-candidate", version: candidate.version };
  }
  return null;
}

function assertRecoveryRoutePair(zhManifest, enManifest, marker, journal, operationId) {
  if (marker.slug !== journal.slug || marker.sourceKey !== journal.sourceKey) {
    fail("recovery-conflict", `Recovery marker identity does not match journal ${operationId}`, operationId);
  }
  const zhRoute = zhManifest.routes.find((route) => route.slug === journal.slug);
  const enRoute = enManifest.routes.find((route) => route.slug === journal.slug);
  if (!zhRoute || !enRoute || !zhManifest.routes.length || !enManifest.routes.length) {
    fail("recovery-conflict", `Recovery manifests do not contain route ${journal.slug}`, operationId);
  }
  const zhTuple = tupleMatches(zhRoute, journal);
  const enTuple = tupleMatches(enRoute, journal);
  if (
    !zhTuple ||
    !enTuple ||
    zhTuple.kind !== enTuple.kind ||
    zhTuple.version !== enTuple.version ||
    zhTuple.version !== journal.candidateVersion
  ) {
    fail("recovery-conflict", `Recovery route tuple does not match journal ${operationId}`, operationId);
  }
  return [zhRoute, enRoute];
}

async function validateRecoveryCandidates(roots, operationId, journal, files) {
  assertRecoveryJournal(journal, operationId);
  for (const relative of ["manifest.json", "manifest.en.json", "import-generation.json"]) {
    if (!files.has(relative)) fail("recovery-conflict", `Journal is missing required file: ${relative}`, operationId);
  }
  const marker = parseRecoveryJson(files.get("import-generation.json").bytes, "Recovery import-generation.json", operationId);
  if (!importMarkerMatches(marker, journal.marker)) {
    fail("recovery-conflict", `Recovery marker does not match ${operationId}`, operationId);
  }
  let zhManifest;
  let enManifest;
  try {
    zhManifest = model.parseTutorialManifest(
      parseRecoveryJson(files.get("manifest.json").bytes, "Recovery manifest.json", operationId),
      "zh-CN",
      "recovery manifest.json",
    );
    enManifest = model.parseTutorialManifest(
      parseRecoveryJson(files.get("manifest.en.json").bytes, "Recovery manifest.en.json", operationId),
      "en",
      "recovery manifest.en.json",
    );
    model.validateTutorialManifestPair(zhManifest, enManifest);
  } catch (error) {
    fail("recovery-conflict", `Recovery candidate manifests are invalid: ${error.message}`, operationId);
  }
  if (zhManifest.generation !== marker.generation || enManifest.generation !== marker.generation) {
    fail("recovery-conflict", `Recovery manifests do not match marker generation ${operationId}`, operationId);
  }
  assertRecoveryRoutePair(zhManifest, enManifest, marker, journal, operationId);
  await validateRecoveryContentValidation(roots, files, journal, operationId);
  const references = [
    ...zhManifest.routes.flatMap((route) => [...contentReferencesFromRecord(route), ...mediaReferencesFromRecord(route)]),
    ...enManifest.routes.flatMap((route) => [...contentReferencesFromRecord(route), ...mediaReferencesFromRecord(route)]),
  ];
  const allowedFiles = new Set([
    "manifest.json",
    "manifest.en.json",
    "import-generation.json",
    ...references.map((reference) => reference.relative),
  ]);
  for (const relative of files.keys()) {
    if (!allowedFiles.has(relative)) {
      fail("recovery-conflict", `Journal contains an unreferenced staged file: ${relative}`, operationId);
    }
  }
  for (const reference of references) {
    await validateReferencedFile(roots, files, reference, operationId);
  }
}

async function committedMarker(roots, operationId, journal) {
  try {
    const marker = await readJsonFile(path.join(roots.contentRoot, "import-generation.json"));
    if (marker.operationId !== operationId || marker.generation !== operationId) return null;
    const files = await recoveryFilesFromLiveJournal(roots, operationId, journal);
    await validateRecoveryCandidates(roots, operationId, journal, files);
    return marker;
  } catch {
    return null;
  }
}

function isBootstrapManifest(manifest) {
  return model.isTutorialBootstrapManifest(manifest);
}

function markerMatchesManifestPair(marker, zhManifest, enManifest) {
  return importMarkerMatches(marker, {
    operationId: marker?.operationId,
    generation: marker?.generation,
    slug: marker?.slug,
    sourceKey: marker?.sourceKey,
    locales: ["zh-CN", "en"],
  }) &&
    marker.operationId === marker.generation &&
    marker.generation === zhManifest.generation &&
    marker.generation === enManifest.generation;
}

async function parseBackupManifest(roots, relative, locale, operationId) {
  const backup = `${path.join(roots.contentRoot, relative)}.backup-${operationId}`;
  let bytes;
  try {
    bytes = await fs.readFile(backup);
  } catch {
    return null;
  }
  try {
    return {
      backup,
      bytes,
      manifest: model.parseTutorialManifest(
        parseRecoveryJson(bytes, `Backup ${relative}`, operationId),
        locale,
        `backup ${relative}`,
      ),
    };
  } catch (error) {
    fail("recovery-conflict", `Backup ${relative} is invalid: ${error.message}`, operationId);
  }
}

async function restoreCommittedBackups(roots, operationId, reason) {
  const zhBackup = await parseBackupManifest(roots, "manifest.json", "zh-CN", operationId);
  const enBackup = await parseBackupManifest(roots, "manifest.en.json", "en", operationId);
  if (!zhBackup || !enBackup) return null;
  try {
    model.validateTutorialManifestPair(zhBackup.manifest, enBackup.manifest);
  } catch (error) {
    fail("recovery-conflict", `Backup locale pair is invalid: ${error.message}`, operationId);
  }

  const markerPath = path.join(roots.contentRoot, "import-generation.json");
  const markerBackupPath = `${markerPath}.backup-${operationId}`;
  const markerBackupBytes = await fs.readFile(markerBackupPath).catch(() => null);
  const liveMarkerBytes = await fs.readFile(markerPath).catch(() => null);
  const markerBytes = markerBackupBytes ?? liveMarkerBytes;
  const marker = markerBytes ? parseRecoveryJson(markerBytes, "Backup import-generation.json", operationId) : null;
  const restoresBootstrap = isBootstrapManifest(zhBackup.manifest) && isBootstrapManifest(enBackup.manifest);
  if (!markerMatchesManifestPair(marker, zhBackup.manifest, enBackup.manifest) && !restoresBootstrap) {
    fail("recovery-conflict", `Backup marker is missing or does not match restored manifests: ${reason}`, operationId);
  }

  await fs.copyFile(zhBackup.backup, path.join(roots.contentRoot, "manifest.json"));
  await fs.copyFile(enBackup.backup, path.join(roots.contentRoot, "manifest.en.json"));
  if (markerBackupBytes) {
    await fs.copyFile(markerBackupPath, markerPath);
  } else if (restoresBootstrap) {
    const failedMarker = `${markerPath}.failed-${operationId}`;
    await fs.rename(markerPath, failedMarker).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }

  const [restoredZh, restoredEn] = await Promise.all([
    readManifest(roots.contentRoot, "zh-CN"),
    readManifest(roots.contentRoot, "en"),
  ]);
  model.validateTutorialManifestPair(restoredZh, restoredEn);
  const restoredMarker = await readJsonFileOrNull(markerPath);
  if (!markerMatchesManifestPair(restoredMarker, restoredZh, restoredEn)) {
    if (!(isBootstrapManifest(restoredZh) && isBootstrapManifest(restoredEn) && restoredMarker === null)) {
      fail("recovery-conflict", `Restored marker verification failed after ${operationId}`, operationId);
    }
  }
  return {
    operationId,
    generation: restoredZh.generation,
    recovered: true,
    status: "restored",
  };
}

function canRestoreBackups(journal) {
  return journal.phase !== "committed" &&
    Array.isArray(journal.phases) &&
    journal.phases.some((entry) =>
      entry?.phase === "manifest-backup" || entry?.phase === "manifest-replace",
    );
}

export async function recoverTutorialImport(options) {
  const roots = {
    contentRoot: path.resolve(options.contentRoot ?? importerDefaults.contentRoot),
    publicRoot: path.resolve(options.publicRoot ?? importerDefaults.publicRoot),
  };
  const operationId = assertOperationId(requireOption({ operation: options.operationId }, "operation"));
  return withImportLock(roots.contentRoot, async () => {
    const journal = await readJournal(roots.contentRoot, operationId);
    assertRecoveryJournal(journal, operationId);
    const marker = await committedMarker(roots, operationId, journal);
    if (marker) {
      return {
        operationId,
        generation: marker.generation,
        recovered: false,
        status: "committed",
      };
    }
    let staged;
    try {
      const recoveryFiles = await recoveryFilesFromJournal(roots, operationId, journal);
      staged = recoveryFiles.staged;
      await validateRecoveryCandidates(roots, operationId, journal, recoveryFiles.files);
    } catch (error) {
      if (canRestoreBackups(journal)) {
        const restored = await restoreCommittedBackups(roots, operationId, error.message);
        if (restored) {
          await updateJournal(roots.contentRoot, operationId, {
            ...journal,
            phase: "restored",
            restoredAt: new Date().toISOString(),
            restoreReason: error.message,
          });
          return restored;
        }
      }
      throw error;
    }
    let currentJournal = journal;
    const setPhase = async (phase, relative = null) => {
      currentJournal = {
        ...currentJournal,
        phase,
        phases: [
          ...(Array.isArray(currentJournal.phases) ? currentJournal.phases : []),
          { phase, ...(relative ? { relative } : {}), recordedAt: new Date().toISOString() },
        ],
      };
      await updateJournal(roots.contentRoot, operationId, currentJournal);
    };
    try {
      await commitDraftFiles(staged, roots, operationId, setPhase);
    } catch (error) {
      fail("recovery-conflict", `Recovery cannot prove a safe commit for ${operationId}: ${error.message}`, operationId);
    }
    await updateJournal(roots.contentRoot, operationId, {
      ...currentJournal,
      phase: "committed",
      recoveredAt: new Date().toISOString(),
    });
    await fs.rm(path.join(roots.contentRoot, ".import-staging", operationId), { recursive: true, force: true });
    return {
      operationId,
      generation: operationId,
      recovered: true,
      status: "committed",
    };
  });
}

function idempotentResult(snapshot, hashes, manifests) {
  const zh = manifests["zh-CN"].routes.find((route) => route.slug === snapshot.slug);
  const en = manifests.en.routes.find((route) => route.slug === snapshot.slug);
  if (!zh || !en) return null;
  if (manifests["zh-CN"].generation !== manifests.en.generation) return null;
  if (
    zh.sourceKey === snapshot.sourceKey &&
    en.sourceKey === snapshot.sourceKey &&
    zh.snapshot.sourceContentHash === snapshot.sourceContentHash &&
    en.snapshot.sourceContentHash === snapshot.sourceContentHash &&
    en.snapshot.contentHash === hashes.english &&
    zh.snapshot.translationContentHash === hashes.chinese
  ) {
    return {
      operationId: manifests.en.generation,
      generation: manifests.en.generation,
      slug: snapshot.slug,
      sourceKey: snapshot.sourceKey,
      englishContentFile: `content/${en.contentFile}`,
      chineseContentFile: `content/${zh.contentFile}`,
      manifestFiles: ["manifest.json", "manifest.en.json"],
      media: zh.media,
      status: zh.status,
      liveRouteStatus: zh.status,
      pendingReview: zh.status !== "published",
      resultKind: "route",
      idempotent: true,
    };
  }
  const matchesCandidate = (candidate) =>
    candidate?.sourceContentHash === snapshot.sourceContentHash &&
    candidate.contentHash === hashes.english &&
    candidate.translationContentHash === hashes.chinese;
  const candidate = matchesCandidate(zh.refreshCandidate) ? zh.refreshCandidate : null;
  const englishCandidate = matchesCandidate(en.refreshCandidate) ? en.refreshCandidate : null;
  if (candidate && englishCandidate && englishCandidate.version === candidate.version) {
    return {
      operationId: candidate.operationId ?? manifests.en.generation,
      generation: manifests.en.generation,
      slug: snapshot.slug,
      sourceKey: snapshot.sourceKey,
      englishContentFile: `content/${candidate.contentFile ?? `${hashes.english}.html`}`,
      chineseContentFile: `content/${candidate.translationContentFile ?? `${hashes.chinese}.html`}`,
      manifestFiles: ["manifest.json", "manifest.en.json"],
      media: candidate.media,
      status: candidate.status,
      liveRouteStatus: zh.status,
      pendingReview: true,
      resultKind: "refresh-candidate",
      idempotent: true,
    };
  }
  const matchesHistory = (entry) =>
    entry.sourceContentHash === snapshot.sourceContentHash &&
    entry.contentHash === hashes.english &&
    entry.translationContentHash === hashes.chinese;
  const historicalCandidate = zh.snapshot.history.find(matchesHistory);
  const englishHistoricalCandidate = en.snapshot.history.find(matchesHistory);
  if (
    historicalCandidate &&
    englishHistoricalCandidate &&
    historicalCandidate.version === englishHistoricalCandidate.version &&
    zh.sourceKey === snapshot.sourceKey &&
    en.sourceKey === snapshot.sourceKey
  ) {
    return {
      operationId: historicalCandidate.operationId ?? manifests.en.generation,
      generation: manifests.en.generation,
      slug: snapshot.slug,
      sourceKey: snapshot.sourceKey,
      englishContentFile: `content/${historicalCandidate.contentFile ?? `${hashes.english}.html`}`,
      chineseContentFile: `content/${historicalCandidate.translationContentFile ?? `${hashes.chinese}.html`}`,
      manifestFiles: ["manifest.json", "manifest.en.json"],
      media: zh.refreshCandidate?.media ?? zh.media,
      status: "stale",
      liveRouteStatus: zh.status,
      pendingReview: true,
      resultKind: "refresh-candidate",
      idempotent: true,
    };
  }
  return null;
}

export async function importTutorialDraft(options) {
  const snapshot = await readSnapshot(options.input);
  model.assertTutorialSlug(snapshot.slug);
  if (snapshot.canonicalMatched !== true || normalizeSourceKey(snapshot.canonicalUrl) !== normalizeSourceKey(snapshot.requestedUrl)) {
    fail("canonical-mismatch", "Snapshot canonical does not match the requested source URL");
  }
  const translation = await readTranslation(options.translation);
  const roots = {
    contentRoot: path.resolve(options.contentRoot),
    publicRoot: path.resolve(options.publicRoot),
  };
  const translationMeta = {
    translator: options.translator ?? null,
    translatedAt: options.translatedAt ?? null,
  };
  const operationId = assertOperationId(options.operationId ?? `tutorial-import-${crypto.randomUUID()}`);
  const generation = operationId;
  const { entries: mediaEntries, map: mediaMap } = await localizeMedia(snapshot, roots.publicRoot, {
    allowFixtureMedia: options.allowFixtureMedia === true,
  });
  const englishHtml = sanitizeTutorialHtml(snapshot.html, snapshot, mediaMap, "English source");
  const chineseHtml = sanitizeTutorialHtml(translation, snapshot, mediaMap, "Chinese translation");
  const enValidation = model.validateTutorialHtml(englishHtml, "English imported tutorial");
  const zhValidation = model.validateTutorialHtml(chineseHtml, "Chinese imported tutorial");
  assertTranslationHandoff(englishHtml, chineseHtml, enValidation, zhValidation);
  const hashes = { english: sha256(englishHtml), chinese: sha256(chineseHtml) };
  const validation = { en: enValidation, zh: zhValidation, enHtml: englishHtml, zhHtml: chineseHtml };
  const sharedMedia = mediaEntries.map(({ manifest }) => manifest);
  const stagingRoot = path.join(roots.contentRoot, ".import-staging", operationId);
  return withImportLock(roots.contentRoot, async () => {
    await options.testHooks?.afterLockAcquired?.(operationId);
    const [zhManifest, enManifest] = await Promise.all([
      readManifest(roots.contentRoot, "zh-CN"),
      readManifest(roots.contentRoot, "en"),
    ]);
    const manifests = { "zh-CN": zhManifest, en: enManifest };
    assertOwnership(snapshot, manifests);
    const idempotent = idempotentResult(snapshot, hashes, manifests);
    if (idempotent) return idempotent;
    const enRecord = routeFromSnapshot(snapshot, "en", hashes, validation, sharedMedia, manifests, operationId, translationMeta);
    const zhRecord = routeFromSnapshot(snapshot, "zh-CN", hashes, validation, sharedMedia, manifests, operationId, translationMeta);
    const candidateVersion = zhRecord.refreshCandidate?.operationId === operationId
      ? zhRecord.refreshCandidate.version
      : zhRecord.snapshot.version;
    const nextEnManifest = manifestJson(enManifest, replaceRoute(enManifest.routes, enRecord), generation);
    const nextZhManifest = manifestJson(zhManifest, replaceRoute(zhManifest.routes, zhRecord), generation);
    model.parseTutorialManifest(nextEnManifest, "en", "candidate manifest.en.json");
    model.parseTutorialManifest(nextZhManifest, "zh-CN", "candidate manifest.json");
    model.validateTutorialManifestPair(
      model.parseTutorialManifest(nextZhManifest, "zh-CN", "candidate manifest.json"),
      model.parseTutorialManifest(nextEnManifest, "en", "candidate manifest.en.json"),
    );

    const marker = importGenerationMarker(
      operationId,
      snapshot.slug,
      snapshot.sourceKey,
      new Date().toISOString(),
    );
    const staged = [
      await stageText(stagingRoot, `content/${hashes.english}.html`, `${englishHtml}\n`),
      await stageText(stagingRoot, `content/${hashes.chinese}.html`, `${chineseHtml}\n`),
      await stageText(stagingRoot, "manifest.json", `${JSON.stringify(nextZhManifest, null, 2)}\n`),
      await stageText(stagingRoot, "manifest.en.json", `${JSON.stringify(nextEnManifest, null, 2)}\n`),
      await stageText(stagingRoot, "import-generation.json", `${JSON.stringify(marker, null, 2)}\n`),
    ];
    const stagedMedia = new Set();
    for (const { target, bytes } of mediaEntries) {
      const relative = `public/${path.relative(roots.publicRoot, target)}`;
      if (stagedMedia.has(relative)) continue;
      stagedMedia.add(relative);
      staged.push(await stageBytes(stagingRoot, relative, bytes));
    }
    const journal = {
      operationId,
      phase: "staged",
      slug: snapshot.slug,
      sourceKey: snapshot.sourceKey,
      generation,
      candidateVersion,
      files: staged.map((file) => ({
        relative: file.relative,
        sha256: file.sha256,
      })),
      hashes: {
        sourceContentHash: snapshot.sourceContentHash,
        contentHash: hashes.english,
        translationContentHash: hashes.chinese,
      },
      marker: importGenerationMarker(operationId, snapshot.slug, snapshot.sourceKey),
      validation: {
        en: enValidation,
        zh: zhValidation,
      },
      phases: [],
    };
    let currentJournal = journal;
    const setPhase = async (phase, relative = null) => {
      currentJournal = {
        ...currentJournal,
        phase,
        phases: [
          ...currentJournal.phases,
          { phase, ...(relative ? { relative } : {}), recordedAt: new Date().toISOString() },
        ],
      };
      await updateJournal(roots.contentRoot, operationId, currentJournal);
    };
    await updateJournal(roots.contentRoot, operationId, journal);
    await stageText(stagingRoot, "journal.json", `${JSON.stringify(journal, null, 2)}\n`);

    try {
      await commitDraftFiles(staged, roots, operationId, setPhase, options.testHooks ?? {});
    } catch (error) {
      await setPhase("commit-failed");
      fail("commit", `Commit failed for ${operationId}: ${error.message}`, operationId);
    }
    await updateJournal(roots.contentRoot, operationId, {
      ...currentJournal,
      phase: "committed",
      committedAt: new Date().toISOString(),
    });
    try {
      await pruneCommittedBackups(roots.contentRoot);
    } catch (error) {
      console.warn(`[tutorial-importer] backup retention warning operation=${operationId}: ${error.message}`);
    }
    await fs.rm(stagingRoot, { recursive: true, force: true });

    const refreshCandidate = zhRecord.refreshCandidate?.operationId === operationId ? zhRecord.refreshCandidate : null;
    return {
      operationId,
      generation,
      slug: snapshot.slug,
      sourceKey: snapshot.sourceKey,
      englishContentFile: `content/${hashes.english}.html`,
      chineseContentFile: `content/${hashes.chinese}.html`,
      manifestFiles: ["manifest.json", "manifest.en.json"],
      media: sharedMedia,
      status: refreshCandidate?.status ?? zhRecord.status,
      liveRouteStatus: zhRecord.status,
      pendingReview: refreshCandidate ? true : zhRecord.status !== "published",
      resultKind: refreshCandidate ? "refresh-candidate" : "route",
      idempotent: false,
    };
  });
}
