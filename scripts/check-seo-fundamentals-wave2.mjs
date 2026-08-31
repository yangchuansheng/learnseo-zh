import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";

import {
  assertWave2ResourceCardMappings,
  collectRightsAudit,
  sourceDefinitions,
  validateAuditEvidence,
} from "./audit-seo-fundamentals-rights.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tutorialRoot = path.join(repositoryRoot, "src/content/tutorials");
const publicRoot = path.join(repositoryRoot, "public");
const jiti = createJiti(import.meta.url, {
  alias: { "@": path.join(repositoryRoot, "src") },
});
const { localHtml } = await jiti.import(
  path.join(repositoryRoot, "src/components/sites/learningseo-io-071dae18/shared/links.ts"),
);

const wave2ExpectedMedia = new Map([
  ["ahrefs-seo-basics", 17],
  ["mangools-complete-seo-guide", 79],
]);

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function assertNoChineseTranslationLeakage(html, label) {
  assert.doesNotMatch(html, /中文：/, `${label} contains an unfinished translation marker`);
  const textBlocks = [...html.matchAll(/<(?:p|li|h[1-6]|figcaption|blockquote)\b[^>]*>([\s\S]*?)<\/(?:p|li|h[1-6]|figcaption|blockquote)>/gi)]
    .map((match) => match[1].replace(/<[^>]*>|&(?:#\d+|#x[\da-f]+|\w+);/gi, " ").replace(/\s+/g, " ").trim());
  for (const text of textBlocks) {
    const words = text.match(/[A-Za-z]{3,}/g) ?? [];
    assert.ok(/[\u3400-\u9fff]/.test(text) || words.length < 12,
      `${label} contains an untranslated English text block: ${text.slice(0, 80)}`);
  }
}

async function assertWave2PublishedContent() {
  const manifests = await Promise.all([
    readJson(path.join(tutorialRoot, "manifest.json")),
    readJson(path.join(tutorialRoot, "manifest.en.json")),
  ]);
  for (const [index, manifest] of manifests.entries()) {
    const locale = index === 0 ? "zh-CN" : "en";
    for (const definition of sourceDefinitions) {
      const route = manifest.routes.find(({ slug }) => slug === definition.slug);
      assert.equal(route?.status, "published", `${locale}/${definition.slug} is not published`);
      assert.equal(route?.source.canonicalUrl, definition.expectedCanonicalUrl,
        `${locale}/${definition.slug} canonical source differs`);
      assert.match(route?.source.license?.text ?? "", /project owner/i,
        `${locale}/${definition.slug} authorization attribution is missing`);
      assert.equal(route?.media.length, wave2ExpectedMedia.get(definition.slug),
        `${locale}/${definition.slug} approved media count differs`);
      for (const media of route.media) {
        assert.ok(media.path.startsWith(`/sites/learningseo-io-071dae18/tutorials/${definition.slug}/`),
          `${locale}/${definition.slug} media escapes its source directory`);
        await fs.access(path.join(publicRoot, media.path.slice(1)));
      }

      const html = await fs.readFile(path.join(tutorialRoot, "content", route.contentFile), "utf8");
      assert.equal((html.match(/<h1\b/gi) ?? []).length, 1, `${locale}/${definition.slug} must have one h1`);
      if (locale === "zh-CN") assertNoChineseTranslationLeakage(html, `${locale}/${definition.slug}`);
      if (definition.slug === "ahrefs-seo-basics") {
        assert.match(html, /id=["']references["']/i, `${locale}/ahrefs article references boundary is missing`);
        continue;
      }
      for (const chapter of ["part2", "part3", "part4", "part5", "part6", "part7", "part8"]) {
        assert.match(html, new RegExp(`<h2\\b[^>]*\\bid=["']${chapter}["']`, "i"),
          `${locale}/mangools chapter ${chapter} was not normalized to h2`);
      }
      assert.doesNotMatch(html, /<(?:form|input|select|textarea)\b/i,
        `${locale}/mangools includes an active form control`);
      assert.match(html, /<iframe\b[^>]*\bsrc=["']https:\/\/www\.youtube\.com\/embed\//i,
        `${locale}/mangools reviewed YouTube iframe is missing`);
      assert.match(html, /<iframe\b[^>]*\btitle=["'][^"']+"/i,
        `${locale}/mangools iframe title is missing`);
      assert.match(html, /href=["']https:\/\/mangools\.com\/blog\/learn-seo\/["']/i,
        `${locale}/mangools static interaction CTA is missing`);
    }
  }
}

async function assertBilingualCardConversion() {
  const generatedRoot = path.join(
    repositoryRoot,
    "src/components/sites/learningseo-io-071dae18/subpages/generated",
  );
  const cards = await Promise.all([
    ["manifest.json", "content", "en"],
    ["manifest.zh-CN.json", "content-zh-CN", "zh-CN"],
  ].map(async ([manifestFile, contentDirectory, locale]) => {
    const manifest = await readJson(path.join(generatedRoot, manifestFile));
    const route = manifest.routes.find(({ sourcePath, finalPath, contentFile }) =>
      sourcePath === "/seo_roadmap/seo-fundamentals/" &&
      finalPath === "/seo_roadmap/seo-fundamentals/" && contentFile,
    );
    assert.ok(route, `${locale} SEO Fundamentals resource cards are missing`);
    return [locale, await fs.readFile(path.join(generatedRoot, contentDirectory, route.contentFile), "utf8")];
  }));
  for (const [locale, card] of cards) {
    const localized = localHtml(card, locale);
    const prefix = locale === "en" ? "/en" : "";
    assert.match(localized, new RegExp(`href=["']${prefix}/tutorials/ahrefs-seo-basics/["']`),
      `${locale} Ahrefs resource card was not converted`);
    assert.match(localized, new RegExp(`href=["']${prefix}/tutorials/mangools-complete-seo-guide/["']`),
      `${locale} Mangools resource card was not converted`);
  }
}

assert.equal(sourceDefinitions.length, 2, "Wave 2 must contain exactly two authorized sources");

const evidence = await collectRightsAudit();
await validateAuditEvidence(evidence);

for (const definition of sourceDefinitions) {
  const source = evidence.sources.find(({ sourceId }) => sourceId === definition.sourceId);
  assert.ok(source, `Missing ${definition.sourceId}`);
  assert.equal(source.collection.status, "collected-in-memory");
  assert.equal(source.contentType, "text/html");
  assert.equal(source.terms.status, 200);
  assert.equal(source.terms.contentType?.split(";", 1)[0].toLowerCase(), "text/html");
  assert.equal(source.terms.finalUrl, definition.termsUrl);
  assert.match(source.terms.contentHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(source.terms.signals, {
    ownershipLanguage: true,
    permissionLanguage: true,
    copyRestrictionLanguage: true,
    openLicenseLanguage: false,
  });
  assert.deepEqual(
    source.terms.sourceAssertions,
    Object.fromEntries(definition.termsAssertions.map(([id]) => [id, true])),
    `${definition.sourceId} lacks source-specific terms evidence`,
  );
  assert.equal(source.rights.disposition, "authorized-internalized");
  assert.equal(source.rights.authorizationHandoff.approver, "project-owner");
  assert.ok(source.rights.authorizationHandoff.scope.includes("translated full-text internal republication"));
  assert.ok(source.rights.authorizationHandoff.scope.includes("approved article media localization"));
  if (definition.sourceId === "mangools-complete-seo-guide") {
    assert.ok(source.rights.authorizationHandoff.scope.includes("static external CTA treatment for forms, quiz, and certificate"));
    assert.ok(source.rights.authorizationHandoff.scope.includes("allowlisted YouTube embed"));
  }
  assert.equal(source.externalDisposition.cardAction, "convert-to-local-tutorial-route");
  assert.equal(source.externalDisposition.routeSlug, definition.slug);
  assert.equal(source.importArtifacts.published, true);
  assert.equal(source.canonicalUrl, definition.expectedCanonicalUrl);
}

const ahrefs = evidence.sources.find(({ sourceId }) => sourceId === "ahrefs-seo-basics");
const mangools = evidence.sources.find(({ sourceId }) => sourceId === "mangools-complete-seo-guide");
assert.match(ahrefs.sourceUpdatedAt ?? "", /^\d{4}-\d{2}-\d{2}T/);
assert.deepEqual(ahrefs.updateEvidence, {
  jsonLdDateModified: null,
  articleModifiedTimeOrVisibleDate: null,
  httpLastModified: ahrefs.httpLastModified,
});
assert.deepEqual(ahrefs.rights.reasonCodes, []);
assert.match(mangools.updateEvidence.jsonLdDateModified ?? "", /^\d{4}-\d{2}-\d{2}T/);
assert.match(mangools.updateEvidence.articleModifiedTimeOrVisibleDate ?? "", /^\d{4}-\d{2}-\d{2}T/);
assert.equal(mangools.sourceUpdatedAt, mangools.updateEvidence.jsonLdDateModified);

await assertWave2ResourceCardMappings();
await assertBilingualCardConversion();
await assertWave2PublishedContent();

console.log(`Validated ${sourceDefinitions.length} Wave 2 sources as authorized internalized tutorials.`);
