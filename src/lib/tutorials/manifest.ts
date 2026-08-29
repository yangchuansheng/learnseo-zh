import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";

import type { Locale } from "@/lib/localization";
import {
  assertTutorialSlug,
  isTutorialSlug,
  normalizeSourceKey,
  safeTutorialRedirect,
  tutorialSlugFromPath,
} from "./url";
import {
  parseTutorialManifest,
  validateTutorialManifestPair,
  validateTutorialRecord,
  validateTutorialManifestPairOwnership as validateModelPairOwnership,
} from "./model";
import type {
  TutorialManifest,
  TutorialPublicationPair,
  TutorialRecord,
} from "./model";

export type {
  Sha256,
  TutorialContentFile,
  TutorialContentMetrics,
  TutorialHeadingEntry,
  TutorialHtmlValidation,
  TutorialLicense,
  TutorialManifest,
  TutorialManifestPair,
  TutorialMedia,
  TutorialPublicationPair,
  TutorialQualification,
  TutorialQualificationChecklist,
  TutorialQualificationChecklistKey,
  TutorialQualificationDecision,
  TutorialRecord,
  TutorialReview,
  TutorialReviewChecklist,
  TutorialReviewChecklistKey,
  TutorialReviewDecision,
  TutorialReviewHistoryEntry,
  TutorialRefreshCandidate,
  TutorialSeo,
  TutorialSemanticTag,
  TutorialSnapshot,
  TutorialSnapshotHistory,
  TutorialSource,
  TutorialSourceAlias,
  TutorialStatus,
  TutorialTocEntry,
  TutorialTranslation,
} from "./model";
export {
  assertTutorialContentFile,
  isSha256,
  isTutorialRecord,
  parseTutorialManifest,
  sha256,
  TUTORIAL_ALLOWED_EMBED_HOSTS,
  TUTORIAL_MANIFEST_SCHEMA,
  TUTORIAL_QUALIFICATION_CHECKLIST_KEYS,
  TUTORIAL_REVIEW_CHECKLIST_KEYS,
  TUTORIAL_SCHEMA_VERSION,
  TUTORIAL_SEMANTIC_TAGS,
  TUTORIAL_STATUSES,
  tutorialManifestSchema,
  validateContentHash,
  validateTutorialHtml,
  validateTutorialManifest,
  validateTutorialManifestPair,
} from "./model";

export const TUTORIAL_CONTENT_ROOT = path.join(process.cwd(), "src/content/tutorials");

export function isTutorialRedirect(record: TutorialRecord): boolean {
  return record.redirectTo !== undefined && record.redirectTo !== null;
}

function recordSourceKey(record: TutorialRecord): string {
  if (typeof record.sourceKey === "string" && record.sourceKey) return record.sourceKey;
  return normalizeSourceKey(record.source.canonicalUrl);
}

function manifestPath(locale: Locale): string {
  return path.join(TUTORIAL_CONTENT_ROOT, locale === "en" ? "manifest.en.json" : "manifest.json");
}

function unavailableManifest(locale: Locale): TutorialManifest {
  return {
    schemaVersion: 1,
    locale,
    generation: null,
    activeVersion: null,
    available: false,
    routes: [],
    aliases: [],
  };
}

async function readImportGenerationMarker(): Promise<unknown | undefined> {
  const markerPath = path.join(TUTORIAL_CONTENT_ROOT, "import-generation.json");
  try {
    return JSON.parse(await readFile(markerPath, "utf8")) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    return null;
  }
}

export function tutorialManifestMatchesGenerationMarker(
  manifest: TutorialManifest,
  marker: unknown,
): boolean {
  if (marker === undefined) return true;
  if (!marker || typeof marker !== "object") return false;
  const value = marker as {
    operationId?: unknown;
    generation?: unknown;
    locales?: unknown;
  };
  return typeof value.operationId === "string" &&
    typeof value.generation === "string" &&
    value.operationId === value.generation &&
    value.generation === manifest.generation &&
    Array.isArray(value.locales) &&
    value.locales.includes("zh-CN") &&
    value.locales.includes("en");
}

export const readTutorialManifest = cache(async (locale: Locale): Promise<TutorialManifest> => {
  const filePath = manifestPath(locale);
  let source: string;
  try {
    source = await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return unavailableManifest(locale);
    }
    throw new Error(`Unable to read tutorial manifest ${filePath}: ${(error as Error).message}`);
  }

  try {
    const manifest = parseTutorialManifest(JSON.parse(source) as unknown, locale, filePath);
    const marker = await readImportGenerationMarker();
    return tutorialManifestMatchesGenerationMarker(manifest, marker)
      ? manifest
      : unavailableManifest(locale);
  } catch (error) {
    throw new Error(`Invalid tutorial manifest ${filePath}: ${(error as Error).message}`);
  }
});

export async function getTutorialRecords(locale: Locale): Promise<readonly TutorialRecord[]> {
  return (await readTutorialManifest(locale)).routes;
}

export async function getTutorialRecord(
  locale: Locale,
  slug: string,
): Promise<TutorialRecord | undefined> {
  if (!isTutorialSlug(slug)) return undefined;
  return (await getTutorialRecords(locale)).find((route) => route.slug === slug);
}

export async function getTutorialStaticParams(
  locale: Locale,
): Promise<Array<{ slug: string }>> {
  return (await getTutorialRecords(locale)).map(({ slug }) => ({ slug }));
}

export function isPublishedTutorial(record: TutorialRecord): boolean {
  return record.status === "published";
}

export function tutorialDateModified(record: TutorialRecord): string | undefined {
  const values = [
    record.seo?.dateModified,
    record.snapshot.sourceUpdatedAt,
    record.snapshot.capturedAt,
  ];
  for (const value of values) {
    if (typeof value !== "string" || !value.trim()) continue;
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) return new Date(timestamp).toISOString();
  }
  return undefined;
}

export function isIndexableTutorialPair(
  zh: TutorialRecord,
  en: TutorialRecord,
  zhGeneration: string | null | undefined,
  enGeneration: string | null | undefined,
): boolean {
  if (!isPublishedTutorial(zh) || !isPublishedTutorial(en)) return false;
  if (isTutorialRedirect(zh) || isTutorialRedirect(en)) return false;
  if (!zhGeneration || zhGeneration !== enGeneration) return false;
  if (
    !Number.isInteger(zh.snapshot.version) ||
    zh.snapshot.version < 1 ||
    !Number.isInteger(en.snapshot.version) ||
    en.snapshot.version < 1
  ) return false;
  if (zh.snapshot.version !== en.snapshot.version) return false;
  if (!tutorialDateModified(zh) || !tutorialDateModified(en)) return false;
  try {
    return recordSourceKey(zh) === recordSourceKey(en) &&
      normalizeSourceKey(zh.source.canonicalUrl) === normalizeSourceKey(en.source.canonicalUrl);
  } catch {
    return false;
  }
}

export function validateTutorialManifestPairOwnership(
  zhManifest: TutorialManifest,
  enManifest: TutorialManifest,
): void {
  const routes = [...zhManifest.routes, ...enManifest.routes];
  if (routes.every((route) => typeof route.sourceKey === "string" && route.sourceKey)) {
    validateModelPairOwnership(zhManifest, enManifest);
    return;
  }
  const owners = new Map<string, string>();
  for (const route of routes) {
    const sourceKey = recordSourceKey(route);
    const owner = owners.get(sourceKey);
    if (owner && owner !== route.slug) {
      throw new Error(
        `Tutorial source key ${sourceKey} is owned by both ${owner} and ${route.slug}`,
      );
    }
    owners.set(sourceKey, route.slug);
  }
}

export function getPublishedTutorialPairsFromManifests(
  zhManifest: TutorialManifest,
  enManifest: TutorialManifest,
): TutorialPublicationPair[] {
  validateTutorialManifestPairOwnership(zhManifest, enManifest);
  if (!zhManifest.available || !enManifest.available) return [];
  const generation = zhManifest.generation;
  if (!generation || generation !== enManifest.generation) return [];
  const pair = validateTutorialManifestPair(zhManifest, enManifest);
  const englishBySlug = new Map(pair.en.routes.map((route) => [route.slug, route]));
  return pair.zh.routes.flatMap((zh) => {
    const en = englishBySlug.get(zh.slug);
    if (!en || !isIndexableTutorialPair(zh, en, generation, enManifest.generation)) {
      return [];
    }
    return [{ zh, en, generation }];
  });
}

export async function getPublishedTutorialPair(
  locale: Locale,
  slug: string,
): Promise<TutorialPublicationPair | undefined> {
  const pair = (await getPublishedTutorialPairs()).find(
    ({ zh, en }) => (locale === "en" ? en : zh).slug === slug,
  );
  return pair;
}

export async function getPublishedTutorialPairs(): Promise<TutorialPublicationPair[]> {
  const [zhManifest, enManifest] = await Promise.all([
    readTutorialManifest("zh-CN"),
    readTutorialManifest("en"),
  ]);
  return getPublishedTutorialPairsFromManifests(zhManifest, enManifest);
}

export function resolveTutorialRedirectPath(
  locale: Locale,
  record: TutorialRecord,
  recordsBySlug: ReadonlyMap<string, TutorialRecord>,
): string | null {
  if (!isTutorialRedirect(record)) return null;

  const visited = new Set([record.slug]);
  let current = record;
  let firstTarget: string | null = null;

  while (isTutorialRedirect(current)) {
    const safeTarget = safeTutorialRedirect(current.redirectTo as string, locale, current.slug);
    if (!safeTarget) {
      throw new Error(`Unsafe tutorial redirect from ${current.path}: ${current.redirectTo}`);
    }
    firstTarget ??= safeTarget;
    const targetSlug = tutorialSlugFromPath(safeTarget, locale);
    if (!targetSlug || visited.has(targetSlug)) {
      throw new Error(`Tutorial redirect cycle detected at ${current.path}`);
    }
    visited.add(targetSlug);
    const next = recordsBySlug.get(targetSlug);
    if (!next) {
      throw new Error(`Tutorial redirect target is missing: ${safeTarget}`);
    }
    current = next;
  }

  return firstTarget;
}

export async function resolveTutorialRedirect(
  locale: Locale,
  record: TutorialRecord,
): Promise<string | null> {
  const recordsBySlug = new Map(
    (await getTutorialRecords(locale)).map((route) => [route.slug, route]),
  );
  return resolveTutorialRedirectPath(locale, record, recordsBySlug);
}

// Backward-compatible parser names used by the first URL/SEO implementation.
export const parseManifest = parseTutorialManifest;
export const normalizeRecord = validateTutorialRecord;

export { assertTutorialSlug };
