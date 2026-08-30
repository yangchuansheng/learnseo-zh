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
  validateCollectOptions,
  validateImportOptions,
  writeJsonFile,
} from "./lib/tutorial-importer.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = path.join(repositoryRoot, "scripts/fixtures/tutorial-importer");
const sourceUrl = "https://developers.google.com/search/docs/fundamentals/seo-starter-guide";
const slug = "google-seo-starter-guide";
const sourcePath = "/seo_roadmap/seo-fundamentals/";
const generatedOperationPattern = /^tutorial-import-[0-9a-f-]{36}$/;
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

async function captureImportError(code, operationId, action) {
  try {
    await action();
  } catch (error) {
    assert.ok(error instanceof TutorialImportError, `expected TutorialImportError for ${operationId}`);
    assert.equal(error.code, code);
    assert.equal(error.operationId, operationId);
    return error.message;
  }
  assert.fail(`expected ${code} for ${operationId}`);
}

async function runImportCli(args) {
  const child = spawn(process.execPath, [path.join(repositoryRoot, "scripts/import-learningseo-tutorial.mjs"), ...args], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  const [code] = await once(child, "exit");
  return { code, stderr };
}

async function runCollectCli(args) {
  const child = spawn(process.execPath, [path.join(repositoryRoot, "scripts/collect-learningseo-tutorial.mjs"), ...args], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  const [code] = await once(child, "exit");
  return { code, stderr };
}

async function runRecoverCli(args) {
  const child = spawn(process.execPath, [path.join(repositoryRoot, "scripts/recover-tutorial.mjs"), ...args], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  const [code] = await once(child, "exit");
  return { code, stderr };
}

async function runRuntimeManifestProbe(cwd) {
  const script = `
    import { createJiti } from "jiti";
    process.chdir(${JSON.stringify(cwd)});
    const jiti = createJiti(${JSON.stringify(import.meta.url)}, {
      alias: { "@": ${JSON.stringify(path.join(repositoryRoot, "src"))} },
    });
    const manifest = await jiti.import(${JSON.stringify(path.join(repositoryRoot, "src/lib/tutorials/manifest.ts"))});
    const [zh, en] = await Promise.all([
      manifest.readTutorialManifest("zh-CN"),
      manifest.readTutorialManifest("en"),
    ]);
    console.log(JSON.stringify({
      zhAvailable: zh.available,
      enAvailable: en.available,
      zhGeneration: zh.generation,
      enGeneration: en.generation,
      zhRoutes: zh.routes.length,
      enRoutes: en.routes.length,
    }));
  `;
  const child = spawn(process.execPath, ["--input-type=module", "-e", script], {
    cwd: repositoryRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  const [code] = await once(child, "exit");
  assert.equal(code, 0, stderr);
  return JSON.parse(stdout);
}

async function assertFailureJournal(contentRoot, operationId, actor, code) {
  const journal = JSON.parse(await fs.readFile(
    path.join(contentRoot, ".import-journal", `${operationId}.json`),
    "utf8",
  ));
  assert.equal(journal.operationId, operationId);
  assert.equal(journal.actor, actor);
  assert.equal(journal.phase, "failed");
  assert.equal(journal.failure.code, code);
  assert.ok(Array.isArray(journal.failures));
  assert.ok(journal.failures.some((failure) => failure.code === code));
  return journal;
}

async function removeFailureJournal(contentRoot, operationId) {
  await fs.rm(path.join(contentRoot, ".import-journal", `${operationId}.json`), { force: true });
}

async function assertOverlongOperationCliFailure(runCli, operationFlag, extraArgs) {
  const overlongOperationId = `tutorial-import-${"a".repeat(400)}`;
  const result = await runCli([
    operationFlag,
    overlongOperationId,
    "--actor",
    "cli.operator",
    ...extraArgs,
  ]);
  assert.equal(result.code, 1);
  assert.doesNotMatch(result.stderr, new RegExp(overlongOperationId));
  const match = result.stderr.match(/\[tutorial-importer\] usage operation=(tutorial-import-[0-9a-f-]{36}): Invalid operation id/);
  assert.ok(match, result.stderr);
  assert.match(match[1], generatedOperationPattern);
  await assertFailureJournal(importerDefaults.contentRoot, match[1], "cli.operator", "usage");
  await removeFailureJournal(importerDefaults.contentRoot, match[1]);
  await assert.rejects(
    fs.access(path.join(importerDefaults.contentRoot, ".import-journal", `${overlongOperationId}.json`)),
    /ENOENT|ENAMETOOLONG/,
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

function recoveryMarker(operationId, snapshot) {
  return {
    operationId,
    generation: operationId,
    slug,
    sourceKey: snapshot.sourceKey,
    locales: ["zh-CN", "en"],
  };
}

async function recoveryJournalFixture(operationId, snapshot, files, overrides = {}) {
  const marker = overrides.marker ?? recoveryMarker(operationId, snapshot);
  return {
    operationId,
    generation: operationId,
    candidateVersion: overrides.candidateVersion ?? 1,
    slug,
    sourceKey: snapshot.sourceKey,
    marker,
    hashes: {
      sourceContentHash: snapshot.sourceContentHash,
      contentHash: sha256(snapshot.html),
      translationContentHash: sha256(await fs.readFile(path.join(fixtureRoot, "google-devsite.zh-CN.html"), "utf8")),
    },
    validation: { en: {}, zh: {} },
    files,
    phases: [],
    ...overrides,
  };
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

function routeWithMissingContent(route, locale) {
  const source = "https://developers.google.com/search/docs/fundamentals/missing-content";
  const sourceContentHash = "c".repeat(64);
  const contentHash = "a".repeat(64);
  const translationContentHash = "b".repeat(64);
  const contentFile = locale === "en" ? `${contentHash}.html` : `${translationContentHash}.html`;
  return {
    ...route,
    slug: "missing-content-guide",
    path: locale === "en" ? "/en/tutorials/missing-content-guide/" : "/tutorials/missing-content-guide/",
    sourceKey: source,
    source: {
      ...route.source,
      canonicalUrl: source,
      requestedUrl: source,
      finalUrl: source,
    },
    snapshot: {
      ...route.snapshot,
      sourceContentHash,
      contentHash,
      translationContentHash,
      history: [],
    },
    contentFile,
    translation: {
      ...route.translation,
      contentHash: translationContentHash,
      contentFile: `${translationContentHash}.html`,
    },
    media: [],
  };
}

function assertManifestPairRejects(zhManifest, enManifest, pattern) {
  assert.throws(
    () => model.validateTutorialManifestPair(
      model.parseTutorialManifest(zhManifest, "zh-CN", "test manifest.json"),
      model.parseTutorialManifest(enManifest, "en", "test manifest.en.json"),
    ),
    pattern,
  );
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
    assert.throws(
      () => validateCollectOptions({ url: sourceUrl, slug, "source-path": sourcePath, output: "snapshot.json", "operation-id": "INVALID" }),
      (error) =>
        error instanceof TutorialImportError &&
        error.code === "usage" &&
        generatedOperationPattern.test(error.operationId),
    );
    assert.throws(
      () => validateImportOptions({ input: "snapshot.json", translation: "translation.html", "translated-at": "1" }),
      (error) => error instanceof TutorialImportError && error.code === "usage",
    );
    assert.throws(
      () => validateImportOptions({
        input: "snapshot.json",
        translation: "translation.html",
        actor: "../operator",
        "operation-id": "tutorial-import-invalid-actor-test",
      }),
      (error) =>
        error instanceof TutorialImportError &&
        error.code === "usage" &&
        error.operationId === "tutorial-import-invalid-actor-test",
    );
    const missingInputCli = await runImportCli([
      "--translation",
      path.join(fixtureRoot, "google-devsite.zh-CN.html"),
      "--operation-id",
      "tutorial-import-cli-missing-input-test",
      "--actor",
      "cli.operator",
    ]);
    assert.equal(missingInputCli.code, 1);
    assert.match(missingInputCli.stderr, /\[tutorial-importer\] usage operation=tutorial-import-cli-missing-input-test:/);
    const contentRootCli = await runImportCli([
      "--content-root",
      "temp",
      "--operation-id",
      "tutorial-import-cli-content-root-test",
      "--input",
      "temp/missing.json",
      "--translation",
      "temp/missing.html",
    ]);
    assert.equal(contentRootCli.code, 1);
    assert.match(contentRootCli.stderr, /\[tutorial-importer\] usage operation=tutorial-import-cli-content-root-test:/);
    const translatorCli = await runImportCli([
      "--translator",
      "--operation-id",
      "tutorial-import-cli-translator-test",
      "--input",
      "temp/missing.json",
      "--translation",
      "temp/missing.html",
    ]);
    assert.equal(translatorCli.code, 1);
    assert.match(translatorCli.stderr, /\[tutorial-importer\] usage operation=tutorial-import-cli-translator-test:/);
    const missingInputJournal = await assertFailureJournal(
      importerDefaults.contentRoot,
      "tutorial-import-cli-missing-input-test",
      "cli.operator",
      "usage",
    );
    assert.equal(missingInputJournal.failures.length, 1);
    assert.equal(missingInputJournal.phases.filter((phase) => phase.phase === "failed").length, 1);
    await assertFailureJournal(importerDefaults.contentRoot, "tutorial-import-cli-content-root-test", "unspecified", "usage");
    await assertFailureJournal(importerDefaults.contentRoot, "tutorial-import-cli-translator-test", "unspecified", "usage");
    await removeFailureJournal(importerDefaults.contentRoot, "tutorial-import-cli-missing-input-test");
    await removeFailureJournal(importerDefaults.contentRoot, "tutorial-import-cli-content-root-test");
    await removeFailureJournal(importerDefaults.contentRoot, "tutorial-import-cli-translator-test");
    const strayCli = await runImportCli([
      "stray",
      "--operation-id",
      "tutorial-import-cli-stray-test",
      "--actor",
      "cli.operator",
    ]);
    assert.equal(strayCli.code, 1);
    assert.match(strayCli.stderr, /\[tutorial-importer\] usage operation=tutorial-import-cli-stray-test:/);
    await assertFailureJournal(importerDefaults.contentRoot, "tutorial-import-cli-stray-test", "cli.operator", "usage");
    await removeFailureJournal(importerDefaults.contentRoot, "tutorial-import-cli-stray-test");
    const invalidOperationCli = await runImportCli([
      "--operation-id",
      "INVALID",
      "--actor",
      "cli.operator",
      "--input",
      "temp/missing.json",
      "--translation",
      "temp/missing.html",
    ]);
    assert.equal(invalidOperationCli.code, 1);
    const invalidOperationMatch = invalidOperationCli.stderr.match(/operation=(tutorial-import-[0-9a-f-]{36})/);
    assert.ok(invalidOperationMatch);
    await assertFailureJournal(importerDefaults.contentRoot, invalidOperationMatch[1], "cli.operator", "usage");
    await removeFailureJournal(importerDefaults.contentRoot, invalidOperationMatch[1]);
    await assertOverlongOperationCliFailure(runImportCli, "--operation-id", [
      "--input",
      "temp/missing.json",
      "--translation",
      "temp/missing.html",
    ]);
    const missingTranslationCli = await runImportCli([
      "--input",
      "temp/missing.json",
      "--operation-id",
      "tutorial-import-cli-missing-translation-test",
      "--actor",
      "cli.operator",
    ]);
    assert.equal(missingTranslationCli.code, 1);
    assert.match(missingTranslationCli.stderr, /\[tutorial-importer\] usage operation=tutorial-import-cli-missing-translation-test:/);
    await assertFailureJournal(importerDefaults.contentRoot, "tutorial-import-cli-missing-translation-test", "cli.operator", "usage");
    await removeFailureJournal(importerDefaults.contentRoot, "tutorial-import-cli-missing-translation-test");
    const missingRecoveryCli = await runRecoverCli([
      "--operation",
      "tutorial-import-cli-recover-missing-journal-test",
      "--actor",
      "cli.operator",
    ]);
    assert.equal(missingRecoveryCli.code, 1);
    assert.match(missingRecoveryCli.stderr, /\[tutorial-importer\] recovery-conflict operation=tutorial-import-cli-recover-missing-journal-test:/);
    await assertFailureJournal(
      importerDefaults.contentRoot,
      "tutorial-import-cli-recover-missing-journal-test",
      "cli.operator",
      "recovery-conflict",
    );
    const missingRecoveryJournal = JSON.parse(await fs.readFile(
      path.join(importerDefaults.contentRoot, ".import-journal", "tutorial-import-cli-recover-missing-journal-test.json"),
      "utf8",
    ));
    assert.equal(missingRecoveryJournal.failures.filter((failure) => failure.code === "recovery-conflict").length, 1);
    assert.equal(missingRecoveryJournal.phases.filter((phase) => phase.phase === "failed").length, 1);
    await removeFailureJournal(importerDefaults.contentRoot, "tutorial-import-cli-recover-missing-journal-test");
    const invalidActorRecoveryCli = await runRecoverCli([
      "--operation",
      "tutorial-import-cli-invalid-actor-test",
      "--actor",
      "../unsafe",
    ]);
    assert.equal(invalidActorRecoveryCli.code, 1);
    assert.match(invalidActorRecoveryCli.stderr, /\[tutorial-importer\] usage operation=tutorial-import-cli-invalid-actor-test:/);
    const invalidActorRecoveryJournal = await assertFailureJournal(
      importerDefaults.contentRoot,
      "tutorial-import-cli-invalid-actor-test",
      "unspecified",
      "usage",
    );
    assert.equal(invalidActorRecoveryJournal.failures.length, 1);
    assert.equal(invalidActorRecoveryJournal.phases.filter((phase) => phase.phase === "failed").length, 1);
    await removeFailureJournal(importerDefaults.contentRoot, "tutorial-import-cli-invalid-actor-test");
    const collectStrayCli = await runCollectCli([
      "stray",
      "--operation-id",
      "tutorial-import-collect-cli-stray-test",
      "--actor",
      "cli.operator",
    ]);
    assert.equal(collectStrayCli.code, 1);
    assert.match(collectStrayCli.stderr, /\[tutorial-importer\] usage operation=tutorial-import-collect-cli-stray-test:/);
    await assertFailureJournal(importerDefaults.contentRoot, "tutorial-import-collect-cli-stray-test", "cli.operator", "usage");
    await removeFailureJournal(importerDefaults.contentRoot, "tutorial-import-collect-cli-stray-test");
    const collectMissingCli = await runCollectCli([
      "--url",
      sourceUrl,
      "--slug",
      slug,
      "--source-path",
      sourcePath,
      "--actor",
      "cli.operator",
    ]);
    assert.equal(collectMissingCli.code, 1);
    const collectMissingMatch = collectMissingCli.stderr.match(/operation=(tutorial-import-[0-9a-f-]{36})/);
    assert.ok(collectMissingMatch);
    await assertFailureJournal(importerDefaults.contentRoot, collectMissingMatch[1], "cli.operator", "usage");
    await removeFailureJournal(importerDefaults.contentRoot, collectMissingMatch[1]);
    const collectInvalidOperationCli = await runCollectCli([
      "--operation-id",
      "INVALID",
      "--actor",
      "cli.operator",
      "--url",
      sourceUrl,
      "--slug",
      slug,
      "--source-path",
      sourcePath,
      "--output",
      path.join(tmpRoot, "unused-collect.json"),
    ]);
    assert.equal(collectInvalidOperationCli.code, 1);
    const collectInvalidOperationMatch = collectInvalidOperationCli.stderr.match(/operation=(tutorial-import-[0-9a-f-]{36})/);
    assert.ok(collectInvalidOperationMatch);
    await assertFailureJournal(importerDefaults.contentRoot, collectInvalidOperationMatch[1], "cli.operator", "usage");
    await removeFailureJournal(importerDefaults.contentRoot, collectInvalidOperationMatch[1]);
    await assertOverlongOperationCliFailure(runCollectCli, "--operation-id", [
      "--url",
      sourceUrl,
      "--slug",
      slug,
      "--source-path",
      sourcePath,
      "--output",
      path.join(tmpRoot, "overlong-collect.json"),
    ]);
    await assertOverlongOperationCliFailure(runRecoverCli, "--operation", []);
    const collectBoundaryCli = await runCollectCli([
      "--operation-id",
      "tutorial-import-collect-cli-boundary-test",
      "--actor",
      "cli.operator",
      "--url",
      "http://127.0.0.1/tutorial",
      "--slug",
      slug,
      "--source-path",
      sourcePath,
      "--output",
      path.join(tmpRoot, "boundary-collect.json"),
    ]);
    assert.equal(collectBoundaryCli.code, 1);
    assert.match(collectBoundaryCli.stderr, /\[tutorial-importer\] unavailable operation=tutorial-import-collect-cli-boundary-test:/);
    await assertFailureJournal(importerDefaults.contentRoot, "tutorial-import-collect-cli-boundary-test", "cli.operator", "unavailable");
    await removeFailureJournal(importerDefaults.contentRoot, "tutorial-import-collect-cli-boundary-test");
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
    const result = await importFixture(tmpRoot, snapshot, {
      translator: "Fixture Translator",
      translatedAt: "2026-08-30T00:00:00.000Z",
      actor: "importer.test",
    });
    assert.equal(result.status, "draft");
    assert.equal(result.actor, "importer.test");
    assert.equal(result.manifestFiles.length, 2);
    assert.equal(result.media.length, 1);
    assert.ok(result.media[0].path.startsWith(`${importerDefaults.mediaPathPrefix}${slug}/`));

    const [zhManifest, enManifest] = await Promise.all([
      fs.readFile(path.join(contentRoot, "manifest.json"), "utf8").then(JSON.parse),
      fs.readFile(path.join(contentRoot, "manifest.en.json"), "utf8").then(JSON.parse),
    ]);
    const parsedZhManifest = model.parseTutorialManifest(zhManifest, "zh-CN", "imported manifest.json");
    const parsedEnManifest = model.parseTutorialManifest(enManifest, "en", "imported manifest.en.json");
    assert.equal(zhManifest.generation, enManifest.generation);
    assert.equal(zhManifest.routes[0].status, "draft");
    assert.equal(enManifest.routes[0].status, "draft");
    assert.equal(zhManifest.routes[0].title, "Fixture SEO 入门指南");
    assert.equal(zhManifest.routes[0].description, "搜索引擎需要清晰的页面、稳定的链接和可抓取的内容。");
    assert.equal(zhManifest.routes[0].review.decision, "pending");
    assert.equal(zhManifest.routes[0].qualification.decision, "pending");
    assert.equal(zhManifest.routes[0].translation.translator, "Fixture Translator");
    assert.equal(zhManifest.routes[0].translation.translatedAt, "2026-08-30T00:00:00.000Z");
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
    assert.equal(runtimeManifest.tutorialManifestMatchesGenerationMarker(parsedZhManifest, marker), true);
    assert.equal(runtimeManifest.tutorialManifestPairMatchesGenerationMarker(parsedZhManifest, parsedEnManifest, marker), true);
    assert.equal(runtimeManifest.tutorialManifestMatchesGenerationMarker(parsedZhManifest, undefined), false);
    assert.equal(runtimeManifest.tutorialManifestMatchesGenerationMarker(emptyManifest("zh-CN"), undefined), true);
    assert.equal(runtimeManifest.tutorialManifestMatchesGenerationMarker(parsedZhManifest, {
      ...marker,
      generation: "tutorial-import-other-generation",
    }), false);
    assert.equal(runtimeManifest.tutorialManifestMatchesGenerationMarker(parsedZhManifest, {
      ...marker,
      slug: "different-guide",
    }), false);
    assert.equal(runtimeManifest.tutorialManifestPairMatchesGenerationMarker(
      parsedZhManifest,
      { ...parsedEnManifest, generation: "tutorial-import-mixed-generation" },
      marker,
    ), false);
    assert.equal(runtimeManifest.tutorialManifestPairMatchesGenerationMarker(
      parsedZhManifest,
      parsedEnManifest,
      { ...marker, sourceKey: "https://developers.google.com/search/docs/fundamentals/different" },
    ), false);
    assert.equal(runtimeManifest.tutorialManifestMatchesGenerationMarker(parsedZhManifest, { broken: true }), false);
    const runtimeRoot = path.join(tmpRoot, "runtime-manifest-root");
    const runtimeContentRoot = path.join(runtimeRoot, "src/content/tutorials");
    await writeJsonFile(path.join(runtimeContentRoot, "manifest.json"), zhManifest);
    await writeJsonFile(path.join(runtimeContentRoot, "manifest.en.json"), enManifest);
    await writeJsonFile(path.join(runtimeContentRoot, "import-generation.json"), marker);
    assert.deepEqual(await runRuntimeManifestProbe(runtimeRoot), {
      zhAvailable: true,
      enAvailable: true,
      zhGeneration: result.generation,
      enGeneration: result.generation,
      zhRoutes: 1,
      enRoutes: 1,
    });
    await writeJsonFile(path.join(runtimeContentRoot, "manifest.en.json"), {
      ...enManifest,
      generation: "tutorial-import-mixed-generation",
    });
    assert.deepEqual(await runRuntimeManifestProbe(runtimeRoot), {
      zhAvailable: false,
      enAvailable: false,
      zhGeneration: null,
      enGeneration: null,
      zhRoutes: 0,
      enRoutes: 0,
    });
    await writeJsonFile(path.join(runtimeContentRoot, "manifest.en.json"), enManifest);
    await writeJsonFile(path.join(runtimeContentRoot, "import-generation.json"), {
      ...marker,
      slug: "different-guide",
    });
    assert.deepEqual(await runRuntimeManifestProbe(runtimeRoot), {
      zhAvailable: false,
      enAvailable: false,
      zhGeneration: null,
      enGeneration: null,
      zhRoutes: 0,
      enRoutes: 0,
    });
    const journal = JSON.parse(await fs.readFile(path.join(contentRoot, ".import-journal", `${result.operationId}.json`), "utf8"));
    assert.equal(journal.phase, "committed");
    assert.ok(journal.files.every((file) => typeof file.relative === "string" && /^[a-f0-9]{64}$/.test(file.sha256)));
    assert.equal(journal.hashes.sourceContentHash, snapshot.sourceContentHash);
    assert.equal(journal.actor, "importer.test");
    assert.equal(journal.candidateVersion, zhManifest.routes[0].snapshot.version);
    assert.equal(journal.marker.slug, slug);
    assert.equal(journal.marker.sourceKey, snapshot.sourceKey);
    assert.deepEqual(journal.validation.en.headingEntries, journal.validation.zh.headingEntries);

    const journalPath = path.join(contentRoot, ".import-journal", `${result.operationId}.json`);
    const firstJournalSource = await fs.readFile(journalPath, "utf8");
    const firstMarkerSource = await fs.readFile(path.join(contentRoot, "import-generation.json"), "utf8");
    const firstBackupFiles = (await fs.readdir(contentRoot))
      .filter((entry) => entry.endsWith(`.backup-${result.operationId}`))
      .sort();
    const changedHtml = snapshot.html.replace(
      "Search engines need clear pages, durable links, and crawlable content.",
      "Search engines need clear pages, durable links, crawlable content, and stable operation identities.",
    );
    const changedTranslation = path.join(tmpRoot, "same-operation-changed.zh-CN.html");
    await fs.writeFile(
      changedTranslation,
      (await fs.readFile(path.join(fixtureRoot, "google-devsite.zh-CN.html"), "utf8")).replace(
        "搜索引擎需要清晰的页面、稳定的链接和可抓取的内容。",
        "搜索引擎需要清晰的页面、稳定的链接、可抓取的内容和稳定的操作身份。",
      ),
      "utf8",
    );
    const changedInput = path.join(tmpRoot, "same-operation-changed-snapshot.json");
    await writeJsonFile(changedInput, {
      ...snapshot,
      html: changedHtml,
      sourceContentHash: sha256(changedHtml),
    });
    await expectImportError("duplicate-operation", result.operationId, () =>
      importTutorialDraft({
        input: changedInput,
        translation: changedTranslation,
        contentRoot,
        publicRoot,
        allowFixtureMedia: true,
        operationId: result.operationId,
        actor: "second.actor",
      }),
    );
    assert.equal(await fs.readFile(journalPath, "utf8"), firstJournalSource);
    assert.equal(await fs.readFile(path.join(contentRoot, "import-generation.json"), "utf8"), firstMarkerSource);
    assert.deepEqual(
      (await fs.readdir(contentRoot))
        .filter((entry) => entry.endsWith(`.backup-${result.operationId}`))
        .sort(),
      firstBackupFiles,
    );

    const conflictingSourceInput = path.join(tmpRoot, "same-operation-conflicting-source-snapshot.json");
    const conflictingSourceUrl = `${sourceUrl}?conflicting-source=1`;
    await writeJsonFile(conflictingSourceInput, {
      ...snapshot,
      canonicalUrl: conflictingSourceUrl,
      requestedUrl: conflictingSourceUrl,
      finalUrl: conflictingSourceUrl,
      sourceKey: conflictingSourceUrl,
    });
    const conflictingDuplicateMessage = await captureImportError("duplicate-operation", result.operationId, () =>
      importTutorialDraft({
        input: conflictingSourceInput,
        translation: path.join(fixtureRoot, "google-devsite.zh-CN.html"),
        contentRoot,
        publicRoot,
        allowFixtureMedia: true,
        operationId: result.operationId,
        actor: "conflict.actor",
      }),
    );
    assert.equal(
      await captureImportError("duplicate-operation", result.operationId, () =>
        importTutorialDraft({
          input: conflictingSourceInput,
          translation: path.join(fixtureRoot, "google-devsite.zh-CN.html"),
          contentRoot,
          publicRoot,
          allowFixtureMedia: true,
          operationId: result.operationId,
          actor: "conflict.actor",
        }),
      ),
      conflictingDuplicateMessage,
    );
    assert.equal(await fs.readFile(journalPath, "utf8"), firstJournalSource);
    assert.equal(JSON.parse(firstJournalSource).actor, "importer.test");
    assert.equal(JSON.parse(firstJournalSource).phase, "committed");
    assert.equal(
      await captureImportError("duplicate-operation", result.operationId, () =>
        importTutorialDraft({
          input: path.join(tmpRoot, "missing-committed-operation-snapshot.json"),
          translation: path.join(fixtureRoot, "google-devsite.zh-CN.html"),
          contentRoot,
          publicRoot,
          allowFixtureMedia: true,
          operationId: result.operationId,
          actor: "conflict.actor",
        }),
      ),
      conflictingDuplicateMessage,
    );
    assert.equal(await fs.readFile(journalPath, "utf8"), firstJournalSource);

    const generationBeforeSecondImport = zhManifest.generation;
    const secondResult = await importFixture(tmpRoot, snapshot);
    assert.equal(secondResult.idempotent, true);
    assert.equal(secondResult.actor, "unspecified");
    const secondZhManifest = JSON.parse(await fs.readFile(path.join(contentRoot, "manifest.json"), "utf8"));
    assert.equal(secondZhManifest.generation, generationBeforeSecondImport);
    assert.equal(secondZhManifest.routes[0].snapshot.version, 1);
    assert.deepEqual(secondZhManifest.routes[0].snapshot.history, []);

    const tamperedMarker = { ...marker, slug: "different-guide" };
    await writeJsonFile(path.join(contentRoot, "import-generation.json"), tamperedMarker);
    const tamperedBefore = await Promise.all([
      fs.readFile(path.join(contentRoot, "manifest.json"), "utf8"),
      fs.readFile(path.join(contentRoot, "manifest.en.json"), "utf8"),
      fs.readFile(path.join(contentRoot, "import-generation.json"), "utf8"),
    ]);
    await expectImportError("recovery-conflict", result.operationId, () =>
      recoverTutorialImport({
        contentRoot,
        publicRoot,
        operationId: result.operationId,
      }),
    );
    const tamperedAfter = await Promise.all([
      fs.readFile(path.join(contentRoot, "manifest.json"), "utf8"),
      fs.readFile(path.join(contentRoot, "manifest.en.json"), "utf8"),
      fs.readFile(path.join(contentRoot, "import-generation.json"), "utf8"),
    ]);
    assert.deepEqual(tamperedAfter, tamperedBefore);
    await writeJsonFile(path.join(contentRoot, "import-generation.json"), marker);

    const translationAuditRoot = path.join(tmpRoot, "translation-audit-content");
    await expectImportError("translation-missing", "tutorial-import-translation-audit-test", () =>
      importTutorialDraft({
        input: path.join(tmpRoot, "snapshot.json"),
        translation: path.join(tmpRoot, "missing.zh-CN.html"),
        contentRoot: translationAuditRoot,
        publicRoot,
        operationId: "tutorial-import-translation-audit-test",
        actor: "audit.operator",
      }),
    );
    await assertFailureJournal(
      translationAuditRoot,
      "tutorial-import-translation-audit-test",
      "audit.operator",
      "translation-missing",
    );
    const mediaAuditRoot = path.join(tmpRoot, "media-failure-content");
    await expectImportError("unsupported-media", "tutorial-import-media-audit-test", () =>
      importFixture(tmpRoot, { ...snapshot, media: [] }, {
        contentRoot: mediaAuditRoot,
        publicRoot: path.join(tmpRoot, "media-failure-public"),
        operationId: "tutorial-import-media-audit-test",
        actor: "audit.operator",
      }),
    );
    await assertFailureJournal(mediaAuditRoot, "tutorial-import-media-audit-test", "audit.operator", "unsupported-media");
    await writeJsonFile(path.join(tmpRoot, "snapshot.json"), snapshot);
    const unsafeTranslation = path.join(tmpRoot, "unsafe.zh-CN.html");
    const unsafeInput = path.join(tmpRoot, "unsafe-snapshot.json");
    await writeJsonFile(unsafeInput, snapshot);
    await fs.writeFile(
      unsafeTranslation,
      snapshot.html.replace("Fixture SEO Starter Guide", "Fixture SEO 入门指南").replace("<p>", "<p onclick=\"alert(1)\">"),
      "utf8",
    );
    const sanitizerAuditRoot = path.join(tmpRoot, "unsafe-content");
    await expectImportError("unsafe-markup", "tutorial-import-sanitizer-audit-test", () =>
      importTutorialDraft({
        input: unsafeInput,
        translation: unsafeTranslation,
        contentRoot: sanitizerAuditRoot,
        publicRoot: path.join(tmpRoot, "unsafe-public"),
        allowFixtureMedia: true,
        operationId: "tutorial-import-sanitizer-audit-test",
        actor: "audit.operator",
      }),
    );
    await assertFailureJournal(sanitizerAuditRoot, "tutorial-import-sanitizer-audit-test", "audit.operator", "unsafe-markup");

    const validationHtml = snapshot.html.replace('id="make-your-site-discoverable"', 'id="seo-starter-guide"');
    const validationAuditInput = path.join(tmpRoot, "validation-audit-snapshot.json");
    await writeJsonFile(validationAuditInput, {
      ...snapshot,
      html: validationHtml,
      sourceContentHash: sha256(validationHtml),
    });
    const validationAuditRoot = path.join(tmpRoot, "validation-audit-content");
    await expectImportError("validation", "tutorial-import-validation-audit-test", () =>
      importTutorialDraft({
        input: validationAuditInput,
        translation: path.join(fixtureRoot, "google-devsite.zh-CN.html"),
        contentRoot: validationAuditRoot,
        publicRoot: path.join(tmpRoot, "validation-audit-public"),
        allowFixtureMedia: true,
        operationId: "tutorial-import-validation-audit-test",
        actor: "audit.operator",
      }),
    );
    await assertFailureJournal(validationAuditRoot, "tutorial-import-validation-audit-test", "audit.operator", "validation");

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
    const benignCaptchaFlag = path.join(tmpRoot, "benign-captcha-flag.html");
    await fs.writeFile(
      benignCaptchaFlag,
      (await fs.readFile(path.join(fixtureRoot, "google-devsite.html"), "utf8")).replace(
        "</head>",
        "    <script>globalThis.DevPro__enable_devsite_captcha = 'unusual traffic';</script>\n  </head>",
      ),
      "utf8",
    );
    const benignCaptchaSnapshot = await collectFixture({ fixture: benignCaptchaFlag });
    assert.equal(benignCaptchaSnapshot.canonicalUrl, sourceUrl);
    const styledSource = path.join(tmpRoot, "styled-source.html");
    await fs.writeFile(
      styledSource,
      (await fs.readFile(path.join(fixtureRoot, "google-devsite.html"), "utf8")).replace(
        "<img ",
        '<img style="display:block;margin:auto;" ',
      ),
      "utf8",
    );
    const styledSnapshot = await collectFixture({ fixture: styledSource });
    assert.match(styledSnapshot.html, /style="display:block;margin:auto;"/);
    const styledContentRoot = path.join(tmpRoot, "styled-content-root");
    await seedManifests(styledContentRoot);
    const styledImportSnapshot = {
      ...styledSnapshot,
      media: styledSnapshot.media.map((entry) => ({
        ...entry,
        fixtureFile: path.join(fixtureRoot, "media/fixture-diagram.svg"),
      })),
    };
    const styledImport = await importFixture(tmpRoot, styledImportSnapshot, {
      contentRoot: styledContentRoot,
      publicRoot: path.join(tmpRoot, "styled-public"),
      operationId: "tutorial-import-styled-source-test",
    });
    const styledManifest = JSON.parse(await fs.readFile(path.join(styledContentRoot, "manifest.en.json"), "utf8"));
    const styledHtml = await fs.readFile(path.join(styledContentRoot, "content", styledManifest.routes[0].contentFile), "utf8");
    assert.equal(styledImport.status, "draft");
    assert.doesNotMatch(styledHtml, /\sstyle=/i);
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
          options.lookup("example.com", { all: true }, (error, addresses) => {
            assert.ifError(error);
            assert.deepEqual(addresses, [{ address: "93.184.216.34", family: 4 }]);
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

    for (const privateMappedAddress of [
      "::127.0.0.1",
      "::10.0.0.1",
      "::192.168.0.1",
      "0:0:0:0:0:0:7f00:1",
      "0:0:0:0:0:0:a00:1",
      "::ffff:7f00:1",
      "0:0:0:0:0:ffff:7f00:1",
      "::ffff:127.0.0.1",
      "::ffff:192.88.99.1",
      "0:0:0:0:0:ffff:c058:6301",
    ]) {
      try {
        dns.lookup = async () => [{ address: privateMappedAddress, family: 6 }];
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
    }
    for (const nonGlobalIpv6Address of [
      "::",
      "::1",
      "100::1",
      "2001:2::1",
      "2001:db8::1",
      "2002::1",
      "3fff::1",
      "fc00::1",
      "fe80::1",
      "ff00::1",
    ]) {
      try {
        let requested = false;
        dns.lookup = async () => [{ address: nonGlobalIpv6Address, family: 6 }];
        https.request = () => {
          requested = true;
          throw new Error("HTTPS request must not run for non-global DNS answers");
        };
        await expectCode("unavailable", () =>
          collectTutorialSnapshot({
            url: pinnedUrl,
            slug: "non-global-ipv6-guide",
            sourcePath,
          }),
        );
        assert.equal(requested, false);
      } finally {
        dns.lookup = originalLookup;
        https.request = originalRequest;
      }
    }
    try {
      let mediaRequested = false;
      for (const [mediaIndex, mediaAddress] of ["::10.0.0.1", "100::1", "2001:2::1", "3fff::1"].entries()) {
        mediaRequested = false;
        dns.lookup = async () => [{ address: mediaAddress, family: 6 }];
        https.request = () => {
          mediaRequested = true;
          throw new Error("HTTPS request must not run for non-global media DNS answers");
        };
        await writeJsonFile(path.join(tmpRoot, "private-media-snapshot.json"), {
          ...snapshot,
          media: [{ ...snapshot.media[0], fixtureFile: undefined }],
        });
        const operationId = `tutorial-import-private-media-dns-test-${mediaIndex + 1}`;
        await expectImportError("unavailable", operationId, () =>
          importTutorialDraft({
            input: path.join(tmpRoot, "private-media-snapshot.json"),
            translation: path.join(fixtureRoot, "google-devsite.zh-CN.html"),
            contentRoot: path.join(tmpRoot, "private-media-content"),
            publicRoot: path.join(tmpRoot, "private-media-public"),
            operationId,
          }),
        );
        assert.equal(mediaRequested, false);
      }
    } finally {
      dns.lookup = originalLookup;
      https.request = originalRequest;
    }
    try {
      dns.lookup = async () => [{ address: "::ffff:5db8:d822", family: 6 }];
      https.request = (_options, callback) => {
        const request = new EventEmitter();
        request.setTimeout = () => request;
        request.on = () => request;
        request.end = () => {
          const response = Readable.from([""]);
          response.statusCode = 404;
          response.headers = { "content-type": "text/html; charset=utf-8" };
          callback(response);
        };
        return request;
      };
      await expectCode("unavailable", () =>
        collectTutorialSnapshot({
          url: pinnedUrl,
          slug: "public-mapped-guide",
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
    await expectImportError("commit", "tutorial-import-transaction-test", () =>
      importFixture(tmpRoot, snapshot, {
        contentRoot: transactionContentRoot,
        publicRoot: path.join(tmpRoot, "transaction-public"),
        operationId: "tutorial-import-transaction-test",
        actor: "audit.operator",
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
    assert.equal(failedJournal.phase, "failed");
    assert.equal(failedJournal.actor, "audit.operator");
    assert.equal(failedJournal.failure.code, "commit");
    assert.ok(failedJournal.phases.some((entry) => entry.phase === "commit-failed"));
    const failedJournalPath = path.join(transactionContentRoot, ".import-journal", "tutorial-import-transaction-test.json");
    const failedJournalSource = await fs.readFile(failedJournalPath, "utf8");
    const failureDuplicateMissingInputMessage = await captureImportError("duplicate-operation", "tutorial-import-transaction-test", () =>
      importTutorialDraft({
        input: path.join(tmpRoot, "missing-reserved-operation-snapshot.json"),
        translation: path.join(fixtureRoot, "google-devsite.zh-CN.html"),
        contentRoot: transactionContentRoot,
        publicRoot: path.join(tmpRoot, "transaction-public"),
        operationId: "tutorial-import-transaction-test",
        actor: "retry.operator",
      }),
    );
    assert.equal(await fs.readFile(failedJournalPath, "utf8"), failedJournalSource);
    const failureDuplicateMessage = await captureImportError("duplicate-operation", "tutorial-import-transaction-test", () =>
      importFixture(tmpRoot, snapshot, {
        contentRoot: transactionContentRoot,
        publicRoot: path.join(tmpRoot, "transaction-public"),
        operationId: "tutorial-import-transaction-test",
        actor: "retry.operator",
      }),
    );
    assert.equal(
      await captureImportError("duplicate-operation", "tutorial-import-transaction-test", () =>
        importFixture(tmpRoot, snapshot, {
          contentRoot: transactionContentRoot,
          publicRoot: path.join(tmpRoot, "transaction-public"),
          operationId: "tutorial-import-transaction-test",
          actor: "retry.operator",
        }),
      ),
      failureDuplicateMessage,
    );
    assert.equal(failureDuplicateMessage, failureDuplicateMissingInputMessage);
    assert.equal(await fs.readFile(failedJournalPath, "utf8"), failedJournalSource);
    assert.equal(JSON.parse(failedJournalSource).actor, "audit.operator");
    assert.equal(JSON.parse(failedJournalSource).phase, "failed");

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

    const retentionContentRoot = path.join(tmpRoot, "retention-content");
    const retentionPublicRoot = path.join(tmpRoot, "retention-public");
    await seedManifests(retentionContentRoot);
    const retentionImports = [
      ["backup-retention-one", "tutorial-import-backup-retention-one", "retention=1"],
      ["backup-retention-two", "tutorial-import-backup-retention-two", "retention=2"],
      ["backup-retention-three", "tutorial-import-backup-retention-three", "retention=3"],
      ["backup-retention-four", "tutorial-import-backup-retention-four", "retention=4"],
    ];
    for (const [retentionSlug, operationId, query] of retentionImports) {
      const url = `${sourceUrl}?${query}`;
      await importFixture(tmpRoot, {
        ...snapshot,
        slug: retentionSlug,
        canonicalUrl: url,
        requestedUrl: url,
        finalUrl: url,
        sourceKey: url,
      }, {
        contentRoot: retentionContentRoot,
        publicRoot: retentionPublicRoot,
        operationId,
      });
    }
    for (const operationId of ["tutorial-import-backup-retention-three", "tutorial-import-backup-retention-four"]) {
      for (const relative of ["manifest.json", "manifest.en.json", "import-generation.json"]) {
        await fs.access(path.join(retentionContentRoot, `${relative}.backup-${operationId}`));
      }
    }
    for (const [operationId, relatives] of [
      ["tutorial-import-backup-retention-one", ["manifest.json", "manifest.en.json"]],
      ["tutorial-import-backup-retention-two", ["manifest.json", "manifest.en.json", "import-generation.json"]],
    ]) {
      for (const relative of relatives) {
        await assert.rejects(
          fs.access(path.join(retentionContentRoot, `${relative}.backup-${operationId}`)),
          /ENOENT/,
        );
      }
    }

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

    const liveMarkerOnlyContentRoot = path.join(tmpRoot, "live-marker-only-recovery-content");
    await seedManifests(liveMarkerOnlyContentRoot);
    const liveMarkerOnlyBefore = await Promise.all([
      fs.readFile(path.join(liveMarkerOnlyContentRoot, "manifest.json"), "utf8"),
      fs.readFile(path.join(liveMarkerOnlyContentRoot, "manifest.en.json"), "utf8"),
    ]);
    const liveMarkerOnlyOperation = "tutorial-import-live-marker-only-test";
    const liveMarkerOnlyMarker = recoveryMarker(liveMarkerOnlyOperation, snapshot);
    await writeJsonFile(path.join(liveMarkerOnlyContentRoot, "import-generation.json"), liveMarkerOnlyMarker);
    const liveMarkerOnlyBytes = await fs.readFile(path.join(liveMarkerOnlyContentRoot, "import-generation.json"));
    await writeJsonFile(
      path.join(liveMarkerOnlyContentRoot, ".import-journal", `${liveMarkerOnlyOperation}.json`),
      await recoveryJournalFixture(liveMarkerOnlyOperation, snapshot, [
        { relative: "import-generation.json", sha256: sha256(liveMarkerOnlyBytes) },
      ], { marker: liveMarkerOnlyMarker }),
    );
    await expectImportError("recovery-conflict", liveMarkerOnlyOperation, () =>
      recoverTutorialImport({
        contentRoot: liveMarkerOnlyContentRoot,
        publicRoot: path.join(tmpRoot, "live-marker-only-recovery-public"),
        operationId: liveMarkerOnlyOperation,
      }),
    );
    const liveMarkerOnlyAfter = await Promise.all([
      fs.readFile(path.join(liveMarkerOnlyContentRoot, "manifest.json"), "utf8"),
      fs.readFile(path.join(liveMarkerOnlyContentRoot, "manifest.en.json"), "utf8"),
    ]);
    assert.deepEqual(liveMarkerOnlyAfter, liveMarkerOnlyBefore);

    const emptyPairContentRoot = path.join(tmpRoot, "empty-pair-recovery-content");
    await seedManifests(emptyPairContentRoot);
    const emptyPairOperation = "tutorial-import-empty-pair-test";
    const emptyPairStaging = path.join(emptyPairContentRoot, ".import-staging", emptyPairOperation);
    const emptyPairMarker = recoveryMarker(emptyPairOperation, snapshot);
    const emptyZh = { ...emptyManifest("zh-CN"), generation: emptyPairOperation };
    const emptyEn = { ...emptyManifest("en"), generation: emptyPairOperation };
    await writeJsonFile(path.join(emptyPairStaging, "manifest.json"), emptyZh);
    await writeJsonFile(path.join(emptyPairStaging, "manifest.en.json"), emptyEn);
    await writeJsonFile(path.join(emptyPairStaging, "import-generation.json"), emptyPairMarker);
    const emptyPairFiles = await Promise.all([
      "manifest.json",
      "manifest.en.json",
      "import-generation.json",
    ].map(async (relative) => ({
      relative,
      sha256: sha256(await fs.readFile(path.join(emptyPairStaging, relative))),
    })));
    await writeJsonFile(
      path.join(emptyPairContentRoot, ".import-journal", `${emptyPairOperation}.json`),
      await recoveryJournalFixture(emptyPairOperation, snapshot, emptyPairFiles, { marker: emptyPairMarker }),
    );
    await expectImportError("recovery-conflict", emptyPairOperation, () =>
      recoverTutorialImport({
        contentRoot: emptyPairContentRoot,
        publicRoot: path.join(tmpRoot, "empty-pair-recovery-public"),
        operationId: emptyPairOperation,
      }),
    );

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

    const validationContentRoot = path.join(tmpRoot, "validation-content");
    const validationPublicRoot = path.join(tmpRoot, "validation-public");
    await seedManifests(validationContentRoot);
    await expectCode("commit", () =>
      importFixture(tmpRoot, snapshot, {
        contentRoot: validationContentRoot,
        publicRoot: validationPublicRoot,
        operationId: "tutorial-import-validation-test",
        testHooks: { failBeforeFirstContent: true },
      }),
    );
    const validationJournalPath = path.join(validationContentRoot, ".import-journal", "tutorial-import-validation-test.json");
    const validationJournal = JSON.parse(await fs.readFile(validationJournalPath, "utf8"));
    await writeJsonFile(validationJournalPath, {
      ...validationJournal,
      validation: {
        ...validationJournal.validation,
        en: { ...validationJournal.validation.en, headingEntries: [] },
      },
    });
    const validationBefore = await Promise.all([
      fs.readFile(path.join(validationContentRoot, "manifest.json"), "utf8"),
      fs.readFile(path.join(validationContentRoot, "manifest.en.json"), "utf8"),
    ]);
    await expectImportError("recovery-conflict", "tutorial-import-validation-test", () =>
      recoverTutorialImport({
        contentRoot: validationContentRoot,
        publicRoot: validationPublicRoot,
        operationId: "tutorial-import-validation-test",
      }),
    );
    const validationAfter = await Promise.all([
      fs.readFile(path.join(validationContentRoot, "manifest.json"), "utf8"),
      fs.readFile(path.join(validationContentRoot, "manifest.en.json"), "utf8"),
    ]);
    assert.deepEqual(validationAfter, validationBefore);

    const versionContentRoot = path.join(tmpRoot, "version-content");
    const versionPublicRoot = path.join(tmpRoot, "version-public");
    await seedManifests(versionContentRoot);
    await expectCode("commit", () =>
      importFixture(tmpRoot, snapshot, {
        contentRoot: versionContentRoot,
        publicRoot: versionPublicRoot,
        operationId: "tutorial-import-version-test",
        testHooks: { failBeforeFirstContent: true },
      }),
    );
    const versionJournalPath = path.join(versionContentRoot, ".import-journal", "tutorial-import-version-test.json");
    const versionJournal = JSON.parse(await fs.readFile(versionJournalPath, "utf8"));
    await writeJsonFile(versionJournalPath, { ...versionJournal, candidateVersion: versionJournal.candidateVersion + 1 });
    const versionBefore = await Promise.all([
      fs.readFile(path.join(versionContentRoot, "manifest.json"), "utf8"),
      fs.readFile(path.join(versionContentRoot, "manifest.en.json"), "utf8"),
    ]);
    await expectImportError("recovery-conflict", "tutorial-import-version-test", () =>
      recoverTutorialImport({
        contentRoot: versionContentRoot,
        publicRoot: versionPublicRoot,
        operationId: "tutorial-import-version-test",
      }),
    );
    const versionAfter = await Promise.all([
      fs.readFile(path.join(versionContentRoot, "manifest.json"), "utf8"),
      fs.readFile(path.join(versionContentRoot, "manifest.en.json"), "utf8"),
    ]);
    assert.deepEqual(versionAfter, versionBefore);

    const extraRouteContentRoot = path.join(tmpRoot, "extra-route-content");
    const extraRoutePublicRoot = path.join(tmpRoot, "extra-route-public");
    await seedManifests(extraRouteContentRoot);
    await expectCode("commit", () =>
      importFixture(tmpRoot, snapshot, {
        contentRoot: extraRouteContentRoot,
        publicRoot: extraRoutePublicRoot,
        operationId: "tutorial-import-extra-route-test",
        testHooks: { failBeforeFirstContent: true },
      }),
    );
    const extraRouteStaging = path.join(extraRouteContentRoot, ".import-staging", "tutorial-import-extra-route-test");
    const [extraZhManifest, extraEnManifest] = await Promise.all([
      fs.readFile(path.join(extraRouteStaging, "manifest.json"), "utf8").then(JSON.parse),
      fs.readFile(path.join(extraRouteStaging, "manifest.en.json"), "utf8").then(JSON.parse),
    ]);
    extraZhManifest.routes.push(routeWithMissingContent(extraZhManifest.routes[0], "zh-CN"));
    extraEnManifest.routes.push(routeWithMissingContent(extraEnManifest.routes[0], "en"));
    await writeJsonFile(path.join(extraRouteStaging, "manifest.json"), extraZhManifest);
    await writeJsonFile(path.join(extraRouteStaging, "manifest.en.json"), extraEnManifest);
    const extraRouteJournalPath = path.join(extraRouteContentRoot, ".import-journal", "tutorial-import-extra-route-test.json");
    const extraRouteJournal = JSON.parse(await fs.readFile(extraRouteJournalPath, "utf8"));
    await writeJsonFile(extraRouteJournalPath, {
      ...extraRouteJournal,
      files: await Promise.all(extraRouteJournal.files.map(async (file) => ({
        ...file,
        sha256: file.relative === "manifest.json" || file.relative === "manifest.en.json"
          ? sha256(await fs.readFile(path.join(extraRouteStaging, file.relative)))
          : file.sha256,
      }))),
    });
    const extraRouteBefore = await Promise.all([
      fs.readFile(path.join(extraRouteContentRoot, "manifest.json"), "utf8"),
      fs.readFile(path.join(extraRouteContentRoot, "manifest.en.json"), "utf8"),
    ]);
    await expectImportError("recovery-conflict", "tutorial-import-extra-route-test", () =>
      recoverTutorialImport({
        contentRoot: extraRouteContentRoot,
        publicRoot: extraRoutePublicRoot,
        operationId: "tutorial-import-extra-route-test",
      }),
    );
    const extraRouteAfter = await Promise.all([
      fs.readFile(path.join(extraRouteContentRoot, "manifest.json"), "utf8"),
      fs.readFile(path.join(extraRouteContentRoot, "manifest.en.json"), "utf8"),
    ]);
    assert.deepEqual(extraRouteAfter, extraRouteBefore);

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

    const restoreContentRoot = path.join(tmpRoot, "restore-content");
    await seedManifests(restoreContentRoot);
    const restoreOperation = "tutorial-import-restore-test";
    const restoreBefore = await Promise.all([
      fs.readFile(path.join(restoreContentRoot, "manifest.json"), "utf8"),
      fs.readFile(path.join(restoreContentRoot, "manifest.en.json"), "utf8"),
    ]);
    await fs.copyFile(path.join(restoreContentRoot, "manifest.json"), path.join(restoreContentRoot, `manifest.json.backup-${restoreOperation}`));
    await fs.copyFile(path.join(restoreContentRoot, "manifest.en.json"), path.join(restoreContentRoot, `manifest.en.json.backup-${restoreOperation}`));
    const restoreMarker = recoveryMarker(restoreOperation, snapshot);
    await writeJsonFile(path.join(restoreContentRoot, "import-generation.json"), restoreMarker);
    await writeJsonFile(
      path.join(restoreContentRoot, ".import-journal", `${restoreOperation}.json`),
      await recoveryJournalFixture(restoreOperation, snapshot, [
        { relative: "manifest.json", sha256: sha256("missing-candidate-manifest") },
        { relative: "manifest.en.json", sha256: sha256("missing-candidate-manifest-en") },
        { relative: "import-generation.json", sha256: sha256("missing-candidate-marker") },
      ], {
        marker: restoreMarker,
        phases: [{ phase: "manifest-backup", relative: "manifest.json", recordedAt: "2026-08-30T00:00:00.000Z" }],
      }),
    );
    const restored = await recoverTutorialImport({
      contentRoot: restoreContentRoot,
      publicRoot: path.join(tmpRoot, "restore-public"),
      operationId: restoreOperation,
    });
    assert.equal(restored.status, "restored");
    const restoreAfter = await Promise.all([
      fs.readFile(path.join(restoreContentRoot, "manifest.json"), "utf8"),
      fs.readFile(path.join(restoreContentRoot, "manifest.en.json"), "utf8"),
    ]);
    assert.deepEqual(restoreAfter, restoreBefore);
    await assert.rejects(() => fs.access(path.join(restoreContentRoot, "import-generation.json")), { code: "ENOENT" });
    await fs.access(path.join(restoreContentRoot, `manifest.json.backup-${restoreOperation}`));

    const partialBackupContentRoot = path.join(tmpRoot, "partial-backup-content");
    const partialBackupPublicRoot = path.join(tmpRoot, "partial-backup-public");
    await seedManifests(partialBackupContentRoot);
    const partialBackupOperation = "tutorial-import-partial-backup-test";
    const partialBackupBefore = await Promise.all([
      fs.readFile(path.join(partialBackupContentRoot, "manifest.json"), "utf8"),
      fs.readFile(path.join(partialBackupContentRoot, "manifest.en.json"), "utf8"),
    ]);
    await expectImportError("commit", partialBackupOperation, () =>
      importFixture(tmpRoot, snapshot, {
        contentRoot: partialBackupContentRoot,
        publicRoot: partialBackupPublicRoot,
        operationId: partialBackupOperation,
        testHooks: { failBeforeManifestRelative: "manifest.json" },
      }),
    );
    const partialBackupStaging = path.join(partialBackupContentRoot, ".import-staging", partialBackupOperation);
    await fs.writeFile(
      path.join(partialBackupContentRoot, `manifest.json.backup-${partialBackupOperation}`),
      partialBackupBefore[0],
      "utf8",
    );
    await fs.rm(path.join(partialBackupContentRoot, `manifest.en.json.backup-${partialBackupOperation}`), { force: true });
    await fs.rm(path.join(partialBackupContentRoot, `import-generation.json.backup-${partialBackupOperation}`), { force: true });
    await fs.copyFile(path.join(partialBackupStaging, "manifest.json"), path.join(partialBackupContentRoot, "manifest.json"));
    await fs.rm(path.join(partialBackupStaging, "manifest.en.json"), { force: true });
    const mixedBeforeRestore = await Promise.all([
      fs.readFile(path.join(partialBackupContentRoot, "manifest.json"), "utf8").then(JSON.parse),
      fs.readFile(path.join(partialBackupContentRoot, "manifest.en.json"), "utf8").then(JSON.parse),
    ]);
    assert.notEqual(mixedBeforeRestore[0].generation, mixedBeforeRestore[1].generation);
    const partialRestored = await recoverTutorialImport({
      contentRoot: partialBackupContentRoot,
      publicRoot: partialBackupPublicRoot,
      operationId: partialBackupOperation,
    });
    assert.equal(partialRestored.status, "restored");
    const partialBackupAfter = await Promise.all([
      fs.readFile(path.join(partialBackupContentRoot, "manifest.json"), "utf8"),
      fs.readFile(path.join(partialBackupContentRoot, "manifest.en.json"), "utf8"),
    ]);
    assert.deepEqual(partialBackupAfter, partialBackupBefore);
    const partialRestoredAgain = await recoverTutorialImport({
      contentRoot: partialBackupContentRoot,
      publicRoot: partialBackupPublicRoot,
      operationId: partialBackupOperation,
    });
    assert.equal(partialRestoredAgain.status, "restored");
    assert.deepEqual(await Promise.all([
      fs.readFile(path.join(partialBackupContentRoot, "manifest.json"), "utf8"),
      fs.readFile(path.join(partialBackupContentRoot, "manifest.en.json"), "utf8"),
    ]), partialBackupBefore);

    const atomicRestoreContentRoot = path.join(tmpRoot, "atomic-restore-content");
    const atomicRestorePublicRoot = path.join(tmpRoot, "atomic-restore-public");
    await seedManifests(atomicRestoreContentRoot);
    const atomicSeedOperation = "tutorial-import-atomic-seed";
    await importFixture(tmpRoot, snapshot, {
      contentRoot: atomicRestoreContentRoot,
      publicRoot: atomicRestorePublicRoot,
      operationId: atomicSeedOperation,
    });
    const atomicRestoreOperation = "tutorial-import-atomic-restore-test";
    const atomicRestoreFiles = ["manifest.json", "manifest.en.json", "import-generation.json"];
    const atomicRestoreBefore = await Promise.all(
      atomicRestoreFiles.map((relative) => fs.readFile(path.join(atomicRestoreContentRoot, relative), "utf8")),
    );
    for (const relative of atomicRestoreFiles) {
      await fs.copyFile(
        path.join(atomicRestoreContentRoot, relative),
        path.join(atomicRestoreContentRoot, `${relative}.backup-${atomicRestoreOperation}`),
      );
      await fs.writeFile(path.join(atomicRestoreContentRoot, relative), "{broken", "utf8");
    }
    await writeJsonFile(
      path.join(atomicRestoreContentRoot, ".import-journal", `${atomicRestoreOperation}.json`),
      await recoveryJournalFixture(atomicRestoreOperation, snapshot, [
        { relative: "manifest.json", sha256: sha256("missing-candidate-manifest") },
        { relative: "manifest.en.json", sha256: sha256("missing-candidate-manifest-en") },
        { relative: "import-generation.json", sha256: sha256("missing-candidate-marker") },
      ], {
        phases: [{ phase: "manifest-replace", relative: "manifest.json", recordedAt: "2026-08-30T00:00:00.000Z" }],
      }),
    );
    await expectImportError("unavailable", atomicRestoreOperation, () =>
      recoverTutorialImport({
        contentRoot: atomicRestoreContentRoot,
        publicRoot: atomicRestorePublicRoot,
        operationId: atomicRestoreOperation,
        testHooks: { failAfterRestoreRenameRelative: "manifest.json" },
      }),
    );
    assert.deepEqual(
      (await fs.readdir(atomicRestoreContentRoot)).filter((entry) =>
        entry.includes(`.restore-${atomicRestoreOperation}.`),
      ),
      [],
    );
    const atomicRestored = await recoverTutorialImport({
      contentRoot: atomicRestoreContentRoot,
      publicRoot: atomicRestorePublicRoot,
      operationId: atomicRestoreOperation,
    });
    assert.equal(atomicRestored.status, "restored");
    const atomicRestoreAfter = await Promise.all(
      atomicRestoreFiles.map((relative) => fs.readFile(path.join(atomicRestoreContentRoot, relative), "utf8")),
    );
    assert.deepEqual(atomicRestoreAfter, atomicRestoreBefore);
    model.validateTutorialManifestPair(
      model.parseTutorialManifest(JSON.parse(atomicRestoreAfter[0]), "zh-CN", "atomic restore manifest.json"),
      model.parseTutorialManifest(JSON.parse(atomicRestoreAfter[1]), "en", "atomic restore manifest.en.json"),
    );
    const atomicRestoredAgain = await recoverTutorialImport({
      contentRoot: atomicRestoreContentRoot,
      publicRoot: atomicRestorePublicRoot,
      operationId: atomicRestoreOperation,
    });
    assert.equal(atomicRestoredAgain.status, "restored");
    assert.deepEqual(
      await Promise.all(
        atomicRestoreFiles.map((relative) => fs.readFile(path.join(atomicRestoreContentRoot, relative), "utf8")),
      ),
      atomicRestoreBefore,
    );

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
    const mediaDriftZhManifest = structuredClone(refreshedZhManifest);
    mediaDriftZhManifest.routes[0].refreshCandidate.media = [];
    assertManifestPairRejects(mediaDriftZhManifest, refreshedEnManifest, /refresh candidate media pairing/);
    const tocDriftZhManifest = structuredClone(refreshedZhManifest);
    tocDriftZhManifest.routes[0].refreshCandidate.toc = [];
    assertManifestPairRejects(tocDriftZhManifest, refreshedEnManifest, /refresh candidate TOC pairing/);
    const metricsDriftZhManifest = structuredClone(refreshedZhManifest);
    metricsDriftZhManifest.routes[0].refreshCandidate.contentMetrics = {
      ...metricsDriftZhManifest.routes[0].refreshCandidate.contentMetrics,
      p: metricsDriftZhManifest.routes[0].refreshCandidate.contentMetrics.p + 1,
    };
    assertManifestPairRejects(metricsDriftZhManifest, refreshedEnManifest, /refresh candidate metrics pairing/);
    const seoDriftZhManifest = structuredClone(refreshedZhManifest);
    seoDriftZhManifest.routes[0].refreshCandidate.seo.dateModified = "2026-08-30T00:00:00.000Z";
    assertManifestPairRejects(seoDriftZhManifest, refreshedEnManifest, /refresh candidate SEO pairing/);
    const refreshRecoveryContentRoot = path.join(tmpRoot, "refresh-recovery-content");
    const refreshRecoveryPublicRoot = path.join(tmpRoot, "refresh-recovery-public");
    await seedManifests(refreshRecoveryContentRoot);
    await importFixture(tmpRoot, snapshot, {
      contentRoot: refreshRecoveryContentRoot,
      publicRoot: refreshRecoveryPublicRoot,
      operationId: "tutorial-import-refresh-recovery-seed",
    });
    await publishImportedFixture(refreshRecoveryContentRoot);
    const refreshRecoveryBefore = await Promise.all([
      fs.readFile(path.join(refreshRecoveryContentRoot, "manifest.json"), "utf8"),
      fs.readFile(path.join(refreshRecoveryContentRoot, "manifest.en.json"), "utf8"),
    ]);
    const refreshRecoveryOperation = "tutorial-import-refresh-recovery-test";
    await expectImportError("commit", refreshRecoveryOperation, () =>
      importTutorialDraft({
        input: refreshedInput,
        translation: refreshedTranslation,
        contentRoot: refreshRecoveryContentRoot,
        publicRoot: refreshRecoveryPublicRoot,
        allowFixtureMedia: true,
        operationId: refreshRecoveryOperation,
        testHooks: { failBeforeFirstContent: true },
      }),
    );
    const refreshRecoveryStaging = path.join(refreshRecoveryContentRoot, ".import-staging", refreshRecoveryOperation);
    const refreshRecoveryJournalPath = path.join(refreshRecoveryContentRoot, ".import-journal", `${refreshRecoveryOperation}.json`);
    const refreshRecoveryJournal = JSON.parse(await fs.readFile(refreshRecoveryJournalPath, "utf8"));
    const refreshRecoveryZhManifest = JSON.parse(await fs.readFile(path.join(refreshRecoveryStaging, "manifest.json"), "utf8"));
    refreshRecoveryZhManifest.routes[0].refreshCandidate.media = [];
    await writeJsonFile(path.join(refreshRecoveryStaging, "manifest.json"), refreshRecoveryZhManifest);
    await writeJsonFile(refreshRecoveryJournalPath, {
      ...refreshRecoveryJournal,
      files: await Promise.all(refreshRecoveryJournal.files.map(async (file) => ({
        ...file,
        sha256: file.relative === "manifest.json"
          ? sha256(await fs.readFile(path.join(refreshRecoveryStaging, file.relative)))
          : file.sha256,
      }))),
    });
    await expectImportError("recovery-conflict", refreshRecoveryOperation, () =>
      recoverTutorialImport({
        contentRoot: refreshRecoveryContentRoot,
        publicRoot: refreshRecoveryPublicRoot,
        operationId: refreshRecoveryOperation,
      }),
    );
    assert.deepEqual(await Promise.all([
      fs.readFile(path.join(refreshRecoveryContentRoot, "manifest.json"), "utf8"),
      fs.readFile(path.join(refreshRecoveryContentRoot, "manifest.en.json"), "utf8"),
    ]), refreshRecoveryBefore);
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
    const beforeSupersededRefresh = JSON.parse(await fs.readFile(path.join(contentRoot, "manifest.json"), "utf8"));
    const supersededRefresh = await importTutorialDraft({
      input: refreshedInput,
      translation: refreshedTranslation,
      contentRoot,
      publicRoot,
      allowFixtureMedia: true,
      operationId: "tutorial-import-refresh-superseded-test",
    });
    assert.equal(supersededRefresh.idempotent, true);
    assert.equal(supersededRefresh.status, "stale");
    assert.equal(supersededRefresh.liveRouteStatus, "published");
    const supersededRefreshManifest = JSON.parse(await fs.readFile(path.join(contentRoot, "manifest.json"), "utf8"));
    assert.deepEqual(supersededRefreshManifest, beforeSupersededRefresh);

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
    const guardedReclaimJournalPath = path.join(
      guardedReclaimContentRoot,
      ".import-journal",
      "tutorial-import-guarded-reclaim-test.json",
    );
    const guardedReclaimJournalSource = await fs.readFile(guardedReclaimJournalPath, "utf8");
    await fs.rm(`${guardedReclaimLockPath}.reclaiming`, { recursive: true, force: true });
    await captureImportError("duplicate-operation", "tutorial-import-guarded-reclaim-test", () =>
      importFixture(tmpRoot, {
        ...snapshot,
        slug: "guarded-reclaim-guide",
      }, {
        contentRoot: guardedReclaimContentRoot,
        publicRoot: path.join(tmpRoot, "guarded-reclaim-public"),
        operationId: "tutorial-import-guarded-reclaim-test",
      }),
    );
    assert.equal(await fs.readFile(guardedReclaimJournalPath, "utf8"), guardedReclaimJournalSource);
    const guardedReclaimResult = await importFixture(tmpRoot, {
      ...snapshot,
      slug: "guarded-reclaim-guide",
    }, {
      contentRoot: guardedReclaimContentRoot,
      publicRoot: path.join(tmpRoot, "guarded-reclaim-public"),
      operationId: "tutorial-import-guarded-reclaim-retry-test",
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

    console.log("Tutorial importer contract passed: deterministic fixture collect/import, collect/import/recover CLI failure audit, overlong operation id fallback, in-process recovery/restore coverage, atomic restore retry coverage, marker gating, non-global IPv6 rejection, tuple idempotency, lock scope, provenance metadata, duplicate media staging, and refresh candidate preservation. Evidence artifact: .omo/evidence/18-fix11-tutorials-importer.log");
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
}

await main();
