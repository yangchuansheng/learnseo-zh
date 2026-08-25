import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import postcss from "postcss";
import selectorParser from "postcss-selector-parser";
import { chromium } from "playwright";

import {
  contentDocument,
  generatedRoot,
  normalizePath,
  replaceDirectoryAtomic,
  sanitizeRouteHtml,
  sha256,
  siteKey,
  siteOrigin,
  validateGeneratedSite,
  validateRoutes,
  writeFileAtomic,
} from "./lib/learningseo-subpages.mjs";

const docsRoot = path.resolve("docs/research", siteKey, "subpages");
const publicRoot = path.resolve("public/sites", siteKey, "subpages");
const themeRoot = path.join(publicRoot, "theme");
const mediaRoot = path.join(publicRoot, "media");
const routeReportPath = path.join(docsRoot, "ROUTES.json");
const rawCachePath = path.resolve("temp/learningseo-subpages-raw.json");
const snapshotCssPath = path.join(generatedRoot, "subpage.css");

const runtimeCss = [
  "/* LEARNINGSEO_RUNTIME_OVERRIDES_START */",
  "html:has(.learningseo-subpage) {",
  "  font-size: 14px;",
  "}",
  "",
  "@media (min-width: 768px) {",
  "  html:has(.learningseo-subpage) {",
  "    font-size: 17px;",
  "  }",
  "}",
  "",
  "@media (max-width: 767px) {",
  "  .learningseo-subpage[data-subpage-runtime] {",
  "    padding-top: 78px;",
  "  }",
  "}",
  "",
  ".learningseo-subpage .tips.grid {",
  "  display: block;",
  "}",
  "",
  ".learningseo-subpage img {",
  "  display: inline;",
  "  height: auto;",
  "  max-width: 100%;",
  "  vertical-align: baseline;",
  "}",
  "",
  ".learningseo-subpage img.emoji {",
  "  width: 1em;",
  "  height: 1em;",
  "  max-width: none;",
  "  vertical-align: -0.1em;",
  "}",
  "",
  ".learningseo-subpage button.accordion-title,",
  ".learningseo-subpage button.resources-sidebar-toggle,",
  ".learningseo-subpage button.tip-share-btn,",
  ".learningseo-subpage button.play {",
  "  border: 0;",
  "  color: inherit;",
  "  font: inherit;",
  "  text-align: left;",
  "}",
  "",
  ".learningseo-subpage button.accordion-title,",
  ".learningseo-subpage button.resources-sidebar-toggle {",
  "  width: 100%;",
  "}",
  "",
  ".learningseo-subpage button.accordion-title {",
  "  background: transparent;",
  "}",
  "",
  ".learningseo-subpage button.play {",
  "  padding: 0;",
  "}",
  "",
  "@media (min-width: 768px) {",
  "  .learningseo-subpage #content > .fullwidth {",
  "    width: 100vw;",
  "    margin-left: calc(50% - 50vw);",
  "  }",
  "}",
  "/* LEARNINGSEO_RUNTIME_OVERRIDES_END */",
  "",
].join("\n");

function parseArguments() {
  const [mode, value, ...rest] = process.argv.slice(2);
  if (mode === "--refresh" && value === undefined && rest.length === 0) {
    return { mode: "refresh" };
  }
  if (mode === "--snapshot" && value && rest.length === 0) {
    return { mode: "snapshot", source: path.resolve(value) };
  }
  throw new Error(
    "Usage: node scripts/download-learningseo-subpages.mjs --refresh\n" +
      "   or: node scripts/download-learningseo-subpages.mjs --snapshot <routes.json>",
  );
}

function unique(items) {
  return [...new Set(items)];
}

function absoluteUrl(value, base = siteOrigin) {
  return new URL(value, base).href;
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(String(response.status) + " " + url);
  return response.text();
}

function extractLocs(text) {
  return [...text.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) =>
    match[1].trim(),
  );
}

function localAssetName(url) {
  const parsed = new URL(url);
  const extension = path.extname(parsed.pathname).toLowerCase() || ".bin";
  const stem =
    path
      .basename(parsed.pathname, extension)
      .replace(/[^a-z0-9_-]+/gi, "-")
      .slice(0, 80) || "asset";
  return sha256(url).slice(0, 10) + "-" + stem + extension;
}

async function downloadAsset(url, targetDirectory) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(String(response.status) + " " + url);
  const filename = localAssetName(url);
  await fs.writeFile(
    path.join(targetDirectory, filename),
    Buffer.from(await response.arrayBuffer()),
  );
  return filename;
}

async function runPool(items, worker, concurrency = 6) {
  let cursor = 0;
  let failure = null;
  const results = new Array(items.length);

  async function run() {
    while (true) {
      if (failure) return;
      const index = cursor++;
      if (index >= items.length) return;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        failure ||= error;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length || 1) }, run),
  );
  if (failure) throw failure;
  return results;
}

async function launchBrowser() {
  const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  return chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
}

async function runWithPages(browser, items, worker, concurrency = 4) {
  const context = await browser.newContext({
    viewport: { height: 1000, width: 1440 },
  });
  const pages = await Promise.all(
    Array.from(
      { length: Math.min(concurrency, items.length || 1) },
      () => context.newPage(),
    ),
  );
  let cursor = 0;
  let failure = null;
  const results = new Array(items.length);

  await Promise.all(
    pages.map(async (page) => {
      while (true) {
        if (failure) return;
        const index = cursor++;
        if (index >= items.length) return;
        try {
          results[index] = await worker(page, items[index], index);
        } catch (error) {
          failure ||= error;
        }
      }
    }),
  );
  await context.close();
  if (failure) throw failure;
  return results;
}

async function collectRoutes() {
  const indexUrls = extractLocs(
    await fetchText(siteOrigin + "/sitemap_index.xml"),
  );
  const sitemapDocuments = await Promise.all(indexUrls.map(fetchText));
  const sourceUrls = unique(sitemapDocuments.flatMap(extractLocs));
  const browser = await launchBrowser();

  try {
    return await runWithPages(browser, sourceUrls, async (page, sourceUrl) => {
      try {
        await page.goto(sourceUrl, {
          timeout: 60000,
          waitUntil: "domcontentloaded",
        });
        await page.waitForSelector("main#content", { timeout: 30000 });
        return await page.evaluate(
          ({ sourceUrl }) => {
            const main = document.querySelector("main#content");
            const meta = (selector) =>
              document.querySelector(selector)?.getAttribute("content") || "";
            const mediaLinks = [
              ...(main?.querySelectorAll("a[href]") || []),
            ]
              .map((anchor) => anchor.href)
              .filter((href) =>
                /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#]|$)/i.test(href),
              );
            return {
              bodyClass: document.body.className,
              canonical:
                document
                  .querySelector('link[rel="canonical"]')
                  ?.getAttribute("href") || "",
              description: meta('meta[name="description"]'),
              finalUrl: window.location.href,
              html: main?.innerHTML || "",
              images: uniqueBrowser([
                ...(main?.querySelectorAll("img") || []),
              ].map((image) =>
                image.currentSrc ||
                image.src ||
                image.getAttribute("data-src") ||
                "",
              ).concat(mediaLinks)),
              mainClass: main?.className || "",
              sourcePath: new URL(sourceUrl).pathname,
              sourceUrl,
              title: document.title,
            };

            function uniqueBrowser(values) {
              return [...new Set(values.filter(Boolean))];
            }
          },
          { sourceUrl },
        );
      } catch (error) {
        throw new Error(sourceUrl + ": " + String(error), { cause: error });
      }
    });
  } finally {
    await browser.close();
  }
}

async function loadSnapshot(source) {
  const snapshot = JSON.parse(await fs.readFile(source, "utf8"));
  const routes = Array.isArray(snapshot) ? snapshot : snapshot.routes;
  return {
    generatedAt:
      (!Array.isArray(snapshot) && snapshot.generatedAt) ||
      new Date().toISOString(),
    routes,
  };
}

function prefixCss(css) {
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
            node.replaceWith(
              selectorParser.className({ value: "learningseo-subpage" }),
            );
            hasScope = true;
          }
        });
        selector.walkPseudos((node) => {
          if (node.value === ":root") {
            node.replaceWith(
              selectorParser.className({ value: "learningseo-subpage" }),
            );
            hasScope = true;
          }
        });

        const first = selector.nodes[0];
        if (
          first?.type === "class" &&
          first.value === "learningseo-subpage"
        ) {
          hasScope = true;
        }
        if (!hasScope) {
          selector.prepend(selectorParser.combinator({ value: " " }));
          selector.prepend(
            selectorParser.className({ value: "learningseo-subpage" }),
          );
        }
      });
    }).processSync(rule.selector);
  });
  return root.toString();
}

function withoutLegacyRoadmapCss(css) {
  const overrideStart = css.indexOf("\nhtml:has(.learningseo-subpage)");
  const source = overrideStart === -1 ? css : css.slice(0, overrideStart);
  const root = postcss.parse(source);

  root.walkRules((rule) => {
    const selectors = rule.selectors;
    if (!selectors) return;
    const retained = selectors.filter(
      (selector) => !selector.includes("#roadmap"),
    );
    if (retained.length === 0) {
      rule.remove();
    } else {
      rule.selectors = retained;
    }
  });
  return root.toString().trim();
}

function cssDocument(css) {
  const sourceCss = css
    .replace(/^\/\* AUTO-GENERATED\. DO NOT EDIT\. \*\/\s*/, "")
    .replace(
      /\/\* LEARNINGSEO_RUNTIME_OVERRIDES_START \*\/[\s\S]*?\/\* LEARNINGSEO_RUNTIME_OVERRIDES_END \*\/\s*$/,
      "",
    );
  return (
    "/* AUTO-GENERATED. DO NOT EDIT. */\n" +
    withoutLegacyRoadmapCss(sourceCss) +
    "\n\n" +
    runtimeCss
  );
}

function replaceCssAssets(css, assetMap, base) {
  return css.replace(
    /url\((?!data:)(["']?)([^\)"']+)\1\)/g,
    (match, _quote, value) => {
      const remote = absoluteUrl(value, base);
      return "url(" + (assetMap.get(remote) || value) + ")";
    },
  );
}

async function refreshAssets(routes) {
  await Promise.all([
    fs.mkdir(themeRoot, { recursive: true }),
    fs.mkdir(mediaRoot, { recursive: true }),
  ]);

  const themeBase = siteOrigin + "/wp-content/themes/learningseo/";
  const [themeStyle, roadmapStyle] = await Promise.all([
    fetchText(
      siteOrigin +
        "/wp-content/themes/learningseo/style.css?a=4369&ver=7.1",
    ),
    fetchText(
      siteOrigin +
        "/wp-content/themes/learningseo/single-seo_roadmap.css?a=5480&ver=7.1",
    ),
  ]);
  const sourceCss = themeStyle + "\n" + roadmapStyle;
  const themeUrls = unique(
    [...sourceCss.matchAll(/url\((?!data:)(["']?)([^\)"']+)\1\)/g)].map(
      (match) => absoluteUrl(match[2], themeBase),
    ),
  );
  const themeEntries = await runPool(themeUrls, async (url) => [
    url,
    "/sites/" +
      siteKey +
      "/subpages/theme/" +
      (await downloadAsset(url, themeRoot)),
  ]);
  const themeMap = new Map(themeEntries);

  const inlineUrls = routes.flatMap((route) =>
    [...(route.html || "").matchAll(/url\((?!data:)(["']?)([^\)"']+)\1\)/g)]
      .map((match) => match[2]),
  );
  const mediaUrls = unique(
    [...routes.flatMap((route) => route.images || []), ...inlineUrls]
      .filter(Boolean)
      .map((url) => absoluteUrl(url)),
  );
  const mediaEntries = await runPool(mediaUrls, async (url) => [
    url,
    "/sites/" +
      siteKey +
      "/subpages/media/" +
      (await downloadAsset(url, mediaRoot)),
  ]);

  return {
    css: prefixCss(replaceCssAssets(sourceCss, themeMap, themeBase)),
    mediaEntries,
  };
}

function normalizeRoute(route) {
  const sourcePath = normalizePath(route.sourcePath);
  const finalUrl =
    route.finalUrl || route.sourceUrl || siteOrigin + sourcePath;
  const finalPath = normalizePath(
    route.finalPath || new URL(finalUrl, siteOrigin).pathname,
  );
  const redirectTo =
    route.redirectTo ||
    (sourcePath === "/the-seo-learning-roadmap/" ||
    sourcePath !== finalPath
      ? finalPath
      : null);

  return {
    ...route,
    canonical: route.canonical || siteOrigin + finalPath,
    finalPath,
    redirectTo: redirectTo ? normalizePath(redirectTo) : null,
    sourcePath,
  };
}

function validateManifest(routes) {
  const paths = new Set(routes.map((route) => route.sourcePath));
  for (const route of routes) {
    if (route.redirectTo && !paths.has(route.redirectTo)) {
      throw new Error(
        "Missing redirect target " +
          route.redirectTo +
          " for " +
          route.sourcePath,
      );
    }
    if (
      route.sourcePath !== "/" &&
      !route.redirectTo &&
      !route.contentFile
    ) {
      throw new Error("Missing content file for " + route.sourcePath);
    }

    const visited = new Set();
    let current = route;
    while (current?.redirectTo) {
      if (visited.has(current.sourcePath)) {
        throw new Error("Redirect cycle at " + current.sourcePath);
      }
      visited.add(current.sourcePath);
      current = routes.find(
        (candidate) => candidate.sourcePath === current.redirectTo,
      );
    }
  }
}

async function buildGeneratedOutput(routes, generatedAt, css, mediaEntries) {
  const staged = generatedRoot + ".staged-" + randomUUID();
  const contentRoot = path.join(staged, "content");
  await fs.mkdir(contentRoot, { recursive: true });
  const browser = await launchBrowser();

  try {
    const manifestRoutes = await runWithPages(
      browser,
      routes,
      async (page, route) => {
        const base = {
          bodyClass: route.bodyClass || "",
          canonical: route.canonical,
          contentFile: null,
          description: route.description || "",
          finalPath: route.finalPath,
          hasRoadmap: false,
          mainClass: route.mainClass || "",
          redirectTo: route.redirectTo,
          roadmapItemCurrent: false,
          roadmapItemHref: null,
          roadmapLinkHref: null,
          sourcePath: route.sourcePath,
          title: route.title,
        };
        if (route.sourcePath === "/" || route.redirectTo) return base;

        const sanitized = await sanitizeRouteHtml(
          page,
          route,
          mediaEntries,
        );
        for (const warning of sanitized.warnings) {
          console.warn(route.sourcePath + ": " + warning);
        }
        const document = contentDocument(sanitized.html);
        const contentFile = sha256(document) + ".html";
        await fs.writeFile(path.join(contentRoot, contentFile), document);

        return {
          ...base,
          contentFile,
          hasRoadmap: sanitized.hasRoadmap,
          roadmapItemCurrent: sanitized.roadmapItemCurrent,
          roadmapItemHref: sanitized.activeItemHref,
          roadmapLinkHref: sanitized.activeLinkHref,
        };
      },
    );

    validateManifest(manifestRoutes);
    const manifest = {
      generatedAt,
      routes: manifestRoutes,
      source: siteOrigin,
      version: 1,
    };
    await Promise.all([
      fs.writeFile(
        path.join(staged, "manifest.json"),
        JSON.stringify(manifest, null, 2) + "\n",
      ),
      fs.writeFile(path.join(staged, "subpage.css"), cssDocument(css)),
    ]);
    const validation = await validateGeneratedSite({
      contentRoot,
      manifest,
    });
    console.log(
      "Validated " +
        validation.internalLinks +
        " internal links and " +
        validation.assets +
        " local assets.",
    );
    await replaceDirectoryAtomic(staged, generatedRoot);
    return manifest;
  } catch (error) {
    await fs.rm(staged, { recursive: true, force: true });
    throw error;
  } finally {
    await browser.close();
  }
}

async function main() {
  const options = parseArguments();
  let generatedAt;
  let routes;
  let css;
  let mediaEntries = [];

  if (options.mode === "refresh") {
    routes = await collectRoutes();
    generatedAt = new Date().toISOString();
    await writeFileAtomic(
      rawCachePath,
      JSON.stringify({ generatedAt, routes }) + "\n",
    );
    const refreshed = await refreshAssets(routes);
    css = refreshed.css;
    mediaEntries = refreshed.mediaEntries;
  } else {
    const snapshot = await loadSnapshot(options.source);
    generatedAt = snapshot.generatedAt;
    routes = snapshot.routes;
    css = await fs.readFile(snapshotCssPath, "utf8");
  }

  validateRoutes(routes);
  const normalizedRoutes = routes.map(normalizeRoute);
  const manifest = await buildGeneratedOutput(
    normalizedRoutes,
    generatedAt,
    css,
    mediaEntries,
  );
  await writeFileAtomic(
    routeReportPath,
    JSON.stringify(
      {
        finalRoutes: unique(
          manifest.routes.map((route) => route.finalPath),
        ).length,
        routes: manifest.routes.map(
          ({
            canonical,
            finalPath,
            redirectTo,
            sourcePath,
            title,
          }) => ({
            canonical,
            finalPath,
            redirectTo,
            sourcePath,
            title,
          }),
        ),
        sitemapEntries: manifest.routes.length,
        source: siteOrigin,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Generated " +
      manifest.routes.length +
      " routes in " +
      generatedRoot +
      ".",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
