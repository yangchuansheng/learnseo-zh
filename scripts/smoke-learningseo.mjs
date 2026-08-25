import assert from "node:assert/strict";

import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:3107";
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
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
    "/updates/",
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
    /Optimize for AI Search/,
  );

  await page.goto(
    baseUrl + "/seo_roadmap/execute-seo/setting-seo-goals/",
    { waitUntil: "domcontentloaded" },
  );
  const playButton = page.locator('[data-subpage-action="video"]').first();
  assert.equal(await playButton.evaluate((element) => element.tagName), "BUTTON");
  await playButton.click();
  assert.equal(await page.locator(".video.playing").count(), 1);
  assert.match(
    await page.locator(".video.playing iframe").first().getAttribute("src"),
    /[?&]autoplay=1(?:&|$)/,
  );

  await page.goto(baseUrl + "/", { waitUntil: "domcontentloaded" });
  const search = page.locator('form[role="search"]').first();
  assert.equal(
    await search.getAttribute("action"),
    "https://learningseo.io/",
  );
  assert.equal(await search.locator('input[name="s"]').count(), 1);
  assert.deepEqual(browserErrors, []);

  console.log("LearningSEO production smoke test passed.");
} finally {
  await browser.close();
}
