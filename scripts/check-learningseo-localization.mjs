import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve("src/components/sites/learningseo-io-071dae18");
const generatedRoot = path.join(root, "subpages", "generated");
const sourceContentPath = path.join(root, "root-8a5edab2", "content.json");
const sourceManifestPath = path.join(generatedRoot, "manifest.json");
const chineseManifestPath = path.join(generatedRoot, "manifest.zh-CN.json");
const translationManifestPath = path.join(generatedRoot, "translation-manifest.json");
const sourceContentRoot = path.join(generatedRoot, "content");
const chineseContentRoot = path.join(generatedRoot, "content-zh-CN");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizePath(pathname) {
  const value = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return value === "/" ? "/" : `${value.replace(/\/+$/, "")}/`;
}

const sourceManifest = JSON.parse(await fs.readFile(sourceManifestPath, "utf8"));
const chineseManifest = JSON.parse(await fs.readFile(chineseManifestPath, "utf8"));
const translationManifest = JSON.parse(await fs.readFile(translationManifestPath, "utf8"));
const sourceContent = await fs.readFile(sourceContentPath);
const chineseContent = JSON.parse(await fs.readFile(path.join(root, "root-8a5edab2", "content.zh-CN.json"), "utf8"));

assert.equal(chineseManifest.locale, "zh-CN");
assert.equal(sha256(sourceContent), translationManifest.sourceContentSha256);
assert.equal(
  sha256(await fs.readFile(sourceManifestPath)),
  translationManifest.sourceManifestSha256,
);

const sourceRoutes = sourceManifest.routes.map((route) => normalizePath(route.sourcePath));
const chineseRoutes = chineseManifest.routes.map((route) => normalizePath(route.sourcePath));
assert.deepEqual(chineseRoutes, sourceRoutes, "Chinese routes must match English routes in order");

const sourceFiles = (await fs.readdir(sourceContentRoot)).filter((file) => file.endsWith(".html"));
const chineseFiles = new Set(
  (await fs.readdir(chineseContentRoot)).filter((file) => file.endsWith(".html")),
);
assert.equal(chineseFiles.size, sourceFiles.length);

for (const file of sourceFiles) {
  assert.ok(chineseFiles.has(file), `Missing Chinese page: ${file}`);
  assert.ok(translationManifest.pages[file], `Missing translation hash: ${file}`);
  const source = await fs.readFile(path.join(sourceContentRoot, file), "utf8");
  assert.equal(sha256(source), translationManifest.pages[file], `Source page changed: ${file}`);
  const chinese = await fs.readFile(path.join(chineseContentRoot, file), "utf8");
  assert.match(chinese, /[\u3400-\u9fff]/, `Page has no Simplified Chinese text: ${file}`);
  assert.doesNotMatch(chinese, /<script\b|\bon[a-z]+\s*=/i, `Unsafe localized HTML: ${file}`);
  const urls = (html) => [...html.matchAll(/\b(?:href|src|data-src|data-cookieblock-src)=(['"])(.*?)\1/gi)].map((match) => match[2]);
  assert.deepEqual(urls(chinese), urls(source), `Localized URLs changed: ${file}`);
}

const localizedTitles = chineseManifest.routes.filter((route) => route.title).length;
assert.ok(localizedTitles >= sourceManifest.routes.filter((route) => route.title).length - 1);

function collectLinks(value, links = []) {
  if (Array.isArray(value)) return value.forEach((item) => collectLinks(item, links)), links;
  if (value && typeof value === "object") {
    return Object.entries(value).forEach(([key, child]) => {
      if (key === "href" && typeof child === "string") links.push(child);
      else collectLinks(child, links);
    }), links;
  }
  return links;
}

assert.deepEqual(collectLinks(chineseContent), collectLinks(JSON.parse(sourceContent.toString())), "Homepage URLs changed");

console.log(
  `Validated ${chineseRoutes.length} Chinese routes, ${chineseFiles.size} translated HTML pages, and ${localizedTitles} localized metadata titles.`,
);
