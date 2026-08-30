import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const decisionsPath = path.join(
  repositoryRoot,
  "docs/research/wayfinder-seo-fundamentals-source-decisions.md",
);

const sourceUrls = [
  "https://developers.google.com/search/docs/fundamentals/how-search-works",
  "https://developers.google.com/search/docs/essentials",
  "https://moz.com/beginners-guide-to-seo",
  "https://ahrefs.com/blog/seo-basics/",
  "https://www.contentkingapp.com/academy/seo-guide/",
  "https://mangools.com/blog/learn-seo/",
  "https://www.semrush.com/academy/courses/seo-fundamentals-course-with-greg-gifford/",
];

const requiredEvidenceUrls = [
  [
    "https://developers.google.com/terms/site-policies",
    "https://creativecommons.org/licenses/by/4.0/",
  ],
  [
    "https://developers.google.com/terms/site-policies",
    "https://creativecommons.org/licenses/by/4.0/",
  ],
  ["https://moz.com/terms-of-use"],
  ["https://ahrefs.com/legal/terms"],
  ["https://www.conductor.com/legal/terms-of-use/"],
  ["https://mangools.com/conditions"],
  ["https://www.semrush.com/company/legal/website-terms-of-use/"],
];

const requiredFields = [
  "Source evidence:",
  "Observed boundary:",
  "Normalization:",
  "Navigation:",
  "Interactive:",
  "Tables and code:",
  "Images and third-party media:",
  "Attribution evidence:",
  "Exact disposition:",
];

const expectedDispositions = [
  "eligible for direct import",
  "eligible for direct import",
  "manual series handling",
  "after rights approval",
  "External resource-center disposition",
  "after manual body/media and rights review",
  "External course disposition",
];

const requiredRules = [
  "sourceKey",
  "requestedUrl",
  "finalUrl",
  "canonicalUrl",
  "sourceUpdatedAt",
  "capturedAt",
  "sourceContentHash",
  "contentHash",
  "contentMetrics",
  "license",
  "author",
  "provider",
  "publisher",
  "heading map",
  "source path",
  "single-page",
  "multi-page",
  "course",
  "translation",
  "published",
  "external",
  "iframe",
  "table",
  "pre",
  "code",
  "images",
  "third-party",
  "written",
  "unsupported",
  "bot-challenge",
  "canonical-mismatch",
  "unsafe-markup",
  "unsupported-media",
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\[\]\\]/g, "\\$&");
}

function sectionFor(document, index) {
  const heading = `### ${index + 1}.`;
  const start = document.indexOf(heading);
  assert.notEqual(start, -1, `missing source section ${index + 1}`);
  const next = document.indexOf("### ", start + heading.length);
  return document.slice(start, next === -1 ? document.length : next);
}

const document = await fs.readFile(decisionsPath, "utf8");

assert.match(document, /^# SEO Fundamentals Source-Specific Normalization and Attribution Decisions\n/m);
assert.match(document, /issues\/22\)/);
assert.match(document, /wayfinder-seo-fundamentals-inventory\.md/);
assert.match(document, /tutorial-internalization-release-gates\.md/);
assert.match(document, /Checked: `2026-08-31`/);

for (const rule of requiredRules) {
  assert.ok(document.includes(rule), `decision artifact lacks required rule: ${rule}`);
}

for (const [index, sourceUrl] of sourceUrls.entries()) {
  const section = sectionFor(document, index);
  assert.match(
    section,
    new RegExp(escapeRegExp(sourceUrl)),
    `source ${index + 1} lacks its inventory URL`,
  );
  for (const field of requiredFields) {
    assert.ok(section.includes(field), `source ${index + 1} lacks ${field}`);
  }
  assert.match(section, /\[[^\]]+\]\(https:\/\//, `source ${index + 1} lacks evidence links`);
  for (const evidenceUrl of requiredEvidenceUrls[index]) {
    assert.match(
      section,
      new RegExp(escapeRegExp(evidenceUrl)),
      `source ${index + 1} lacks owning evidence ${evidenceUrl}`,
    );
  }
  assert.match(
    section,
    new RegExp(escapeRegExp(expectedDispositions[index]), "i"),
    `source ${index + 1} lacks its exact disposition`,
  );
}

assert.match(
  sectionFor(document, 5),
  /single route `h1`[\s\S]*seven additional chapter `h1` labels to `h2`/,
  "Mangools heading normalization is missing",
);

assert.match(document, /`eligible-direct`/);
assert.match(document, /`rights-gated`/);
assert.match(document, /`manual-series`/);
assert.match(document, /`external-collection`/);
assert.match(document, /`external-course`/);
assert.match(document, /npm run tutorials:source-decisions/);
assert.match(document, /npm run tutorials:collect/);
assert.match(document, /npm run tutorials:release-gates/);

console.log(`Validated ${sourceUrls.length} SEO Fundamentals source-specific decisions.`);
