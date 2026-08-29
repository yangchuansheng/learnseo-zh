import type { Metadata } from "next";

import { SITE_ORIGIN } from "@/components/sites/learningseo-io-071dae18/shared/links";
import type { Locale } from "@/lib/localization";
import { isTutorialRedirect, tutorialDateModified, type TutorialRecord } from "./manifest";
import { tutorialAlternates, tutorialUrl } from "./url";

export { tutorialDateModified } from "./manifest";

export const TUTORIAL_PUBLISHER = Object.freeze({
  "@type": "Organization" as const,
  name: "LearningSEO.io",
  url: SITE_ORIGIN,
});

type TutorialAuthor = Readonly<{
  "@type": "Person" | "Organization";
  name: string;
}>;

export type TutorialMetadataOptions = Readonly<{
  indexable?: boolean;
  includeAlternates?: boolean;
}>;

export type TutorialStructuredData = Readonly<{
  "@context": "https://schema.org";
  "@type": "TechArticle";
  headline: string;
  description: string;
  inLanguage: Locale;
  dateModified?: string;
  author: TutorialAuthor;
  publisher: typeof TUTORIAL_PUBLISHER;
  mainEntityOfPage: Readonly<{ "@type": "WebPage"; "@id": string }>;
  isBasedOn: string;
}>;

function firstText(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function sourceAuthor(record: TutorialRecord): { name: string; type: "Person" | "Organization" } {
  const author = firstText(record.source.author);
  if (author) return { name: author, type: "Person" };
  return {
    name: firstText(record.source.provider, record.provider) ?? "LearningSEO.io",
    type: "Organization",
  };
}

export function createTutorialMetadata(
  record: TutorialRecord,
  locale: Locale,
  options: TutorialMetadataOptions = {},
): Metadata {
  const url = tutorialUrl(record.slug, locale);
  const alternates = tutorialAlternates(record.slug);
  const title = firstText(record.seo?.title, record.title) ?? record.title;
  const description = firstText(record.seo?.description, record.description) ?? record.description;
  const author = sourceAuthor(record);
  const dateModified = tutorialDateModified(record);
  const indexable = options.indexable ?? record.status === "published";
  const includeAlternates = options.includeAlternates ?? true;

  if (isTutorialRedirect(record)) {
    return {
      metadataBase: new URL(SITE_ORIGIN),
      title,
      description,
      alternates: null,
      robots: {
        index: false,
        follow: false,
        googleBot: { index: false, follow: false },
      },
      openGraph: null,
    };
  }

  return {
    metadataBase: new URL(SITE_ORIGIN),
    title,
    description,
    alternates: {
      canonical: url,
      ...(includeAlternates ? { languages: alternates } : {}),
    },
    robots: {
      index: indexable,
      follow: indexable,
      googleBot: {
        index: indexable,
        follow: indexable,
      },
    },
    authors: [{ name: author.name }],
    publisher: TUTORIAL_PUBLISHER.name,
    openGraph: {
      type: "article",
      url,
      title,
      description,
      siteName: TUTORIAL_PUBLISHER.name,
      ...(dateModified ? { modifiedTime: dateModified } : {}),
      authors: [author.name],
    },
    other: {
      citation_title: record.source.title ?? record.title,
      citation_author: author.name,
      citation_publisher: record.source.provider ?? record.provider,
      citation_source: record.source.canonicalUrl,
      ...(dateModified ? { "article:modified_time": dateModified } : {}),
    },
  };
}

export function createTutorialStructuredData(
  record: TutorialRecord,
  locale: Locale,
): TutorialStructuredData {
  const author = sourceAuthor(record);
  const dateModified = tutorialDateModified(record);
  const url = tutorialUrl(record.slug, locale);
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: firstText(record.seo?.title, record.title) ?? record.title,
    description: firstText(record.seo?.description, record.description) ?? record.description,
    inLanguage: locale,
    ...(dateModified ? { dateModified } : {}),
    author: { "@type": author.type, name: author.name },
    publisher: TUTORIAL_PUBLISHER,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    isBasedOn: record.source.canonicalUrl,
  };
}

export function serializeTutorialStructuredData(data: TutorialStructuredData): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function TutorialStructuredData({
  record,
  locale,
}: Readonly<{ record: TutorialRecord; locale: Locale }>) {
  const data = createTutorialStructuredData(record, locale);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeTutorialStructuredData(data) }}
    />
  );
}
