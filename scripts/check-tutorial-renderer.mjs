import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createJiti } from "jiti";

globalThis.React = React;

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, {
  alias: {
    "@": path.join(repositoryRoot, "src"),
    "next/image": path.join(repositoryRoot, "scripts/fixtures/next-image.mock.mjs"),
    "next/link": path.join(repositoryRoot, "scripts/fixtures/next-link.mock.mjs"),
    "next/navigation": path.join(repositoryRoot, "scripts/fixtures/next-navigation.mock.mjs"),
  },
  jsx: true,
});
const [route, model, seo] = await Promise.all([
  jiti.import(path.join(repositoryRoot, "src/components/tutorials/route.tsx")),
  jiti.import(path.join(repositoryRoot, "src/lib/tutorials/model.ts")),
  jiti.import(path.join(repositoryRoot, "src/lib/tutorials/seo.tsx")),
]);

const hex = (value) => value.repeat(64);
const sourceCanonical = "https://developers.google.com/search/docs/fundamentals/seo-starter-guide";
const allTrue = (keys) => Object.fromEntries(keys.map((key) => [key, true]));
const fixturePath = path.join(repositoryRoot, "src/content/tutorials/fixtures/semantic-fixture.html");
const html = await fs.readFile(fixturePath, "utf8");

function tutorialRecord(locale, status = "published") {
  const contentHash = hex("a");
  const sourceContentHash = hex("b");
  const translationContentHash = hex("c");
  const now = "2026-08-29T00:00:00.000Z";
  return {
    slug: "semantic-guide",
    path: locale === "en" ? "/en/tutorials/semantic-guide/" : "/tutorials/semantic-guide/",
    title: locale === "en" ? "Semantic Guide" : "Semantic Guide zh-CN",
    description: "A renderer contract fixture.",
    provider: "Google Search Central",
    status,
    activeVersion: 1,
    sourceKey: sourceCanonical,
    source: {
      title: "Search Engine Optimization (SEO) Starter Guide",
      provider: "Google Search Central / Google for Developers",
      author: null,
      canonicalUrl: sourceCanonical,
      sourcePath: "/seo_roadmap/seo-fundamentals/",
      requestedUrl: sourceCanonical,
      finalUrl: sourceCanonical,
      contentType: "text/html",
      license: { text: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
    },
    snapshot: {
      version: 1,
      capturedAt: now,
      sourceUpdatedAt: "2025-12-10T00:00:00.000Z",
      pageCanonicalUrl: sourceCanonical,
      canonicalMatched: true,
      requestedUrl: sourceCanonical,
      finalUrl: sourceCanonical,
      sourceContentHash,
      contentHash,
      translationContentHash,
      history: [],
    },
    translation: {
      sourceLanguage: "en",
      language: "zh-CN",
      translator: status === "published" ? "Translator" : null,
      translatedAt: status === "published" ? now : null,
      reviewedAt: status === "published" ? now : null,
      sourceSections: 3,
      translatedSections: 3,
      contentHash: translationContentHash,
      contentFile: `${translationContentHash}.html`,
    },
    review: {
      decision: status === "published" ? "approved" : "pending",
      reviewer: status === "published" ? "Reviewer" : null,
      reviewedAt: status === "published" ? now : null,
      notes: "Renderer fixture.",
      checklist: allTrue(model.TUTORIAL_REVIEW_CHECKLIST_KEYS),
      history: [],
    },
    qualification: {
      decision: status === "published" ? "qualified" : "pending",
      reviewer: status === "published" ? "Reviewer" : null,
      reviewedAt: status === "published" ? now : null,
      checklist: allTrue(model.TUTORIAL_QUALIFICATION_CHECKLIST_KEYS),
    },
    contentFile: locale === "en" ? `${contentHash}.html` : `${translationContentHash}.html`,
    toc: [
      { id: "semantic-fixture", title: "Semantic fixture", level: 1 },
      { id: "block-code", title: "Block code", level: 2 },
      { id: "supported-embed", title: "Supported embed", level: 2 },
      { id: "nested-section", title: "Nested section", level: 3 },
      { id: "deep-topic", title: "Deep topic", level: 4 },
      { id: "fine-detail", title: "Fine detail", level: 5 },
      { id: "source-note", title: "Source note", level: 6 },
    ],
    media: [{
      path: "/sites/learningseo-io-071dae18/tutorials/semantic-diagram.png",
      sha256: hex("d"),
      alt: "Semantic tutorial diagram",
      sourceUrl: "https://example.com/diagram.png",
      width: 640,
      height: 360,
    }],
    contentMetrics: {
      h1: 1,
      h2: 1,
      h3: 1,
      p: 3,
      ul: 1,
      ol: 1,
      li: 3,
      a: 1,
      table: 1,
      code: 1,
      pre: 1,
      blockquote: 1,
      img: 1,
      figure: 1,
      figcaption: 1,
      iframe: 1,
    },
    seo: {
      title: "Semantic Guide",
      description: "A renderer contract fixture.",
      indexable: status === "published",
      dateModified: now,
    },
  };
}

function count(source, pattern) {
  return (source.match(pattern) ?? []).length;
}

async function render(locale, status = "published") {
  const record = tutorialRecord(locale, status);
  const preparedHtml = route.prepareTutorialHtmlForRender(html);
  const element = await route.renderTutorialRecord(locale, record, {
    contentLoader: async () => preparedHtml,
    redirectResolver: async () => null,
  });
  return { markup: renderToStaticMarkup(element), record };
}

const validation = model.validateTutorialHtml(html, "renderer fixture", {
  requireTags: ["pre", "blockquote", "iframe"],
});
assert.deepEqual(validation.headingIds, [
  "semantic-fixture",
  "block-code",
  "supported-embed",
  "nested-section",
  "deep-topic",
  "fine-detail",
  "source-note",
]);
const preparedHtml = route.prepareTutorialHtmlForRender(html);
assert.match(preparedHtml, /data-tutorial-table/);
assert.doesNotMatch(preparedHtml, /<h1\b/i);

for (const locale of ["zh-CN", "en"]) {
  const { markup, record } = await render(locale);
  assert.equal(count(markup, /<h1\b/g), 1, `${locale} must render one page h1`);
  assert.match(markup, new RegExp(`data-tutorial-slug="${record.slug}"`));
  assert.match(markup, new RegExp(`data-tutorial-status="${record.status}"`));
  assert.match(markup, /href="#semantic-fixture"/);
  assert.match(markup, /href="#block-code"/);
  assert.match(markup, /href="#fine-detail"/);
  assert.match(markup, /class="tutorial-table-wrapper"/);
  assert.match(markup, /overflow-x-auto/);
  assert.match(markup, /w-\[calc\(100%-40px\)\]/);
  assert.match(markup, /max-w-\[1224px\]/);
  assert.match(markup, /min-w-0/);
  assert.match(markup, /_h5/);
  assert.match(markup, /_h6/);
  assert.match(markup, /_img\]:max-w-full/);
  assert.match(markup, /_iframe\]:w-full/);
  assert.match(markup, /src="\/sites\/learningseo-io-071dae18\/tutorials\/semantic-diagram.png"/);
  assert.match(markup, /alt="Semantic tutorial diagram"/);
  assert.match(markup, /www.youtube-nocookie.com\/embed\/dQw4w9WgXcQ/);
  assert.match(markup, /title="YouTube privacy-enhanced example"/);
  assert.match(markup, new RegExp(`href="${sourceCanonical}"`));
  assert.match(markup, /\/seo_roadmap\/seo-fundamentals\//);
  assert.match(markup, /CC BY 4.0/);
  assert.match(markup, /application\/ld\+json/);
  assert.match(markup, /isBasedOn/);
  assert.match(
    markup,
    new RegExp(`href="${locale === "en" ? "/tutorials/semantic-guide/" : "/en/tutorials/semantic-guide/"}"`),
  );
}

const previewMetadata = seo.createTutorialMetadata(tutorialRecord("zh-CN", "draft"), "zh-CN", {
  indexable: false,
  includeAlternates: false,
});
assert.equal(previewMetadata.robots.index, false);
assert.equal(previewMetadata.robots.follow, false);

console.log("Tutorial renderer contract passed: locales, semantics, TOC, media, tables, attribution, and preview metadata.");
