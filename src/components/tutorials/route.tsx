import type { Metadata } from "next";
import { notFound } from "next/navigation";

import type { Locale } from "@/lib/localization";
import {
  getTutorialRecord,
  getTutorialStaticParams,
  type TutorialRecord,
} from "@/lib/tutorials/manifest";
import { createTutorialMetadata, TutorialStructuredData } from "@/lib/tutorials/seo";

export type TutorialParams = Promise<{ slug: string }>;

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
  return createTutorialMetadata(await getTutorialPageRecord(locale, params), locale);
}

export async function renderTutorialPage(locale: Locale, params: TutorialParams) {
  const record = await getTutorialPageRecord(locale, params);
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
