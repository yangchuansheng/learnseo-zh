import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import type { Locale } from "@/lib/localization";
import {
  assertTutorialContentFile,
  getTutorialRecord,
  getPublishedTutorialPair,
  getTutorialStaticParams,
  isTutorialRedirect,
  resolveTutorialRedirect,
  TUTORIAL_CONTENT_ROOT,
  validateContentHash,
  validateTutorialHtml,
  type TutorialRecord,
} from "@/lib/tutorials/manifest";
import { createTutorialMetadata } from "@/lib/tutorials/seo";
import { TutorialDocument } from "./TutorialDocument";

export type TutorialParams = Promise<{ slug: string }>;
type TutorialRedirectResolver = (
  locale: Locale,
  record: TutorialRecord,
) => Promise<string | null>;
type TutorialContentLoader = (locale: Locale, record: TutorialRecord) => Promise<string>;
type TutorialRenderOptions = Readonly<{
  contentLoader?: TutorialContentLoader;
  redirectResolver?: TutorialRedirectResolver;
}>;
type TutorialRenderThirdArgument = TutorialRedirectResolver | TutorialRenderOptions;

const SAFE_ANCHOR_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_.:-]*$/;

export async function generateTutorialStaticParams(locale: Locale): Promise<Array<{ slug: string }>> {
  return getTutorialStaticParams(locale);
}

export async function getTutorialPageRecord(
  locale: Locale,
  params: TutorialParams,
): Promise<TutorialRecord> {
  const { slug } = await params;
  const record = await getTutorialRecord(locale, slug);
  if (!record) notFound();
  return record;
}

export async function generateTutorialPageMetadata(
  locale: Locale,
  params: TutorialParams,
): Promise<Metadata> {
  const record = await getTutorialPageRecord(locale, params);
  if (isTutorialRedirect(record)) {
    return createTutorialMetadata(record, locale, {
      indexable: false,
      includeAlternates: false,
    });
  }
  const pair = await getPublishedTutorialPair(locale, record.slug);
  return createTutorialMetadata(record, locale, {
    indexable: Boolean(pair),
    includeAlternates: Boolean(pair),
  });
}

function contentHashForLocale(locale: Locale, record: TutorialRecord): string {
  const hash = locale === "en" ? record.snapshot.contentHash : record.snapshot.translationContentHash;
  if (!hash) throw new Error(`Tutorial ${record.slug} is missing ${locale} content hash`);
  return hash;
}

function tutorialContentPath(locale: Locale, record: TutorialRecord): string {
  const contentFile = assertTutorialContentFile(
    record.contentFile,
    `Tutorial ${record.slug} contentFile`,
  );
  const expectedHash = contentHashForLocale(locale, record);
  if (!contentFile.startsWith(`${expectedHash}.`)) {
    throw new Error(`Tutorial ${record.slug} ${locale} contentFile does not match its content hash`);
  }
  const target = path.resolve(TUTORIAL_CONTENT_ROOT, "content", contentFile);
  const contentRoot = path.resolve(TUTORIAL_CONTENT_ROOT, "content");
  if (target !== path.join(contentRoot, contentFile) || !target.startsWith(`${contentRoot}${path.sep}`)) {
    throw new Error(`Tutorial ${record.slug} content path escapes tutorial content root`);
  }
  return target;
}

function assertSafeToc(record: TutorialRecord, headingIds: readonly string[]): void {
  const headings = new Set(headingIds);
  for (const entry of record.toc) {
    if (!SAFE_ANCHOR_ID_PATTERN.test(entry.id)) {
      throw new Error(`Tutorial ${record.slug} TOC anchor is unsafe: ${entry.id}`);
    }
    if (!headings.has(entry.id)) {
      throw new Error(`Tutorial ${record.slug} TOC anchor is missing from HTML: ${entry.id}`);
    }
  }
}

export function prepareTutorialHtmlForRender(html: string): string {
  return html
    .replace(/<h1\b[\s\S]*?<\/h1>/i, "")
    .replace(
      /<table\b[\s\S]*?<\/table>/gi,
      (table) => `<div class="tutorial-table-wrapper" data-tutorial-table>${table}</div>`,
    );
}

export async function loadTutorialHtml(locale: Locale, record: TutorialRecord): Promise<string> {
  const contentPath = tutorialContentPath(locale, record);
  const html = await readFile(contentPath, "utf8");
  validateContentHash(html, contentHashForLocale(locale, record), `Tutorial ${record.slug} ${locale} content`);
  const validation = validateTutorialHtml(html, `Tutorial ${record.slug} ${locale}`);
  assertSafeToc(record, validation.headingIds);
  return prepareTutorialHtmlForRender(html);
}

function renderOptions(thirdArgument?: TutorialRenderThirdArgument): Required<TutorialRenderOptions> {
  if (typeof thirdArgument === "function") {
    return {
      contentLoader: loadTutorialHtml,
      redirectResolver: thirdArgument,
    };
  }
  return {
    contentLoader: thirdArgument?.contentLoader ?? loadTutorialHtml,
    redirectResolver: thirdArgument?.redirectResolver ?? resolveTutorialRedirect,
  };
}

export async function renderTutorialRecord(
  locale: Locale,
  record: TutorialRecord,
  thirdArgument?: TutorialRenderThirdArgument,
) {
  const { contentLoader, redirectResolver } = renderOptions(thirdArgument);
  const redirectTarget = await redirectResolver(locale, record);
  if (redirectTarget) permanentRedirect(redirectTarget);
  return (
    <TutorialDocument html={await contentLoader(locale, record)} locale={locale} record={record} />
  );
}

export async function renderTutorialPage(locale: Locale, params: TutorialParams) {
  return renderTutorialRecord(locale, await getTutorialPageRecord(locale, params));
}
