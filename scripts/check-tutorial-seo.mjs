import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentRoot = path.join(repositoryRoot, "src/content/tutorials");
const origin = "https://learningseo.io";
const statuses = new Set(["draft", "review", "published", "stale"]);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function readManifest(locale, filename) {
  const filePath = path.join(contentRoot, filename);
  try {
    const source = await fs.readFile(filePath, "utf8");
    return { locale, filePath, data: JSON.parse(source) };
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw new Error(`Unable to read ${filePath}: ${error.message}`);
  }
}

function routesFromManifest(manifest) {
  assert.ok(manifest && typeof manifest.data === "object", `${manifest?.filePath} must be an object`);
  if (manifest.data.locale !== undefined) assert.equal(manifest.data.locale, manifest.locale);
  const routes = manifest.data.routes || manifest.data.records || manifest.data.tutorials;
  assert.ok(Array.isArray(routes), `${manifest.filePath} must contain routes`);
  return routes;
}

function expectedPath(locale, slug) {
  return locale === "en" ? `/en/tutorials/${slug}/` : `/tutorials/${slug}/`;
}

function validateRedirect(target, locale, slug) {
  if (target === undefined || target === null) return;
  assert.equal(typeof target, "string", `${slug} redirectTo must be a string or null`);
  const parsed = new URL(target, `${origin}/`);
  assert.equal(parsed.origin, origin, `${slug} redirectTo must stay on the site`);
  assert.equal(parsed.protocol, "https:", `${slug} redirectTo must use HTTPS`);
  const targetPath = parsed.pathname.endsWith("/") ? parsed.pathname : `${parsed.pathname}/`;
  assert.match(targetPath, locale === "en" ? /^\/en\/tutorials\/[^/]+\/$/ : /^\/tutorials\/[^/]+\/$/);
  assert.match(targetPath.split("/").filter(Boolean).at(-1), slugPattern);
}

function validateRecord(record, locale, index, slugs) {
  assert.ok(record && typeof record === "object", `${locale} route ${index} must be an object`);
  assert.equal(typeof record.slug, "string", `${locale} route ${index} slug must be a string`);
  assert.match(record.slug, slugPattern, `${locale} route ${index} slug is invalid`);
  assert.ok(!slugs.has(record.slug), `Duplicate ${locale} tutorial slug: ${record.slug}`);
  slugs.add(record.slug);
  assert.equal(record.path || expectedPath(locale, record.slug), expectedPath(locale, record.slug));
  assert.ok(statuses.has(record.status), `${record.slug} has an invalid status`);
  assert.ok(record.source && typeof record.source === "object", `${record.slug} source is missing`);
  const canonical = new URL(record.source.canonicalUrl);
  assert.equal(canonical.protocol, "https:", `${record.slug} source canonical must use HTTPS`);
  assert.ok(Number.isInteger(record.snapshot?.version) && record.snapshot.version > 0,
    `${record.slug} snapshot version must be positive`);
  if (record.seo?.indexable !== undefined) {
    assert.equal(record.seo.indexable, record.status === "published",
      `${record.slug} seo.indexable must follow publication status`);
  }
  validateRedirect(record.redirectTo, locale, record.slug);
}

function normalizeCanonical(value) {
  const url = new URL(value);
  url.hostname = url.hostname.toLowerCase();
  url.port = "";
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(?:utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  }
  url.pathname = url.pathname === "/" ? "/" : url.pathname.replace(/\/+$/, "");
  return url.toString();
}

async function main() {
  const [zh, en] = await Promise.all([
    readManifest("zh-CN", "manifest.json"),
    readManifest("en", "manifest.en.json"),
  ]);
  if (!zh && !en) {
    console.log("Tutorial SEO check skipped: tutorial manifests are not present yet; routes return 404 and sitemap remains unchanged.");
    return;
  }
  assert.ok(zh && en, "Tutorial SEO requires both manifest.json and manifest.en.json");

  const zhRoutes = routesFromManifest(zh);
  const enRoutes = routesFromManifest(en);
  const zhSlugs = new Set();
  const enSlugs = new Set();
  zhRoutes.forEach((record, index) => validateRecord(record, "zh-CN", index, zhSlugs));
  enRoutes.forEach((record, index) => validateRecord(record, "en", index, enSlugs));
  assert.deepEqual([...zhSlugs], [...enSlugs], "Locale tutorial slug sets must match");

  const enBySlug = new Map(enRoutes.map((record) => [record.slug, record]));
  for (const zhRecord of zhRoutes) {
    const enRecord = enBySlug.get(zhRecord.slug);
    assert.equal(normalizeCanonical(zhRecord.source.canonicalUrl), normalizeCanonical(enRecord.source.canonicalUrl),
      `${zhRecord.slug} locale source canonicals differ`);
    assert.equal(zhRecord.snapshot.version, enRecord.snapshot.version,
      `${zhRecord.slug} locale snapshot versions differ`);
  }

  const published = zhRoutes.filter((record) => record.status === "published");
  const preview = zhRoutes.filter((record) => record.status !== "published");
  console.log(`Tutorial SEO contract passed: ${published.length} published pair(s), ${preview.length} preview pair(s).`);
}

main().catch((error) => {
  console.error(`Tutorial SEO contract failed: ${error.message}`);
  process.exitCode = 1;
});
