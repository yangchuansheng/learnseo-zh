import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";

import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:3107";
const systemChromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const executablePath =
  process.env.PLAYWRIGHT_EXECUTABLE_PATH ||
  (await fs.access(systemChromePath).then(() => systemChromePath).catch(() => undefined));
let serverProcess;

async function isReachable(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

if (!process.env.BASE_URL && !(await isReachable(baseUrl))) {
  serverProcess = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3107"],
    { stdio: "ignore" },
  );
  process.on("exit", () => serverProcess?.kill("SIGTERM"));
  for (let attempt = 0; attempt < 50 && !(await isReachable(baseUrl)); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!(await isReachable(baseUrl))) throw new Error(`Smoke server did not start at ${baseUrl}`);
}
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
});

try {
  const context = await browser.newContext({
    viewport: { height: 844, width: 390 },
  });
  const page = await context.newPage();
  const browserErrors = [];
  page.setDefaultNavigationTimeout(10000);
  page.setDefaultTimeout(5000);
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(String(error)));

  const trailingSlash = await context.request.get(baseUrl + "/updates", {
    maxRedirects: 0,
  });
  assert.equal(trailingSlash.status(), 308);
  assert.equal(trailingSlash.headers().location, "/updates/");

  await page.goto(baseUrl + "/updates/", {
    waitUntil: "domcontentloaded",
  });
  assert.equal(
    await page.locator('link[rel="canonical"]').getAttribute("href"),
    "https://learningseo.io/updates/",
  );
  assert.match(
    await page.locator("iframe").getAttribute("src"),
    /^https:\/\/embeds\.beehiiv\.com\//,
  );

  await page.goto(baseUrl + "/seo_roadmap/optimize-ai-search/", {
    waitUntil: "domcontentloaded",
  });
  const sidebarButton = page.locator('[data-subpage-action="sidebar"]');
  const sidebar = page.locator(".resources-sidebar");
  assert.equal(await sidebarButton.evaluate((element) => element.tagName), "BUTTON");
  assert.equal(
    await sidebar.evaluate((element) => getComputedStyle(element).display),
    "none",
  );
  await sidebarButton.press("Enter");
  assert.equal(await sidebarButton.getAttribute("aria-expanded"), "true");
  assert.equal(
    await sidebar.evaluate((element) => getComputedStyle(element).display),
    "block",
  );

  const faqButton = page.locator('[data-subpage-action="faq"]').first();
  await faqButton.press("Enter");
  const answerId = await faqButton.getAttribute("aria-controls");
  assert.equal(await faqButton.getAttribute("aria-expanded"), "true");
  assert.equal(
    await page.locator("#" + answerId).getAttribute("aria-hidden"),
    "false",
  );

  const shareButton = page.locator('[data-subpage-action="share"]').first();
  await shareButton.click();
  assert.equal(await shareButton.getAttribute("aria-expanded"), "true");
  assert.equal(
    await page
      .locator("#" + (await shareButton.getAttribute("aria-controls")))
      .getAttribute("aria-hidden"),
    "false",
  );
  assert.equal(
    await page.locator("#roadmap[data-react-roadmap]").count(),
    1,
  );
  assert.match(
    (
      await page
        .locator('#roadmap [aria-current="page"]')
        .first()
        .textContent()
    ) || "",
    /Optimize for AI Search|AI 搜索/,
  );

  await page.goto(
    baseUrl + "/seo_roadmap/execute-seo/setting-seo-goals/",
    { waitUntil: "domcontentloaded" },
  );
  const playButton = page.locator('[data-subpage-action="video"]').first();
  assert.equal(await playButton.evaluate((element) => element.tagName), "BUTTON");
  assert.match(await playButton.getAttribute("aria-label"), /^播放[\s\S]*[\u3400-\u9fff]/);
  await playButton.click();
  assert.equal(await page.locator(".video.playing").count(), 1);
  assert.match(
    await page.locator(".video.playing iframe").first().getAttribute("src"),
    /[?&]autoplay=1(?:&|$)/,
  );

  await page.goto(baseUrl + "/seo_roadmap/implement-in-cms/shopify-seo-guidelines/", {
    waitUntil: "domcontentloaded",
  });
  assert.match(
    await page.locator('[data-subpage-action="video"]').first().getAttribute("aria-label"),
    /^播放[\s\S]*Shopify[\s\S]*[\u3400-\u9fff]/,
  );
  assert.ok(await page.locator('img[alt="Tweet"]').count());
  assert.ok(await page.locator('img[alt="Threads"]').count());
  assert.ok(await page.locator('img[alt="Linkedin"]').count());

  await page.goto(baseUrl + "/en/seo_roadmap/optimize-ai-search/", {
    waitUntil: "domcontentloaded",
  });
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
  assert.equal(
    await page.locator('link[rel="canonical"]').getAttribute("href"),
    "https://learningseo.io/en/seo_roadmap/optimize-ai-search/",
  );
  assert.equal(
    await page.locator('link[rel="alternate"][hreflang="zh-CN"]').getAttribute("href"),
    "https://learningseo.io/seo_roadmap/optimize-ai-search/",
  );
  assert.equal(
    await page.locator('a[aria-label="切换到简体中文"]').getAttribute("href"),
    "/seo_roadmap/optimize-ai-search/",
  );

  await page.goto(baseUrl + "/", { waitUntil: "domcontentloaded" });
  assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
  assert.equal(
    await page.locator('a[aria-label="Switch to English"]').getAttribute("href"),
    "/en/",
  );
  const search = page.locator('form[role="search"]').first();
  assert.equal(await search.getAttribute("action"), "/");
  assert.equal(await search.locator('input[name="s"]').count(), 1);

  await page.goto(baseUrl + "/en/", { waitUntil: "domcontentloaded" });
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
  assert.equal(
    await page.locator('a[aria-label="切换到简体中文"]').getAttribute("href"),
    "/",
  );
  assert.equal(await page.locator('form[role="search"]').first().getAttribute("action"), "/en/");
  assert.equal(
    await page.locator('link[rel="canonical"]').getAttribute("href"),
    "https://learningseo.io/en/",
  );
  assert.deepEqual(browserErrors, []);

  console.log("LearningSEO production smoke test passed.");
} finally {
  await browser.close();
  serverProcess?.kill("SIGTERM");
}
