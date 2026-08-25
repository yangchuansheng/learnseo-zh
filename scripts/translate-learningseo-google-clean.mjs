import fs from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const cachePath = path.resolve("temp/learningseo-translation-cache.json");
const cleanCachePath = path.resolve("temp/learningseo-translation-cache-google.json");
const executablePath =
  process.env.TRANSLATION_CHROME ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function buildBatches(values) {
  const batches = [];
  let current = [];
  let length = 0;
  for (const value of values) {
    if (current.length && (current.length >= 30 || length + value.length + 1 > 2600)) {
      batches.push(current);
      current = [];
      length = 0;
    }
    current.push(value);
    length += value.length + 1;
  }
  if (current.length) batches.push(current);
  return batches;
}

async function translateBatch(page, batch) {
  const query = batch.join("\n");
  const url =
    "https://translate.google.com/?sl=en&tl=zh-CN&text=" +
    encodeURIComponent(query) +
    "&op=translate";
  await page.goto("about:blank");
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(
    (expected) => document.querySelectorAll(".ryNqvb").length === expected,
    batch.length,
    { timeout: 8000 },
  );
    return page.locator(".ryNqvb").allTextContents().then((values) =>
    values.map((value) => value.trim()),
  );
}

async function translateWithRetry(page, batch) {
  try {
    return await translateBatch(page, batch);
  } catch {
    if (batch.length === 1) {
      return batch;
    }
    const middle = Math.ceil(batch.length / 2);
    const left = await translateWithRetry(page, batch.slice(0, middle));
    const right = await translateWithRetry(page, batch.slice(middle));
    return [...left, ...right];
  }
}

const sourceCache = JSON.parse(await fs.readFile(cachePath, "utf8"));
// Long HTML paragraphs are preserved for manual editorial translation.
const keys = Object.keys(sourceCache).filter((value) => value.length <= 450);
const batchSafeKeys = keys.filter((value) => !/[<>&\n]/.test(value) && !/^[,.)]/.test(value));
const individualKeys = keys.filter((value) => !batchSafeKeys.includes(value));
const batches = [
  ...buildBatches(batchSafeKeys),
  ...individualKeys.map((value) => [value]),
];
const output = { ...sourceCache };
const browser = await chromium.launch({ headless: true, executablePath });
const pages = await Promise.all(Array.from({ length: 8 }, () => browser.newPage()));
let cursor = 0;
let completed = 0;

async function worker(page) {
  while (true) {
    const index = cursor++;
    if (index >= batches.length) return;
    const batch = batches[index];
    const translated = await translateWithRetry(page, batch);
    batch.forEach((source, itemIndex) => {
      output[source] = translated[itemIndex] || source;
    });
    completed += batch.length;
    if (completed % 200 < batch.length || completed === keys.length) {
      console.log(`Translated ${completed}/${keys.length} strings`);
      await fs.writeFile(cleanCachePath, JSON.stringify(output, null, 2) + "\n");
    }
  }
}

try {
  await Promise.all(pages.map(worker));
  await fs.writeFile(cleanCachePath, JSON.stringify(output, null, 2) + "\n");
} finally {
  await browser.close();
}
