import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inventoryPath = path.join(repositoryRoot, "docs/research/wayfinder-seo-fundamentals-inventory.md");
const cardUrls = [
  "https://developers.google.com/search/docs/fundamentals/how-search-works",
  "https://developers.google.com/search/docs/essentials",
  "https://moz.com/beginners-guide-to-seo",
  "https://ahrefs.com/blog/seo-basics/",
  "https://www.contentkingapp.com/academy/seo-guide/",
  "https://mangools.com/blog/learn-seo/",
  "https://www.semrush.com/academy/courses/seo-fundamentals-course-with-greg-gifford/",
];
const requiredFields = [
  "Card:",
  "Source:",
  "HTTP/content:",
  "Topology:",
  "Media/embed:",
  "Attribution/license:",
  "Recommendation:",
];
const dispositions = [
  "eligible for direct import",
  "eligible for direct import",
  "manual series handling",
  "after rights approval",
  "External resource-center disposition",
  "after manual body/media and rights review",
  "External course disposition",
];

function sectionFor(inventory, index) {
  const heading = `### ${index + 1}.`;
  const start = inventory.indexOf(heading);
  assert.notEqual(start, -1, `missing source section ${index + 1}`);
  const next = inventory.indexOf("### ", start + heading.length);
  return inventory.slice(start, next === -1 ? inventory.length : next);
}

const inventory = await fs.readFile(inventoryPath, "utf8");

assert.match(inventory, /^# SEO Fundamentals Source Tutorial Inventory\n/m);
assert.match(inventory, /issues\/20\)/);
assert.match(inventory, /^## Decision$/m);
assert.match(inventory, /^## Eligibility and evidence method$/m);
assert.match(inventory, /^## Per-source findings$/m);
assert.match(inventory, /^## Cross-source follow-up$/m);

for (const [index, cardUrl] of cardUrls.entries()) {
  const section = sectionFor(inventory, index);
  assert.match(section, new RegExp(cardUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const field of requiredFields) assert.ok(section.includes(field), `source ${index + 1} lacks ${field}`);
  assert.match(section, /\[[^\]]+\]\(https:\/\//, `source ${index + 1} lacks primary-source links`);
  assert.match(section, new RegExp(dispositions[index], "i"), `source ${index + 1} lacks its disposition`);
}

console.log(`Validated ${cardUrls.length} SEO Fundamentals source tutorial classifications.`);
