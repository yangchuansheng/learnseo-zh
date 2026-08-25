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
