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
const protectedTerms = [
  "LearningSEO.io",
  "Google",
  "Google Analytics",
  "Google Search Console",
  "Google Tag Manager",
  "Search Engine Land",
  "SEOFOMO",
  "Shopify",
  "WordPress",
  "Webflow",
  "Magento",
  "Squarespace",
  "Wix",
  "Bing",
  "Yandex",
  "Baidu",
  "Naver",
  "Amazon",
  "YouTube",
  "TikTok",
  "Reddit",
  "Facebook",
  "Twitter",
  "LinkedIn",
  "Instagram",
  "Moz",
  "SEMrush",
  "Ahrefs",
  "Tweet",
  "Threads",
  "Linkedin",
  "Javascript",
  "GTmetrix",
];
const personNamePattern = /^\p{Lu}[\p{L}'’.-]*(?:\s+\p{Lu}[\p{L}'’.-]*){1,3}$/u;
const singleNamePattern = /^\p{Lu}[\p{L}'’.-]*(?:\s+\p{Lu}[\p{L}'’.-]*){0,3}$/u;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizePath(pathname) {
  const value = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return value === "/" ? "/" : `${value.replace(/\/+$/, "")}/`;
}

function numericFacts(value) {
  const asciiFacts = (value.match(/\b\d[\d,.]*(?:%|[A-Za-z]+)?\b/g) || []).map((number) => {
    const normalized = number.replace(/[A-Za-z]+$/, "").replace(/,/g, "").replace(/\.$/, "");
    const metric = number.match(/([KMB])$/i);
    if (!metric) return normalized;
    return String(Number(normalized) * { k: 1e3, m: 1e6, b: 1e9 }[metric[1].toLowerCase()]);
  });
  const chineseFacts = [];
  for (const match of value.matchAll(/(\d+(?:\.\d+)?)\s*([万亿千百十])/g)) {
    chineseFacts.push(String(Number(match[1]) * { 十: 10, 百: 1e2, 千: 1e3, 万: 1e4, 亿: 1e8 }[match[2]]));
  }
  for (const match of value.matchAll(/第?[零〇一二两三四五六七八九十百千万亿]+/g)) {
    const token = match[0].replace(/^第/, "");
    const isClassifierNumber = /^(个|名|次|位|项|篇|条|种|人|月|年|日|周|届|号|点|岁|家|款|页|步|倍)/.test(
      value.slice(match.index + match[0].length),
    );
    if (!/[十百千万亿]/.test(token) && !match[0].startsWith("第") && !isClassifierNumber) continue;
    const digits = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
    let total = 0;
    let section = 0;
    let current = 0;
    for (const char of token) {
      if (char in digits) {
        current = digits[char];
      } else {
        const unit = { 十: 10, 百: 1e2, 千: 1e3, 万: 1e4, 亿: 1e8 }[char];
        if (unit >= 1e4) {
          section = (section + (current || 0)) * unit;
          total += section;
          section = 0;
        } else {
          section += (current || 1) * unit;
        }
        current = 0;
      }
    }
    chineseFacts.push(String(total + section + current));
  }
  return [...asciiFacts, ...chineseFacts];
}

function numbersPreserved(source, localized) {
  const localizedNumbers = new Set(numericFacts(localized));
  return numericFacts(source).every((number) => {
    if (localizedNumbers.has(number)) return true;
    const ordinal =
      new RegExp(`\\b${number}(?:st|nd|rd|th)\\b`, "i").test(source) ||
      new RegExp(`#\\s*${number}\\b`, "i").test(source);
    return ordinal && /[第首][一二三四五六七八九十百千万\d]+/.test(localized);
  });
}

function personalNames(html) {
  const names = new Set();
  const add = (value) => {
    const normalized = value.replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
    if (personNamePattern.test(normalized)) names.add(normalized);
  };
  for (const match of html.matchAll(
    /<a\b[^>]*\bhref=(['"])(?:https?:\/\/(?:www\.)?linkedin\.com\/in\/|https?:\/\/(?:www\.)?aleydasolis\.com\/)[^'"]*\1[^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    add(match[2].replace(/<[^>]+>/g, " "));
  }
  for (const match of html.matchAll(
    /<a\b[^>]*\bhref=(['"])https?:\/\/(?:www\.)?twitter\.com\/(?!intent(?:\/|$))[^'"]*\1[^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const name = match[2].replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
    if (singleNamePattern.test(name)) names.add(name);
  }
  for (const match of html.matchAll(/<p\b[^>]*>\s*([^<]+?)\s*<\/p>/gi)) add(match[1]);
  for (const paragraph of html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    let cursor = 0;
    let attributionStarted = false;
    for (const strong of paragraph[1].matchAll(/<strong\b[^>]*>([^<]+)<\/strong>/gi)) {
      const between = paragraph[1]
        .slice(cursor, strong.index)
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      const candidate = strong[1].replace(/&nbsp;/gi, " ").split(" / ")[0].trim();
      const startsAttribution = /\b(?:from|by|via)\s*$/i.test(between);
      const continuesAttribution = attributionStarted && /^(?:and|&|,)$/i.test(between);
      if (startsAttribution || continuesAttribution) add(candidate);
      attributionStarted = startsAttribution || continuesAttribution;
      cursor = strong.index + strong[0].length;
    }
  }
  for (const match of html.matchAll(/<strong\b[^>]*>([^<]+)<\/strong>/gi)) {
    const text = match[1].replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
    const context = html.slice(Math.max(0, match.index - 180), match.index);
    add((context.includes("tip-author") || text.includes(" / ")) ? text.split(" / ")[0] : "");
  }
  return [...names];
}

function localizedAttributes(html) {
  return [...html.matchAll(/\b(title|alt|aria-label|placeholder)=(['"])(.*?)\2/gi)].map(
    (match) => ({ name: match[1].toLowerCase(), value: match[3] }),
  );
}

function assertLocalizedAttributes(source, localized, file) {
  const sourceAttributes = localizedAttributes(source);
  const localizedPageAttributes = localizedAttributes(localized);
  assert.equal(
    localizedPageAttributes.length,
    sourceAttributes.length,
    `Localized attribute count changed: ${file}`,
  );
  sourceAttributes.forEach((attribute, index) => {
    const localizedAttribute = localizedPageAttributes[index];
    assert.equal(localizedAttribute.name, attribute.name, `Localized attribute order changed: ${file}`);
    if (!/[A-Za-z]/.test(attribute.value) || attribute.value.startsWith("#")) return;
    if (attribute.value === localizedAttribute.value) {
      assert.ok(
        protectedTerms.some((term) => attribute.value.includes(term)) ||
          personNamePattern.test(attribute.value.replace(/&nbsp;/gi, " ").trim()),
        `Unlocalized first-party attribute: ${file} ${attribute.name}=${attribute.value}`,
      );
    }
    if (/^Play\b/i.test(attribute.value)) {
      assert.match(localizedAttribute.value, /[\u3400-\u9fff]/, `Unlocalized play label: ${file}`);
      assert.doesNotMatch(localizedAttribute.value, /^Play\b/i, `Unlocalized play label: ${file}`);
    }
    protectedTerms.forEach((term) => {
      if (attribute.value.includes(term)) {
        assert.ok(
          localizedAttribute.value.includes(term),
          `Protected attribute term changed: ${file} ${term}`,
        );
      }
    });
  });
}

const sourceManifest = JSON.parse(await fs.readFile(sourceManifestPath, "utf8"));
const chineseManifest = JSON.parse(await fs.readFile(chineseManifestPath, "utf8"));
const translationManifest = JSON.parse(await fs.readFile(translationManifestPath, "utf8"));
const sourceContent = await fs.readFile(sourceContentPath);
const sourceContentJson = JSON.parse(sourceContent.toString());
const chineseContent = JSON.parse(await fs.readFile(path.join(root, "root-8a5edab2", "content.zh-CN.json"), "utf8"));

assert.equal(chineseManifest.locale, "zh-CN");
assert.equal(sha256(sourceContent), translationManifest.sourceContentSha256);
assert.equal(
  sha256(await fs.readFile(path.join(root, "root-8a5edab2", "content.zh-CN.json"))),
  translationManifest.localizedContentSha256,
);
assert.equal(
  sha256(await fs.readFile(sourceManifestPath)),
  translationManifest.sourceManifestSha256,
);
assert.ok(
  translationManifest.segments && Object.keys(translationManifest.segments).length > 0,
  "Translation manifest must contain reusable localized segments",
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
  const chinese = await fs.readFile(path.join(chineseContentRoot, file), "utf8");
  const pageHashes = translationManifest.pages[file];
  const sourceHash = typeof pageHashes === "string" ? pageHashes : pageHashes.sourceSha256;
  const localizedHash = typeof pageHashes === "string" ? null : pageHashes.localizedSha256;
  assert.equal(sha256(source), sourceHash, `Source page changed: ${file}`);
  if (localizedHash) assert.equal(sha256(chinese), localizedHash, `Localized page changed: ${file}`);
  assert.match(chinese, /[\u3400-\u9fff]/, `Page has no Simplified Chinese text: ${file}`);
  assert.doesNotMatch(chinese, /<script\b|\bon[a-z]+\s*=/i, `Unsafe localized HTML: ${file}`);
  assert.doesNotMatch(chinese, /&nbsp;by&nbsp;|>\s*by\s*</i, `Unlocalized attribution: ${file}`);
  assertLocalizedAttributes(source, chinese, file);
  const tags = (html) => [...html.matchAll(/<\/?([a-z][\w-]*)\b/gi)].map((match) => match[1].toLowerCase());
  assert.deepEqual(tags(chinese), tags(source), `Localized HTML tags changed: ${file}`);
  const urls = (html) => [...html.matchAll(/\b(?:href|src|data-src|data-cookieblock-src)=(['"])(.*?)\1/gi)].map((match) => match[2]);
  assert.deepEqual(urls(chinese), urls(source), `Localized URLs changed: ${file}`);
  assert.ok(numbersPreserved(source, chinese), `Localized numbers changed: ${file}`);
  assert.ok(
    protectedTerms.every((term) => !source.includes(term) || chinese.includes(term)),
    `Localized protected terms changed: ${file}`,
  );
  assert.ok(
    personalNames(source).every((name) => chinese.includes(name)),
    `Localized personal names changed: ${file}`,
  );
}

const localizedTitles = chineseManifest.routes.filter((route) => route.title).length;
assert.ok(localizedTitles >= sourceManifest.routes.filter((route) => route.title).length - 1);
for (const [index, route] of chineseManifest.routes.entries()) {
  const sourceRoute = sourceManifest.routes[index];
  for (const field of ["title", "description"]) {
    const value = route[field];
    if (!sourceRoute[field] || !value) continue;
    assert.ok(
      /[\u3400-\u9fff]/.test(value) || protectedTerms.some((term) => value.includes(term)),
      `Unlocalized metadata ${field}: ${route.sourcePath}`,
    );
  }
}

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

function collectHtmlUrls(value, path = "", urls = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectHtmlUrls(item, `${path}[${index}]`, urls));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, child]) =>
      collectHtmlUrls(child, path ? `${path}.${key}` : key, urls),
    );
  } else if (typeof value === "string" && value.includes("<")) {
    for (const match of value.matchAll(
      /\b(?:href|src|data-src|data-cookieblock-src)=(['"])(.*?)\1/gi,
    )) {
      urls.push({ path, value: match[2] });
    }
  }
  return urls;
}

function collectNamedFields(value, fieldName, path = "", fields = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectNamedFields(item, fieldName, `${path}[${index}]`, fields));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, child]) =>
      collectNamedFields(child, fieldName, path ? `${path}.${key}` : key, fields),
    );
  } else if (typeof value === "string" && path.endsWith(`.${fieldName}`)) {
    fields.push({ path, value });
  }
  return fields;
}

function collectPersonalNamesByPath(value, path = "", names = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectPersonalNamesByPath(item, `${path}[${index}]`, names));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, child]) =>
      collectPersonalNamesByPath(child, path ? `${path}.${key}` : key, names),
    );
  } else if (typeof value === "string") {
    personalNames(value).forEach((name) => names.push({ path, name }));
  }
  return names;
}

const localizedHomepageNames = new Map();
for (const { path, name } of collectPersonalNamesByPath(chineseContent)) {
  const names = localizedHomepageNames.get(path) || new Set();
  names.add(name);
  localizedHomepageNames.set(path, names);
}
assert.ok(
  collectPersonalNamesByPath(sourceContentJson).every(({ path, name }) =>
    localizedHomepageNames.get(path)?.has(name),
  ),
  "Homepage personal names changed",
);
const localizedAuthors = new Map(
  collectNamedFields(chineseContent, "author").map(({ path, value }) => [path, value]),
);
assert.ok(
  collectNamedFields(sourceContentJson, "author").every(
    ({ path, value }) => localizedAuthors.get(path) === value,
  ),
  "Homepage author names changed",
);

assert.deepEqual(
  collectHtmlUrls(chineseContent),
  collectHtmlUrls(sourceContentJson),
  "Homepage embedded HTML URLs changed",
);

assert.deepEqual(collectLinks(chineseContent), collectLinks(sourceContentJson), "Homepage URLs changed");
assert.doesNotMatch(
  chineseContent.footer.copyrightHtml,
  /Copyright © \d+\. All rights reserved\.|\bby\b/i,
  "Homepage footer contains untranslated copy",
);

console.log(
  `Validated ${chineseRoutes.length} Chinese routes, ${chineseFiles.size} translated HTML pages, and ${localizedTitles} localized metadata titles.`,
);
