import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";

import type { Locale } from "@/lib/localization";
import {
  assertTutorialSlug,
  isTutorialSlug,
  normalizeSourceKey,
  safeTutorialRedirect,
  tutorialPath,
  tutorialSlugFromPath,
} from "./url";

export type TutorialStatus = "draft" | "review" | "published" | "stale";

export type TutorialSource = Readonly<{
  title?: string;
  provider?: string;
  author?: string | null;
  canonicalUrl: string;
  sourcePath?: string;
  license?: unknown;
}>;

export type TutorialSnapshot = Readonly<{
  version: number;
  capturedAt?: string;
  sourceUpdatedAt?: string;
  pageCanonicalUrl?: string;
  canonicalMatched?: boolean;
  sourceContentHash?: string;
  contentHash?: string;
  translationContentHash?: string;
  history?: readonly unknown[];
}>;

export type TutorialSeo = Readonly<{
  title?: string;
  description?: string;
  indexable?: boolean;
  dateModified?: string;
}>;

export type TutorialRecord = Readonly<{
  slug: string;
  path: string;
  title: string;
  description: string;
  provider: string;
  status: TutorialStatus;
  source: TutorialSource;
  snapshot: TutorialSnapshot;
  seo?: TutorialSeo;
  contentFile?: string | null;
  redirectTo?: string | null;
}> & Readonly<Record<string, unknown>>;

export type TutorialManifest = Readonly<{
  locale: Locale;
  generation: string | null;
  available: boolean;
  routes: readonly TutorialRecord[];
}>;

export type TutorialPublicationPair = Readonly<{
  zh: TutorialRecord;
  en: TutorialRecord;
  generation: string;
}>;

export const TUTORIAL_CONTENT_ROOT = path.join(process.cwd(), "src/content/tutorials");

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function sourceCanonical(value: unknown, label: string): string {
  const canonical = requiredString(value, label);
  let parsed: URL;
  try {
    parsed = new URL(canonical);
  } catch {
    throw new Error(`${label} must be an absolute HTTPS URL`);
  }
  if (parsed.protocol !== "https:" || !parsed.hostname) {
    throw new Error(`${label} must be an absolute HTTPS URL`);
  }
  normalizeSourceKey(canonical);
  return canonical;
}

function tutorialStatus(value: unknown, label: string): TutorialStatus {
  if (value === "draft" || value === "review" || value === "published" || value === "stale") {
    return value;
  }
  throw new Error(`${label} must be draft, review, published, or stale`);
}

export function isTutorialRedirect(record: TutorialRecord): boolean {
  return record.redirectTo !== undefined && record.redirectTo !== null;
}

function normalizeRecord(value: unknown, locale: Locale, index: number): TutorialRecord {
  if (!isRecord(value)) throw new Error(`Tutorial route ${index} must be an object`);

  const slug = assertTutorialSlug(requiredString(value.slug, `Tutorial route ${index} slug`));
  const expectedPath = tutorialPath(slug, locale);
  const recordPath = optionalString(value.path) ?? expectedPath;
  if (recordPath !== expectedPath) {
    throw new Error(`Tutorial route ${slug} path must be ${expectedPath}`);
  }

  const source = isRecord(value.source) ? value.source : null;
  if (!source) throw new Error(`Tutorial route ${slug} source must be an object`);
  const canonicalUrl = sourceCanonical(
    source.canonicalUrl,
    `Tutorial route ${slug} source.canonicalUrl`,
  );
  const snapshot = isRecord(value.snapshot) ? value.snapshot : null;
  if (!snapshot || !Number.isInteger(snapshot.version) || Number(snapshot.version) < 1) {
    throw new Error(`Tutorial route ${slug} snapshot.version must be a positive integer`);
  }

  const normalizedSource: TutorialSource = {
    ...source,
    canonicalUrl,
    title: optionalString(source.title),
    provider: optionalString(source.provider),
    author: source.author === null ? null : optionalString(source.author) ?? null,
  };
  const normalizedSnapshot: TutorialSnapshot = {
    ...snapshot,
    version: Number(snapshot.version),
    capturedAt: optionalString(snapshot.capturedAt),
    sourceUpdatedAt: optionalString(snapshot.sourceUpdatedAt),
    pageCanonicalUrl: optionalString(snapshot.pageCanonicalUrl),
    canonicalMatched: typeof snapshot.canonicalMatched === "boolean"
      ? snapshot.canonicalMatched
      : undefined,
    sourceContentHash: optionalString(snapshot.sourceContentHash),
    contentHash: optionalString(snapshot.contentHash),
    translationContentHash: optionalString(snapshot.translationContentHash),
    history: Array.isArray(snapshot.history) ? snapshot.history : undefined,
  };
  const seo = isRecord(value.seo)
    ? {
        ...value.seo,
        title: optionalString(value.seo.title),
        description: optionalString(value.seo.description),
        indexable: typeof value.seo.indexable === "boolean" ? value.seo.indexable : undefined,
        dateModified: optionalString(value.seo.dateModified),
      }
    : undefined;

  const redirectTo = value.redirectTo;
  if (redirectTo !== undefined && redirectTo !== null &&
      (typeof redirectTo !== "string" || !redirectTo.trim())) {
    throw new Error(`Tutorial route ${slug} redirectTo must be a non-empty string or null`);
  }

  return {
    ...value,
    slug,
    path: expectedPath,
    title: requiredString(value.title, `Tutorial route ${slug} title`),
    description: requiredString(value.description, `Tutorial route ${slug} description`),
    provider: requiredString(value.provider, `Tutorial route ${slug} provider`),
    status: tutorialStatus(value.status, `Tutorial route ${slug} status`),
    source: normalizedSource,
    snapshot: normalizedSnapshot,
    seo,
    contentFile: typeof value.contentFile === "string" || value.contentFile === null
      ? value.contentFile
      : undefined,
    redirectTo: typeof redirectTo === "string" || redirectTo === null
      ? redirectTo
      : undefined,
  } as TutorialRecord;
}

function parseManifest(value: unknown, locale: Locale, filePath: string): TutorialManifest {
  if (!isRecord(value)) throw new Error(`Tutorial manifest ${filePath} must be an object`);
  if (value.locale !== undefined && value.locale !== locale) {
    throw new Error(`Tutorial manifest ${filePath} locale must be ${locale}`);
  }
  const records = value.routes ?? value.records ?? value.tutorials;
  if (!Array.isArray(records)) throw new Error(`Tutorial manifest ${filePath} must contain routes`);

  const routes = records.map((record, index) => normalizeRecord(record, locale, index));
  const slugs = new Set<string>();
  const sourceKeyOwners = new Map<string, string>();
  for (const route of routes) {
    if (slugs.has(route.slug)) throw new Error(`Duplicate tutorial slug: ${route.slug}`);
    slugs.add(route.slug);

    const sourceKey = normalizeSourceKey(route.source.canonicalUrl);
    const owner = sourceKeyOwners.get(sourceKey);
    if (owner && owner !== route.slug) {
      throw new Error(
        `Tutorial source key ${sourceKey} is owned by both ${owner} and ${route.slug}`,
      );
    }
    sourceKeyOwners.set(sourceKey, route.slug);
  }

  const routesBySlug = new Map(routes.map((route) => [route.slug, route]));
  for (const route of routes) {
    if (isTutorialRedirect(route)) {
      resolveTutorialRedirectPath(locale, route, routesBySlug);
    }
  }

  return {
    locale,
    generation: optionalString(value.generation) ?? optionalString(value.commitGeneration) ?? null,
    available: true,
    routes,
  };
}

function manifestPath(locale: Locale): string {
  return path.join(TUTORIAL_CONTENT_ROOT, locale === "en" ? "manifest.en.json" : "manifest.json");
}

export const readTutorialManifest = cache(async (locale: Locale): Promise<TutorialManifest> => {
  const filePath = manifestPath(locale);
  let source: string;
  try {
    source = await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { locale, generation: null, available: false, routes: [] };
    }
    throw new Error(`Unable to read tutorial manifest ${filePath}: ${(error as Error).message}`);
  }

  try {
    return parseManifest(JSON.parse(source) as unknown, locale, filePath);
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
  try {
    return normalizeSourceKey(zh.source.canonicalUrl) === normalizeSourceKey(en.source.canonicalUrl);
  } catch {
    return false;
  }
}

export function getPublishedTutorialPairsFromManifests(
  zhManifest: TutorialManifest,
  enManifest: TutorialManifest,
): TutorialPublicationPair[] {
  if (!zhManifest.available || !enManifest.available) return [];
  const generation = zhManifest.generation;
  if (!generation || generation !== enManifest.generation) return [];
  const englishBySlug = new Map(enManifest.routes.map((route) => [route.slug, route]));
  return zhManifest.routes.flatMap((zh) => {
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

export async function getPublishedTutorialPairs(): Promise<
  TutorialPublicationPair[]
> {
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
