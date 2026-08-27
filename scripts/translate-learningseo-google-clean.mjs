import fs from "node:fs/promises";
import path from "node:path";

const cachePath = path.resolve("temp/learningseo-translation-cache.json");
const cleanCachePath = path.resolve("temp/learningseo-translation-cache-google.json");

function decodeHtml(value) {
  return value
    .replace(/<br\s*\/?>(?=.)/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/gi, "'");
}

async function translateBatch(_page, batch) {
  const query = batch.join("\n");
  const url = `https://translate.google.com/m?sl=en&tl=zh-CN&q=${encodeURIComponent(query)}`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Google Translate returned ${response.status}`);
      const html = await response.text();
      const result = html.match(/<div class="result-container">([\s\S]*?)<\/div>/)?.[1];
      if (!result) throw new Error("Google Translate result was unavailable");
      const translated = decodeHtml(result).split(/\r?\n/).map((value) => value.trim());
      if (translated.length !== batch.length) throw new Error("Google Translate batch length changed");
      return translated;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw new Error("Google Translate request failed");
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
const existingCache = await fs
  .readFile(cleanCachePath, "utf8")
  .then((value) => JSON.parse(value))
  .catch(() => ({}));
const forceRefresh = process.env.FORCE_GOOGLE_TRANSLATION === "1";
// Long HTML paragraphs are preserved for manual editorial translation.
const keys = Object.keys(sourceCache).filter(
  (value) =>
    value.length <= 450 &&
    (forceRefresh ? true : !existingCache[value] || existingCache[value] === value),
);
const batches = keys.map((value) => [value]);
const output = { ...sourceCache, ...existingCache };
const pages = Array.from({ length: 8 }, () => null);
let cursor = 0;
let completed = 0;

async function worker(page) {
  while (true) {
    const index = cursor++;
    if (index >= batches.length) return;
    const batch = batches[index];
    const translated = await translateWithRetry(page, batch);
    batch.forEach((source, itemIndex) => {
      const candidate = translated[itemIndex] || source;
      if (candidate !== source || !output[source]) output[source] = candidate;
    });
    completed += batch.length;
    if (completed % 200 < batch.length || completed === keys.length) {
      console.log(`Translated ${completed}/${keys.length} strings`);
      await fs.writeFile(cleanCachePath, JSON.stringify(output, null, 2) + "\n");
    }
  }
}

await Promise.all(pages.map(worker));
await fs.writeFile(cleanCachePath, JSON.stringify(output, null, 2) + "\n");
