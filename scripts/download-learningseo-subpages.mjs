import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const browserRequire = createRequire("/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright/package.json");
const projectRequire = createRequire(path.resolve("package.json"));
const { chromium } = browserRequire("playwright");

const origin = "https://learningseo.io";
const siteKey = "learningseo-io-071dae18";
const componentRoot = path.resolve("src/components/sites", siteKey, "subpages");
const docsRoot = path.resolve("docs/research", siteKey, "subpages");
const publicRoot = path.resolve("public/sites", siteKey, "subpages");
const themeRoot = path.join(publicRoot, "theme");
const mediaRoot = path.join(publicRoot, "media");

const unique = (items) => [...new Set(items)];
const absoluteUrl = (value, base = origin) => new URL(value, base).href;

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

function extractLocs(text) {
  return [...text.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1].trim());
}

function localAssetName(url) {
  const parsed = new URL(url);
  const ext = path.extname(parsed.pathname).toLowerCase() || ".bin";
  const stem = path.basename(parsed.pathname, ext).replace(/[^a-z0-9_-]+/gi, "-").slice(0, 80) || "asset";
  const hash = crypto.createHash("sha256").update(url).digest("hex").slice(0, 10);
  return `${hash}-${stem}${ext}`;
}

function prefixCss(css) {
  const postcss = projectRequire("postcss");
  const selectorParser = projectRequire("postcss-selector-parser");
  const root = postcss.parse(css);

  root.walkRules((rule) => {
    let parent = rule.parent;
    while (parent) {
      if (parent.type === "atrule" && /keyframes$/i.test(parent.name)) return;
      parent = parent.parent;
    }

    rule.selector = selectorParser((selectors) => {
      selectors.each((selector) => {
        let hasScope = false;
        selector.walkTags((node) => {
          if (node.value === "html" || node.value === "body") {
            node.replaceWith(selectorParser.className({ value: "learningseo-subpage" }));
            hasScope = true;
          }
        });
        selector.walkPseudos((node) => {
          if (node.value === ":root") {
            node.replaceWith(selectorParser.className({ value: "learningseo-subpage" }));
            hasScope = true;
          }
        });

        const first = selector.nodes[0];
        if (first?.type === "class" && first.value === "learningseo-subpage") hasScope = true;
        if (!hasScope) {
          selector.prepend(selectorParser.combinator({ value: " " }));
          selector.prepend(selectorParser.className({ value: "learningseo-subpage" }));
        }
      });
    }).processSync(rule.selector);
  });

  return root.toString();
}

async function downloadAsset(url, targetDir) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const filename = localAssetName(url);
  await fs.writeFile(path.join(targetDir, filename), buffer);
  return filename;
}

async function runPool(items, worker, concurrency = 6) {
  let cursor = 0;
  const results = [];
  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, run));
  return results;
}

async function collectRoutes() {
  const indexUrls = extractLocs(await fetchText(`${origin}/sitemap_index.xml`));
  const sitemapUrls = unique((await Promise.all(indexUrls.map(fetchText))).flatMap(extractLocs));
  const sourceUrls = unique(sitemapUrls);
  const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  const pages = await Promise.all(Array.from({ length: 4 }, () => browser.newPage({ viewport: { width: 1440, height: 1000 } })));
  let cursor = 0;

  async function collect(page) {
    while (true) {
      const index = cursor++;
      if (index >= sourceUrls.length) return;
      const sourceUrl = sourceUrls[index];
      try {
        await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForSelector("main#content", { timeout: 30000 });
        const route = await page.evaluate(() => {
          const main = document.querySelector("main#content");
          const meta = (selector) => document.querySelector(selector)?.getAttribute("content") || "";
          return {
            finalUrl: window.location.href,
            title: document.title,
            description: meta('meta[name="description"]'),
            canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "",
            bodyClass: document.body.className,
            mainClass: main?.className || "",
            html: main?.innerHTML || "",
            images: [...(main?.querySelectorAll("img") || [])].map((image) => image.currentSrc || image.src || image.getAttribute("data-src") || ""),
          };
        });
        sourceUrls[index] = { sourceUrl, sourcePath: new URL(sourceUrl).pathname, ...route };
      } catch (error) {
        sourceUrls[index] = { sourceUrl, sourcePath: new URL(sourceUrl).pathname, error: String(error) };
      }
    }
  }

  await Promise.all(pages.map(collect));
  await browser.close();
  return sourceUrls;
}

async function main() {
  await Promise.all([
    fs.mkdir(componentRoot, { recursive: true }),
    fs.mkdir(docsRoot, { recursive: true }),
    fs.mkdir(themeRoot, { recursive: true }),
    fs.mkdir(mediaRoot, { recursive: true }),
    fs.mkdir(path.resolve("src/app/[...slug]"), { recursive: true }),
  ]);

  const rawRoutesPath = path.join(docsRoot, "_raw-routes.json");
  let routes;
  try {
    routes = JSON.parse(await fs.readFile(rawRoutesPath, "utf8"));
    console.log(`Loaded ${routes.length} cached route captures.`);
  } catch {
    routes = await collectRoutes();
    await fs.writeFile(rawRoutesPath, JSON.stringify(routes));
  }
  const themeStyle = await fetchText(`${origin}/wp-content/themes/learningseo/style.css?a=4369&ver=7.1`);
  const roadmapStyle = await fetchText(`${origin}/wp-content/themes/learningseo/single-seo_roadmap.css?a=5480&ver=7.1`);
  const themeAssetUrls = unique([...`${themeStyle}\n${roadmapStyle}`.matchAll(/url\((?!data:)["']?([^\)"']+)["']?\)/g)].map((match) => absoluteUrl(match[1], `${origin}/wp-content/themes/learningseo/`)));
  const themeAssets = await runPool(themeAssetUrls, async (url) => {
    try {
      return [url, `/sites/${siteKey}/subpages/theme/${await downloadAsset(url, themeRoot)}`];
    } catch (error) {
      console.warn(`Theme asset failed: ${url} (${error.message})`);
      return [url, url];
    }
  });
  const themeMap = new Map(themeAssets);
  const scopedCss = `${prefixCss(`${themeStyle}\n${roadmapStyle}`)}\n\nhtml:has(.learningseo-subpage) {\n  font-size: 14px;\n}\n\n@media (min-width: 768px) {\n  html:has(.learningseo-subpage) {\n    font-size: 17px;\n  }\n}\n\n@media (max-width: 767px) {\n  .learningseo-subpage {\n    padding-top: 78px;\n  }\n}\n\n.learningseo-subpage .tips.grid {\n  display: block;\n}\n\n.learningseo-subpage .roadmap-item-links svg {\n  display: inline;\n  vertical-align: baseline;\n}\n\n.learningseo-subpage .newsletter svg {\n  vertical-align: baseline;\n}\n`
    .replace(/url\((?!data:)["']?([^\)"']+)["']?\)/g, (match, value) => `url(${themeMap.get(absoluteUrl(value, `${origin}/wp-content/themes/learningseo/`)) || value})`);
  await fs.writeFile(
    path.join(process.cwd(), "src/app/[...slug]/subpage.css"),
    `${scopedCss}\n.learningseo-subpage img {\n  display: inline;\n  height: auto;\n  max-width: 100%;\n  vertical-align: baseline;\n}\n\n.learningseo-subpage img.emoji {\n  width: 1em;\n  height: 1em;\n  max-width: none;\n  vertical-align: -0.1em;\n}\n\n@media (min-width: 768px) {\n  .learningseo-subpage #content > .fullwidth {\n    width: 100vw;\n    margin-left: calc(50% - 50vw);\n  }\n}\n`,
  );

  const inlineMediaUrls = routes.flatMap((route) => [...(route.html || "").matchAll(/url\((?!data:)["']?([^\)"']+)["']?\)/g)].map((match) => match[1]));
  const mediaUrls = unique([...routes.flatMap((route) => route.images || []), ...inlineMediaUrls].filter(Boolean).map((url) => absoluteUrl(url)));
  const mediaAssets = await runPool(mediaUrls, async (url) => {
    try {
      return [url, `/sites/${siteKey}/subpages/media/${await downloadAsset(url, mediaRoot)}`];
    } catch (error) {
      console.warn(`Page asset failed: ${url} (${error.message})`);
      return [url, url];
    }
  });
  const mediaMap = new Map(mediaAssets);
  const normalizedRoutes = routes.map((route) => {
    const finalUrl = route.finalUrl || route.sourceUrl;
    const finalPath = new URL(finalUrl).pathname;
    let html = (route.html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/\s+on[a-z]+="[^"]*"/gi, "")
      .replace(/(href|action)=(['"])https:\/\/learningseo\.io([^'"]*)\2/gi, (_match, attribute, quote, pathname) => `${attribute}=${quote}${pathname || "/"}${quote}`)
      .replace(/(src|srcset|data-src|data-lazy-src|poster)=("[^"]*"|'[^']*')/gi, (match, attribute, quoted) => {
        let value = quoted.slice(1, -1);
        for (const [remote, local] of mediaMap) {
          value = value.split(remote).join(local);
          value = value.split(new URL(remote).pathname).join(local);
        }
        return `${attribute}="${value}"`;
      });
    for (const [remote, local] of mediaMap) {
      html = html.split(remote).join(local);
      html = html.split(new URL(remote).pathname).join(local);
    }
    return {
      sourcePath: route.sourcePath,
      finalPath,
      redirectTo: route.sourcePath === "/the-seo-learning-roadmap/" || route.sourcePath !== finalPath ? finalPath : null,
      title: route.title,
      description: route.description,
      canonical: route.canonical,
      bodyClass: route.bodyClass,
      mainClass: route.mainClass,
      html,
      error: route.error || null,
    };
  });

  await fs.writeFile(path.join(componentRoot, "data.json"), JSON.stringify({ generatedAt: new Date().toISOString(), routes: normalizedRoutes }, null, 2));
  await fs.writeFile(path.join(docsRoot, "ROUTES.json"), JSON.stringify({ source: origin, sitemapEntries: routes.length, finalRoutes: unique(normalizedRoutes.map((route) => route.finalPath)).length, routes: normalizedRoutes.map(({ sourcePath, finalPath, redirectTo, title, canonical, error }) => ({ sourcePath, finalPath, redirectTo, title, canonical, error })) }, null, 2));
  console.log(`Collected ${normalizedRoutes.length} sitemap routes, ${mediaMap.size} media assets, ${themeMap.size} theme assets.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
