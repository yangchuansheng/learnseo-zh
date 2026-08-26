import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve("src/components/sites/learningseo-io-071dae18");
const rootContentPath = path.join(root, "root-8a5edab2", "content.json");
const chineseContentPath = path.join(root, "root-8a5edab2", "content.zh-CN.json");
const generatedRoot = path.join(root, "subpages", "generated");
const englishContentRoot = path.join(generatedRoot, "content");
const chineseContentRoot = path.join(generatedRoot, "content-zh-CN");
const englishManifestPath = path.join(generatedRoot, "manifest.json");
const chineseManifestPath = path.join(generatedRoot, "manifest.zh-CN.json");
const cachePath = path.resolve("temp/learningseo-translation-cache.json");
const trustedCachePath = path.resolve("temp/learningseo-translation-cache-google.json");
const translationManifestPath = path.join(generatedRoot, "translation-manifest.json");

const skipKeys = new Set([
  "source",
  "extractedAt",
  "href",
  "id",
  "icon",
  "embed",
  "share",
  "x",
  "threads",
  "linkedIn",
]);
const nonTranslatableValue = /^(?:https?:|\/|#|\d+(?:\.\d+)?$)/i;

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

const protectedPeople = new Set(["Aleyda Solis"]);
const personNamePattern = /^\p{Lu}[\p{L}'’.-]*(?:\s+\p{Lu}[\p{L}'’.-]*){1,3}$/u;
const singleNamePattern = /^\p{Lu}[\p{L}'’.-]*(?:\s+\p{Lu}[\p{L}'’.-]*){0,3}$/u;

function collectProtectedPeople(markup) {
  const profileAnchorPattern =
    /<a\b[^>]*\bhref=(['"])(?:https?:\/\/(?:www\.)?linkedin\.com\/in\/|https?:\/\/(?:www\.)?aleydasolis\.com\/)[^'"]*\1[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of markup.matchAll(profileAnchorPattern)) {
    const text = normalizeText(match[2].replace(/<[^>]+>/g, ""));
    if (personNamePattern.test(text)) protectedPeople.add(text);
  }
  for (const match of markup.matchAll(
    /<a\b[^>]*\bhref=(['"])https?:\/\/(?:www\.)?twitter\.com\/(?!intent(?:\/|$))[^'"]*\1[^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const text = normalizeText(match[2].replace(/<[^>]+>/g, ""));
    if (singleNamePattern.test(text)) protectedPeople.add(text);
  }
  for (const match of markup.matchAll(/<p\b[^>]*>\s*([^<]+?)\s*<\/p>/gi)) {
    const text = normalizeText(match[1]);
    if (personNamePattern.test(text)) protectedPeople.add(text);
  }
  for (const paragraph of markup.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    let cursor = 0;
    let attributionStarted = false;
    for (const strong of paragraph[1].matchAll(/<strong\b[^>]*>([^<]+)<\/strong>/gi)) {
      const between = normalizeText(
        paragraph[1].slice(cursor, strong.index).replace(/<[^>]+>/g, " "),
      );
      const candidate = normalizeText(strong[1]).split(" / ")[0].trim();
      const startsAttribution = /\b(?:from|by|via)\s*$/i.test(between);
      const continuesAttribution = attributionStarted && /^(?:and|&|,)$/i.test(between);
      if ((startsAttribution || continuesAttribution) && personNamePattern.test(candidate)) {
        protectedPeople.add(candidate);
      }
      attributionStarted = startsAttribution || continuesAttribution;
      cursor = strong.index + strong[0].length;
    }
  }
  for (const match of markup.matchAll(/<strong\b[^>]*>([^<]+)<\/strong>/gi)) {
    const text = normalizeText(match[1]);
    const context = markup.slice(Math.max(0, match.index - 180), match.index);
    const author = text.split(" / ")[0].trim();
    if ((context.includes("tip-author") || text.includes(" / ")) && personNamePattern.test(author)) {
      protectedPeople.add(author);
    }
  }
}

function escapedRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function preserveProfileAnchorNames(sourceMarkup, localizedMarkup) {
  const profileAnchorPattern =
    /<a\b[^>]*\bhref=(['"])((?:https?:\/\/(?:www\.)?linkedin\.com\/in\/|https?:\/\/(?:www\.)?aleydasolis\.com\/)[^'"]*)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let preserved = localizedMarkup;
  for (const match of sourceMarkup.matchAll(profileAnchorPattern)) {
    const name = normalizeText(match[3].replace(/<[^>]+>/g, ""));
    if (!protectedPeople.has(name) || !personNamePattern.test(name)) continue;
    const href = escapedRegExp(match[2]);
    const target = new RegExp(
      `(<a\\b[^>]*\\bhref=(['"])${href}\\2[^>]*>)[\\s\\S]*?(</a>)`,
      "i",
    );
    preserved = preserved.replace(target, `$1${match[3]}$3`);
  }
  return preserved;
}

function preserveNamedStrongText(sourceMarkup, localizedMarkup) {
  const sourceNames = [...sourceMarkup.matchAll(/<strong\b[^>]*>([^<]+)<\/strong>/gi)]
    .map((match) => normalizeText(match[1]))
    .map((value) => (protectedPeople.has(value) ? value : null));
  if (!sourceNames.some(Boolean)) return localizedMarkup;
  let index = 0;
  return localizedMarkup.replace(
    /(<strong\b[^>]*>)([^<]*)(<\/strong>)/gi,
    (match, open, _text, close) => {
      const name = sourceNames[index++];
      return name ? `${open}${name}${close}` : match;
    },
  );
}

function preserveStandaloneNames(sourceMarkup, localizedMarkup) {
  const sourceParagraphs = [...sourceMarkup.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)];
  if (!sourceParagraphs.some((match) => personNamePattern.test(normalizeText(match[1])))) {
    return localizedMarkup;
  }
  let index = 0;
  return localizedMarkup.replace(
    /(<p\b[^>]*>)([\s\S]*?)(<\/p>)/gi,
    (match, open, _inner, close) => {
      const sourceInner = sourceParagraphs[index++]?.[1] || "";
      const candidate = normalizeText(sourceInner);
      if (!personNamePattern.test(candidate) || /</.test(sourceInner)) return match;
      const whitespace = sourceInner.match(/^(\s*)[\s\S]*?(\s*)$/);
      return `${open}${whitespace?.[1] || ""}${candidate}${whitespace?.[2] || ""}${close}`;
    },
  );
}

function normalizeLocalizedMarkup(markup, sourceMarkup = "") {
  const normalized = markup.replace(/[ \t]+$/gm, "");
  if (!sourceMarkup) return normalized;
  const preserved = preserveNamedStrongText(
    sourceMarkup,
    preserveProfileAnchorNames(sourceMarkup, normalized),
  );
  return preserveStandaloneNames(sourceMarkup, preserved).replace(/[ \t]+$/gm, "");
}

function normalizeLocalizedJson(value, source, fieldKey = "") {
  if (Array.isArray(value) && Array.isArray(source)) {
    return value.map((item, index) => normalizeLocalizedJson(item, source[index], fieldKey));
  }
  if (value && typeof value === "object" && source && typeof source === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, child]) => [
        childKey,
        normalizeLocalizedJson(child, source[childKey], childKey),
      ]),
    );
  }
  if (fieldKey === "author" && typeof source === "string") return source;
  if (typeof value === "string" && typeof source === "string" && source.includes("<")) {
    return normalizeLocalizedMarkup(value, source);
  }
  return value;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function shouldTranslate(value) {
  const normalized = normalizeText(value);
  return normalized.length > 0 && /[A-Za-z]/.test(normalized) && !nonTranslatableValue.test(normalized);
}

function splitText(value) {
  const normalized = normalizeText(value);
  if (!shouldTranslate(normalized)) return [];
  if (normalized.length <= 450) return [normalized];

  const chunks = [];
  let remainder = normalized;
  while (remainder.length > 450) {
    const boundary = Math.max(
      remainder.lastIndexOf(". ", 450),
      remainder.lastIndexOf("? ", 450),
      remainder.lastIndexOf("! ", 450),
      remainder.lastIndexOf(", ", 450),
      remainder.lastIndexOf(" ", 450),
    );
    const cut = boundary > 120 ? boundary + 1 : 450;
    chunks.push(remainder.slice(0, cut).trim());
    remainder = remainder.slice(cut).trim();
  }
  if (remainder) chunks.push(remainder);
  return chunks;
}

function collectMarkupStrings(markup, strings) {
  collectProtectedPeople(markup);
  for (const match of markup.matchAll(/>([^<]+)</g)) {
    for (const part of splitText(match[1])) strings.add(part);
  }
  for (const match of markup.matchAll(/\b(?:title|alt|aria-label|placeholder)=(['"])(.*?)\1/gi)) {
    for (const part of splitText(match[2])) strings.add(part);
  }
}

function collectJsonStrings(value, strings, key = "") {
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonStrings(item, strings, key));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([childKey, child]) => {
      if (!skipKeys.has(childKey)) collectJsonStrings(child, strings, childKey);
    });
    return;
  }
  if (typeof value !== "string" || skipKeys.has(key)) return;
  if (key === "author") protectedPeople.add(normalizeText(value));
  if (value.includes("<")) collectMarkupStrings(value, strings);
  else splitText(value).forEach((part) => strings.add(part));
}

async function readCache() {
  try {
    return JSON.parse(await fs.readFile(cachePath, "utf8"));
  } catch {
    return {};
  }
}

async function writeCache(cache) {
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2) + "\n");
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function readTrustedCache() {
  return (await readJsonIfExists(trustedCachePath)) || {};
}

async function translateBatch(batch) {
  const query = batch.join("\n");
  const url =
    "https://api.mymemory.translated.net/get?q=" +
    encodeURIComponent(query) +
    "&langpair=en|zh-CN";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (response.ok && data.responseStatus === 200) {
        const translated = String(data.responseData.translatedText || "").split("\n");
        if (translated.length === batch.length) return translated;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  return batch;
}

async function translateStrings(strings) {
  const cache = await readCache();
  const pending = [...strings].filter((value) => !cache[value]);
  let completed = 0;

  for (let index = 0; index < pending.length; index += 40) {
    const batches = [];
    for (let offset = index; offset < Math.min(index + 40, pending.length); offset += 5) {
      batches.push(pending.slice(offset, offset + 5));
    }
    const results = await Promise.all(batches.map(translateBatch));
    results.forEach((translated, batchIndex) => {
      batches[batchIndex].forEach((source, itemIndex) => {
        cache[source] = translated[itemIndex] || source;
      });
    });
    completed += results.reduce((count, batch) => count + batch.length, 0);
    console.log(`Translated ${completed}/${pending.length} strings`);
    await writeCache(cache);
  }
  await writeCache(cache);
  return cache;
}

function translateText(value, cache, previousSegments = {}) {
  const leading = value.match(/^\s*/)?.[0] || "";
  const trailing = value.match(/\s*$/)?.[0] || "";
  const normalized = normalizeText(value);
  if (!shouldTranslate(normalized)) return value;
  const translated =
    previousSegments[normalized] ||
    splitText(normalized)
      .map((part) => previousSegments[part] || cache[part] || part)
      .join(" ");
  const restored = preserveProperNames(normalized, restoreProtectedTerms(normalized, translated));
  if (!preservesSourceFacts(normalized, restored)) return value;
  return leading + restored + trailing;
}

const protectedBrands = [
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

const protectedBrandAliases = new Map([
  ["Google Search Console", ["谷歌搜索控制台", "谷歌 搜索控制台", "Google 搜索控制台"]],
  [
    "Google Tag Manager",
    [
      "谷歌标签管理器",
      "谷歌 标签管理器",
      "Google 标签管理器",
      "谷歌跟踪代码管理器",
      "谷歌 跟踪代码管理器",
      "Google 跟踪代码管理器",
    ],
  ],
  ["Google Analytics", ["谷歌分析", "谷歌 分析", "Google 分析"]],
  ["Google", ["谷歌"]],
  ["Shopify", ["购物"]],
  ["Baidu", ["百度"]],
  ["Amazon", ["亚马逊"]],
  ["Yandex", ["扬德克斯"]],
  ["Naver", ["纳维尔"]],
  ["Facebook", ["脸书"]],
  ["Twitter", ["推特"]],
  ["LinkedIn", ["领英"]],
  ["Instagram", ["照片墙"]],
  ["Moz", ["莫兹"]],
  ["SEMrush", ["赛普"]],
  ["Ahrefs", ["阿雷夫斯"]],
  ["Tweet", ["鸣叫"]],
  ["Threads", ["线程数"]],
  ["Linkedin", ["领英"]],
  ["Javascript", ["JavaScript"]],
]);

function restoreProtectedTerms(source, translated) {
  let restored = translated.replace(/[\u200B-\u200D\uFEFF]/g, "");
  for (const [brand, aliases] of [...protectedBrandAliases].sort(
    (left, right) => right[0].length - left[0].length,
  )) {
    if (!source.includes(brand)) continue;
    aliases.forEach((alias) => {
      restored = restored.split(alias).join(brand);
    });
  }
  return restored;
}

function preserveProperNames(source, translated) {
  let preserved = translated;
  for (const match of source.matchAll(/\b(?:from|by|with|via)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){1,3})/g)) {
    const firstNamePart = match[1].split(/\s+/)[0];
    if (
      protectedBrands.includes(firstNamePart) ||
      ["A", "An", "The", "Learning"].includes(firstNamePart) ||
      preserved.includes(match[1])
    ) {
      continue;
    }
    preserved = `${preserved}（${match[1]}）`;
  }
  return preserved;
}

function preservesSourceFacts(source, translated) {
  translated = restoreProtectedTerms(source, translated);
  const sourceNumbers = numericFacts(source);
  const translatedNumbers = new Set(numericFacts(translated));
  if (
    sourceNumbers.some((number) => {
      if (translatedNumbers.has(number)) return false;
      const ordinal =
        new RegExp(`\\b${number}(?:st|nd|rd|th)\\b`, "i").test(source) ||
        new RegExp(`#\\s*${number}\\b`, "i").test(source);
      return !ordinal || !/[第首][一二三四五六七八九十百千万\d]+/.test(translated);
    })
  ) {
    return false;
  }
  if (protectedBrands.some((brand) => source.includes(brand) && !translated.includes(brand))) {
    return false;
  }
  if ([...protectedPeople].some((person) => source.includes(person) && !translated.includes(person))) {
    return false;
  }
  for (const match of source.matchAll(/\b(?:from|by|with|via)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){1,3})/g)) {
    const firstNamePart = match[1].split(/\s+/)[0];
    if (protectedBrands.includes(firstNamePart) || ["A", "An", "The", "Learning"].includes(firstNamePart)) {
      continue;
    }
    if (!translated.includes(match[1])) return false;
  }
  return true;
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

const markupPhraseTranslations = new Map([
  ["Home", "首页"],
  ["Roadmap", "路线图"],
  ["Learn More", "了解更多"],
  ["Learn More About", "了解更多关于"],
  ["Guide", "指南"],
  ["Guides", "指南"],
  ["Video", "视频"],
  ["Course", "课程"],
  ["Webinar", "网络研讨会"],
  ["Presentation", "演示"],
  ["Coverage", "报道"],
  ["Case Study", "案例研究"],
  ["Checklist", "清单"],
  ["Interview", "访谈"],
  ["Study", "研究"],
  ["Template", "模板"],
  ["Podcast", "播客"],
  ["Article", "文章"],
  ["Newsletter", "通讯"],
  ["Online Event", "线上活动"],
  ["Subscribe to our Email alerts", "订阅邮件提醒"],
  ["Privacy Policy", "隐私政策"],
  ["Terms of Use", "使用条款"],
  ["Deepen your SEO Knowledge", "加深你的 SEO 知识"],
  ["Deepen Your SEO Knowledge", "加深你的 SEO 知识"],
  ["Current", "当前"],
  ["YouTube video player", "YouTube 视频播放器"],
  ["reach Aleyda here", "在这里联系 Aleyda"],
  ["by", "来自"],
]);

function translateMarkupText(value, cache, preserveStrong = false, previousSegments = {}) {
  const leading = value.match(/^\s*/)?.[0] || "";
  const trailing = value.match(/\s*$/)?.[0] || "";
  const normalized = normalizeText(value);
  if (!shouldTranslate(normalized)) return value;
  const direct = markupPhraseTranslations.get(normalized);
  if (direct) return leading + direct + trailing;
  const preserved = previousSegments[normalized];
  if (preserved && preserved !== normalized && preservesSourceFacts(normalized, preserved)) {
    return leading + preserved + trailing;
  }
  if (preserveStrong) return value;
  const translatedParts = splitText(normalized).map((part) => {
    const cachedPart = previousSegments[part] || cache[part];
    const restoredPart = cachedPart
      ? preserveProperNames(part, restoreProtectedTerms(part, cachedPart))
      : cachedPart;
    if (
      !restoredPart ||
      restoredPart === part ||
      !/[\u3400-\u9fff]/.test(restoredPart) ||
      !preservesSourceFacts(part, restoredPart)
    ) {
      return part;
    }
    return escapeTranslatedText(restoredPart);
  });
  const translated = preserveProperNames(normalized, translatedParts.join(" "));
  if (
    translated !== normalized &&
    /[\u3400-\u9fff]/.test(translated) &&
    preservesSourceFacts(normalized, translated)
  ) {
    return leading + translated + trailing;
  }
  const cached = previousSegments[normalized] || cache[normalized];
  const restoredCached = cached
    ? preserveProperNames(normalized, restoreProtectedTerms(normalized, cached))
    : cached;
  if (
    restoredCached &&
    restoredCached !== normalized &&
    /[\u3400-\u9fff]/.test(restoredCached) &&
    preservesSourceFacts(normalized, restoredCached)
  ) {
    return leading + escapeTranslatedText(restoredCached) + trailing;
  }
  if (protectedBrands.some((brand) => normalized.includes(brand))) return value;
  if (normalized.length <= 120) {
    const candidate = editorialRouteTitle(normalized);
    if (candidate !== normalized && /[\u3400-\u9fff]/.test(candidate)) {
      return leading + candidate + trailing;
    }
  }
  return value;
}

function escapeTranslatedText(value) {
  return value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function shouldPreserveStrongText(value, context) {
  const normalized = normalizeText(value).replace(/&nbsp;/gi, " ").trim();
  if (!normalized) return true;
  if (protectedPeople.has(normalized)) return true;
  if (protectedBrands.includes(normalized) || normalized.includes(" / ")) return true;
  const surrounding = context.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").trim();
  if (/\b(?:from|by)\s*$/i.test(surrounding)) return true;
  return context.includes(`title="${normalized}"`) || context.includes(`title='${normalized}'`);
}

function translateMarkup(markup, cache, previousSegments = {}) {
  let translated = markup.replace(
    /(<strong\b[^>]*>)([^<]*)(<\/strong>)|(?<=>)([^<]+)(?=<)/gi,
    (_match, open, strongText, close, text, offset, sourceMarkup) =>
      open
        ? `${open}${translateMarkupText(
            strongText,
            cache,
            shouldPreserveStrongText(strongText, sourceMarkup.slice(Math.max(0, offset - 120), offset)),
            previousSegments,
          )}${close}`
        : translateMarkupText(text, cache, false, previousSegments),
  );
  translated = translated.replace(
    /\b(title|alt|aria-label|placeholder)=(['"])(.*?)\2/gi,
    (_match, attribute, quote, value) =>
      `${attribute}=${quote}${translateAttributeText(attribute, value, cache, previousSegments)}${quote}`,
  );
  return normalizeLocalizedMarkup(translated, markup);
}

function translateAttributeText(attribute, value, cache, previousSegments = {}) {
  const normalized = normalizeText(value);
  if (
    attribute.toLowerCase() === "title" &&
    (protectedPeople.has(normalized) || protectedBrands.includes(normalized))
  ) {
    return value;
  }
  const translated = translateMarkupText(value, cache, false, previousSegments);
  return attribute.toLowerCase() === "aria-label"
    ? translated.replace(/^Play\b/i, "播放")
    : translated;
}

function translateJson(value, cache, key = "", previousSegments = {}) {
  if (Array.isArray(value)) {
    return value.map((item) => translateJson(item, cache, key, previousSegments));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, child]) => [
        childKey,
        skipKeys.has(childKey)
          ? child
          : translateJson(child, cache, childKey, previousSegments),
      ]),
    );
  }
  if (typeof value !== "string" || skipKeys.has(key)) return value;
  return value.includes("<")
    ? translateMarkup(value, cache, previousSegments)
    : translateText(value, cache, previousSegments);
}

const routeTitlePhrases = [
  ["Why my Page Doesn't Rank [Better or At All] in Google?", "为什么我的页面在 Google 中排名不佳（或没有排名）？"],
  ["The Great Decoupling", "大解耦"],
  ["Zero Click Search Era", "零点击搜索时代"],
  ["The Top", "顶级"],
  ["Predictions", "预测"],
  ["Trends", "趋势"],
  ["To Win", "获胜"],
  ["Landscape", "全景"],
  ["Platforms", "平台"],
  ["Optimize", "优化"],
  ["Reliable", "可靠的"],
  ["Free", "免费"],
  ["Learn", "学习"],
  ["Further", "进阶"],
  ["further", "进阶"],
  ["Do a", "进行"],
  ["New Web Launch", "新网站发布"],
  ["Web Migrations", "网站迁移"],
  ["Web Redesigns", "网站改版"],
  ["Black Friday, Cyber Monday and Holiday Season Deals", "黑色星期五、网络星期一与节日促销"],
  ["Search News", "搜索新闻"],
  ["Online Events", "线上活动"],
  ["Small Business", "小型企业"],
  ["International", "国际"],
  ["Local", "本地"],
  ["Enterprise", "企业"],
  ["Travel", "旅游"],
  ["News", "新闻"],
  ["Publications", "出版物"],
  ["Courses", "课程"],
  ["Training", "培训"],
  ["Scenarios", "场景"],
  ["Opportunities", "机会"],
  ["Content", "内容"],
  ["Technical", "技术"],
  ["Advanced", "进阶"],
  ["Fundamentals", "基础知识"],
  ["Process", "流程"],
  ["Tasks", "任务"],
  ["Machine Learning", "机器学习"],
  ["Search Visibility", "搜索可见度"],
  ["AI Search", "AI 搜索"],
  ["Google Search", "Google 搜索"],
  ["Core Updates", "核心更新"],
  ["Duplicate Content", "重复内容"],
  ["Canonicalization", "规范化"],
  ["Negative SEO", "负面 SEO"],
  ["Branding", "品牌建设"],
  ["Rank Tracking", "排名跟踪"],
  ["Dashboard", "仪表盘"],
  ["Reporting Tools", "报告工具"],
  ["Forecasting", "预测"],
  ["Mobile", "移动端"],
  ["Wordpress", "WordPress"],
  ["Javascript", "JavaScript"],
  ["Youtube", "YouTube"],
  ["App Store", "应用商店"],
  ["Google Analytics", "Google Analytics"],
  ["Google Tag Manager", "Google Tag Manager"],
  ["Google Search Console", "Google Search Console"],
  ["BigQuery", "BigQuery"],
  ["SQL", "SQL"],
  ["E-commerce", "电子商务"],
  ["App Store Optimization", "应用商店优化"],
  ["Search News Publications", "搜索新闻出版物"],
  ["Search News Aggregators", "搜索新闻聚合器"],
  ["Search Engines Official Publications", "搜索引擎官方出版物"],
  ["Link Building", "链接建设"],
  ["Keyword Research", "关键词研究"],
  ["Competition Analysis", "竞争分析"],
  ["Content Optimization", "内容优化"],
  ["Technical Optimization", "技术优化"],
  ["Web Speed Optimization", "网站速度优化"],
  ["Structured Data", "结构化数据"],
  ["Internal Links", "内部链接"],
  ["SEO Guidelines", "SEO 指南"],
  ["SEO Tools", "SEO 工具"],
  ["SEO Myths", "SEO 误区"],
  ["SEO Jobs", "SEO 工作"],
  ["SEO Podcasts", "SEO 播客"],
  ["SEO Newsletters", "SEO 通讯"],
  ["SEO Roadmap", "SEO 路线图"],
  ["Free Reliable", "免费可靠的"],
  ["Free Guides", "免费指南"],
  ["Free Tools", "免费工具"],
  ["Reliable Guides", "可靠指南"],
  ["Guidelines", "指南"],
  ["Guides", "指南"],
  ["Tools", "工具"],
  ["Tips", "技巧"],
  ["Analysis", "分析"],
  ["Optimization", "优化"],
  ["Management", "管理"],
  ["Measuring", "衡量"],
  ["Reporting", "报告"],
  ["Monitoring", "监测"],
  ["Learn How to", "学习如何"],
  ["Learn To", "学习如何"],
  ["Learn to", "学习如何"],
  ["Learn about", "了解"],
  ["Learn SEO", "学习 SEO"],
  ["Automate", "自动化"],
  ["Developing", "开发"],
  ["Building", "构建"],
  ["Creating", "创建"],
  ["Start an", "开始"],
  ["Keep up with", "及时了解"],
  ["Deepen Your", "加深你的"],
  ["Complement your", "补充你的"],
  ["Specialize Within", "专注于"],
  ["Other Search Engines", "其他搜索引擎"],
  ["with", "与"],
  ["and", "与"],
  ["for", "用于"],
  ["your", "你的"],
  ["SEO", "SEO"],
];

function editorialRouteTitle(title) {
  const exact = {
    "Learn SEO with a Free Roadmap of Reliable Guides & Tools": "用免费可靠的指南和工具学习 SEO",
    "Privacy Policy & Terms of Use - LearningSEO.io": "隐私政策与使用条款 - LearningSEO.io",
    "Subscribe to our Email alerts - LearningSEO.io": "订阅邮件提醒 - LearningSEO.io",
    "About LearningSEO.io": "关于 LearningSEO.io",
  };
  if (exact[title]) return exact[title];
  const brand = title.match(/\s+-\s+LearningSEO\.io$/) ? " - LearningSEO.io" : "";
  let core = title.replace(/\s+-\s+LearningSEO\.io$/, "");
  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const [source, target] of [...routeTitlePhrases].sort((left, right) => right[0].length - left[0].length)) {
    core = core.replace(new RegExp(`\\b${escapeRegExp(source)}\\b`, "g"), target);
  }
  return `${core}${brand}`;
}

const routeTitleOverrides = new Map([
  ["/seo_roadmap/complement-knowledge/google-analytics/", "Google Analytics - LearningSEO.io"],
  ["/seo_roadmap/seo-tools/wordpress-seo-plugins/", "WordPress SEO 插件 - LearningSEO.io"],
  [
    "/seo_roadmap/seo-tools/google-search-console-guidelines/",
    "Google Search Console 指南 - LearningSEO.io",
  ],
  [
    "/seo_roadmap/keep-up-with-news/search-engine-official-publications/",
    "及时了解 SEO 新闻与搜索引擎官方出版物",
  ],
  [
    "/seo_roadmap/deepen-knowledge/management/communication-with-seo-stakeholders/",
    "与 SEO 利益相关者沟通 - LearningSEO.io",
  ],
  ["/seo_roadmap/complement-knowledge/google-tag-manager/", "Google Tag Manager - LearningSEO.io"],
  [
    "/seo_roadmap/automate-tasks/chatgpt-for-seo/",
    "使用 AI、LLM 与聊天机器人自动化 SEO 任务",
  ],
  ["/seo_roadmap/execute-seo/establishing-an-seo-strategy/", "如何制定 SEO 策略"],
  [
    "/seo_roadmap/implement-in-cms/wordpress-seo-guidelines/",
    "WordPress SEO 指南、技巧与工具",
  ],
  ["/seo_roadmap/deepen-knowledge/content/structured-data/", "如何使用结构化数据优化 SEO"],
  [
    "/seo_roadmap/train-test-troubleshoot-your-seo-further/the-learningseo-accelerator/",
    "Learning SEO 加速器：免费问答与 SEO 专家",
  ],
  ["/seo_roadmap/execute-seo/setting-seo-goals/", "如何设定 SEO 目标：免费指南、课程与技巧"],
  ["/seo_roadmap/execute-seo/seo-buy-in/", "如何获得 SEO 支持"],
  ["/seo_roadmap/optimize-ai-search/ai-search-landscape/", "AI 搜索全景"],
  [
    "/seo_roadmap/optimize-ai-search/ai-search-technical-optimization/",
    "AI 搜索技术优化：配置网站技术",
  ],
  ["/seo_roadmap/optimize-ai-search/measuring-ai-search/", "衡量 AI 搜索可见度与流量"],
  ["/seo_roadmap/optimize-ai-search/ai-search-content-optimization/", "AI 搜索内容优化"],
  ["/seo_roadmap/optimize-ai-search/fundamentals-ai-search-optimization/", "AI 搜索优化基础知识"],
  ["/seo_roadmap/optimize-ai-search/tools/", "AI 搜索跟踪与优化工具"],
  ["/seo_roadmap/deepen-knowledge/content/programmatic-seo/", "程序化 SEO 与 Learning SEO"],
  ["/seo_roadmap/deepen-knowledge/content/quality-eeat/", "内容质量与 EEAT：SEO 指南"],
  ["/seo_roadmap/deepen-knowledge/content/content-pruning/", "如何在 SEO 流程中进行内容精简"],
  [
    "/seo_roadmap/deepen-knowledge/content/avoiding-duplicate-content/",
    "避免并修复重复内容与规范化问题",
  ],
  ["/seo_roadmap/deepen-knowledge/advanced-technical/robots-txt-optimization/", "robots.txt 优化 - LearningSEO.io"],
  ["/seo_roadmap/deepen-knowledge/advanced-technical/internal-linking/", "如何优化 SEO 内部链接"],
  [
    "/seo_roadmap/deepen-knowledge/scenarios/google-core-updates-recovery/",
    "如何从 Google 搜索核心更新中恢复",
  ],
  ["/seo_roadmap/complement-knowledge/", "补充 SEO 知识：免费指南与资源"],
  ["/seo_roadmap/deepen-knowledge/", "加深 SEO 知识：可靠免费指南"],
  ["/seo_roadmap/execute-seo/", "如何执行 SEO 流程：免费可靠指南与工具"],
  ["/seo_roadmap/implement-in-cms/", "如何实施 SEO：CMS 免费指南、技巧与工具"],
  [
    "/seo_roadmap/keep-up-with-news/",
    "及时了解 SEO 新闻：免费出版物、通讯与播客",
  ],
  ["/seo_roadmap/other-search-engines/", "其他搜索引擎 SEO 指南"],
  ["/seo_roadmap/seo-tools/", "最佳免费 SEO 工具与使用技巧"],
  [
    "/seo_roadmap/train-test-troubleshoot-your-seo-further/",
    "训练、测试与排查 SEO 问题",
  ],
  ["/seo_roadmap/automate-tasks/machine-learning-seo/", "如何使用机器学习自动化 SEO"],
  ["/seo_roadmap/deepen-knowledge/management/seo-forecasting/", "如何创建 SEO 预测：可靠资源"],
  [
    "/seo_roadmap/deepen-knowledge/scenarios/detect-protect-from-negative-seo/",
    "检测并防止负面 SEO - LearningSEO.io",
  ],
  [
    "/seo_roadmap/train-test-troubleshoot-your-seo-further/why-my-page-doesnt-rank/",
    "为什么我的页面在 Google 中排名不佳（或没有排名）？",
  ],
  ["/seo_roadmap/deepen-knowledge/opportunities/", "如何发现进阶 SEO 机会：免费指南与工具"],
  [
    "/seo_roadmap/deepen-knowledge/scenarios/optimizing-faceted-navigation/",
    "如何优化分面导航：免费 SEO 指南",
  ],
  [
    "/seo_roadmap/train-test-troubleshoot-your-seo-further/online-seo-courses/",
    "免费可靠的 SEO 在线课程与培训",
  ],
  ["/seo_roadmap/execute-seo/seo-measurement/", "如何衡量 SEO：免费指南、工具与技巧"],
  ["/seo_roadmap/implement-in-cms/shopify-seo-guidelines/", "Shopify SEO 指南、技巧与工具"],
  [
    "/seo_roadmap/execute-seo/seo-audits-recommendations/",
    "如何制定 SEO 审计方案：免费指南、模板与工具",
  ],
  ["/seo_roadmap/execute-seo/seo-reporting/", "如何报告 SEO：免费指南、工具与技巧"],
  [
    "/seo_roadmap/deepen-knowledge/scenarios/ranking-drop-analysis/",
    "如何分析 Google 搜索排名下降",
  ],
  [
    "/seo_roadmap/train-test-troubleshoot-your-seo-further/free-seo-tests-quizzes/",
    "免费 SEO 测试与测验：评估你的知识",
  ],
  [
    "/seo_roadmap/other-search-engines/reddit-seo-guidelines/",
    "如何使用 Reddit 做 SEO：免费指南与技巧",
  ],
  [
    "/seo_roadmap/deepen-knowledge/scenarios/seo-branding/",
    "SEO 品牌建设：如何提升 SERP 中的品牌",
  ],
  ["/seo_roadmap/deepen-knowledge/opportunities/google-ai-overviews/", "Google AIO、AI 模式与 LLM 优化"],
  ["/seo_roadmap/automate-tasks/r-for-seo/", "使用 R 自动化 SEO 任务：可靠的免费指南"],
  [
    "/seo_roadmap/deepen-knowledge/scenarios/seo-predictions-trends-tips/",
    "2025 年顶级 SEO 预测、趋势与制胜技巧",
  ],
  ["/seo_roadmap/deepen-knowledge/scenarios/great-decoupling/", "大解耦与零点击搜索时代的优化"],
  ["/seo_roadmap/deepen-knowledge/scenarios/", "如何在 SEO 场景中进行优化：免费可靠指南"],
  ["/seo_roadmap/automate-tasks/", "SEO 任务自动化：免费指南与工具"],
  ["/seo_roadmap/deepen-knowledge/content/", "进阶内容优化：免费可靠指南"],
  ["/seo_roadmap/deepen-knowledge/backlinks/", "进阶链接建设：免费可靠指南"],
  [
    "/seo_roadmap/deepen-knowledge/advanced-technical/",
    "进阶技术 SEO：免费可靠指南与工具",
  ],
  ["/seo_roadmap/deepen-knowledge/management/", "进阶 SEO 管理：免费可靠指南与工具"],
  ["/seo_roadmap/specialize/", "SEO 专项：免费可靠指南与工具"],
  ["/seo_roadmap/seo-fundamentals/", "SEO 基础知识：免费可靠指南、技巧与工具"],
  [
    "/seo_roadmap/seo-fundamentals/introduction-to-seo/",
    "SEO 基础知识：免费可靠指南、技巧与工具 - LearningSEO.io",
  ],
  [
    "/seo_roadmap/seo-fundamentals/keyword-research/",
    "如何进行关键词研究：SEO 免费指南与工具",
  ],
  [
    "/seo_roadmap/seo-fundamentals/competition-analysis/",
    "如何进行竞争分析：SEO 免费指南与工具",
  ],
  ["/seo_roadmap/seo-fundamentals/content-optimization/", "内容优化：免费指南、课程、工具与技巧"],
  ["/seo_roadmap/seo-fundamentals/link-building/", "链接建设：免费指南、工具与技巧"],
  ["/seo_roadmap/seo-fundamentals/technical-seo/", "技术 SEO：可靠的免费指南与技巧"],
  ["/seo_roadmap/execute-seo/seo-process-management/", "SEO 流程管理 - LearningSEO.io"],
  ["/seo_roadmap/seo-tools/seo-audit-templates/", "SEO 审计模板 - LearningSEO.io"],
  [
    "/seo_roadmap/deepen-knowledge/management/seo-product-management/",
    "SEO 产品管理 - LearningSEO.io",
  ],
  [
    "/seo_roadmap/optimize-ai-search/",
    "AI 搜索平台优化（GEO、AEO、LLMO）",
  ],
]);

function localizedRouteTitle(route, cache, previousSegments = {}) {
  const override = routeTitleOverrides.get(route.sourcePath);
  if (override) return override;
  const preserved = previousSegments[normalizeText(route.title)];
  if (preserved && preserved !== normalizeText(route.title)) return preserved;
  const title = route.title;
  const suffix = /\s+-\s+LearningSEO\.io$/.test(title) ? " - LearningSEO.io" : "";
  const core = title.replace(/\s+-\s+LearningSEO\.io$/, "");
  const translated = translateMarkupText(core, cache).trim();
  if (translated !== core && /[\u3400-\u9fff]/.test(translated)) {
    return `${translated}${suffix}`;
  }
  return editorialRouteTitle(title);
}

function localizedRouteDescription(route, previousSegments = {}, localizedTitle = "") {
  const source = normalizeText(route.description);
  const preserved = source && previousSegments[source];
  const generated = editorialRouteDescription(route);
  if (preserved && preserved !== source && preserved !== generated) return preserved;
  return editorialRouteDescription(route, localizedTitle);
}

function markupSegmentValues(markup) {
  const textValues = [...markup.matchAll(/(?<=>)([^<]+)(?=<)/g)].map((match) =>
    normalizeText(match[1]),
  );
  const attributeValues = [
    ...markup.matchAll(/\b(?:title|alt|aria-label|placeholder)=(['"])(.*?)\1/gi),
  ].map((match) => normalizeText(match[2]));
  return [...textValues, ...attributeValues].filter(Boolean);
}

function collectMarkupSegments(sourceMarkup, localizedMarkup, segments) {
  const sourceValues = markupSegmentValues(sourceMarkup);
  const localizedValues = markupSegmentValues(localizedMarkup);
  if (sourceValues.length !== localizedValues.length) return;
  sourceValues.forEach((source, index) => {
    segments[source] = localizedValues[index];
  });
}

function collectJsonSegments(source, localized, segments, key = "") {
  if (Array.isArray(source) && Array.isArray(localized)) {
    source.forEach((item, index) => collectJsonSegments(item, localized[index], segments, key));
    return;
  }
  if (source && typeof source === "object" && localized && typeof localized === "object") {
    Object.entries(source).forEach(([childKey, child]) => {
      if (!skipKeys.has(childKey)) {
        collectJsonSegments(child, localized[childKey], segments, childKey);
      }
    });
    return;
  }
  if (typeof source !== "string" || typeof localized !== "string" || skipKeys.has(key)) return;
  if (source.includes("<") && localized.includes("<")) {
    collectMarkupSegments(source, localized, segments);
  } else {
    segments[normalizeText(source)] = normalizeText(localized);
  }
}

function editorialRouteDescription(route, localizedTitle = "") {
  if (route.finalPath === "/") {
    return "LearningSEO.io 提供覆盖 SEO 基础、流程、工具与 AI 搜索的免费可靠学习路线图。";
  }
  if (route.finalPath === "/privacy-policy-terms-of-use/") {
    return "查看 LearningSEO.io 的隐私政策与使用条款。";
  }
  if (route.finalPath === "/updates/") {
    return "订阅 LearningSEO.io 邮件提醒，及时获取新发布和更新的 SEO 资源。";
  }
  if (route.finalPath === "/about/") {
    return "了解 LearningSEO.io 的目标、愿景，以及 SEO 资源的编选标准。";
  }
  const title = (localizedTitle || editorialRouteTitle(route.title)).replace(
    /\s+-\s+LearningSEO\.io$/,
    "",
  );
  return `学习“${title}”，获取与该主题相关的 SEO 指南、资源与实操建议。`;
}

function applyEditorialHomepage(content) {
  content.header.social = content.header.social.map((item, index) => ({
    ...item,
    label: ["Facebook", "X", "Instagram", "YouTube", "LinkedIn"][index] || item.label,
  }));
  content.hero = {
    ...content.hero,
    titleHtml:
      'SEO 学习路线图：<span class="color-violeta">免费</span><span class="color-violeta">资源</span>与<span class="color-violeta">工具</span>',
    version: "版本 28",
    updated: "更新于 2025 年 6 月 9 日",
    paragraphsHtml: [
      '开始学习搜索引擎优化（SEO），或继续深化 SEO 能力，理解<a class="inlinks" href="/seo_roadmap/other-search-engines/">搜索引擎</a>优化流程的每个环节，提升网站自然搜索流量，成长为更专业的 SEO 从业者。',
      'LearningSEO.io 是一份完整的 SEO 学习路线图，涵盖主要领域与阶段，并为每个主题整理可靠的免费指南、实用建议、常见问题和<a class="inlinks" href="/seo_roadmap/seo-tools/">学习工具</a>，包括 AI 搜索相关内容。',
      '从关键词研究、<a class="inlinks" href="/seo_roadmap/deepen-knowledge/backlinks/">链接建设</a>等 SEO 基础，到<a class="inlinks" href="/seo_roadmap/deepen-knowledge/content/content-pruning/">内容</a>优化、技术 SEO、指标监测、策略制定，以及应对搜索算法更新的实战方法，这里汇集 SEO 社区提供的可靠博客、指南、在线课程、资源和工具，帮助你系统掌握 SEO。',
    ],
  };
  content.roadmap.title = "SEO 学习路线图";
  content.roadmap.intro = "下面这份 SEO 学习路线图覆盖从基础知识到 SEO 流程中常见活动与阶段的完整学习路径：";
  content.resourceBanner = {
    ...content.resourceBanner,
    title: "在 Google 表格中访问、复制和分享免费的 SEO 指南、资源与工具",
    bodyHtml:
      "<p>我整理了一份 Google 表格，方便你复制和分享路线图覆盖的可靠 SEO 资源，也可以在学习 SEO 时作为参考。</p>",
    cta: "复制 Google 表格",
  };
  content.faq = {
    title: "SEO 学习路线图常见问题",
    items: [
      {
        question: "什么是 SEO？",
        answerHtml:
          '<p>SEO（搜索引擎优化）通过改进网站的<a class="inlinks" href="/seo_roadmap/deepen-knowledge/advanced-technical/">技术配置</a>、内容和反向链接等方面，提升网站在搜索结果页中的可见度、排名、流量与转化。</p>',
      },
      {
        question: "可以自学 SEO 吗？",
        answerHtml:
          '<p>可以。LearningSEO.io 通过可靠的免费资源帮助初学者按合理顺序学习 SEO。学习过程中建议在自己的网站上实践，即使使用无代码工具搭建简单网站也能积累经验。</p>',
      },
      {
        question: "SEO 有需求吗？",
        answerHtml:
          '<p>SEO 在 2023 年有需求。68% 的在线体验从搜索引擎开始（<a href="https://videos.brightedge.com/research-report/BrightEdge_ChannelReport2019_FINAL.pdf">1</a>），SEO 行业预计在 2023 年达到 $77.6 billion（<a href="https://www.gotchseo.com/is-seo-a-good">2</a>），对 SEO 服务的需求也持续增长。美国市场的需求在 2022 年 12 月达到峰值，增长明显的关键词包括“seo local”“seo agency”“seo content”“seo consultant”和“seo analytics”（<a href="https://searchengineland.com/seo-is-alive-392901">3</a>）。</p>',
      },
      {
        question: "SEO 需要编程吗？",
        answerHtml:
          '<p>SEO 入门无需编程。了解 HTML、CSS 和 JavaScript 等 Web 基础，有助于处理技术 SEO，相关资源见<a href="/seo_roadmap/complement-knowledge/#html-css">HTML 与 CSS</a>和<a href="/seo_roadmap/complement-knowledge/#javascript">JavaScript</a>指南。</p>',
      },
      {
        question: "Google 提供 SEO 认证吗？",
        answerHtml: "<p>Google 没有官方 SEO 认证，Google 提供 SEO 指南与最佳实践。</p>",
      },
      {
        question: "做 SEO 能赚钱吗？",
        answerHtml:
          '<p>可以。SEO 提供多种职业机会，你可以在企业内部工作、承接客户，或创建并发展自己的网站。专业 SEO 人才也有重要市场需求：截至 2023 年，美国 Glassdoor 上列出了 7430 个<a href="https://www.glassdoor.com/Job/united-states-seo-jobs-SRCH_IL.0,13_IN1_KO14,17.htm"> SEO 职位</a>，体现出市场对相关技能的需求。<a href="https://www.ziprecruiter.com/Salaries/SEO-Salary">根据 ZipRecruiter</a>，截至 2023 年 5 月，美国 SEO 专家的平均年薪为 $64,172。</p>',
      },
      {
        question: "应该按什么顺序学习 SEO 路线图？",
        answerHtml:
          '<h3><strong>适合开始学习的 SEO 初学者：</strong></h3>\n<p>如果你刚开始学习 SEO，先从第一阶段<a href="/seo_roadmap/seo-fundamentals/"><strong>学习 SEO 基础知识</strong></a>开始，掌握影响 SEO 的主要概念与领域、搜索引擎抓取与工作方式、标题标签、内部链接、搜索排名影响因素、关键词研究、内容优化和链接建设等。</p>\n<p>接着学习第二阶段<a href="/seo_roadmap/execute-seo/"><strong>执行 SEO 流程</strong></a>，了解如何进行页面 SEO 审计、制定链接建设策略、监测搜索排名与网站可见度。</p>\n<p>如果你希望在自己的网站上以较低成本实践 SEO，可以查看<a href="/seo_roadmap/seo-tools/"><strong>使用免费 SEO 工具实施</strong></a>，了解页面优化、页面速度和关键词工具。</p>\n<p>如果你使用 WordPress、Shopify、Magento 或 Webflow，可以查看<a href="/seo_roadmap/implement-in-cms/"><strong>在 CMS 中实施 SEO</strong></a>，获取适配常用平台的实操建议。</p>\n<p>&nbsp;</p>\n<h3><strong>适合拓展知识的 SEO 从业者：</strong></h3>\n<p>通过<a href="/seo_roadmap/deepen-knowledge/"><strong>加深 SEO 知识</strong></a>，从网站速度、内容策略、技术 SEO、链接建设和管理等方面建立更深入的理解。</p>\n<p>根据所在公司或行业，从<a href="/seo_roadmap/specialize/"><strong>专注 SEO 专项</strong></a>中选择希望深入的方向。</p>\n<p>当你发现某些 SEO 任务适合自动化，并愿意学习编程或脚本语言时，可以查看<a href="/seo_roadmap/automate-tasks/"><strong>自动化 SEO 任务</strong></a>。</p>\n<p>同步关注最新的 SEO 更新与搜索引擎新闻，查看<a href="/seo_roadmap/keep-up-with-news/"><strong>及时了解 SEO 新闻</strong></a>中的可靠出版物、播客和通讯。</p>\n<p>最后，通过<a href="/seo_roadmap/complement-knowledge/"><strong>补充 SEO 知识</strong></a>学习 Google Analytics、前端 Web 开发等相关数字营销能力。</p>',
      },
      {
        question: "需要学习路线图中的所有领域吗？",
        answerHtml:
          '<p>完整浏览路线图有助于建立全局视角。你可以先覆盖每个领域的基础，再根据职业目标深入技术 SEO、内容 SEO、链接建设或其他方向。</p>',
      },
      {
        question: "如何判断页面为什么没有排名？",
        answerHtml:
          '<p>可以使用<a href="/seo_roadmap/train-test-troubleshoot-your-seo-further/why-my-page-doesnt-rank/">页面排名诊断清单</a>，从搜索意图、内容、技术配置、内部链接和外部信号等方面逐项排查。</p>',
      },
      {
        question: "学习 SEO 时要避免哪些问题？",
        answerHtml:
          '<p>学习 SEO 时存在一些常见挑战，需要提前了解。以下是经验丰富的 SEO 专家分享的主要问题：</p>\n<ul>\n<li>“错误信息或过时信息。在互联网上，从排名研究到黑帽论坛，有人说了一些话就被当作事实，这种情况很奇怪。” –&nbsp;<a href="https://twitter.com/dergal">Gerry White</a>，SEO 总监兼 TakeItOffiline 联合组织者。</li>\n<li>“因为学习新知识而感到不知所措。我认为这种情况很常见，尤其是学习技术 SEO 时，面对新知识会感到非常不知所措。重要的是给自己时间、寻求帮助，并相信自己最终会掌握它。” –&nbsp;<a href="https://twitter.com/areej_abuali">Areej AbuAli</a>，SEO 顾问兼 Women in Tech SEO 创始人。</li>\n<li>“认为‘在&lt;6 小时内教会我或我的团队所有 SEO 知识’可行，这注定会失败。你需要学习原则，先用自己的需求审视这些原则，再应用它们积累经验。这需要时间，每个人都需要保持现实的预期。” –&nbsp;<a href="https://twitter.com/chrisgreenseo">Chris Green</a>，Torque Partnership 高级 SEO 顾问。</li>\n<li>“我认为边学边不实践是个问题。来自可靠来源的课程和指南是学习 SEO 的好方法，但它们只是其中一面。如果不尝试所学内容，你永远不会知道什么有效、什么无效。条件允许时，可以搭建网站，或向家人和亲友请求访问权限，谨慎实践所学内容。这样既能学习，也能取得哪怕很小的成果，为获得第一份 SEO 工作提供帮助。这对我有效。” –&nbsp;<a href="https://twitter.com/Ka3rne">Katherine Nwanorue</a>，技术 SEO 专家。</li>\n<li>“错误：相信网上发布的每一条信息。解决方案：阅读他人的观点或展示内容，同时保持独立判断。测试、分析后再做决定。进行全站更改前，始终先在少量页面上测试。” –&nbsp;<a href="https://twitter.com/MusingPraveen">Praveen Sharma</a>，SEO 顾问兼策略师。</li>\n<li>“对我而言，最重要的是了解到内容、技术 SEO 和其他数字渠道必须协同工作才能成功。” –&nbsp;<a href="https://twitter.com/HollerVeronika">Veronika Hoeller</a>，高级 SEO 经理。</li>\n<li>“对于初学者而言，学习 SEO 最大的痛点是错误信息。初学者难免感到不知所措，也不知道如何辨别事实与虚假信息（尤其是在搜索结果中）。理想的做法是加入论坛或 Slack 频道，例如 Tech SEO Women 的频道，在健康的交流环境中获得可靠反馈。加入免费，反馈来自专业人士。” –&nbsp;<a href="https://twitter.com/clorinda__">Iman</a>，SEO 专家。</li>\n</ul>',
      },
      {
        question: "如何及时了解 SEO 新闻？",
        answerHtml:
          '<p>可以订阅<a href="https://hub.seofomo.co/">SEOFOMO 通讯</a>，持续获取 SEO 新闻、更新、指南、活动与工作机会。</p>',
      },
      {
        question: "如何找到 SEO 工作？",
        answerHtml:
          '<p>可以查看免费的<a href="https://hub.seofomo.co/seofomo-jobs/">SEOFOMO 求职板</a>，了解全球 SEO 岗位。</p>',
      },
    ],
  };
  content.tips = {
    ...content.tips,
    title: "经验丰富的专家提供 SEO 学习技巧",
    introHtml: "从行业专家的经验中提炼方法，选择你当前最需要的主题。",
  };
  content.newsletter = {
    ...content.newsletter,
    text: "订阅 SEOFOMO，及时获取最新 SEO 更新与新闻。",
    linkLabel: "立即订阅 SEOFOMO",
  };
  content.footer.social = content.footer.social.map((item, index) => ({
    ...item,
    label: ["Facebook", "X", "Instagram", "YouTube", "LinkedIn"][index] || item.label,
  }));
  const navigationLabels = new Map([
    ["/seo_roadmap/keep-up-with-news/", "及时了解 SEO 新闻"],
  ]);
  content.header.navigation = content.header.navigation.map((item) => ({
    ...item,
    label: navigationLabels.get(item.href) || item.label,
  }));
  content.footer.navigation = content.footer.navigation.map((item) => ({
    ...item,
    label: navigationLabels.get(item.href) || item.label,
  }));
  const linkLabels = new Map([
    [
      "/seo_roadmap/deepen-knowledge/#communication-with-seo-stakeholders",
      "与 SEO 利益相关者的沟通",
    ],
    ["/seo_roadmap/deepen-knowledge/#google-discover", "Google Discover"],
    ["/seo_roadmap/deepen-knowledge/#dealing-with-google-penalties", "处理 Google 处罚"],
    [
      "/seo_roadmap/deepen-knowledge/#detect-protect-from-negative-seo",
      "检测并防止负面 SEO",
    ],
    ["/seo_roadmap/other-search-engines/#baidu-seo-guidelines-tips", "Baidu SEO 指南和技巧"],
    ["/seo_roadmap/other-search-engines/#amazon-seo-guidelines-tips", "Amazon SEO 指南和技巧"],
    ["/seo_roadmap/complement-knowledge/#google-analytics", "Google Analytics"],
    ["/seo_roadmap/complement-knowledge/#google-tag-manager", "Google Tag Manager"],
    ["/seo_roadmap/seo-tools/#google-search-console-guidelines", "Google Search Console 指南"],
  ]);
  content.roadmap.items = content.roadmap.items.map((item) => ({
    ...item,
    title: item.title === "Keep up with SEO News" ? "及时了解 SEO 新闻" : item.title,
    links: item.links.map((link) => ({
      ...link,
      label: linkLabels.get(link.href) || link.label,
    })),
  }));
  content.videos = content.videos.map((video, index) =>
    index === 0 ? { ...video, description: "不要错过并订阅网站底部的电子邮件提醒。" } : video,
  );
  content.tips = {
    ...content.tips,
    items: content.tips.items.map((item) => {
      if (item.id === "tip_26") {
        return {
          ...item,
          text: "“停止关注图表的上升或下降；关注票据的完成情况。如果你的策略是以最好的方式服务于用户意图，就专注于这一点，避免匆忙分析每一个可疑的 Google 更新。”",
        };
      }
      if (item.id === "tip_32") {
        return {
          ...item,
          text: "“三件事：考虑你的目标受众及其需求，尽力为他们提供所需的服务。这正是 Google 为其受众所做的事情。关注 SEO 原则，它们会持续有效。”",
        };
      }
      return item;
    }),
  };
  const newsletterSvg = content.newsletter.html.slice(content.newsletter.html.indexOf("<svg"));
  content.newsletter.html = `<p>随时了解最新的 SEO 更新和新闻 <a href="https://hub.seofomo.co/" target="_blank" rel="noopener">立即订阅 SEOFOMO。</a></p>\n    ${newsletterSvg}`;
  content.footer.copyrightHtml = content.footer.copyrightHtml
    .replace("学习 more", "了解更多")
    .replace("about LearningSEO.io", "关于 LearningSEO.io")
    .replace("developed by", "开发者")
    .replace("Aleyda Solis, SEO Consultant.", "阿莱达·索利斯 (Aleyda Solis)，SEO 顾问。")
    .replace(">Aleyda Solis</a>, SEO Consultant.", ">阿莱达·索利斯</a>，SEO 顾问。")
    .replace("Made 与", "制作与")
    .replace(/\n            by\n/, "\n            通过\n")
    .replace('title="Miss Marketing. Desarrollo Web"', 'title="市场营销小姐。Desarrollo Web"')
    .replace(">Miss Marketing</a>", ">营销小姐</a>");
  return content;
}

async function main() {
  const sourceContent = JSON.parse(await fs.readFile(rootContentPath, "utf8"));
  const sourceManifest = JSON.parse(await fs.readFile(englishManifestPath, "utf8"));
  const sourceContentBytes = await fs.readFile(rootContentPath);
  const previousTranslationManifest = await readJsonIfExists(translationManifestPath);
  const previousHomepage = await readJsonIfExists(chineseContentPath);
  const previousSegments = process.env.FORCE_TRANSLATION
    ? {}
    : previousTranslationManifest?.segments || {};
  const strings = new Set();
  collectJsonStrings(sourceContent, strings);

  const files = (await fs.readdir(englishContentRoot)).filter((file) => file.endsWith(".html"));
  const htmlByFile = new Map();
  for (const file of files) {
    const html = await fs.readFile(path.join(englishContentRoot, file), "utf8");
    htmlByFile.set(file, html);
    collectMarkupStrings(html, strings);
  }
  sourceManifest.routes.forEach((route) => {
    splitText(route.title).forEach((part) => strings.add(part));
    splitText(route.description).forEach((part) => strings.add(part));
  });

  console.log(`Collected ${strings.size} unique strings`);
  const cache = await translateStrings(strings);
  const trustedCache = await readTrustedCache();
  const sourceContentHash = sha256(sourceContentBytes);
  const translatedHomepage = translateJson(sourceContent, cache, "", previousSegments);
  let localizedHomepage =
    !process.env.FORCE_TRANSLATION &&
    previousHomepage &&
    previousTranslationManifest?.sourceContentSha256 === sourceContentHash
      ? previousHomepage
      : previousHomepage && !process.env.FORCE_TRANSLATION && previousTranslationManifest?.segments
        ? translatedHomepage
        : applyEditorialHomepage(translatedHomepage);
  localizedHomepage = normalizeLocalizedJson(localizedHomepage, sourceContent);
  await fs.writeFile(chineseContentPath, JSON.stringify(localizedHomepage, null, 2) + "\n");

  const translatedRoutes = sourceManifest.routes.map((route) => {
    const title = localizedRouteTitle(route, trustedCache, previousSegments);
    return {
      ...route,
      title,
      description: localizedRouteDescription(route, previousSegments, title),
    };
  });
  await fs.writeFile(
    chineseManifestPath,
    JSON.stringify({ ...sourceManifest, routes: translatedRoutes, locale: "zh-CN" }, null, 2) + "\n",
  );

  await fs.mkdir(chineseContentRoot, { recursive: true });
  const sourceFiles = new Set(htmlByFile.keys());
  for (const file of await fs.readdir(chineseContentRoot)) {
    if (!sourceFiles.has(file)) await fs.rm(path.join(chineseContentRoot, file));
  }
  for (const [file, html] of htmlByFile) {
    const targetPath = path.join(chineseContentRoot, file);
    const previousPage = previousTranslationManifest?.pages?.[file];
    const previousSourceHash =
      typeof previousPage === "string" ? previousPage : previousPage?.sourceSha256;
    const localized =
      !process.env.FORCE_TRANSLATION &&
      previousSourceHash === sha256(html) && (await fs.stat(targetPath).catch(() => null))
        ? await fs.readFile(targetPath, "utf8")
        : translateMarkup(html, trustedCache, previousSegments);
    await fs.writeFile(targetPath, normalizeLocalizedMarkup(localized, html));
  }
  const pageHashes = {};
  const segments = {};
  for (const [file, html] of htmlByFile) {
    const localized = await fs.readFile(path.join(chineseContentRoot, file), "utf8");
    collectMarkupSegments(html, localized, segments);
    pageHashes[file] = {
      sourceSha256: sha256(html),
      localizedSha256: sha256(localized),
    };
  }
  collectJsonSegments(sourceContent, localizedHomepage, segments);
  sourceManifest.routes.forEach((route, index) => {
    const localized = translatedRoutes[index];
    if (route.title && localized.title) segments[normalizeText(route.title)] = normalizeText(localized.title);
    if (route.description && localized.description) {
      segments[normalizeText(route.description)] = normalizeText(localized.description);
    }
  });
  await fs.writeFile(
    translationManifestPath,
    JSON.stringify(
      {
        locale: "zh-CN",
        sourceContentSha256: sourceContentHash,
        localizedContentSha256: sha256(await fs.readFile(chineseContentPath)),
        sourceManifestSha256: sha256(await fs.readFile(englishManifestPath)),
        segments,
        pages: pageHashes,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Wrote ${files.length} localized pages`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
