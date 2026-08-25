import fs from "node:fs/promises";
import path from "node:path";

const siteRoot = path.resolve("src/components/sites/learningseo-io-071dae18");
const generatedRoot = path.join(siteRoot, "subpages", "generated");
const htmlRoot = path.join(generatedRoot, "content");
const manifest = JSON.parse(await fs.readFile(path.join(generatedRoot, "manifest.json"), "utf8"));
const content = JSON.parse(
  await fs.readFile(path.join(siteRoot, "root-8a5edab2", "content.json"), "utf8"),
);

let htmlTextNodes = 0;
let htmlAttributeValues = 0;
let htmlCharacters = 0;
const attributeCounts = {};

for (const file of await fs.readdir(htmlRoot)) {
  if (!file.endsWith(".html")) continue;
  const html = await fs.readFile(path.join(htmlRoot, file), "utf8");
  for (const match of html.matchAll(/>([^<]+)</g)) {
    if (/[A-Za-z]/.test(match[1])) {
      htmlTextNodes += 1;
      htmlCharacters += match[1].length;
    }
  }
  for (const match of html.matchAll(/\b(title|alt|aria-label|placeholder)=(['"])(.*?)\2/gi)) {
    if (/[A-Za-z]/.test(match[3])) {
      htmlAttributeValues += 1;
      attributeCounts[match[1].toLowerCase()] = (attributeCounts[match[1].toLowerCase()] || 0) + 1;
    }
  }
}

let jsonStrings = 0;
function walk(value, key = "") {
  if (Array.isArray(value)) return value.forEach((item) => walk(item, key));
  if (value && typeof value === "object") {
    return Object.entries(value).forEach(([childKey, child]) => walk(child, childKey));
  }
  if (typeof value === "string" && !["href", "source", "extractedAt", "id", "icon", "embed"].includes(key)) {
    if (/[A-Za-z]/.test(value)) jsonStrings += 1;
  }
}
walk(content);

const report = {
  generatedAt: new Date().toISOString(),
  routeCount: manifest.routes.length,
  generatedHtmlPages: manifest.routes.filter((route) => route.contentFile).length,
  homepageJsonStrings: jsonStrings,
  generatedHtmlEnglishTextNodes: htmlTextNodes,
  generatedHtmlEnglishCharacters: htmlCharacters,
  generatedHtmlTranslatableAttributes: htmlAttributeValues,
  attributeCounts,
  owners: [
    {
      surface: "homepage JSON and React props",
      owner: "HomePage and homepage section components",
      source: "src/components/sites/learningseo-io-071dae18/root-8a5edab2/content.json",
      localized: "src/components/sites/learningseo-io-071dae18/root-8a5edab2/content.zh-CN.json",
    },
    {
      surface: "generated subpage HTML text nodes",
      owner: "SubpageDocument and generated subpage renderer",
      source: "src/components/sites/learningseo-io-071dae18/subpages/generated/content/",
      localized: "src/components/sites/learningseo-io-071dae18/subpages/generated/content-zh-CN/",
    },
    {
      surface: "generated metadata title and description",
      owner: "subpages/route.tsx metadata loader",
      source: "src/components/sites/learningseo-io-071dae18/subpages/generated/manifest.json",
      localized: "src/components/sites/learningseo-io-071dae18/subpages/generated/manifest.zh-CN.json",
    },
    {
      surface: "document language and locale switcher",
      owner: "app/layout.tsx, proxy.ts, HeaderNavigation.tsx",
      source: "src/app/layout.tsx and src/proxy.ts",
      localized: "src/lib/localization.ts and HeaderNavigation.tsx",
    },
    {
      surface: "navigation, footer, forms, buttons, and accessibility labels",
      owner: "HeaderNavigation, FooterSection, SubpageFooter, and shared runtime controls",
      source: "src/components/sites/learningseo-io-071dae18/root-8a5edab2/ and subpages/",
      localized: "locale-specific content manifests and shared locale renderers",
    },
    {
      surface: "canonical, hreflang, sitemap, robots, and redirects",
      owner: "app/layout.tsx, app/page.tsx, subpages/route.tsx, sitemap.ts, robots.ts",
      source: "src/app/ and generated manifests",
      localized: "locale-aware metadata and SEO routes",
    },
    {
      surface: "internal links and generated media references",
      owner: "shared/links.ts and SubpageDocument link sanitizer",
      source: "generated HTML href/src attributes",
      localized: "localized HTML with preserved URLs and media paths",
    },
  ],
  edgeCases: [
    {
      case: "legacy redirect",
      paths: ["/the-seo-learning-roadmap/", "/seo_roadmap/seo-fundamentals/introduction-to-seo/"],
      owner: "generated manifest and subpages/route.tsx",
    },
    {
      case: "empty source description",
      paths: ["/privacy-policy-terms-of-use/"],
      owner: "generated manifest metadata fallback",
    },
    {
      case: "embedded media and playback control",
      paths: ["/seo_roadmap/execute-seo/setting-seo-goals/"],
      owner: "generated HTML and SubpageRuntime",
    },
    {
      case: "brand-only terms and accessibility attributes",
      values: ["LearningSEO.io", "Shopify", "Google Search Console", "aria-label", "alt"],
      owner: "translation manifest and localized generated HTML",
    },
    {
      case: "unknown locale path",
      paths: ["/en/does-not-exist/"],
      owner: "catch-all route with dynamicParams=false and 404 response",
    },
  ],
  surfaces: [
    "homepage JSON and React props",
    "generated subpage HTML text nodes",
    "generated metadata title and description",
    "document language and locale switcher",
    "navigation, footer, forms, buttons, and accessibility labels",
    "canonical, hreflang, sitemap, robots, and redirects",
    "internal links and generated media references",
  ],
};

const output = path.resolve("docs/research/learningseo-io-071dae18/LOCALIZATION_INVENTORY.json");
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log(`Wrote ${output}`);
