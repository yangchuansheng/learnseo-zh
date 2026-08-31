#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tutorialRoot = path.join(repositoryRoot, "src/content/tutorials");
const contentRoot = path.join(tutorialRoot, "content");
const publicRoot = path.join(repositoryRoot, "public");
const mediaPrefix = "/sites/learningseo-io-071dae18/tutorials/";
const reviewDecisions = new Set(["pending", "approved", "changes-requested"]);

const jiti = createJiti(import.meta.url, {
  alias: { "@": path.join(repositoryRoot, "src") },
});
const model = await jiti.import(path.join(repositoryRoot, "src/lib/tutorials/model.ts"));

function usage(message) {
  throw new Error(`${message}\nUsage: npm run tutorials:review -- --slug <slug> --input <review.json>`);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (!name.startsWith("--")) usage(`Unexpected argument: ${name}`);
    const key = name.slice(2);
    if (!["slug", "input"].includes(key)) usage(`Unsupported option: ${name}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) usage(`Missing value for ${name}`);
    args[key] = value;
    index += 1;
  }
  if (!args.slug || !args.input) usage("--slug and --input are required");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.slug)) usage("--slug must be a safe tutorial slug");
  return args;
}

async function readJson(filePath, label) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read ${label}: ${error.message}`);
  }
}

function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function requiredHash(value, label) {
  const hash = requiredString(value, label).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error(`${label} must be a SHA-256 digest`);
  return hash;
}

function reviewTimestamp(value, label, { nullable = false } = {}) {
  if (value === null && nullable) return null;
  const timestamp = requiredString(value, label);
  if (!Number.isFinite(Date.parse(timestamp))) throw new Error(`${label} must be an ISO-8601 timestamp`);
  return new Date(timestamp).toISOString();
}

function checklist(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const result = {};
  for (const key of keys) {
    if (typeof value[key] !== "boolean") throw new Error(`${label}.${key} must be boolean`);
    result[key] = value[key];
  }
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) throw new Error(`${label} contains unsupported key ${key}`);
  }
  return result;
}

function allTrue(value) {
  return Object.values(value).every(Boolean);
}

function reviewInput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Review input must be an object");
  }
  const decision = requiredString(value.decision, "Review decision");
  if (!reviewDecisions.has(decision)) throw new Error("Review decision must be pending, approved, or changes-requested");
  const reviewer = requiredString(value.reviewer, "Review reviewer");
  const notes = requiredString(value.notes, "Review notes");
  const reviewedAt = value.reviewedAt === null || value.reviewedAt === undefined
    ? (decision === "pending" ? null : new Date().toISOString())
    : reviewTimestamp(value.reviewedAt, "Review reviewedAt");
  if (decision !== "pending" && !reviewedAt) throw new Error("Editorial decisions require reviewedAt");
  const reviewChecklist = checklist(value.checklist, model.TUTORIAL_REVIEW_CHECKLIST_KEYS, "Review checklist");
  const qualificationValue = value.qualification?.checklist ?? value.qualification;
  const qualificationChecklist = qualificationValue === undefined
    ? Object.fromEntries(model.TUTORIAL_QUALIFICATION_CHECKLIST_KEYS.map((key) => [key, false]))
    : checklist(
      qualificationValue,
      model.TUTORIAL_QUALIFICATION_CHECKLIST_KEYS,
      "Qualification checklist",
    );
  if (decision === "approved" && (!allTrue(reviewChecklist) || !allTrue(qualificationChecklist))) {
    throw new Error("An approved tutorial requires every review and qualification checklist item");
  }
  const snapshot = value.snapshot && typeof value.snapshot === "object" ? value.snapshot : value;
  const version = Number(snapshot.version ?? snapshot.snapshotVersion);
  if (!Number.isInteger(version) || version < 1) throw new Error("Review snapshot version must be a positive integer");
  return {
    decision,
    reviewer,
    notes,
    reviewedAt,
    reviewChecklist,
    qualificationChecklist,
    version,
    sourceContentHash: requiredHash(snapshot.sourceContentHash, "Review sourceContentHash"),
    contentHash: requiredHash(snapshot.contentHash, "Review contentHash"),
    translationContentHash: requiredHash(snapshot.translationContentHash, "Review translationContentHash"),
  };
}

function contentPath(file, label) {
  if (typeof file !== "string" || !/^[a-f0-9]{64}\.html$/.test(file)) {
    throw new Error(`${label} must be a hash-named HTML file`);
  }
  return path.join(contentRoot, file);
}

function mediaPath(value, label) {
  if (typeof value !== "string" || !value.startsWith(mediaPrefix) || value.includes("..")) {
    throw new Error(`${label} must stay under the tutorial media root`);
  }
  const target = path.resolve(publicRoot, value.slice(1));
  if (!target.startsWith(`${publicRoot}${path.sep}`)) throw new Error(`${label} escapes public root`);
  return target;
}

async function verifyRecord(record, locale, expected) {
  if (record.status !== "draft" && record.status !== "review") {
    throw new Error(`${locale} route must be draft or review before publication`);
  }
  if (record.snapshot.version !== expected.version) throw new Error(`${locale} snapshot version does not match review input`);
  if (record.snapshot.sourceContentHash !== expected.sourceContentHash) throw new Error(`${locale} sourceContentHash does not match review input`);
  if (record.snapshot.contentHash !== expected.contentHash) throw new Error(`${locale} contentHash does not match review input`);
  if (record.snapshot.translationContentHash !== expected.translationContentHash) {
    throw new Error(`${locale} translationContentHash does not match review input`);
  }
  const expectedContentHash = locale === "en" ? expected.contentHash : expected.translationContentHash;
  const file = contentPath(record.contentFile, `${locale} contentFile`);
  if (!record.contentFile.startsWith(`${expectedContentHash}.`)) throw new Error(`${locale} contentFile hash does not match review input`);
  const html = await fs.readFile(file, "utf8");
  model.validateContentHash(html, expectedContentHash, `${locale} content`);
  const validation = model.validateTutorialHtml(html, `${locale} content`);
  if (record.translation.sourceSections !== record.translation.translatedSections) {
    throw new Error("Bilingual section counts must match");
  }
  if (record.translation.sourceSections < 1) throw new Error("Bilingual section counts must be positive");
  if (record.source.author === undefined || !record.source.canonicalUrl || !record.source.provider) {
    throw new Error(`${locale} provenance metadata is incomplete`);
  }
  for (const [index, media] of record.media.entries()) {
    const target = mediaPath(media.path, `${locale} media[${index}]`);
    const bytes = await fs.readFile(target);
    const hash = crypto.createHash("sha256").update(bytes).digest("hex");
    if (hash !== media.sha256) throw new Error(`${locale} media[${index}] hash does not match manifest`);
  }
  return { html, validation };
}

function snapshotHistoryEntry(route) {
  return {
    version: route.snapshot.version,
    canonicalUrl: route.source.canonicalUrl,
    sourceContentHash: route.snapshot.sourceContentHash,
    contentHash: route.snapshot.contentHash,
    ...(route.snapshot.translationContentHash ? { translationContentHash: route.snapshot.translationContentHash } : {}),
    contentFile: `${route.snapshot.contentHash}.html`,
    ...(route.snapshot.translationContentHash
      ? { translationContentFile: `${route.snapshot.translationContentHash}.html` }
      : {}),
    pageCanonicalUrl: route.snapshot.pageCanonicalUrl,
    canonicalMatched: route.snapshot.canonicalMatched,
    requestedUrl: route.snapshot.requestedUrl,
    finalUrl: route.snapshot.finalUrl,
    capturedAt: route.snapshot.capturedAt,
    ...(route.snapshot.sourceUpdatedAt ? { sourceUpdatedAt: route.snapshot.sourceUpdatedAt } : {}),
    recordedAt: new Date().toISOString(),
  };
}

function priorReviewEntry(review) {
  return {
    decision: review.decision,
    reviewer: review.reviewer,
    reviewedAt: review.reviewedAt,
    notes: review.notes,
    version: undefined,
    operationId: undefined,
  };
}

function candidateAsRoute(route, candidate) {
  const candidateHistory = route.snapshot.history.find((entry) =>
    entry.version === candidate.version &&
    entry.sourceContentHash === candidate.sourceContentHash &&
    entry.contentHash === candidate.contentHash &&
    entry.translationContentHash === candidate.translationContentHash);
  return {
    ...route,
    status: candidate.status,
    activeVersion: candidate.version,
    title: candidate.title,
    description: candidate.description,
    contentFile: candidate.contentFile,
    media: candidate.media,
    toc: candidate.toc,
    contentMetrics: candidate.contentMetrics,
    snapshot: {
      ...route.snapshot,
      version: candidate.version,
      capturedAt: candidateHistory?.capturedAt ?? route.snapshot.capturedAt,
      pageCanonicalUrl: candidateHistory?.pageCanonicalUrl ?? route.snapshot.pageCanonicalUrl,
      canonicalMatched: candidateHistory?.canonicalMatched ?? route.snapshot.canonicalMatched,
      requestedUrl: candidateHistory?.requestedUrl ?? route.snapshot.requestedUrl,
      finalUrl: candidateHistory?.finalUrl ?? route.snapshot.finalUrl,
      ...(candidateHistory?.sourceUpdatedAt || candidate.seo.dateModified
        ? { sourceUpdatedAt: candidateHistory?.sourceUpdatedAt ?? candidate.seo.dateModified }
        : {}),
      sourceContentHash: candidate.sourceContentHash,
      contentHash: candidate.contentHash,
      translationContentHash: candidate.translationContentHash,
    },
    translation: {
      ...route.translation,
      contentHash: candidate.translationContentHash,
      contentFile: candidate.translationContentFile,
    },
    seo: {
      ...candidate.seo,
      indexable: false,
    },
    refreshCandidate: undefined,
  };
}

function nextRoute(route, input) {
  const status = input.decision === "approved"
    ? "published"
    : input.decision === "changes-requested"
      ? "draft"
      : "review";
  const previousHistory = Array.isArray(route.review.history) ? route.review.history : [];
  const historyEntry = priorReviewEntry(route.review);
  const history = [...previousHistory, historyEntry].map((entry) => {
    const clean = { ...entry };
    if (clean.version === undefined) delete clean.version;
    if (clean.operationId === undefined) delete clean.operationId;
    return clean;
  });
  const approved = status === "published";
  return {
    ...route,
    status,
    activeVersion: approved ? route.snapshot.version : route.activeVersion,
    translation: {
      ...route.translation,
      reviewedAt: approved ? input.reviewedAt : null,
    },
    review: {
      ...route.review,
      decision: input.decision,
      reviewer: input.reviewer,
      reviewedAt: input.reviewedAt,
      notes: input.notes,
      checklist: input.reviewChecklist,
      history,
    },
    qualification: {
      ...route.qualification,
      decision: approved ? "qualified" : "pending",
      reviewer: approved ? input.reviewer : null,
      reviewedAt: approved ? input.reviewedAt : null,
      checklist: approved
        ? input.qualificationChecklist
        : Object.fromEntries(model.TUTORIAL_QUALIFICATION_CHECKLIST_KEYS.map((key) => [key, false])),
    },
    seo: {
      ...route.seo,
      indexable: approved,
    },
  };
}

function nextRouteFromRefreshCandidate(route, input) {
  const candidate = route.refreshCandidate;
  const status = input.decision === "approved"
    ? "published"
    : input.decision === "changes-requested"
      ? "draft"
      : "review";
  const previousHistory = Array.isArray(route.review.history) ? route.review.history : [];
  const historyEntry = priorReviewEntry(route.review);
  const history = [...previousHistory, historyEntry].map((entry) => {
    const clean = { ...entry };
    if (clean.version === undefined) delete clean.version;
    if (clean.operationId === undefined) delete clean.operationId;
    return clean;
  });
  const approved = status === "published";
  if (!approved) {
    return {
      ...route,
      refreshCandidate: {
        ...candidate,
        status,
        seo: {
          ...candidate.seo,
          indexable: false,
        },
      },
      review: {
        ...route.review,
        decision: input.decision,
        reviewer: input.reviewer,
        reviewedAt: input.reviewedAt,
        notes: input.notes,
        checklist: input.reviewChecklist,
        history,
      },
    };
  }

  const priorSnapshot = snapshotHistoryEntry(route);
  const existingHistory = route.snapshot.history.filter((entry) => entry.version !== candidate.version);
  const snapshotHistory = existingHistory.some((entry) => entry.version === priorSnapshot.version)
    ? existingHistory
    : [...existingHistory, priorSnapshot];
  const promoted = candidateAsRoute(route, candidate);
  const routeWithoutCandidate = { ...promoted };
  delete routeWithoutCandidate.refreshCandidate;
  return {
    ...routeWithoutCandidate,
    status,
    activeVersion: candidate.version,
    snapshot: {
      ...promoted.snapshot,
      history: snapshotHistory,
    },
    translation: {
      ...promoted.translation,
      reviewedAt: input.reviewedAt,
    },
    review: {
      ...route.review,
      decision: input.decision,
      reviewer: input.reviewer,
      reviewedAt: input.reviewedAt,
      notes: input.notes,
      checklist: input.reviewChecklist,
      history,
    },
    qualification: {
      ...route.qualification,
      decision: "qualified",
      reviewer: input.reviewer,
      reviewedAt: input.reviewedAt,
      checklist: input.qualificationChecklist,
    },
    seo: {
      ...promoted.seo,
      indexable: true,
    },
  };
}

async function writePairAtomically(zhManifest, enManifest, operationId) {
  const files = [
    [path.join(tutorialRoot, "manifest.json"), zhManifest],
    [path.join(tutorialRoot, "manifest.en.json"), enManifest],
  ];
  const temporary = files.map(([target]) => `${target}.tmp-${operationId}`);
  const backups = files.map(([target]) => `${target}.backup-${operationId}`);
  const replaced = [];
  try {
    await Promise.all(files.map(([, value], index) =>
      fs.writeFile(temporary[index], `${JSON.stringify(value, null, 2)}\n`, "utf8")));
    for (let index = 0; index < files.length; index += 1) {
      try {
        await fs.rename(files[index][0], backups[index]);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    for (let index = 0; index < files.length; index += 1) {
      await fs.rename(temporary[index], files[index][0]);
      replaced.push(files[index][0]);
    }
  } catch (error) {
    for (const target of replaced.reverse()) await fs.rm(target, { force: true });
    for (let index = backups.length - 1; index >= 0; index -= 1) {
      try {
        await fs.rename(backups[index], files[index][0]);
      } catch (restoreError) {
        if (restoreError.code !== "ENOENT") throw restoreError;
      }
    }
    throw error;
  } finally {
    await Promise.all([...temporary, ...backups].map((file) => fs.rm(file, { force: true })));
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = reviewInput(await readJson(path.resolve(args.input), "review input"));
  const operationId = `tutorial-review-${args.slug}-${Date.now()}`;
  const lockPath = path.join(tutorialRoot, ".review.lock");
  let lock;
  try {
    lock = await fs.open(lockPath, "wx");
    const [zhRaw, enRaw, marker] = await Promise.all([
      readJson(path.join(tutorialRoot, "manifest.json"), "Chinese manifest"),
      readJson(path.join(tutorialRoot, "manifest.en.json"), "English manifest"),
      readJson(path.join(tutorialRoot, "import-generation.json"), "import generation marker"),
    ]);
    const zhManifest = model.parseTutorialManifest(zhRaw, "zh-CN", "manifest.json");
    const enManifest = model.parseTutorialManifest(enRaw, "en", "manifest.en.json");
    model.validateTutorialManifestPair(zhManifest, enManifest);
    if (marker.operationId !== marker.generation || marker.generation !== zhManifest.generation || marker.generation !== enManifest.generation) {
      throw new Error("Import generation marker does not match both locale manifests");
    }
    if (marker.slug !== args.slug) throw new Error("Import generation marker slug does not match review slug");
    const zhRoute = zhManifest.routes.find((route) => route.slug === args.slug);
    const enRoute = enManifest.routes.find((route) => route.slug === args.slug);
    if (!zhRoute || !enRoute) throw new Error(`Unknown tutorial slug: ${args.slug}`);
    const hasRefreshCandidate = zhRoute.refreshCandidate && enRoute.refreshCandidate;
    if ((zhRoute.status === "published" || enRoute.status === "published") && !hasRefreshCandidate) {
      throw new Error("Tutorial pair is already published");
    }
    const zhReviewRoute = hasRefreshCandidate ? candidateAsRoute(zhRoute, zhRoute.refreshCandidate) : zhRoute;
    const enReviewRoute = hasRefreshCandidate ? candidateAsRoute(enRoute, enRoute.refreshCandidate) : enRoute;
    if (hasRefreshCandidate && zhRoute.refreshCandidate.version !== enRoute.refreshCandidate.version) {
      throw new Error("Refresh candidate versions differ");
    }
    await verifyRecord(zhReviewRoute, "zh-CN", input);
    await verifyRecord(enReviewRoute, "en", input);
    const nextZh = {
      ...zhRaw,
      activeVersion: input.decision === "approved" ? input.version : zhRaw.activeVersion,
      routes: zhRaw.routes.map((route) =>
        route.slug === args.slug
          ? (hasRefreshCandidate ? nextRouteFromRefreshCandidate(route, input) : nextRoute(route, input))
          : route),
    };
    const nextEn = {
      ...enRaw,
      activeVersion: input.decision === "approved" ? input.version : enRaw.activeVersion,
      routes: enRaw.routes.map((route) =>
        route.slug === args.slug
          ? (hasRefreshCandidate ? nextRouteFromRefreshCandidate(route, input) : nextRoute(route, input))
          : route),
    };
    model.parseTutorialManifest(nextZh, "zh-CN", "candidate manifest.json");
    model.parseTutorialManifest(nextEn, "en", "candidate manifest.en.json");
    model.validateTutorialManifestPair(
      model.parseTutorialManifest(nextZh, "zh-CN", "candidate manifest.json"),
      model.parseTutorialManifest(nextEn, "en", "candidate manifest.en.json"),
    );
    await writePairAtomically(nextZh, nextEn, operationId);
    console.log(`[tutorial-review] ${input.decision} ${args.slug}`);
    console.log(`[tutorial-review] status=${input.decision === "approved" ? "published" : input.decision === "pending" ? "review" : "draft"} operation=${operationId}`);
  } finally {
    if (lock) {
      await lock.close();
      await fs.rm(lockPath, { force: true });
    }
  }
}

try {
  await main();
} catch (error) {
  console.error(`[tutorial-review] ${error.message}`);
  process.exitCode = 1;
}
