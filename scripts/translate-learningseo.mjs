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

function normalizeLocalizedMarkup(markup) {
  return markup.replace(/[ \t]+$/gm, "");
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

function translateText(value, cache) {
  const leading = value.match(/^\s*/)?.[0] || "";
  const trailing = value.match(/\s*$/)?.[0] || "";
  const normalized = normalizeText(value);
  if (!shouldTranslate(normalized)) return value;
  const translated = splitText(normalized)
    .map((part) => cache[part] || part)
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
]);

function translateMarkupText(value, cache, preserveStrong = false) {
  const leading = value.match(/^\s*/)?.[0] || "";
  const trailing = value.match(/\s*$/)?.[0] || "";
  const normalized = normalizeText(value);
  if (!shouldTranslate(normalized)) return value;
  const direct = markupPhraseTranslations.get(normalized);
  if (direct) return leading + direct + trailing;
  if (preserveStrong) return value;
  const translatedParts = splitText(normalized).map((part) => {
    const cachedPart = cache[part];
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
  const cached = cache[normalized];
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
  if (protectedBrands.includes(normalized) || normalized.includes(" / ")) return true;
  const surrounding = context.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").trim();
  if (/\b(?:from|by)\s*$/i.test(surrounding)) return true;
  return context.includes(`title="${normalized}"`) || context.includes(`title='${normalized}'`);
}

function translateMarkup(markup, cache) {
  let translated = markup.replace(
    /(<strong\b[^>]*>)([^<]*)(<\/strong>)|(?<=>)([^<]+)(?=<)/gi,
    (_match, open, strongText, close, text, offset, sourceMarkup) =>
      open
        ? `${open}${translateMarkupText(
            strongText,
            cache,
            shouldPreserveStrongText(strongText, sourceMarkup.slice(Math.max(0, offset - 120), offset)),
          )}${close}`
        : translateMarkupText(text, cache),
  );
  translated = translated.replace(
    /\b(title|alt|aria-label|placeholder)=(['"])(.*?)\2/gi,
    (_match, attribute, quote, value) =>
      `${attribute}=${quote}${translateAttributeText(attribute, value, cache)}${quote}`,
  );
  return translated;
}

function translateAttributeText(attribute, value, cache) {
  const normalized = normalizeText(value);
  if (
    attribute.toLowerCase() === "title" &&
    /^(?:[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'-]+)(?:\s+[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'-]+){1,3}$/.test(normalized)
  ) {
    return value;
  }
  return translateMarkupText(value, cache);
}

function translateJson(value, cache, key = "") {
  if (Array.isArray(value)) return value.map((item) => translateJson(item, cache, key));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, child]) => [
        childKey,
        skipKeys.has(childKey) ? child : translateJson(child, cache, childKey),
      ]),
    );
  }
  if (typeof value !== "string" || skipKeys.has(key)) return value;
  return value.includes("<") ? translateMarkup(value, cache) : translateText(value, cache);
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

function editorialRouteDescription(route) {
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
  const title = editorialRouteTitle(route.title).replace(/\s+-\s+LearningSEO\.io$/, "");
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
          '<p>SEO 仍然有稳定需求。大量在线体验从搜索开始，企业持续需要提升自然搜索流量，因此 SEO 服务与相关岗位长期存在。</p>',
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
          '<p>可以。SEO 既有企业内部岗位，也有顾问、代理机构和内容网站等职业路径。市场对能提升自然搜索表现的专业人才持续有需求。</p>',
      },
      {
        question: "应该按什么顺序学习 SEO 路线图？",
        answerHtml:
          '<p>建议先学习<a href="/seo_roadmap/seo-fundamentals/"><strong>SEO 基础知识</strong></a>，再学习<a href="/seo_roadmap/execute-seo/"><strong>执行 SEO 流程</strong></a>，之后根据工作场景学习免费工具、CMS 实施、深入知识、专业方向、自动化、行业新闻和相关数字营销能力。</p>',
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
          "<p>重点防范过时信息、只看理论不实践、盲目复制所谓排名技巧，以及忽视内容、技术 SEO 和其他营销渠道之间的协作。优先选择可靠来源并用小范围测试验证结论。</p>",
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
  const localizedHomepage =
    !process.env.FORCE_TRANSLATION &&
    previousHomepage &&
    previousTranslationManifest?.sourceContentSha256 === sourceContentHash
      ? previousHomepage
      : applyEditorialHomepage(translateJson(sourceContent, cache));
  await fs.writeFile(chineseContentPath, JSON.stringify(localizedHomepage, null, 2) + "\n");

  const translatedRoutes = sourceManifest.routes.map((route) => ({
    ...route,
    title: editorialRouteTitle(route.title),
    description: editorialRouteDescription(route),
  }));
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
        : translateMarkup(html, trustedCache);
    await fs.writeFile(targetPath, normalizeLocalizedMarkup(localized));
  }
  const pageHashes = {};
  for (const [file, html] of htmlByFile) {
    const localized = await fs.readFile(path.join(chineseContentRoot, file), "utf8");
    pageHashes[file] = {
      sourceSha256: sha256(html),
      localizedSha256: sha256(localized),
    };
  }
  await fs.writeFile(
    translationManifestPath,
    JSON.stringify(
      {
        locale: "zh-CN",
        sourceContentSha256: sourceContentHash,
        localizedContentSha256: sha256(await fs.readFile(chineseContentPath)),
        sourceManifestSha256: sha256(await fs.readFile(englishManifestPath)),
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
