import crypto from "node:crypto";
import dns from "node:dns/promises";
import fs from "node:fs/promises";
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
  return {
    input: requireOption(args, "input"),
    translation: requireOption(args, "translation"),
    contentRoot: importerDefaults.contentRoot,
    publicRoot: importerDefaults.publicRoot,
  };
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
  const lower = hostname.toLowerCase();
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
  const mappedIpv4 = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (mappedIpv4) return isPrivateIpv4(mappedIpv4);
  return lower === "::1" ||
    lower === "::" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe80:") ||
    lower.startsWith("ff") ||
    lower.startsWith("2001:db8:");
}

async function assertResolvedPublicHost(hostname) {
  const records = await dns.lookup(hostname, { all: true });
  if (!records.length) fail("unavailable", `Source host has no DNS records: ${hostname}`);
  for (const { address } of records) {
    if (!isPublicHostname(address)) fail("unavailable", `Source DNS resolves to a private address: ${address}`);
  }
}

function assertSamePolicyHost(initialUrl, nextUrl) {
  if (new URL(initialUrl).hostname.toLowerCase() !== new URL(nextUrl).hostname.toLowerCase()) {
    fail("canonical-mismatch", `Cross-host redirect is outside source policy: ${initialUrl} -> ${nextUrl}`);
  }
}

async function responseBytes(response, limit, label, code = "unavailable") {
  const reader = response.body?.getReader();
  if (!reader) fail(code, `${label} response body is unavailable`);
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) fail(code, `${label} exceeds importer size limit`);
    chunks.push(Buffer.from(value));
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
  await assertResolvedPublicHost(new URL(initialUrl).hostname);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    if (seen.has(current)) fail("redirect-loop", `Redirect loop detected at ${current}`);
    seen.add(current);
    let response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        headers: { "user-agent": "learnseo-tutorial-importer/1.0" },
      });
    } catch (error) {
      fail("unavailable", `Fetch failed for ${current}: ${error.message}`);
    }
    const status = response.status;
    if ([301, 302, 303, 307, 308].includes(status)) {
      const location = response.headers.get("location");
      if (!location) fail("unavailable", `Redirect missing Location header at ${current}`);
      const next = new URL(location, current).toString();
      assertPublicHttps(next);
      assertSamePolicyHost(initialUrl, next);
      await assertResolvedPublicHost(new URL(next).hostname);
      redirects.push({ from: current, to: next, status });
      current = next;
      continue;
    }
    if (status === 401 || status === 403 || status === 407) fail("authentication", `Source requires authentication: ${status}`);
    if (status < 200 || status >= 300) fail("unavailable", `Source returned HTTP ${status}`);
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.startsWith("text/html")) fail("non-html", `Source content type is ${contentType || "unknown"}`);
    const body = await responseBytes(response, htmlSizeLimit, "Source HTML");
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
  await assertResolvedPublicHost(new URL(current).hostname);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    if (seen.has(current)) fail("redirect-loop", `Media redirect loop detected at ${current}`);
    seen.add(current);
    let response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        headers: { "user-agent": "learnseo-tutorial-importer/1.0" },
      });
    } catch (error) {
      fail("media-download", `Unable to download media ${current}: ${error.message}`);
    }
    const status = response.status;
    if ([301, 302, 303, 307, 308].includes(status)) {
      const location = response.headers.get("location");
      if (!location) fail("media-download", `Media redirect missing Location header at ${current}`);
      const next = new URL(location, current).toString();
      assertPublicHttps(next);
      await assertResolvedPublicHost(new URL(next).hostname);
      current = next;
      continue;
    }
    if (!response.ok) fail("media-download", `Media returned HTTP ${response.status}: ${current}`);
    const contentType = (response.headers.get("content-type") ?? "").split(";", 1)[0].toLowerCase();
    if (!imageContentTypes.has(contentType)) fail("unsupported-media", `Unsupported media type ${contentType || "unknown"}: ${current}`);
    const bytes = await responseBytes(response, mediaSizeLimit, `Media ${current}`, "unsupported-media");
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

function routeFromSnapshot(snapshot, locale, hashes, validation, media, manifests, operationId) {
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
      translator: null,
      translatedAt: null,
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
        backups.push({ target, backup });
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
    for (const { backup } of backups) await fs.rm(backup, { force: true });
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

async function withImportLock(contentRoot, callback) {
  const lockPath = path.join(contentRoot, ".tutorial-import.lock");
  await fs.mkdir(contentRoot, { recursive: true });
  let handle;
  try {
    handle = await fs.open(lockPath, "wx");
  } catch (error) {
    if (error.code === "EEXIST") fail("unavailable", `Tutorial import lock is already held: ${lockPath}`);
    throw error;
  }
  try {
    return await callback();
  } finally {
    await handle?.close();
    await fs.rm(lockPath, { force: true });
  }
}

async function updateJournal(contentRoot, operationId, value) {
  const target = path.join(contentRoot, ".import-journal", `${operationId}.json`);
  await writeJsonFile(target, value);
}

async function readJournal(contentRoot, operationId) {
  return readJsonFile(path.join(contentRoot, ".import-journal", `${operationId}.json`));
}

function safeStagedTarget(stagingRoot, relative) {
  try {
    assertSafeStagedRelative(relative);
  } catch (error) {
    fail("recovery-conflict", error.message);
  }
  const target = path.resolve(stagingRoot, relative);
  const relativeFromRoot = path.relative(stagingRoot, target);
  if (!relativeFromRoot || relativeFromRoot.startsWith("..") || path.isAbsolute(relativeFromRoot)) {
    fail("recovery-conflict", `Staged file escapes operation root: ${relative}`);
  }
  return target;
}

function liveTargetForRelative(roots, relative) {
  if (relative.startsWith("public/")) return path.join(roots.publicRoot, relative.slice("public/".length));
  return path.join(roots.contentRoot, relative);
}

async function stagedFilesFromJournal(roots, operationId, journal) {
  if (!Array.isArray(journal.files)) fail("recovery-conflict", "Journal files are missing");
  const stagingRoot = path.join(roots.contentRoot, ".import-staging", operationId);
  const staged = [];
  for (const entry of journal.files) {
    const relative = typeof entry === "string" ? entry : entry?.relative;
    const expectedHash = typeof entry === "string" ? null : entry?.sha256;
    if (typeof relative !== "string" || relative === "journal.json") continue;
    const target = safeStagedTarget(stagingRoot, relative);
    let bytes;
    try {
      bytes = await fs.readFile(target);
    } catch (error) {
      const liveBytes = await fs.readFile(liveTargetForRelative(roots, relative)).catch(() => null);
      if (liveBytes && expectedHash && sha256(liveBytes) === expectedHash) continue;
      fail("recovery-conflict", `Staged file is missing: ${relative}; ${error.message}`);
    }
    if (expectedHash && sha256(bytes) !== expectedHash) {
      fail("recovery-conflict", `Staged file hash mismatch: ${relative}`);
    }
    staged.push({ relative, target, sha256: sha256(bytes) });
  }
  return staged;
}

async function committedMarker(contentRoot, operationId) {
  try {
    const marker = await readJsonFile(path.join(contentRoot, "import-generation.json"));
    return marker.operationId === operationId && marker.generation === operationId ? marker : null;
  } catch {
    return null;
  }
}

export async function recoverTutorialImport(options) {
  const roots = {
    contentRoot: path.resolve(options.contentRoot ?? importerDefaults.contentRoot),
    publicRoot: path.resolve(options.publicRoot ?? importerDefaults.publicRoot),
  };
  const operationId = assertOperationId(requireOption({ operation: options.operationId }, "operation"));
  return withImportLock(roots.contentRoot, async () => {
    const marker = await committedMarker(roots.contentRoot, operationId);
    if (marker) {
      return {
        operationId,
        generation: marker.generation,
        recovered: false,
        status: "committed",
      };
    }
    const journal = await readJournal(roots.contentRoot, operationId);
    if (journal.operationId !== operationId || journal.generation !== operationId) {
      fail("recovery-conflict", `Journal operation mismatch for ${operationId}`, operationId);
    }
    const staged = await stagedFilesFromJournal(roots, operationId, journal);
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
      idempotent: true,
    };
  }
  const matchesCandidate = (candidate) =>
    candidate?.sourceContentHash === snapshot.sourceContentHash &&
    candidate.contentHash === hashes.english &&
    candidate.translationContentHash === hashes.chinese;
  const candidate = zh.snapshot.history.find((entry) =>
    entry.sourceContentHash === snapshot.sourceContentHash &&
    entry.contentHash === hashes.english &&
    entry.translationContentHash === hashes.chinese,
  ) ?? (matchesCandidate(zh.refreshCandidate) ? zh.refreshCandidate : null);
  const englishCandidate = en.snapshot.history.find((entry) =>
    entry.version === candidate?.version &&
    entry.sourceContentHash === snapshot.sourceContentHash &&
    entry.contentHash === hashes.english &&
    entry.translationContentHash === hashes.chinese,
  ) ?? (matchesCandidate(en.refreshCandidate) ? en.refreshCandidate : null);
  if (candidate && englishCandidate && englishCandidate.version === candidate.version) {
    return {
      operationId: candidate.operationId ?? manifests.en.generation,
      generation: manifests.en.generation,
      slug: snapshot.slug,
      sourceKey: snapshot.sourceKey,
      englishContentFile: `content/${candidate.contentFile ?? `${hashes.english}.html`}`,
      chineseContentFile: `content/${candidate.translationContentFile ?? `${hashes.chinese}.html`}`,
      manifestFiles: ["manifest.json", "manifest.en.json"],
      media: zh.media,
      status: zh.status,
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
    const enRecord = routeFromSnapshot(snapshot, "en", hashes, validation, sharedMedia, manifests, operationId);
    const zhRecord = routeFromSnapshot(snapshot, "zh-CN", hashes, validation, sharedMedia, manifests, operationId);
    const nextEnManifest = manifestJson(enManifest, replaceRoute(enManifest.routes, enRecord), generation);
    const nextZhManifest = manifestJson(zhManifest, replaceRoute(zhManifest.routes, zhRecord), generation);
    model.parseTutorialManifest(nextEnManifest, "en", "candidate manifest.en.json");
    model.parseTutorialManifest(nextZhManifest, "zh-CN", "candidate manifest.json");
    model.validateTutorialManifestPair(
      model.parseTutorialManifest(nextZhManifest, "zh-CN", "candidate manifest.json"),
      model.parseTutorialManifest(nextEnManifest, "en", "candidate manifest.en.json"),
    );

    const staged = [
      await stageText(stagingRoot, `content/${hashes.english}.html`, `${englishHtml}\n`),
      await stageText(stagingRoot, `content/${hashes.chinese}.html`, `${chineseHtml}\n`),
      await stageText(stagingRoot, "manifest.json", `${JSON.stringify(nextZhManifest, null, 2)}\n`),
      await stageText(stagingRoot, "manifest.en.json", `${JSON.stringify(nextEnManifest, null, 2)}\n`),
      await stageText(stagingRoot, "import-generation.json", `${JSON.stringify({
        operationId,
        generation,
        slug: snapshot.slug,
        sourceKey: snapshot.sourceKey,
        locales: ["zh-CN", "en"],
        committedAt: null,
      }, null, 2)}\n`),
    ];
    for (const { target, bytes } of mediaEntries) {
      const relative = `public/${path.relative(roots.publicRoot, target)}`;
      staged.push(await stageBytes(stagingRoot, relative, bytes));
    }
    const journal = {
      operationId,
      phase: "staged",
      slug: snapshot.slug,
      sourceKey: snapshot.sourceKey,
      generation,
      files: staged.map((file) => ({
        relative: file.relative,
        sha256: file.sha256,
      })),
      hashes: {
        sourceContentHash: snapshot.sourceContentHash,
        contentHash: hashes.english,
        translationContentHash: hashes.chinese,
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
    await fs.rm(stagingRoot, { recursive: true, force: true });

    return {
      operationId,
      generation,
      slug: snapshot.slug,
      sourceKey: snapshot.sourceKey,
      englishContentFile: `content/${hashes.english}.html`,
      chineseContentFile: `content/${hashes.chinese}.html`,
      manifestFiles: ["manifest.json", "manifest.en.json"],
      media: sharedMedia,
      status: zhRecord.status,
      idempotent: false,
    };
  });
}
