import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, {
  alias: { "@": path.join(repositoryRoot, "src") },
});
const model = await jiti.import(path.join(repositoryRoot, "src/lib/tutorials/model.ts"));

const hex = (value) => value.repeat(64);
const allTrue = (keys) => Object.fromEntries(keys.map((key) => [key, true]));

function schemaError(label, message) {
  return new Error(`${label}: ${message}`);
}

function matchesSchemaType(type, value) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "object") return value && typeof value === "object" && !Array.isArray(value);
  return typeof value === type;
}

function resolveRef(rootSchema, ref) {
  const pathSegments = ref.replace(/^#\//, "").split("/");
  return pathSegments.reduce((node, segment) => node?.[segment], rootSchema);
}

function assertSchemaValid(schema, value, label, rootSchema = schema) {
  if (schema.$ref) return assertSchemaValid(resolveRef(rootSchema, schema.$ref), value, label, rootSchema);
  if (schema.anyOf) {
    const errors = [];
    for (const candidate of schema.anyOf) {
      try {
        assertSchemaValid(candidate, value, label, rootSchema);
        return;
      } catch (error) {
        errors.push(error.message);
      }
    }
    throw schemaError(label, `must match one schema: ${errors.join("; ")}`);
  }
  if (schema.const !== undefined) assert.deepEqual(value, schema.const, `${label} const mismatch`);
  if (schema.enum) assert.ok(schema.enum.includes(value), `${label} enum mismatch`);
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    assert.ok(types.some((type) => matchesSchemaType(type, value)), `${label} type mismatch`);
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      throw schemaError(label, `minLength ${schema.minLength} failed`);
    }
    if (schema.pattern) assert.match(value, new RegExp(schema.pattern), `${label} pattern mismatch`);
    if (schema.format === "date-time") {
      assert.match(
        value,
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/,
        `${label} date-time format mismatch`,
      );
      assert.ok(Number.isFinite(Date.parse(value)), `${label} date-time parse mismatch`);
    }
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      throw schemaError(label, `minimum ${schema.minimum} failed`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      throw schemaError(label, `maximum ${schema.maximum} failed`);
    }
  }
  if (Array.isArray(value) && schema.items) {
    value.forEach((item, index) => assertSchemaValid(schema.items, item, `${label}[${index}]`, rootSchema));
  }
  if (matchesSchemaType("object", value)) {
    for (const key of schema.required ?? []) {
      assert.ok(Object.hasOwn(value, key), `${label}.${key} is required by schema`);
    }
    const properties = schema.properties ?? {};
    for (const [key, item] of Object.entries(value)) {
      const propertySchema = properties[key];
      if (propertySchema) {
        assertSchemaValid(propertySchema, item, `${label}.${key}`, rootSchema);
      } else if (schema.additionalProperties === false) {
        throw schemaError(label, `${key} is unsupported by schema`);
      } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        assertSchemaValid(schema.additionalProperties, item, `${label}.${key}`, rootSchema);
      }
    }
  }
}

function record(locale, overrides = {}) {
  const contentHash = hex("a");
  const sourceHash = hex("b");
  const translationHash = hex("c");
  return {
    slug: "semantic-guide",
    path: locale === "en" ? "/en/tutorials/semantic-guide/" : "/tutorials/semantic-guide/",
    title: locale === "en" ? "Semantic Guide" : "语义指南",
    description: "A durable tutorial model fixture.",
    provider: "Example Publisher",
    status: "published",
    activeVersion: 1,
    sourceKey: "https://example.com/guide",
    source: {
      title: "Semantic Guide",
      provider: "Example Publisher",
      author: null,
      canonicalUrl: "https://example.com/guide",
      sourcePath: "/roadmap/guide/",
      requestedUrl: "https://example.com/guide",
      finalUrl: "https://example.com/guide",
      contentType: "text/html",
      license: { text: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
    },
    snapshot: {
      version: 1,
      capturedAt: "2026-08-29T00:00:00.000Z",
      sourceUpdatedAt: "2026-08-28T00:00:00.000Z",
      pageCanonicalUrl: "https://example.com/guide",
      canonicalMatched: true,
      requestedUrl: "https://example.com/guide",
      finalUrl: "https://example.com/guide",
      sourceContentHash: sourceHash,
      contentHash,
      translationContentHash: translationHash,
      history: [],
    },
    translation: {
      sourceLanguage: "en",
      language: "zh-CN",
      translator: "Translator",
      translatedAt: "2026-08-29T00:00:00.000Z",
      reviewedAt: "2026-08-29T00:00:00.000Z",
      sourceSections: 2,
      translatedSections: 2,
      contentHash: translationHash,
      contentFile: `${translationHash}.html`,
    },
    review: {
      decision: "approved",
      reviewer: "Reviewer",
      reviewedAt: "2026-08-29T00:00:00.000Z",
      notes: "Reviewed fixture.",
      checklist: allTrue(model.TUTORIAL_REVIEW_CHECKLIST_KEYS),
      history: [],
    },
    qualification: {
      decision: "qualified",
      reviewer: "Reviewer",
      reviewedAt: "2026-08-29T00:00:00.000Z",
      checklist: allTrue(model.TUTORIAL_QUALIFICATION_CHECKLIST_KEYS),
    },
    contentFile: locale === "en" ? `${contentHash}.html` : `${translationHash}.html`,
    toc: [{ id: "semantic-guide", title: "Semantic Guide", level: 1 }],
    media: [{
      path: "/sites/learningseo-io-071dae18/tutorials/diagram.png",
      sha256: hex("d"),
      alt: "A semantic diagram",
      sourceUrl: "https://example.com/diagram.png",
    }],
    contentMetrics: { h1: 1, h2: 1, p: 2, pre: 1, code: 1, blockquote: 1, iframe: 1 },
    seo: {
      title: "Semantic Guide",
      description: "A durable tutorial model fixture.",
      indexable: true,
      dateModified: "2026-08-29T00:00:00.000Z",
    },
    ...overrides,
  };
}

function manifest(locale, routes, overrides = {}) {
  return {
    $schema: "https://learningseo.io/schemas/tutorial-manifest.json",
    schemaVersion: 1,
    locale,
    generation: "generation-1",
    activeVersion: 1,
    routes,
    aliases: [],
    ...overrides,
  };
}

const zh = model.parseTutorialManifest(manifest("zh-CN", [record("zh-CN")]), "zh-CN");
const en = model.parseTutorialManifest(manifest("en", [record("en")]), "en");

assert.equal(zh.routes[0].sourceKey, "https://example.com/guide");
assert.equal(en.routes[0].contentFile, `${hex("a")}.html`);
assert.equal(zh.routes[0].contentFile, `${hex("c")}.html`);
assert.equal(zh.routes[0].translation.contentFile, `${hex("c")}.html`);
assert.deepEqual(model.validateTutorialManifestPair(zh, en).generation, "generation-1");
assert.equal(model.isSha256(hex("f")), true);
assert.equal(model.isSha256(hex("F")), false);
assert.equal(model.isSha256("invalid"), false);
assert.equal(model.isTutorialRecord(record("zh-CN")), true);
assert.equal(model.isTutorialRecord(record("zh-CN"), "zh-CN"), true);
assert.equal(model.isTutorialRecord(record("zh-CN"), "en"), false);

const fixture = await fs.readFile(
  path.join(repositoryRoot, "src/content/tutorials/fixtures/semantic-fixture.html"),
  "utf8",
);
const fixtureResult = model.validateTutorialHtml(fixture, "semantic fixture", {
  requireTags: ["pre", "blockquote", "iframe"],
});
assert.equal(fixtureResult.metrics.pre, 1);
assert.equal(fixtureResult.metrics.blockquote, 1);
assert.equal(fixtureResult.metrics.iframe, 1);

const committedManifestFiles = [
  ["zh-CN", "src/content/tutorials/manifest.json"],
  ["en", "src/content/tutorials/manifest.en.json"],
];
for (const [locale, relativePath] of committedManifestFiles) {
  const filePath = path.join(repositoryRoot, relativePath);
  const value = JSON.parse(await fs.readFile(filePath, "utf8"));
  assertSchemaValid(model.TUTORIAL_MANIFEST_SCHEMA, value, relativePath);
  assert.equal(model.parseTutorialManifest(value, locale, relativePath).locale, locale);
}

assert.throws(
  () => model.parseTutorialManifest({ routes: [] }, "zh-CN"),
  /schemaVersion must be 1/,
);
assert.throws(
  () => model.parseTutorialManifest(manifest("zh-CN", [], { records: [] }), "zh-CN"),
  /unsupported key records/,
);
assert.throws(
  () => model.parseTutorialManifest(manifest("zh-CN", [record("zh-CN", { contentFile: "../guide.html" })]), "zh-CN"),
  /content-addressed SHA-256 filename/,
);
assert.throws(
  () => model.parseTutorialManifest(manifest("en", [record("en", { contentFile: `${hex("c")}.html` })]), "en"),
  /contentFile must match snapshot.contentHash/,
);
assert.throws(
  () => model.parseTutorialManifest(manifest("zh-CN", [record("zh-CN", { contentFile: `${hex("a")}.html` })]), "zh-CN"),
  /contentFile must match snapshot.translationContentHash/,
);
assert.throws(
  () => model.parseTutorialManifest(manifest("zh-CN", [record("zh-CN", {
    translation: { ...record("zh-CN").translation, contentFile: `${hex("e")}.html` },
  })]), "zh-CN"),
  /translation.contentFile must match contentHash/,
);
assert.throws(
  () => model.parseTutorialManifest(manifest("zh-CN", [record("zh-CN", {
    translation: { ...record("zh-CN").translation, contentHash: undefined },
  })]), "zh-CN"),
  /contentFile requires contentHash/,
);
assert.throws(
  () => model.parseTutorialManifest(manifest("zh-CN", [{
    ...record("zh-CN"),
    source: { ...record("zh-CN").source, canonicalUrl: "http://example.com/guide" },
  }]), "zh-CN"),
  /absolute HTTPS URL/,
);
assert.throws(
  () => model.validateTutorialHtml(fixture.replace("www.youtube-nocookie.com", "evil.example.com")),
  /outside the allowlist/,
);
assert.throws(
  () => model.validateTutorialHtml(fixture.replace("<blockquote", "<script><blockquote")),
  /unsupported <script>/,
);
assert.throws(
  () => model.validateTutorialHtml("<article><h1 id=\"x\">Title</h1><p><a href=\"javascript:alert(1)\" href=\"https://safe.example/\">safe</a></p></article>"),
  /duplicate attribute href/,
);
assert.throws(
  () => model.validateTutorialHtml("<article><h1 id=\"x\">Title</h1><p><img src=\"/sites/%2e%2e/secret.png\" alt=\"Diagram\"></p></article>"),
  /repository-local path/,
);
assert.throws(
  () => model.validateTutorialHtml("<article><h1 id=\"x\">Title</h1><p><img src=\"/sites//learningseo-io-071dae18/tutorials/a.png\" alt=\"Diagram\"></p></article>"),
  /repository-local path/,
);
assert.throws(
  () => model.validateTutorialManifestPair(zh, { ...en, generation: "generation-2" }),
  /share one generation/,
);
assert.throws(
  () => model.validateTutorialManifestPair(
    zh,
    model.parseTutorialManifest(manifest("en", [
      { ...record("en"), toc: [{ id: "different", title: "Different", level: 1 }] },
    ]), "en"),
  ),
  /TOC pairing failed/,
);
assert.throws(
  () => model.validateTutorialManifestPair(
    zh,
    model.parseTutorialManifest(manifest("en", [
      { ...record("en"), media: [{ ...record("en").media[0], path: "/sites/learningseo-io-071dae18/tutorials/other.png" }] },
    ]), "en"),
  ),
  /media pairing failed/,
);
assert.throws(
  () => model.parseTutorialManifest(manifest("zh-CN", [record("zh-CN", {
    media: [{ ...record("zh-CN").media[0], path: "/sites/example/tutorials/diagram.png" }],
  })]), "zh-CN"),
  /repository-local path/,
);
assert.throws(
  () => model.parseTutorialManifest(manifest("zh-CN", [{
    ...record("zh-CN"),
    sourceKey: "https://example.com/other",
  }]), "zh-CN"),
  /sourceKey does not match/,
);

const incompletePublished = {
  ...record("zh-CN"),
  snapshot: { ...record("zh-CN").snapshot, sourceUpdatedAt: undefined },
  translation: { ...record("zh-CN").translation, translator: null, sourceSections: 0, translatedSections: 0 },
  review: { ...record("zh-CN").review, reviewer: null, reviewedAt: null },
  qualification: { ...record("zh-CN").qualification, reviewer: null, reviewedAt: null },
};
assert.throws(
  () => model.validateTutorialRecord(incompletePublished, "zh-CN"),
  /sourceUpdatedAt/,
);
assert.throws(
  () => model.validateTutorialRecord({
    ...record("zh-CN"),
    snapshot: { ...record("zh-CN").snapshot, translationContentHash: undefined },
  }, "zh-CN"),
  /translationContentHash/,
);
assert.throws(
  () => model.validateTutorialRecord({
    ...record("zh-CN"),
    translation: { ...record("zh-CN").translation, contentHash: hex("e"), contentFile: `${hex("e")}.html` },
  }, "zh-CN"),
  /translation contentHash must match/,
);
assert.throws(
  () => model.validateTutorialRecord({
    ...record("zh-CN"),
    translation: { ...record("zh-CN").translation, contentFile: undefined },
  }, "zh-CN"),
  /translation contentFile/,
);
assert.throws(
  () => model.validateTutorialRecord({
    ...record("zh-CN"),
    review: { ...record("zh-CN").review, reviewer: null },
  }, "zh-CN"),
  /review reviewer/,
);
assert.throws(
  () => model.validateTutorialRecord({
    ...record("zh-CN"),
    qualification: { ...record("zh-CN").qualification, reviewedAt: null },
  }, "zh-CN"),
  /qualification timestamp/,
);
assert.throws(
  () => model.validateTutorialRecord({
    ...record("zh-CN"),
    translation: { ...record("zh-CN").translation, translatedSections: 0 },
  }, "zh-CN"),
  /positive bilingual sections/,
);
assert.throws(
  () => model.validateTutorialRecord({
    ...record("zh-CN"),
    snapshot: {
      ...record("zh-CN").snapshot,
      history: [{
        version: 1,
        canonicalUrl: "https://example.com/guide",
        sourceContentHash: hex("b"),
        contentHash: hex("a"),
        canonicalMatched: "true",
      }],
    },
  }, "zh-CN"),
  /canonicalMatched must be boolean/,
);
model.parseTutorialManifest(manifest("zh-CN", [], {
  resourceLinkReport: {
    total: 3,
    unique: 2,
    converted: 2,
    fallback: 1,
    rendered: 6,
    duplicateOccurrences: 1,
    unknownFragments: 1,
    occurrences: [
      { sourceKey: "https://example.com/guide", slug: "semantic-guide", fragment: "#overview", converted: true },
      { sourceKey: "https://example.com/guide", slug: "semantic-guide", fragment: "#overview", converted: true },
      { sourceKey: "https://example.com/missing", slug: null, fragment: "#missing", converted: false },
    ],
  },
}), "zh-CN");
assert.throws(
  () => model.parseTutorialManifest(manifest("zh-CN", [], { resourceLinkReport: {} }), "zh-CN"),
  /total/,
);
assert.throws(
  () => model.parseTutorialManifest(manifest("zh-CN", [], {
    resourceLinkReport: {
      total: 3,
      unique: 2,
      converted: 3,
      fallback: 1,
      rendered: 6,
      duplicateOccurrences: 1,
      unknownFragments: 1,
      occurrences: [
        { sourceKey: "https://example.com/guide", slug: "semantic-guide", fragment: "#overview", converted: true },
        { sourceKey: "https://example.com/guide", slug: "semantic-guide", fragment: "#overview", converted: true },
        { sourceKey: "https://example.com/missing", slug: null, fragment: "#missing", converted: false },
      ],
    },
  }), "zh-CN"),
  /must equal total/,
);
assert.throws(
  () => model.parseTutorialManifest(manifest("zh-CN", [], {
    resourceLinkReport: {
      total: 2,
      unique: 1,
      converted: 2,
      fallback: 0,
      rendered: 4,
      duplicateOccurrences: 1,
      unknownFragments: 0,
      occurrences: [
        { sourceKey: "https://example.com/guide", slug: "semantic-guide", fragment: "#overview", converted: true },
        { sourceKey: "https://example.com/guide", slug: null, fragment: "#overview", converted: true },
      ],
    },
  }), "zh-CN"),
  /slug is required/,
);
assert.throws(
  () => model.parseTutorialManifest(manifest("zh-CN", [], {
    resourceLinkReport: {
      total: 2,
      unique: 1,
      converted: 2,
      fallback: 0,
      rendered: 4,
      duplicateOccurrences: 1,
      unknownFragments: 0,
      occurrences: [
        { sourceKey: "https://example.com/guide", slug: "semantic-guide", fragment: "#overview", converted: true },
        { sourceKey: "https://example.com/guide", slug: "other-guide", fragment: "#overview", converted: true },
      ],
    },
  }), "zh-CN"),
  /must resolve to one slug/,
);
assert.throws(
  () => model.parseTutorialManifest(manifest("zh-CN", [], {
    resourceLinkReport: {
      total: 1,
      unique: 1,
      converted: 0,
      fallback: 1,
      rendered: 2,
      duplicateOccurrences: 0,
      unknownFragments: 0,
      occurrences: [
        { sourceKey: "https://example.com/missing", slug: null, fragment: "#missing", converted: false },
      ],
    },
  }), "zh-CN"),
  /unknownFragments must match/,
);

const redirectTargetSource = {
  ...record("zh-CN").source,
  canonicalUrl: "https://example.com/target",
  requestedUrl: "https://example.com/target",
  finalUrl: "https://example.com/target",
};
const redirectSourceMetadata = {
  ...record("zh-CN").source,
  canonicalUrl: "https://example.com/legacy",
  requestedUrl: "https://example.com/legacy",
  finalUrl: "https://example.com/legacy",
};
const redirectTarget = record("zh-CN", {
  slug: "target",
  path: "/tutorials/target/",
  sourceKey: "https://example.com/target",
  source: redirectTargetSource,
  snapshot: {
    ...record("zh-CN").snapshot,
    pageCanonicalUrl: "https://example.com/target",
    requestedUrl: "https://example.com/target",
    finalUrl: "https://example.com/target",
  },
});
const redirectSource = record("zh-CN", {
  slug: "legacy",
  path: "/tutorials/legacy/",
  sourceKey: "https://example.com/legacy",
  source: redirectSourceMetadata,
  snapshot: {
    ...record("zh-CN").snapshot,
    pageCanonicalUrl: "https://example.com/legacy",
    requestedUrl: "https://example.com/legacy",
    finalUrl: "https://example.com/legacy",
  },
  redirectTo: "/tutorials/target/",
});
model.parseTutorialManifest(manifest("zh-CN", [redirectSource, redirectTarget]), "zh-CN");
assert.throws(
  () => model.parseTutorialManifest(manifest("zh-CN", [
    { ...redirectSource, redirectTo: "/tutorials/missing/" },
  ]), "zh-CN"),
  /redirect target is missing/,
);
assert.throws(
  () => model.parseTutorialManifest(manifest("zh-CN", [
    { ...redirectSource, redirectTo: "/en/tutorials/target/" },
    redirectTarget,
  ]), "zh-CN"),
  /Unsafe tutorial redirect/,
);
assert.throws(
  () => model.parseTutorialManifest(manifest("zh-CN", [
    { ...redirectSource, redirectTo: "/tutorials/legacy/" },
  ]), "zh-CN"),
  /Unsafe tutorial redirect/,
);
assert.throws(
  () => model.parseTutorialManifest(manifest("zh-CN", [
    { ...redirectSource, redirectTo: "/tutorials/target/" },
    { ...redirectTarget, redirectTo: "/tutorials/legacy/" },
  ]), "zh-CN"),
  /redirect cycle detected/,
);

console.log("Tutorial content model contract passed.");
