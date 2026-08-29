import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";

import type { Locale } from "@/lib/localization";
import { assertTutorialSlug, isTutorialSlug, tutorialPath } from "./url";

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
  return canonical;
}

function tutorialStatus(value: unknown, label: string): TutorialStatus {
  if (value === "draft" || value === "review" || value === "published" || value === "stale") {
    return value;
  }
  throw new Error(`${label} must be draft, review, published, or stale`);
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
    redirectTo: typeof value.redirectTo === "string" || value.redirectTo === null
      ? value.redirectTo
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
  for (const route of routes) {
    if (slugs.has(route.slug)) throw new Error(`Duplicate tutorial slug: ${route.slug}`);
    slugs.add(route.slug);
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

export async function getPublishedTutorialPairs(): Promise<
  Array<{ zh: TutorialRecord; en: TutorialRecord }>
> {
  const [zhManifest, enManifest] = await Promise.all([
    readTutorialManifest("zh-CN"),
    readTutorialManifest("en"),
  ]);
  const englishBySlug = new Map(enManifest.routes.map((route) => [route.slug, route]));
  return zhManifest.routes.flatMap((zh) => {
    const en = englishBySlug.get(zh.slug);
    if (!en || !isPublishedTutorial(zh) || !isPublishedTutorial(en)) return [];
    if (zh.source.canonicalUrl !== en.source.canonicalUrl) return [];
    return [{ zh, en }];
  });
}
