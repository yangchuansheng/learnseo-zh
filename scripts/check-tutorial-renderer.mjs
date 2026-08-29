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
const [route, model, seo, headerModule, navigationMock] = await Promise.all([
  jiti.import(path.join(repositoryRoot, "src/components/tutorials/route.tsx")),
  jiti.import(path.join(repositoryRoot, "src/lib/tutorials/model.ts")),
  jiti.import(path.join(repositoryRoot, "src/lib/tutorials/seo.tsx")),
  jiti.import(path.join(repositoryRoot, "src/components/sites/learningseo-io-071dae18/root-8a5edab2/HeaderNavigation.tsx")),
  jiti.import(path.join(repositoryRoot, "scripts/fixtures/next-navigation.mock.mjs")),
]);

const hex = (value) => value.repeat(64);
const sourceCanonical = "https://developers.google.com/search/docs/fundamentals/seo-starter-guide";
const allTrue = (keys) => Object.fromEntries(keys.map((key) => [key, true]));
const fixturePath = path.join(repositoryRoot, "src/content/tutorials/fixtures/semantic-fixture.html");
const contentRoot = path.join(repositoryRoot, "src/content/tutorials/content");
const englishHtml = await fs.readFile(fixturePath, "utf8");
const chineseHtml = englishHtml.replace(
  "Accessible tutorials preserve the source meaning.",
  "Localized tutorials preserve the source meaning.",
);
const expectedSemanticMetrics = {
  h1: 1,
  h2: 2,
  h3: 1,
  h4: 1,
  h5: 1,
  h6: 1,
  p: 6,
  a: 1,
  table: 1,
  code: 1,
  pre: 1,
  blockquote: 1,
  img: 1,
  figure: 1,
  figcaption: 1,
  iframe: 1,
};
const htmlByLocale = { "zh-CN": chineseHtml, en: englishHtml };
const validationByLocale = Object.fromEntries(
  Object.entries(htmlByLocale).map(([locale, source]) => [
    locale,
    model.validateTutorialHtml(source, `renderer fixture ${locale}`, {
      requireTags: ["pre", "blockquote", "iframe"],
    }),
  ]),
);
const contentHashByLocale = Object.fromEntries(
  Object.entries(htmlByLocale).map(([locale, source]) => [locale, model.sha256(source)]),
);
const createdFixtureFiles = new Set();
let contentRootExisted = true;

try {
  await fs.access(contentRoot);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  contentRootExisted = false;
}

function tutorialRecord(locale, status = "published") {
  const contentHash = contentHashByLocale.en;
  const sourceContentHash = hex("b");
  const translationContentHash = contentHashByLocale["zh-CN"];
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
    contentMetrics: expectedSemanticMetrics,
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

async function ensureContentFile(contentFile, source) {
  await fs.mkdir(contentRoot, { recursive: true });
  const target = path.join(contentRoot, contentFile);
  try {
    const existing = await fs.readFile(target, "utf8");
    assert.equal(existing, source, `${contentFile} must contain the renderer fixture content`);
    return;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await fs.writeFile(target, source, "utf8");
  createdFixtureFiles.add(target);
}

async function cleanupContentFiles() {
  for (const target of createdFixtureFiles) {
    await fs.rm(target, { force: true });
  }
  if (!contentRootExisted) {
    try {
      await fs.rmdir(contentRoot);
    } catch (error) {
      if (!["ENOENT", "ENOTEMPTY"].includes(error.code)) throw error;
    }
  }
}

async function render(locale, status = "published") {
  const record = tutorialRecord(locale, status);
  const element = await route.renderTutorialRecord(locale, record, {
    redirectResolver: async () => null,
  });
  return { markup: renderToStaticMarkup(element), record };
}

function renderHeader(pathname, locale) {
  navigationMock.setMockPathname(pathname);
  return renderToStaticMarkup(
    React.createElement(headerModule.HeaderNavigation, {
      header: { menuTitle: "Menu", navigation: [], social: [] },
      locale,
    }),
  );
}

try {
  await Promise.all(
    Object.entries(htmlByLocale).map(([locale, source]) =>
      ensureContentFile(`${contentHashByLocale[locale]}.html`, source),
    ),
  );

  assert.deepEqual(validationByLocale.en.headingIds, [
    "semantic-fixture",
    "block-code",
    "supported-embed",
    "nested-section",
    "deep-topic",
    "fine-detail",
    "source-note",
  ]);
  assert.deepEqual(validationByLocale.en.metrics, expectedSemanticMetrics);
  assert.deepEqual(validationByLocale["zh-CN"].metrics, expectedSemanticMetrics);
  const preparedHtml = route.prepareTutorialHtmlForRender(englishHtml);
  assert.match(preparedHtml, /data-tutorial-table/);
  assert.doesNotMatch(preparedHtml, /<h1\b/i);
  const nestedPreparedHtml = route.prepareTutorialHtmlForRender([
    "<article><h1 id=\"nested-table\">Nested table</h1>",
    "<table><tbody><tr><td>Outer",
    "<table><tbody><tr><td>Inner</td></tr></tbody></table>",
    "</td></tr></tbody></table></article>",
  ].join(""));
  assert.equal(count(nestedPreparedHtml, /data-tutorial-table/g), 1);
  assert.match(nestedPreparedHtml, /Outer<table><tbody><tr><td>Inner/);

  for (const locale of ["zh-CN", "en"]) {
    const { markup, record } = await render(locale);
    assert.deepEqual(record.contentMetrics, expectedSemanticMetrics);
    assert.equal(count(markup, /<h1\b/g), 1, `${locale} must render one page h1`);
    assert.match(markup, new RegExp(`data-tutorial-slug="${record.slug}"`));
    assert.match(markup, new RegExp(`data-tutorial-status="${record.status}"`));
    assert.match(markup, new RegExp(locale === "en" ? "Accessible tutorials preserve" : "Localized tutorials preserve"));
    assert.match(markup, /href="#semantic-fixture"/);
    assert.match(markup, /href="#block-code"/);
    assert.match(markup, /href="#fine-detail"/);
    assert.match(markup, /class="tutorial-table-wrapper"/);
    assert.match(markup, /overflow-x-auto/);
    assert.match(markup, /min-w-0/);
    assert.match(markup, /_pre\]:overflow-x-auto/);
    assert.match(markup, /_h5/);
    assert.match(markup, /_h6/);
    assert.match(markup, /_img\]:max-w-full/);
    assert.match(markup, /_iframe\]:aspect-video/);
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

  assert.match(renderHeader("/tutorials/semantic-guide/", "zh-CN"), /href="\/en\/tutorials\/semantic-guide\/"/);
  assert.match(renderHeader("/en/tutorials/semantic-guide/", "en"), /href="\/tutorials\/semantic-guide\/"/);
  assert.match(renderHeader("/privacy-policy-terms-of-use/", "zh-CN"), /href="\/en\/privacy-policy-terms-of-use\/"/);

  const mismatchHash = hex("e");
  const englishRecord = tutorialRecord("en");
  await ensureContentFile(`${mismatchHash}.html`, englishHtml);
  await assert.rejects(
    () => route.loadTutorialHtml("en", {
      ...englishRecord,
      snapshot: { ...englishRecord.snapshot, contentHash: mismatchHash },
      contentFile: `${mismatchHash}.html`,
    }),
    /hash does not match expected SHA-256/,
  );
  await assert.rejects(
    () => route.loadTutorialHtml("en", {
      ...englishRecord,
      toc: [...englishRecord.toc, { id: "missing-anchor", title: "Missing anchor", level: 2 }],
    }),
    /TOC anchor is missing from HTML/,
  );
  await assert.rejects(
    () => route.loadTutorialHtml("en", {
      ...englishRecord,
      toc: [{ id: "1-unsafe", title: "Unsafe anchor", level: 1 }],
    }),
    /TOC anchor is unsafe/,
  );
  await assert.rejects(
    () => route.loadTutorialHtml("en", {
      ...englishRecord,
      toc: [
        { id: "semantic-fixture", title: "Semantic fixture", level: 1 },
        { id: "semantic-fixture", title: "Semantic fixture again", level: 1 },
      ],
    }),
    /TOC anchor is duplicated/,
  );
  await assert.rejects(
    () => route.loadTutorialHtml("en", {
      ...englishRecord,
      toc: [
        { id: "block-code", title: "Block code", level: 2 },
        { id: "semantic-fixture", title: "Semantic fixture", level: 1 },
      ],
    }),
    /TOC anchors must follow HTML heading order/,
  );

  const previewMetadata = seo.createTutorialMetadata(tutorialRecord("zh-CN", "draft"), "zh-CN", {
    indexable: false,
    includeAlternates: false,
  });
  assert.equal(previewMetadata.robots.index, false);
  assert.equal(previewMetadata.robots.follow, false);

  console.log("Tutorial renderer contract passed: locale files, hashes, TOC, media, tables, attribution, header language links, and preview metadata.");
} finally {
  await cleanupContentFiles();
}
