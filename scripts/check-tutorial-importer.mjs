import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";

import {
  TutorialImportError,
  collectTutorialSnapshot,
  importTutorialDraft,
  importerDefaults,
  sha256,
  writeJsonFile,
} from "./lib/tutorial-importer.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = path.join(repositoryRoot, "scripts/fixtures/tutorial-importer");
const sourceUrl = "https://developers.google.com/search/docs/fundamentals/seo-starter-guide";
const slug = "google-seo-starter-guide";
const sourcePath = "/seo_roadmap/seo-fundamentals/";
const jiti = createJiti(import.meta.url, {
  alias: { "@": path.join(repositoryRoot, "src") },
});
const model = await jiti.import(path.join(repositoryRoot, "src/lib/tutorials/model.ts"));

function emptyManifest(locale) {
  return {
    $schema: model.TUTORIAL_MANIFEST_SCHEMA.$id,
    schemaVersion: model.TUTORIAL_SCHEMA_VERSION,
    locale,
    generation: "tutorial-generation-0",
    activeVersion: null,
    routes: [],
    aliases: [],
  };
}

async function seedManifests(contentRoot) {
  await writeJsonFile(path.join(contentRoot, "manifest.json"), emptyManifest("zh-CN"));
  await writeJsonFile(path.join(contentRoot, "manifest.en.json"), emptyManifest("en"));
}

async function expectCode(code, action) {
  await assert.rejects(
    action,
    (error) => error instanceof TutorialImportError && error.code === code,
    `expected ${code}`,
  );
}

async function collectFixture(overrides = {}) {
  return collectTutorialSnapshot({
    url: sourceUrl,
    slug,
    sourcePath,
    fixture: path.join(fixtureRoot, "google-devsite.html"),
    ...overrides,
  });
}

async function importFixture(tmpRoot, snapshot, overrides = {}) {
  const input = path.join(tmpRoot, "snapshot.json");
  const translation = path.join(fixtureRoot, "google-devsite.zh-CN.html");
  await writeJsonFile(input, snapshot);
  return importTutorialDraft({
    input,
    translation,
    contentRoot: path.join(tmpRoot, "content-root"),
    publicRoot: path.join(tmpRoot, "public"),
    ...overrides,
  });
}

async function main() {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "tutorial-importer-"));
  try {
    const snapshot = await collectFixture();
    assert.equal(snapshot.slug, slug);
    assert.equal(snapshot.sourcePath, sourcePath);
    assert.equal(snapshot.canonicalUrl, sourceUrl);
    assert.equal(snapshot.sourceKey, sourceUrl);
    assert.equal(snapshot.contentType, "text/html");
    assert.equal(snapshot.media.length, 1);
    assert.equal(snapshot.media[0].sourceUrl, "https://developers.google.com/static/search/docs/images/fixture-diagram.svg");
    assert.equal(snapshot.media[0].alt, "A simple search result diagram");
    assert.match(snapshot.html, /<article/);
    assert.match(snapshot.html, /href="https:\/\/developers\.google\.com\/search\/docs\/fundamentals\/how-search-works"/);
    assert.match(snapshot.html, /src="https:\/\/developers\.google\.com\/static\/search\/docs\/images\/fixture-diagram\.svg"/);

    const contentRoot = path.join(tmpRoot, "content-root");
    const publicRoot = path.join(tmpRoot, "public");
    await seedManifests(contentRoot);
    const result = await importFixture(tmpRoot, snapshot);
    assert.equal(result.status, "draft");
    assert.equal(result.manifestFiles.length, 2);
    assert.equal(result.media.length, 1);
    assert.ok(result.media[0].path.startsWith(`${importerDefaults.mediaPathPrefix}${slug}/`));

    const [zhManifest, enManifest] = await Promise.all([
      fs.readFile(path.join(contentRoot, "manifest.json"), "utf8").then(JSON.parse),
      fs.readFile(path.join(contentRoot, "manifest.en.json"), "utf8").then(JSON.parse),
    ]);
    assert.equal(zhManifest.generation, enManifest.generation);
    assert.equal(zhManifest.routes[0].status, "draft");
    assert.equal(enManifest.routes[0].status, "draft");
    assert.equal(zhManifest.routes[0].title, "Fixture SEO 入门指南");
    assert.equal(zhManifest.routes[0].description, "搜索引擎需要清晰的页面、稳定的链接和可抓取的内容。");
    assert.equal(zhManifest.routes[0].review.decision, "pending");
    assert.equal(zhManifest.routes[0].qualification.decision, "pending");
    assert.equal(zhManifest.routes[0].seo.indexable, false);
    assert.equal(enManifest.routes[0].seo.indexable, false);
    const enHtml = await fs.readFile(path.join(contentRoot, "content", enManifest.routes[0].contentFile), "utf8");
    const zhHtml = await fs.readFile(path.join(contentRoot, "content", zhManifest.routes[0].contentFile), "utf8");
    assert.match(enHtml, new RegExp(`src="${result.media[0].path}"`));
    assert.match(zhHtml, /搜索引擎需要清晰的页面/);
    assert.match(zhHtml, new RegExp(`src="${result.media[0].path}"`));
    assert.equal(sha256(enHtml.trim()), enManifest.routes[0].snapshot.contentHash);
    assert.equal(sha256(zhHtml.trim()), zhManifest.routes[0].snapshot.translationContentHash);
    const mediaBytes = await fs.readFile(path.join(publicRoot, result.media[0].path.slice(1)));
    assert.equal(sha256(mediaBytes), result.media[0].sha256);
    const marker = JSON.parse(await fs.readFile(path.join(contentRoot, "import-generation.json"), "utf8"));
    assert.equal(marker.generation, result.generation);
    assert.deepEqual(marker.locales, ["zh-CN", "en"]);
    const journal = JSON.parse(await fs.readFile(path.join(contentRoot, ".import-journal", `${result.operationId}.json`), "utf8"));
    assert.equal(journal.phase, "committed");

    const generationBeforeSecondImport = zhManifest.generation;
    const secondResult = await importFixture(tmpRoot, snapshot);
    assert.equal(secondResult.idempotent, true);
    const secondZhManifest = JSON.parse(await fs.readFile(path.join(contentRoot, "manifest.json"), "utf8"));
    assert.equal(secondZhManifest.generation, generationBeforeSecondImport);
    assert.equal(secondZhManifest.routes[0].snapshot.version, 1);
    assert.deepEqual(secondZhManifest.routes[0].snapshot.history, []);

    await expectCode("translation-missing", () =>
      importTutorialDraft({
        input: path.join(tmpRoot, "snapshot.json"),
        translation: path.join(tmpRoot, "missing.zh-CN.html"),
        contentRoot,
        publicRoot,
      }),
    );
    await expectCode("unsupported-media", () =>
      importFixture(tmpRoot, { ...snapshot, media: [] }, {
        contentRoot: path.join(tmpRoot, "media-failure-content"),
        publicRoot: path.join(tmpRoot, "media-failure-public"),
      }),
    );
    const unsafeTranslation = path.join(tmpRoot, "unsafe.zh-CN.html");
    const unsafeInput = path.join(tmpRoot, "unsafe-snapshot.json");
    await writeJsonFile(unsafeInput, snapshot);
    await fs.writeFile(
      unsafeTranslation,
      snapshot.html.replace("Fixture SEO Starter Guide", "Fixture SEO 入门指南").replace("<p>", "<p onclick=\"alert(1)\">"),
      "utf8",
    );
    await expectCode("unsafe-markup", () =>
      importTutorialDraft({
        input: unsafeInput,
        translation: unsafeTranslation,
        contentRoot: path.join(tmpRoot, "unsafe-content"),
        publicRoot: path.join(tmpRoot, "unsafe-public"),
      }),
    );

    const canonicalMismatch = path.join(tmpRoot, "canonical-mismatch.html");
    await fs.writeFile(
      canonicalMismatch,
      (await fs.readFile(path.join(fixtureRoot, "google-devsite.html"), "utf8")).replace(sourceUrl, "https://developers.google.com/search/docs/fundamentals/other"),
      "utf8",
    );
    await expectCode("canonical-mismatch", () => collectFixture({ fixture: canonicalMismatch }));

    const unsafeSource = path.join(tmpRoot, "unsafe-source.html");
    await fs.writeFile(
      unsafeSource,
      (await fs.readFile(path.join(fixtureRoot, "google-devsite.html"), "utf8")).replace("</h1>", "</h1><script>alert(1)</script>"),
      "utf8",
    );
    await expectCode("unsafe-markup", () => collectFixture({ fixture: unsafeSource }));

    const botChallenge = path.join(tmpRoot, "bot-challenge.html");
    await fs.writeFile(botChallenge, "captcha enable JavaScript and cookies", "utf8");
    await expectCode("bot-challenge", () => collectFixture({ fixture: botChallenge }));
    await expectCode("authentication", () => collectFixture({ fixtureStatus: 401 }));
    await expectCode("non-html", () => collectFixture({ fixtureContentType: "application/pdf" }));

    const duplicateSnapshot = {
      ...snapshot,
      canonicalUrl: "https://developers.google.com/search/docs/fundamentals/other-guide",
      requestedUrl: "https://developers.google.com/search/docs/fundamentals/other-guide",
      finalUrl: "https://developers.google.com/search/docs/fundamentals/other-guide",
      sourceKey: "https://developers.google.com/search/docs/fundamentals/other-guide",
    };
    await expectCode("duplicate-slug", () => importFixture(tmpRoot, duplicateSnapshot, { contentRoot, publicRoot }));

    const atomicContentRoot = path.join(tmpRoot, "atomic-content");
    await seedManifests(atomicContentRoot);
    const before = await Promise.all([
      fs.readFile(path.join(atomicContentRoot, "manifest.json"), "utf8"),
      fs.readFile(path.join(atomicContentRoot, "manifest.en.json"), "utf8"),
    ]);
    await expectCode("unsupported-media", () =>
      importFixture(tmpRoot, { ...snapshot, media: [] }, {
        contentRoot: atomicContentRoot,
        publicRoot: path.join(tmpRoot, "atomic-public"),
      }),
    );
    const after = await Promise.all([
      fs.readFile(path.join(atomicContentRoot, "manifest.json"), "utf8"),
      fs.readFile(path.join(atomicContentRoot, "manifest.en.json"), "utf8"),
    ]);
    assert.deepEqual(after, before);
    const stagingRoot = path.join(atomicContentRoot, ".import-staging");
    const stagingEntries = await fs.readdir(stagingRoot).catch((error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    assert.deepEqual(stagingEntries, []);

    console.log("Tutorial importer contract passed: fixture collect/import, idempotency, failure taxonomy, duplicate ownership, and atomic rollback.");
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
}

await main();
