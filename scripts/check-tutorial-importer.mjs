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
  recoverTutorialImport,
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
    await expectCode("recovery-conflict", () =>
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
    assert.equal(refreshResult.status, "published");
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

    const lockContentRoot = path.join(tmpRoot, "lock-content");
    await seedManifests(lockContentRoot);
    let releaseLock;
    const lockHeld = new Promise((resolve) => {
      releaseLock = resolve;
    });
    const firstImport = importFixture(tmpRoot, snapshot, {
      contentRoot: lockContentRoot,
      publicRoot: path.join(tmpRoot, "lock-public-a"),
      operationId: "tutorial-import-lock-a",
      testHooks: { afterLockAcquired: async () => lockHeld },
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    await expectCode("unavailable", () =>
      importFixture(tmpRoot, snapshot, {
        contentRoot: lockContentRoot,
        publicRoot: path.join(tmpRoot, "lock-public-b"),
        operationId: "tutorial-import-lock-b",
      }),
    );
    releaseLock();
    await firstImport;

    console.log("Tutorial importer contract passed: fixture collect/import, idempotency, failure taxonomy, media trust boundaries, transaction rollback/recovery, lock scope, snapshot provenance, and refresh preservation.");
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
}

await main();
