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
  return leading + translated + trailing;
}

function translateMarkup(markup, cache) {
  let translated = markup.replace(/>([^<]+)</g, (_match, text) =>
    `>${translateText(text, cache)}<`,
  );
  translated = translated.replace(
    /\b(title|alt|aria-label|placeholder)=(['"])(.*?)\2/gi,
    (_match, attribute, quote, value) =>
      `${attribute}=${quote}${translateText(value, cache)}${quote}`,
  );
  return translated;
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
  return content;
}

async function main() {
  const sourceContent = JSON.parse(await fs.readFile(rootContentPath, "utf8"));
  const sourceManifest = JSON.parse(await fs.readFile(englishManifestPath, "utf8"));
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
  const localizedHomepage = applyEditorialHomepage(translateJson(sourceContent, cache));
  await fs.writeFile(chineseContentPath, JSON.stringify(localizedHomepage, null, 2) + "\n");

  const translatedRoutes = sourceManifest.routes.map((route) => ({
    ...route,
    title: editorialRouteTitle(route.title),
    description:
      route.finalPath === "/"
        ? "LearningSEO.io 提供覆盖 SEO 基础、流程、工具与 AI 搜索的免费可靠学习路线图。"
        : `围绕“${editorialRouteTitle(route.title).replace(/\s+-\s+LearningSEO\.io$/, "")}”整理可靠的 SEO 指南、工具与实操建议，帮助你系统学习并应用搜索引擎优化。`,
  }));
  await fs.writeFile(
    chineseManifestPath,
    JSON.stringify({ ...sourceManifest, routes: translatedRoutes, locale: "zh-CN" }, null, 2) + "\n",
  );

  await fs.rm(chineseContentRoot, { recursive: true, force: true });
  await fs.mkdir(chineseContentRoot, { recursive: true });
  for (const [file, html] of htmlByFile) {
    await fs.writeFile(path.join(chineseContentRoot, file), translateMarkup(html, cache));
  }
  const pageHashes = Object.fromEntries(
    [...htmlByFile].map(([file, html]) => [file, sha256(html)]),
  );
  await fs.writeFile(
    translationManifestPath,
    JSON.stringify(
      {
        locale: "zh-CN",
        sourceContentSha256: sha256(await fs.readFile(rootContentPath)),
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
