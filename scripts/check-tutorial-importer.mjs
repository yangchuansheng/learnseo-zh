import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import dns from "node:dns/promises";
import { EventEmitter, once } from "node:events";
import fs from "node:fs/promises";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";

import {
  TutorialImportError,
  collectTutorialSnapshot,
  importTutorialDraft,
  importerDefaults,
  recoverTutorialImport,
  sha256,
  tutorialImportResultMessage,
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
const runtimeManifest = await jiti.import(path.join(repositoryRoot, "src/lib/tutorials/manifest.ts"));

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

async function expectImportError(code, operationId, action) {
  await assert.rejects(
    action,
    (error) =>
      error instanceof TutorialImportError &&
      error.code === code &&
      error.operationId === operationId,
    `expected ${code} for ${operationId}`,
  );
}

async function exitedPid() {
  const child = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
  const pid = child.pid;
  await once(child, "exit");
  return pid;
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
    allowFixtureMedia: true,
    ...overrides,
  });
}

function allTrue(keys) {
  return Object.fromEntries(keys.map((key) => [key, true]));
}

function publishRoute(route, locale) {
  const now = "2026-08-29T00:00:00.000Z";
  return {
    ...route,
    status: "published",
    activeVersion: route.snapshot.version,
    translation: {
      ...route.translation,
      translator: "Importer Test Translator",
      translatedAt: now,
      reviewedAt: now,
    },
    review: {
      ...route.review,
      decision: "approved",
      reviewer: "Importer Test Reviewer",
      reviewedAt: now,
      notes: "Approved importer fixture.",
      checklist: allTrue(model.TUTORIAL_REVIEW_CHECKLIST_KEYS),
    },
    qualification: {
      ...route.qualification,
      decision: "qualified",
      reviewer: "Importer Test Reviewer",
      reviewedAt: now,
      checklist: allTrue(model.TUTORIAL_QUALIFICATION_CHECKLIST_KEYS),
    },
    seo: {
      ...route.seo,
      indexable: true,
    },
    contentFile: locale === "en"
      ? `${route.snapshot.contentHash}.html`
      : `${route.snapshot.translationContentHash}.html`,
  };
}

async function publishImportedFixture(contentRoot) {
  const [zhManifest, enManifest] = await Promise.all([
    fs.readFile(path.join(contentRoot, "manifest.json"), "utf8").then(JSON.parse),
    fs.readFile(path.join(contentRoot, "manifest.en.json"), "utf8").then(JSON.parse),
  ]);
  zhManifest.routes = zhManifest.routes.map((route) => publishRoute(route, "zh-CN"));
  enManifest.routes = enManifest.routes.map((route) => publishRoute(route, "en"));
  await writeJsonFile(path.join(contentRoot, "manifest.json"), zhManifest);
  await writeJsonFile(path.join(contentRoot, "manifest.en.json"), enManifest);
  return { zhManifest, enManifest };
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
    assert.equal(runtimeManifest.tutorialManifestMatchesGenerationMarker(zhManifest, marker), true);
    assert.equal(runtimeManifest.tutorialManifestMatchesGenerationMarker(zhManifest, undefined), true);
    assert.equal(runtimeManifest.tutorialManifestMatchesGenerationMarker(zhManifest, {
      ...marker,
      generation: "tutorial-import-other-generation",
    }), false);
    assert.equal(runtimeManifest.tutorialManifestMatchesGenerationMarker(zhManifest, { broken: true }), false);
    const journal = JSON.parse(await fs.readFile(path.join(contentRoot, ".import-journal", `${result.operationId}.json`), "utf8"));
    assert.equal(journal.phase, "committed");
    assert.ok(journal.files.every((file) => typeof file.relative === "string" && /^[a-f0-9]{64}$/.test(file.sha256)));
    assert.equal(journal.hashes.sourceContentHash, snapshot.sourceContentHash);

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
    await writeJsonFile(path.join(tmpRoot, "snapshot.json"), snapshot);
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
        allowFixtureMedia: true,
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

    const missingCanonical = path.join(tmpRoot, "missing-canonical.html");
    await fs.writeFile(
      missingCanonical,
      (await fs.readFile(path.join(fixtureRoot, "google-devsite.html"), "utf8")).replace(/<link rel="canonical"[^>]+>\n/, ""),
      "utf8",
    );
    await expectCode("canonical-mismatch", () => collectFixture({ fixture: missingCanonical }));

    const originalLookup = dns.lookup;
    const originalRequest = https.request;
    const pinnedUrl = "https://example.com/search/docs/fundamentals/seo-starter-guide";
    try {
      let connectedToPinnedAddress = false;
      const pinnedHtml = (await fs.readFile(path.join(fixtureRoot, "google-devsite.html"), "utf8"))
        .replaceAll(sourceUrl, pinnedUrl);
      dns.lookup = async (hostname) => {
        assert.equal(hostname, "example.com");
        return [{ address: "93.184.216.34", family: 4 }];
      };
      https.request = (options, callback) => {
        assert.equal(options.hostname, "example.com");
        assert.equal(options.servername, "example.com");
        assert.equal(options.headers.host, "example.com");
        const request = new EventEmitter();
        request.setTimeout = () => request;
        request.end = () => {
          options.lookup("example.com", {}, (error, address, family) => {
            assert.ifError(error);
            assert.equal(address, "93.184.216.34");
            assert.equal(family, 4);
            connectedToPinnedAddress = true;
            const response = Readable.from([pinnedHtml]);
            response.statusCode = 200;
            response.headers = { "content-type": "text/html; charset=utf-8" };
            callback(response);
          });
        };
        return request;
      };
      const pinnedSnapshot = await collectTutorialSnapshot({
        url: pinnedUrl,
        slug: "pinned-guide",
        sourcePath,
      });
      assert.equal(pinnedSnapshot.canonicalUrl, pinnedUrl);
      assert.equal(connectedToPinnedAddress, true);
    } finally {
      dns.lookup = originalLookup;
      https.request = originalRequest;
    }

    try {
      dns.lookup = async () => [{ address: "::ffff:7f00:1", family: 6 }];
      https.request = () => {
        throw new Error("HTTPS request must not run for private DNS answers");
      };
      await expectCode("unavailable", () =>
        collectTutorialSnapshot({
          url: pinnedUrl,
          slug: "private-mapped-guide",
          sourcePath,
        }),
      );
    } finally {
      dns.lookup = originalLookup;
      https.request = originalRequest;
    }

    const hashMismatchInput = path.join(tmpRoot, "hash-mismatch-snapshot.json");
    await writeJsonFile(hashMismatchInput, { ...snapshot, sourceContentHash: sha256("tampered") });
    await expectCode("snapshot-invalid", () =>
      importTutorialDraft({
        input: hashMismatchInput,
        translation: path.join(fixtureRoot, "google-devsite.zh-CN.html"),
        contentRoot: path.join(tmpRoot, "hash-mismatch-content"),
        publicRoot: path.join(tmpRoot, "hash-mismatch-public"),
        allowFixtureMedia: true,
      }),
    );

    const invalidUtf8Translation = path.join(tmpRoot, "invalid-utf8.zh-CN.html");
    await fs.writeFile(invalidUtf8Translation, Buffer.from([0xff]));
    await expectCode("translation-missing", () =>
      importTutorialDraft({
        input: path.join(tmpRoot, "snapshot.json"),
        translation: invalidUtf8Translation,
        contentRoot: path.join(tmpRoot, "invalid-utf8-content"),
        publicRoot: path.join(tmpRoot, "invalid-utf8-public"),
        allowFixtureMedia: true,
      }),
    );

    const numericDriftTranslation = path.join(tmpRoot, "numeric-drift.zh-CN.html");
    await fs.writeFile(
      numericDriftTranslation,
      (await fs.readFile(path.join(fixtureRoot, "google-devsite.zh-CN.html"), "utf8")).replace("2025-12-10", "2024-12-10"),
      "utf8",
    );
    await expectCode("extraction-failure", () =>
      importTutorialDraft({
        input: path.join(tmpRoot, "snapshot.json"),
        translation: numericDriftTranslation,
        contentRoot: path.join(tmpRoot, "numeric-drift-content"),
        publicRoot: path.join(tmpRoot, "numeric-drift-public"),
        allowFixtureMedia: true,
      }),
    );

    await expectCode("unsupported-media", () =>
      importTutorialDraft({
        input: path.join(tmpRoot, "snapshot.json"),
        translation: path.join(fixtureRoot, "google-devsite.zh-CN.html"),
        contentRoot: path.join(tmpRoot, "fixture-media-production-content"),
        publicRoot: path.join(tmpRoot, "fixture-media-production-public"),
      }),
    );
    await expectCode("usage", () =>
      importFixture(tmpRoot, snapshot, {
        contentRoot: path.join(tmpRoot, "invalid-operation-content"),
        publicRoot: path.join(tmpRoot, "invalid-operation-public"),
        operationId: "../manifest",
      }),
    );
    await expectCode("usage", () =>
      recoverTutorialImport({
        contentRoot: path.join(tmpRoot, "invalid-recovery-content"),
        publicRoot: path.join(tmpRoot, "invalid-recovery-public"),
        operationId: "../manifest",
      }),
    );
    const unsafeRecoveryRoot = path.join(tmpRoot, "unsafe-recovery-content");
    await writeJsonFile(path.join(unsafeRecoveryRoot, ".import-journal", "tutorial-import-unsafe-relative.json"), {
      operationId: "tutorial-import-unsafe-relative",
      generation: "tutorial-import-unsafe-relative",
      phase: "staged",
      files: [{ relative: "public/../escaped.txt", sha256: sha256("escaped") }],
      phases: [],
    });
    await expectImportError("recovery-conflict", "tutorial-import-unsafe-relative", () =>
      recoverTutorialImport({
        contentRoot: unsafeRecoveryRoot,
        publicRoot: path.join(tmpRoot, "unsafe-recovery-public"),
        operationId: "tutorial-import-unsafe-relative",
      }),
    );

    const fixtureEscapeInput = path.join(tmpRoot, "fixture-escape-snapshot.json");
    await writeJsonFile(fixtureEscapeInput, {
      ...snapshot,
      media: [{ ...snapshot.media[0], fixtureFile: path.join(tmpRoot, "outside.svg") }],
    });
    await fs.writeFile(path.join(tmpRoot, "outside.svg"), "<svg xmlns=\"http://www.w3.org/2000/svg\" />", "utf8");
    await expectCode("unsupported-media", () =>
      importTutorialDraft({
        input: fixtureEscapeInput,
        translation: path.join(fixtureRoot, "google-devsite.zh-CN.html"),
        contentRoot: path.join(tmpRoot, "fixture-escape-content"),
        publicRoot: path.join(tmpRoot, "fixture-escape-public"),
        allowFixtureMedia: true,
      }),
    );

    const activeSvg = path.join(fixtureRoot, "media", `active-${process.pid}.svg`);
    try {
      await fs.writeFile(activeSvg, "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>", "utf8");
      const activeSvgInput = path.join(tmpRoot, "active-svg-snapshot.json");
      await writeJsonFile(activeSvgInput, {
        ...snapshot,
        media: [{ ...snapshot.media[0], fixtureFile: activeSvg }],
      });
      await expectCode("unsupported-media", () =>
        importTutorialDraft({
          input: activeSvgInput,
          translation: path.join(fixtureRoot, "google-devsite.zh-CN.html"),
          contentRoot: path.join(tmpRoot, "active-svg-content"),
          publicRoot: path.join(tmpRoot, "active-svg-public"),
          allowFixtureMedia: true,
        }),
      );
    } finally {
      await fs.rm(activeSvg, { force: true });
    }

    const repeatedMediaResult = await importFixture(tmpRoot, {
      ...snapshot,
      slug: "repeated-media-guide",
      media: [snapshot.media[0], { ...snapshot.media[0] }],
    }, {
      contentRoot: path.join(tmpRoot, "repeated-media-content"),
      publicRoot: path.join(tmpRoot, "repeated-media-public"),
      operationId: "tutorial-import-repeated-media-test",
    });
    assert.equal(repeatedMediaResult.media.length, 2);
    assert.equal(new Set(repeatedMediaResult.media.map((entry) => entry.path)).size, 1);

    const duplicateSnapshot = {
      ...snapshot,
      canonicalUrl: "https://developers.google.com/search/docs/fundamentals/other-guide",
      requestedUrl: "https://developers.google.com/search/docs/fundamentals/other-guide",
      finalUrl: "https://developers.google.com/search/docs/fundamentals/other-guide",
      sourceKey: "https://developers.google.com/search/docs/fundamentals/other-guide",
    };
    await expectCode("duplicate-slug", () => importFixture(tmpRoot, duplicateSnapshot, { contentRoot, publicRoot }));

    const transactionContentRoot = path.join(tmpRoot, "transaction-content");
    await seedManifests(transactionContentRoot);
    const transactionBefore = await Promise.all([
      fs.readFile(path.join(transactionContentRoot, "manifest.json"), "utf8"),
      fs.readFile(path.join(transactionContentRoot, "manifest.en.json"), "utf8"),
    ]);
    await expectCode("commit", () =>
      importFixture(tmpRoot, snapshot, {
        contentRoot: transactionContentRoot,
        publicRoot: path.join(tmpRoot, "transaction-public"),
        operationId: "tutorial-import-transaction-test",
        testHooks: { failAfterBackupRelative: "manifest.en.json" },
      }),
    );
    const transactionAfter = await Promise.all([
      fs.readFile(path.join(transactionContentRoot, "manifest.json"), "utf8"),
      fs.readFile(path.join(transactionContentRoot, "manifest.en.json"), "utf8"),
    ]);
    assert.deepEqual(transactionAfter, transactionBefore);
    const failedJournal = JSON.parse(await fs.readFile(
      path.join(transactionContentRoot, ".import-journal", "tutorial-import-transaction-test.json"),
      "utf8",
    ));
    assert.equal(failedJournal.phase, "commit-failed");

    const cleanupContentRoot = path.join(tmpRoot, "cleanup-content");
    await seedManifests(cleanupContentRoot);
    const cleanupResult = await importFixture(tmpRoot, {
      ...snapshot,
      slug: "cleanup-guide",
    }, {
      contentRoot: cleanupContentRoot,
      publicRoot: path.join(tmpRoot, "cleanup-public"),
      operationId: "tutorial-import-cleanup-test",
      testHooks: { failCleanupBackupRelative: "manifest.json" },
    });
    assert.equal(cleanupResult.status, "draft");
    const cleanupManifest = JSON.parse(await fs.readFile(path.join(cleanupContentRoot, "manifest.json"), "utf8"));
    assert.equal(cleanupManifest.generation, "tutorial-import-cleanup-test");
    assert.equal(cleanupManifest.routes[0].slug, "cleanup-guide");
    await fs.access(path.join(cleanupContentRoot, "manifest.json.backup-tutorial-import-cleanup-test"));

    const markerOnlyContentRoot = path.join(tmpRoot, "marker-only-recovery-content");
    const markerOnlyPublicRoot = path.join(tmpRoot, "marker-only-recovery-public");
    await seedManifests(markerOnlyContentRoot);
    const markerOnlyBefore = await Promise.all([
      fs.readFile(path.join(markerOnlyContentRoot, "manifest.json"), "utf8"),
      fs.readFile(path.join(markerOnlyContentRoot, "manifest.en.json"), "utf8"),
    ]);
    const markerOnlyOperation = "tutorial-import-marker-only-test";
    const markerOnlyStaging = path.join(markerOnlyContentRoot, ".import-staging", markerOnlyOperation);
    const markerOnlyMarker = {
      operationId: markerOnlyOperation,
      generation: markerOnlyOperation,
      slug,
      sourceKey: snapshot.sourceKey,
      locales: ["zh-CN", "en"],
      committedAt: null,
    };
    const markerOnlyTarget = path.join(markerOnlyStaging, "import-generation.json");
    await writeJsonFile(markerOnlyTarget, markerOnlyMarker);
    const markerOnlyBytes = await fs.readFile(markerOnlyTarget);
    await writeJsonFile(path.join(markerOnlyContentRoot, ".import-journal", `${markerOnlyOperation}.json`), {
      operationId: markerOnlyOperation,
      generation: markerOnlyOperation,
      phase: "staged",
      files: [{ relative: "import-generation.json", sha256: sha256(markerOnlyBytes) }],
      phases: [],
    });
    await expectImportError("recovery-conflict", markerOnlyOperation, () =>
      recoverTutorialImport({
        contentRoot: markerOnlyContentRoot,
        publicRoot: markerOnlyPublicRoot,
        operationId: markerOnlyOperation,
      }),
    );
    const markerOnlyAfter = await Promise.all([
      fs.readFile(path.join(markerOnlyContentRoot, "manifest.json"), "utf8"),
      fs.readFile(path.join(markerOnlyContentRoot, "manifest.en.json"), "utf8"),
    ]);
    assert.deepEqual(markerOnlyAfter, markerOnlyBefore);

    await expectImportError("recovery-conflict", "tutorial-import-missing-journal-test", () =>
      recoverTutorialImport({
        contentRoot: path.join(tmpRoot, "missing-journal-content"),
        publicRoot: path.join(tmpRoot, "missing-journal-public"),
        operationId: "tutorial-import-missing-journal-test",
      }),
    );
    const corruptJournalRoot = path.join(tmpRoot, "corrupt-journal-content");
    await fs.mkdir(path.join(corruptJournalRoot, ".import-journal"), { recursive: true });
    await fs.writeFile(path.join(corruptJournalRoot, ".import-journal", "tutorial-import-corrupt-journal-test.json"), "{", "utf8");
    await expectImportError("recovery-conflict", "tutorial-import-corrupt-journal-test", () =>
      recoverTutorialImport({
        contentRoot: corruptJournalRoot,
        publicRoot: path.join(tmpRoot, "corrupt-journal-public"),
        operationId: "tutorial-import-corrupt-journal-test",
      }),
    );

    const recoveryContentRoot = path.join(tmpRoot, "recovery-content");
    const recoveryPublicRoot = path.join(tmpRoot, "recovery-public");
    await seedManifests(recoveryContentRoot);
    await expectCode("commit", () =>
      importFixture(tmpRoot, snapshot, {
        contentRoot: recoveryContentRoot,
        publicRoot: recoveryPublicRoot,
        operationId: "tutorial-import-recovery-test",
        testHooks: { failBeforeManifestRelative: "manifest.json" },
      }),
    );
    const recovered = await recoverTutorialImport({
      contentRoot: recoveryContentRoot,
      publicRoot: recoveryPublicRoot,
      operationId: "tutorial-import-recovery-test",
    });
    assert.equal(recovered.recovered, true);
    assert.equal(recovered.status, "committed");
    const recoveredAgain = await recoverTutorialImport({
      contentRoot: recoveryContentRoot,
      publicRoot: recoveryPublicRoot,
      operationId: "tutorial-import-recovery-test",
    });
    assert.equal(recoveredAgain.recovered, false);
    const recoveredZhManifest = JSON.parse(await fs.readFile(path.join(recoveryContentRoot, "manifest.json"), "utf8"));
    assert.equal(recoveredZhManifest.generation, "tutorial-import-recovery-test");

    await publishImportedFixture(contentRoot);
    const publishedBefore = JSON.parse(await fs.readFile(path.join(contentRoot, "manifest.json"), "utf8"));
    const refreshedHtml = snapshot.html.replace(
      "Search engines need clear pages, durable links, and crawlable content.",
      "Search engines need clear pages, durable links, crawlable content, and measurable outcomes.",
    );
    const refreshedSnapshot = {
      ...snapshot,
      html: refreshedHtml,
      sourceContentHash: sha256(refreshedHtml),
    };
    const refreshedTranslation = path.join(tmpRoot, "refreshed.zh-CN.html");
    await fs.writeFile(
      refreshedTranslation,
      (await fs.readFile(path.join(fixtureRoot, "google-devsite.zh-CN.html"), "utf8")).replace(
        "搜索引擎需要清晰的页面、稳定的链接和可抓取的内容。",
        "搜索引擎需要清晰的页面、稳定的链接、可抓取的内容和可衡量的结果。",
      ),
      "utf8",
    );
    const refreshedInput = path.join(tmpRoot, "refreshed-snapshot.json");
    await writeJsonFile(refreshedInput, refreshedSnapshot);
    const refreshResult = await importTutorialDraft({
      input: refreshedInput,
      translation: refreshedTranslation,
      contentRoot,
      publicRoot,
      allowFixtureMedia: true,
      operationId: "tutorial-import-refresh-test",
    });
    assert.equal(refreshResult.status, "draft");
    assert.equal(refreshResult.liveRouteStatus, "published");
    assert.equal(refreshResult.resultKind, "refresh-candidate");
    assert.equal(refreshResult.pendingReview, true);
    assert.match(tutorialImportResultMessage(refreshResult), /staged refresh candidate/);
    assert.match(tutorialImportResultMessage(refreshResult), /live route remains published pending review/);
    const [refreshedZhManifest, refreshedEnManifest] = await Promise.all([
      fs.readFile(path.join(contentRoot, "manifest.json"), "utf8").then(JSON.parse),
      fs.readFile(path.join(contentRoot, "manifest.en.json"), "utf8").then(JSON.parse),
    ]);
    assert.equal(refreshedZhManifest.routes[0].status, "published");
    assert.equal(refreshedEnManifest.routes[0].status, "published");
    assert.equal(refreshedZhManifest.routes[0].contentFile, publishedBefore.routes[0].contentFile);
    assert.equal(refreshedZhManifest.routes[0].snapshot.version, publishedBefore.routes[0].snapshot.version);
    assert.equal(refreshedZhManifest.routes[0].refreshCandidate.status, "draft");
    assert.equal(refreshedEnManifest.routes[0].refreshCandidate.status, "draft");
    assert.equal(refreshedZhManifest.routes[0].refreshCandidate.contentFile, `${refreshedZhManifest.routes[0].refreshCandidate.translationContentHash}.html`);
    assert.equal(refreshedEnManifest.routes[0].refreshCandidate.contentFile, `${refreshedEnManifest.routes[0].refreshCandidate.contentHash}.html`);
    assert.equal(refreshedZhManifest.routes[0].refreshCandidate.operationId, "tutorial-import-refresh-test");
    const refreshCandidate = refreshedZhManifest.routes[0].snapshot.history.at(-1);
    const refreshCandidateEn = refreshedEnManifest.routes[0].snapshot.history.at(-1);
    assert.equal(refreshCandidate.version, publishedBefore.routes[0].snapshot.version + 1);
    assert.equal(refreshCandidate.sourceContentHash, refreshedSnapshot.sourceContentHash);
    assert.equal(refreshCandidate.contentHash, refreshCandidateEn.contentHash);
    assert.equal(refreshCandidate.translationContentHash, refreshCandidateEn.translationContentHash);
    assert.equal(refreshedZhManifest.routes[0].review.history.at(-1).decision, "pending");
    const refreshGeneration = refreshedZhManifest.generation;
    const repeatRefresh = await importTutorialDraft({
      input: refreshedInput,
      translation: refreshedTranslation,
      contentRoot,
      publicRoot,
      allowFixtureMedia: true,
      operationId: "tutorial-import-refresh-test-repeat",
    });
    assert.equal(repeatRefresh.idempotent, true);
    const repeatZhManifest = JSON.parse(await fs.readFile(path.join(contentRoot, "manifest.json"), "utf8"));
    assert.equal(repeatZhManifest.generation, refreshGeneration);
    assert.equal(repeatZhManifest.routes[0].snapshot.history.length, refreshedZhManifest.routes[0].snapshot.history.length);

    const secondRefreshedHtml = snapshot.html.replace(
      "Search engines need clear pages, durable links, and crawlable content.",
      "Search engines need clear pages, durable links, crawlable content, measurable outcomes, and stable audits.",
    );
    const secondRefreshedTranslation = path.join(tmpRoot, "second-refreshed.zh-CN.html");
    await fs.writeFile(
      secondRefreshedTranslation,
      (await fs.readFile(path.join(fixtureRoot, "google-devsite.zh-CN.html"), "utf8")).replace(
        "搜索引擎需要清晰的页面、稳定的链接和可抓取的内容。",
        "搜索引擎需要清晰的页面、稳定的链接、可抓取的内容、可衡量的结果和稳定的审计。",
      ),
      "utf8",
    );
    const secondRefreshedInput = path.join(tmpRoot, "second-refreshed-snapshot.json");
    await writeJsonFile(secondRefreshedInput, {
      ...snapshot,
      html: secondRefreshedHtml,
      sourceContentHash: sha256(secondRefreshedHtml),
    });
    const secondRefresh = await importTutorialDraft({
      input: secondRefreshedInput,
      translation: secondRefreshedTranslation,
      contentRoot,
      publicRoot,
      allowFixtureMedia: true,
      operationId: "tutorial-import-refresh-second-test",
    });
    assert.equal(secondRefresh.idempotent, false);
    const secondRefreshManifest = JSON.parse(await fs.readFile(path.join(contentRoot, "manifest.json"), "utf8"));
    assert.equal(secondRefreshManifest.routes[0].status, "published");
    assert.equal(secondRefreshManifest.routes[0].snapshot.version, publishedBefore.routes[0].snapshot.version);
    assert.equal(secondRefreshManifest.routes[0].refreshCandidate.version, refreshCandidate.version + 1);
    assert.equal(secondRefreshManifest.routes[0].refreshCandidate.operationId, "tutorial-import-refresh-second-test");
    const supersededRefresh = await importTutorialDraft({
      input: refreshedInput,
      translation: refreshedTranslation,
      contentRoot,
      publicRoot,
      allowFixtureMedia: true,
      operationId: "tutorial-import-refresh-superseded-test",
    });
    assert.equal(supersededRefresh.idempotent, false);
    assert.equal(supersededRefresh.status, "draft");
    assert.equal(supersededRefresh.liveRouteStatus, "published");
    const supersededRefreshManifest = JSON.parse(await fs.readFile(path.join(contentRoot, "manifest.json"), "utf8"));
    assert.equal(supersededRefreshManifest.routes[0].refreshCandidate.version, refreshCandidate.version + 2);
    assert.equal(supersededRefreshManifest.routes[0].refreshCandidate.operationId, "tutorial-import-refresh-superseded-test");

    const lockContentRoot = path.join(tmpRoot, "lock-content");
    await seedManifests(lockContentRoot);
    let signalLockAcquired;
    let releaseLock;
    const lockAcquired = new Promise((resolve) => {
      signalLockAcquired = resolve;
    });
    const lockHeld = new Promise((resolve) => {
      releaseLock = resolve;
    });
    const firstImport = importFixture(tmpRoot, snapshot, {
      contentRoot: lockContentRoot,
      publicRoot: path.join(tmpRoot, "lock-public-a"),
      operationId: "tutorial-import-lock-a",
      testHooks: {
        afterLockAcquired: async () => {
          signalLockAcquired();
          await lockHeld;
        },
      },
    });
    await lockAcquired;
    await expectCode("unavailable", () =>
      importFixture(tmpRoot, snapshot, {
        contentRoot: lockContentRoot,
        publicRoot: path.join(tmpRoot, "lock-public-b"),
        operationId: "tutorial-import-lock-b",
      }),
    );
    releaseLock();
    await firstImport;

    const staleLockContentRoot = path.join(tmpRoot, "stale-lock-content");
    await seedManifests(staleLockContentRoot);
    const staleLockPath = path.join(staleLockContentRoot, ".tutorial-import.lock");
    await writeJsonFile(staleLockPath, {
      pid: await exitedPid(),
      token: "stale-lock-token",
      createdAt: "2026-08-29T00:00:00.000Z",
    });
    const staleLockResult = await importFixture(tmpRoot, {
      ...snapshot,
      slug: "stale-lock-guide",
    }, {
      contentRoot: staleLockContentRoot,
      publicRoot: path.join(tmpRoot, "stale-lock-public"),
      operationId: "tutorial-import-stale-lock-test",
    });
    assert.equal(staleLockResult.status, "draft");
    await assert.rejects(() => fs.access(staleLockPath), { code: "ENOENT" });

    const guardedReclaimContentRoot = path.join(tmpRoot, "guarded-reclaim-content");
    await seedManifests(guardedReclaimContentRoot);
    const guardedReclaimLockPath = path.join(guardedReclaimContentRoot, ".tutorial-import.lock");
    await writeJsonFile(guardedReclaimLockPath, {
      pid: await exitedPid(),
      token: "guarded-stale-lock-token",
      createdAt: "2026-08-29T00:00:00.000Z",
    });
    await fs.mkdir(`${guardedReclaimLockPath}.reclaiming`);
    await expectCode("unavailable", () =>
      importFixture(tmpRoot, {
        ...snapshot,
        slug: "guarded-reclaim-guide",
      }, {
        contentRoot: guardedReclaimContentRoot,
        publicRoot: path.join(tmpRoot, "guarded-reclaim-public"),
        operationId: "tutorial-import-guarded-reclaim-test",
      }),
    );
    await fs.access(guardedReclaimLockPath);
    await fs.rm(`${guardedReclaimLockPath}.reclaiming`, { recursive: true, force: true });
    const guardedReclaimResult = await importFixture(tmpRoot, {
      ...snapshot,
      slug: "guarded-reclaim-guide",
    }, {
      contentRoot: guardedReclaimContentRoot,
      publicRoot: path.join(tmpRoot, "guarded-reclaim-public"),
      operationId: "tutorial-import-guarded-reclaim-test",
    });
    assert.equal(guardedReclaimResult.status, "draft");

    const freshEmptyLockContentRoot = path.join(tmpRoot, "fresh-empty-lock-content");
    await seedManifests(freshEmptyLockContentRoot);
    await fs.writeFile(path.join(freshEmptyLockContentRoot, ".tutorial-import.lock"), "", "utf8");
    await expectCode("unavailable", () =>
      importFixture(tmpRoot, {
        ...snapshot,
        slug: "fresh-empty-lock-guide",
      }, {
        contentRoot: freshEmptyLockContentRoot,
        publicRoot: path.join(tmpRoot, "fresh-empty-lock-public"),
        operationId: "tutorial-import-fresh-empty-lock-test",
      }),
    );

    const staleEmptyLockContentRoot = path.join(tmpRoot, "stale-empty-lock-content");
    await seedManifests(staleEmptyLockContentRoot);
    const staleEmptyLockPath = path.join(staleEmptyLockContentRoot, ".tutorial-import.lock");
    await fs.writeFile(staleEmptyLockPath, "", "utf8");
    await fs.utimes(staleEmptyLockPath, new Date("2026-08-29T00:00:00.000Z"), new Date("2026-08-29T00:00:00.000Z"));
    const staleEmptyLockResult = await importFixture(tmpRoot, {
      ...snapshot,
      slug: "stale-empty-lock-guide",
    }, {
      contentRoot: staleEmptyLockContentRoot,
      publicRoot: path.join(tmpRoot, "stale-empty-lock-public"),
      operationId: "tutorial-import-stale-empty-lock-test",
    });
    assert.equal(staleEmptyLockResult.status, "draft");
    await assert.rejects(() => fs.access(staleEmptyLockPath), { code: "ENOENT" });

    console.log("Tutorial importer contract passed: fixture collect/import, idempotency, failure taxonomy, DNS-pinned media/source trust boundaries, transaction rollback/recovery, stale and active lock scope, runtime marker gate, snapshot provenance, duplicate media staging, and refresh candidate preservation.");
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
}

await main();
