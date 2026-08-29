import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import type { Locale } from "@/lib/localization";
import {
  getTutorialRecord,
  getPublishedTutorialPair,
  getTutorialStaticParams,
  isTutorialRedirect,
  resolveTutorialRedirect,
  type TutorialRecord,
} from "@/lib/tutorials/manifest";
import { createTutorialMetadata, TutorialStructuredData } from "@/lib/tutorials/seo";

export type TutorialParams = Promise<{ slug: string }>;
type TutorialRedirectResolver = (
  locale: Locale,
  record: TutorialRecord,
) => Promise<string | null>;

export function generateTutorialStaticParams(locale: Locale): Promise<Array<{ slug: string }>> {
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
  const pair = isTutorialRedirect(record)
    ? undefined
    : await getPublishedTutorialPair(locale, record.slug);
  return createTutorialMetadata(record, locale, {
    indexable: Boolean(pair),
    includeAlternates: Boolean(pair),
  });
}

export async function renderTutorialRecord(
  locale: Locale,
  record: TutorialRecord,
  redirectResolver: TutorialRedirectResolver = resolveTutorialRedirect,
) {
  const redirectTarget = await redirectResolver(locale, record);
  if (redirectTarget) permanentRedirect(redirectTarget);
  const sourceTitle = record.source.title ?? record.source.canonicalUrl;
  return (
    <>
      <TutorialStructuredData record={record} locale={locale} />
      <article data-tutorial-slug={record.slug} data-tutorial-status={record.status}>
        <header>
          <h1>{record.title}</h1>
          <p>{record.description}</p>
        </header>
        <p>
          Source: <a href={record.source.canonicalUrl}>{sourceTitle}</a>
        </p>
      </article>
    </>
  );
}

export async function renderTutorialPage(locale: Locale, params: TutorialParams) {
  return renderTutorialRecord(locale, await getTutorialPageRecord(locale, params));
}
