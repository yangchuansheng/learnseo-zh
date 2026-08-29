import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";
import { normalizeSourceKey } from "../src/lib/tutorials/source-key.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origin = "https://learningseo.io";
const hex = (value) => value.repeat(64);
const allTrue = (keys) => Object.fromEntries(keys.map((key) => [key, true]));
const reviewChecklistKeys = [
  "contentComplete",
  "dataPreserved",
  "factsPreserved",
  "logicPreserved",
  "terminologyCorrect",
  "chineseNatural",
  "authorVoicePreserved",
  "linksPreserved",
  "mediaVerified",
  "attributionPresent",
  "seoVerified",
];
const qualificationChecklistKeys = [
  "publiclyAccessible",
  "continuousBody",
  "topicComplete",
  "singlePage",
  "canonicalVerified",
];

async function loadProductionModules() {
  const jiti = createJiti(import.meta.url, {
    alias: { "@": path.join(repositoryRoot, "src") },
    jsx: true,
  });
  const [manifest, route, seo, sitemap, url, robots] = await Promise.all([
    jiti.import(path.join(repositoryRoot, "src/lib/tutorials/manifest.ts")),
    jiti.import(path.join(repositoryRoot, "src/components/tutorials/route.tsx")),
    jiti.import(path.join(repositoryRoot, "src/lib/tutorials/seo.tsx")),
    jiti.import(path.join(repositoryRoot, "src/app/sitemap.ts")),
    jiti.import(path.join(repositoryRoot, "src/lib/tutorials/url.ts")),
    jiti.import(path.join(repositoryRoot, "src/app/robots.ts")),
  ]);
  return { manifest, route, seo, sitemap, url, robots };
}

function tutorialRecord(
  locale,
  slug,
  {
    canonicalUrl = "https://example.com/guide",
    status = "published",
    version = 1,
    redirectTo,
  } = {},
) {
  const contentHash = hex("a");
  const sourceContentHash = hex("b");
  const translationContentHash = hex("c");
  const now = "2026-08-29T00:00:00.000Z";
  return {
    slug,
    path: locale === "en" ? `/en/tutorials/${slug}/` : `/tutorials/${slug}/`,
    title: "SEO <Guide>",
    description: "A tested tutorial",
    provider: "Example",
    status,
    activeVersion: version,
    sourceKey: normalizeSourceKey(canonicalUrl),
    source: {
      title: "SEO <Guide>",
      provider: "Example",
      author: "Example Author",
      canonicalUrl,
      sourcePath: "/roadmap/guide/",
      requestedUrl: canonicalUrl,
      finalUrl: canonicalUrl,
      contentType: "text/html",
      license: "CC BY 4.0",
    },
    snapshot: {
      version,
      capturedAt: now,
      sourceUpdatedAt: "2026-08-28T00:00:00.000Z",
      pageCanonicalUrl: canonicalUrl,
      canonicalMatched: true,
      requestedUrl: canonicalUrl,
      finalUrl: canonicalUrl,
      sourceContentHash,
      contentHash,
      translationContentHash,
      history: [],
    },
    translation: {
      sourceLanguage: "en",
      language: "zh-CN",
      translator: "Translator",
      translatedAt: now,
      reviewedAt: now,
      sourceSections: 1,
      translatedSections: 1,
      contentHash: translationContentHash,
      contentFile: `${translationContentHash}.html`,
    },
    review: {
      decision: status === "published" ? "approved" : "pending",
      reviewer: status === "published" ? "Reviewer" : null,
      reviewedAt: status === "published" ? now : null,
      notes: "Fixture review state.",
      checklist: allTrue(reviewChecklistKeys),
      history: [],
    },
    qualification: {
      decision: status === "published" ? "qualified" : "pending",
      reviewer: status === "published" ? "Reviewer" : null,
      reviewedAt: status === "published" ? now : null,
      checklist: allTrue(qualificationChecklistKeys),
    },
    contentFile: locale === "en" ? `${contentHash}.html` : `${translationContentHash}.html`,
    toc: [{ id: "seo-guide", title: "SEO Guide", level: 1 }],
    media: [],
    contentMetrics: {
      h1: 1,
      p: 1,
      a: 1,
    },
    seo: {
      title: "SEO <Guide>",
      description: "A tested tutorial",
      indexable: status === "published" && redirectTo === undefined,
      dateModified: now,
    },
    ...(redirectTo === undefined ? {} : { redirectTo }),
  };
}

function tutorialManifest(locale, generation, routes) {
  return {
    $schema: "https://learningseo.io/schemas/tutorial-manifest.json",
    schemaVersion: 1,
    locale,
    generation,
    activeVersion: 1,
    available: true,
    routes,
    aliases: [],
  };
}

function sortedSlugs(routes) {
  return routes.map((route) => route.slug).sort();
}

function assertMetadataContract(metadata, canonical, indexable, languages) {
  assert.equal(metadata.alternates.canonical, canonical);
  assert.equal(metadata.robots.index, indexable);
  assert.equal(metadata.robots.follow, indexable);
  assert.equal(metadata.robots.googleBot.index, indexable);
  assert.equal(metadata.robots.googleBot.follow, indexable);
  if (languages) assert.deepEqual(metadata.alternates.languages, languages);
  else assert.equal(metadata.alternates.languages, undefined);
}

async function assertProductionContract(production) {
  const { manifest, route, seo, sitemap, url, robots } = production;
  const canonicalZh = "https://EXAMPLE.com/guide/?utm_source=pilot&b=2&a=1#overview";
  const canonicalEn = "https://example.com/guide?a=1&b=2";
  const zh = tutorialRecord("zh-CN", "guide", { canonicalUrl: canonicalZh });
  const en = tutorialRecord("en", "guide", { canonicalUrl: canonicalEn });
  const previewZh = tutorialRecord("zh-CN", "preview", { status: "draft" });
  const previewEn = tutorialRecord("en", "preview", { status: "draft" });
  const aliasZh = tutorialRecord("zh-CN", "legacy-guide", {
    canonicalUrl: "https://example.com/legacy-guide",
    redirectTo: "/tutorials/guide/",
  });
  const aliasEn = tutorialRecord("en", "legacy-guide", {
    canonicalUrl: "https://example.com/legacy-guide",
    redirectTo: "/en/tutorials/guide/",
  });
  const zhManifest = tutorialManifest("zh-CN", "generation-1", [zh, previewZh, aliasZh]);
  const enManifest = tutorialManifest("en", "generation-1", [en, previewEn, aliasEn]);

  assert.equal(url.tutorialPath("guide", "zh-CN"), "/tutorials/guide/");
  assert.equal(url.tutorialPath("guide", "en"), "/en/tutorials/guide/");
  assert.equal(url.tutorialUrl("guide", "zh-CN"), `${origin}/tutorials/guide/`);
  assert.equal(url.tutorialUrl("guide", "en"), `${origin}/en/tutorials/guide/`);
  assert.deepEqual(url.tutorialAlternates("guide"), {
    "zh-CN": `${origin}/tutorials/guide/`,
    en: `${origin}/en/tutorials/guide/`,
  });
  assert.deepEqual(robots.default(), {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${origin}/sitemap.xml`,
  });
  assert.equal(url.normalizeSourceKey(canonicalZh), url.normalizeSourceKey(canonicalEn));
  assert.equal(
    url.normalizeSourceKey("https://example.com:443/guide"),
    url.normalizeSourceKey("https://example.com/guide"),
  );
  assert.notEqual(
    url.normalizeSourceKey("https://example.com:8443/guide"),
    url.normalizeSourceKey("https://example.com/guide"),
  );

  const pairs = manifest.getPublishedTutorialPairsFromManifests(zhManifest, enManifest);
  assert.deepEqual(pairs.map(({ zh: pairZh }) => pairZh.slug), ["guide"]);
  const rejectPublishedDrift = (enRoute, message) => {
    assert.throws(
      () => manifest.getPublishedTutorialPairsFromManifests(
        tutorialManifest("zh-CN", "generation-1", [zh]),
        tutorialManifest("en", "generation-1", [enRoute]),
      ),
      message,
    );
  };
  rejectPublishedDrift(
    { ...en, toc: [{ id: "changed", title: "SEO Guide", level: 1 }] },
    /TOC pairing failed/,
  );
  rejectPublishedDrift(
    {
      ...en,
      media: [{
        path: "/sites/learningseo-io-071dae18/tutorials/other.png",
        sha256: hex("d"),
        alt: "Other diagram",
      }],
    },
    /media pairing failed/,
  );
  rejectPublishedDrift(
    { ...en, contentMetrics: { ...en.contentMetrics, p: 2 } },
    /content metrics pairing failed/,
  );
  rejectPublishedDrift(
    { ...en, source: { ...en.source, provider: "Other" } },
    /source pairing failed/,
  );
  rejectPublishedDrift(
    {
      ...en,
      snapshot: { ...en.snapshot, contentHash: hex("d") },
      contentFile: `${hex("d")}.html`,
    },
    /content hash pairing failed/,
  );
  rejectPublishedDrift(
    { ...en, translation: { ...en.translation, contentFile: `${hex("e")}.html` } },
    /content file pairing failed/,
  );
  assert.throws(
    () => manifest.getPublishedTutorialPairsFromManifests(
      {
        ...tutorialManifest("zh-CN", "generation-1", [zh]),
        aliases: [{ sourceKey: "https://example.com/alias", slug: "guide" }],
      },
      tutorialManifest("en", "generation-1", [en]),
    ),
    /source aliases must be paired/,
  );
  assert.throws(
    () => manifest.getPublishedTutorialPairsFromManifests(
      {
        ...tutorialManifest("zh-CN", "generation-1", [zh]),
        resourceLinkReport: {
          total: 0,
          unique: 0,
          converted: 0,
          fallback: 0,
          rendered: 0,
          duplicateOccurrences: 0,
          unknownFragments: 0,
          occurrences: [],
        },
      },
      tutorialManifest("en", "generation-1", [en]),
    ),
    /resource link reports must be paired/,
  );

  for (const status of ["draft", "review", "stale"]) {
    const conflictingZh = tutorialRecord("zh-CN", `${status}-owner`, {
      canonicalUrl: "https://example.com/shared-source",
      status,
    });
    const conflictingEn = tutorialRecord("en", `${status}-other`, {
      canonicalUrl: "https://example.com/shared-source",
      status,
    });
    const conflictingZhManifest = tutorialManifest("zh-CN", "generation-1", [conflictingZh]);
    const conflictingEnManifest = tutorialManifest("en", "generation-1", [conflictingEn]);
    assert.throws(
      () => manifest.validateTutorialManifestPairOwnership(
        conflictingZhManifest,
        conflictingEnManifest,
      ),
      /source key .* is owned by both/,
    );
    assert.throws(
      () => manifest.getPublishedTutorialPairsFromManifests(
        conflictingZhManifest,
        conflictingEnManifest,
      ),
      /source key .* is owned by both/,
    );
  }

  assert.equal(
    manifest.isIndexableTutorialPair(zh, en, "generation-1", "generation-1"),
    true,
  );
  assert.equal(
    manifest.isIndexableTutorialPair(zh, en, "generation-1", "generation-2"),
    false,
  );
  assert.equal(
    manifest.isIndexableTutorialPair(
      zh,
      { ...en, status: "draft" },
      "generation-1",
      "generation-1",
    ),
    false,
  );
  assert.equal(
    manifest.isIndexableTutorialPair(
      zh,
      { ...en, snapshot: { ...en.snapshot, version: 2 } },
      "generation-1",
      "generation-1",
    ),
    false,
  );
  assert.equal(
    manifest.isIndexableTutorialPair(
      zh,
      { ...en, source: { ...en.source, canonicalUrl: "https://example.com/other" } },
      "generation-1",
      "generation-1",
    ),
    false,
  );
  assert.equal(
    manifest.isIndexableTutorialPair(zh, aliasEn, "generation-1", "generation-1"),
    false,
  );
  const undatedZh = { ...zh, snapshot: { version: 1 }, seo: {} };
  const undatedEn = { ...en, snapshot: { version: 1 }, seo: {} };
  assert.equal(
    manifest.isIndexableTutorialPair(undatedZh, undatedEn, "generation-1", "generation-1"),
    false,
  );
  const seoDatedZh = {
    ...undatedZh,
    seo: { dateModified: "2026-08-29T00:00:00.000Z" },
  };
  const seoDatedEn = {
    ...undatedEn,
    seo: { dateModified: "2026-08-29T00:00:00.000Z" },
  };
  assert.equal(
    manifest.isIndexableTutorialPair(seoDatedZh, seoDatedEn, "generation-1", "generation-1"),
    true,
  );
  assert.equal(
    manifest.getPublishedTutorialPairsFromManifests(
      tutorialManifest("zh-CN", "generation-1", [zh]),
      tutorialManifest("en", null, [en]),
    ).length,
    0,
  );

  const publishedMetadata = seo.createTutorialMetadata(zh, "zh-CN", {
    indexable: true,
    includeAlternates: true,
  });
  assertMetadataContract(
    publishedMetadata,
    `${origin}/tutorials/guide/`,
    true,
    url.tutorialAlternates("guide"),
  );
  assert.equal(publishedMetadata.other.citation_source, canonicalZh);
  const englishMetadata = seo.createTutorialMetadata(en, "en", {
    indexable: true,
    includeAlternates: true,
  });
  assertMetadataContract(
    englishMetadata,
    `${origin}/en/tutorials/guide/`,
    true,
    url.tutorialAlternates("guide"),
  );

  const previewMetadata = seo.createTutorialMetadata(previewZh, "zh-CN", {
    indexable: false,
    includeAlternates: false,
  });
  assertMetadataContract(
    previewMetadata,
    `${origin}/tutorials/preview/`,
    false,
    undefined,
  );
  const aliasMetadata = seo.createTutorialMetadata(aliasZh, "zh-CN", {
    indexable: true,
    includeAlternates: true,
  });
  assert.equal(aliasMetadata.robots.index, false);
  assert.equal(aliasMetadata.robots.follow, false);
  assert.equal(aliasMetadata.alternates, null);
  assert.equal(aliasMetadata.openGraph, null);
  assert.equal(aliasMetadata.other, undefined);

  const structured = seo.createTutorialStructuredData(zh, "zh-CN");
  for (const key of [
    "headline",
    "description",
    "inLanguage",
    "dateModified",
    "author",
    "publisher",
    "mainEntityOfPage",
    "isBasedOn",
  ]) {
    assert.ok(structured[key], `TechArticle is missing ${key}`);
  }
  assert.equal(structured.inLanguage, "zh-CN");
  assert.equal(structured.mainEntityOfPage["@id"], `${origin}/tutorials/guide/`);
  const serialized = seo.serializeTutorialStructuredData(structured);
  assert.match(serialized, /\\u003c/);
  assert.doesNotMatch(serialized, /<Guide>/);

  const sitemapEntries = sitemap.tutorialSitemapEntries(pairs);
  assert.deepEqual(sitemapEntries.map((entry) => entry.url), [
    `${origin}/tutorials/guide/`,
    `${origin}/en/tutorials/guide/`,
  ]);
  for (const entry of sitemapEntries) {
    assert.deepEqual(entry.alternates.languages, url.tutorialAlternates("guide"));
  }
  assert.equal(sitemapEntries.some((entry) => entry.url.includes("/preview/")), false);
  assert.equal(sitemapEntries.some((entry) => entry.url.includes("legacy-guide")), false);

  const redirectRecords = new Map([
    ["legacy-guide", aliasZh],
    ["guide", zh],
  ]);
  assert.equal(
    url.safeTutorialRedirect("/tutorials/guide", "zh-CN", "legacy-guide"),
    "/tutorials/guide/",
  );
  assert.equal(
    manifest.resolveTutorialRedirectPath("zh-CN", aliasZh, redirectRecords),
    "/tutorials/guide/",
  );
  await assert.rejects(
    route.renderTutorialRecord("zh-CN", aliasZh, async (_locale, record) =>
      manifest.resolveTutorialRedirectPath("zh-CN", record, redirectRecords),
    ),
    (error) =>
      typeof error?.digest === "string" &&
      error.digest.includes("/tutorials/guide/") &&
      error.digest.includes(";308;"),
  );

  const self = tutorialRecord("zh-CN", "self", { redirectTo: "/tutorials/self/" });
  assert.throws(
    () => manifest.resolveTutorialRedirectPath("zh-CN", self, new Map([["self", self]])),
    /Unsafe tutorial redirect/,
  );
  const crossLocale = tutorialRecord("zh-CN", "cross-locale", {
    redirectTo: "/en/tutorials/guide/",
  });
  assert.throws(
    () => manifest.resolveTutorialRedirectPath("zh-CN", crossLocale, new Map()),
    /Unsafe tutorial redirect/,
  );
  const missing = tutorialRecord("zh-CN", "missing", { redirectTo: "/tutorials/unknown/" });
  assert.throws(
    () => manifest.resolveTutorialRedirectPath("zh-CN", missing, new Map()),
    /redirect target is missing/,
  );
  const cycleA = tutorialRecord("zh-CN", "cycle-a", { redirectTo: "/tutorials/cycle-b/" });
  const cycleB = tutorialRecord("zh-CN", "cycle-b", { redirectTo: "/tutorials/cycle-a/" });
  assert.throws(
    () => manifest.resolveTutorialRedirectPath(
      "zh-CN",
      cycleA,
      new Map([
        ["cycle-a", cycleA],
        ["cycle-b", cycleB],
      ]),
    ),
    /redirect cycle detected/,
  );
}

async function checkManifestIntegration(production) {
  const { manifest, seo, sitemap, url } = production;
  const [zh, en] = await Promise.all([
    manifest.readTutorialManifest("zh-CN"),
    manifest.readTutorialManifest("en"),
  ]);
  if (!zh.available || !en.available) {
    console.error(
      "Tutorial manifest integration: UNAVAILABLE (both locale manifests are required; status is non-success).",
    );
    return false;
  }

  manifest.validateTutorialManifestPairOwnership(zh, en);
  assert.deepEqual(sortedSlugs(zh.routes), sortedSlugs(en.routes), "Locale tutorial slug sets differ");
  const pairs = manifest.getPublishedTutorialPairsFromManifests(zh, en);
  const pairBySlug = new Map(pairs.map((pair) => [pair.zh.slug, pair]));
  for (const [locale, routes] of [["zh-CN", zh.routes], ["en", en.routes]]) {
    for (const record of routes) {
      const pair = pairBySlug.get(record.slug);
      if (record.status === "published") {
        assert.ok(pair, `${locale}/${record.slug} is published without a validated bilingual pair`);
        assert.ok(seo.tutorialDateModified(record), `${locale}/${record.slug} is missing a valid dateModified`);
      }
      const metadata = seo.createTutorialMetadata(record, locale, {
        indexable: Boolean(pair),
        includeAlternates: Boolean(pair),
      });
      assert.equal(metadata.robots.index, Boolean(pair), `${locale}/${record.slug} indexability drifted`);
      if (manifest.isTutorialRedirect(record)) {
        assert.equal(metadata.robots.index, false, `${locale}/${record.slug} alias must be noindex`);
        assert.equal(metadata.alternates, null, `${locale}/${record.slug} alias must have no alternates`);
        assert.equal(metadata.openGraph, null, `${locale}/${record.slug} alias must have no Open Graph metadata`);
        assert.equal(metadata.other, undefined, `${locale}/${record.slug} alias must have no citation metadata`);
      }
      if (pair) assert.equal(url.normalizeSourceKey(record.source.canonicalUrl),
        url.normalizeSourceKey(locale === "en" ? pair.zh.source.canonicalUrl : pair.en.source.canonicalUrl));
    }
  }
  const entries = sitemap.tutorialSitemapEntries(pairs);
  const expectedEntryUrls = pairs.flatMap((pair) => [
    url.tutorialUrl(pair.zh.slug, "zh-CN"),
    url.tutorialUrl(pair.en.slug, "en"),
  ]);
  assert.deepEqual(entries.map((entry) => entry.url).sort(), expectedEntryUrls.sort());
  console.log(
    `Tutorial manifest integration passed: ${pairs.length} published pair(s), ${zh.routes.length - pairs.length} non-indexable route(s).`,
  );
  return true;
}

async function main() {
  const production = await loadProductionModules();
  await assertProductionContract(production);
  console.log("Tutorial SEO production contract passed: URL, metadata, JSON-LD, sitemap, and redirects.");
  const manifestAvailable = await checkManifestIntegration(production);
  if (!manifestAvailable) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Tutorial SEO contract failed: ${error.message}`);
  process.exitCode = 1;
});
