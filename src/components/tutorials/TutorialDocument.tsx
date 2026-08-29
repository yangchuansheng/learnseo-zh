import { FooterSection } from "@/components/sites/learningseo-io-071dae18/root-8a5edab2/FooterSection";
import { HeaderNavigation } from "@/components/sites/learningseo-io-071dae18/root-8a5edab2/HeaderNavigation";
import { getSiteContent } from "@/components/sites/learningseo-io-071dae18/root-8a5edab2/content";
import { localHref, localHtml } from "@/components/sites/learningseo-io-071dae18/shared/links";
import type { Locale } from "@/lib/localization";
import type { TutorialLicense, TutorialRecord } from "@/lib/tutorials/manifest";
import { TutorialStructuredData } from "@/lib/tutorials/seo";
import { tutorialPath } from "@/lib/tutorials/url";

export type TutorialDocumentProps = Readonly<{
  html: string;
  locale: Locale;
  record: TutorialRecord;
}>;

function licenseText(license: TutorialLicense | undefined): string | null {
  if (!license) return null;
  return typeof license === "string" ? license : license.text;
}

function licenseHref(license: TutorialLicense | undefined): string | null {
  return typeof license === "object" ? license.url ?? null : null;
}

function formatDate(value: string | undefined, locale: Locale): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return value;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(time));
}

function anchorHref(id: string): string {
  return `#${encodeURIComponent(id)}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasRenderedHeadingId(html: string, id: string): boolean {
  const idPattern = new RegExp(
    `\\bid\\s*=\\s*(?:"${escapeRegExp(id)}"|'${escapeRegExp(id)}'|${escapeRegExp(id)})(?=\\s|>|/)`,
    "i",
  );
  for (const match of html.matchAll(/<!--[\s\S]*?(?:-->|$)|<h[1-6]\b[^>]*>/gi)) {
    const tag = match[0];
    if (!tag.startsWith("<!--") && idPattern.test(tag)) return true;
  }
  return false;
}

export function TutorialDocument({ html, locale, record }: TutorialDocumentProps) {
  const content = getSiteContent(locale);
  const sourceAuthor = record.source.author ?? record.source.provider;
  const sourceUpdated = formatDate(record.snapshot.sourceUpdatedAt, locale);
  const capturedAt = formatDate(record.snapshot.capturedAt, locale);
  const oppositeLocale: Locale = locale === "en" ? "zh-CN" : "en";
  const languageLabel = oppositeLocale === "en" ? "English" : "简体中文";
  const license = licenseText(record.source.license);
  const licenseUrl = licenseHref(record.source.license);
  const tocTitleId = record.toc.find((entry) => entry.level === 1)?.id;
  const titleId = tocTitleId && !hasRenderedHeadingId(html, tocTitleId) ? tocTitleId : undefined;

  return (
    <>
      <TutorialStructuredData record={record} locale={locale} />
      <div data-learning-seo className="min-h-screen bg-[#f2f2f2] text-[#303030]">
        <div className="min-h-[220px] bg-[#e6d3ff]" aria-hidden="true" />
        <HeaderNavigation header={content.header} locale={locale} />
        <main id="content" className="mx-auto -mt-[120px] w-[calc(100%-40px)] max-w-[1224px] pb-16 md:-mt-[72px] md:w-[88%]">
          <article
            className="rounded-[4px] bg-white px-5 py-8 shadow-[0_8px_24px_rgba(0,0,54,0.06)] md:px-10 md:py-12 lg:px-14"
            data-tutorial-slug={record.slug}
            data-tutorial-status={record.status}
          >
            <header className="border-b border-[#ededed] pb-7">
              <div className="mb-4 flex flex-wrap items-center gap-3 text-[12.6px] font-bold uppercase tracking-[1.2px] text-[#845bc0]">
                <span>{record.provider}</span>
                <span aria-hidden="true">/</span>
                <span>{record.status}</span>
              </div>
              <h1
                className="max-w-[920px] text-[38px] leading-[40px] font-extrabold tracking-normal text-[#000036] md:text-[58px] md:leading-[60px]"
                id={titleId}
              >
                {record.title}
              </h1>
              <p className="mt-5 max-w-[760px] text-[18px] leading-[26px] text-[#606060] md:text-[22px] md:leading-[31px]">
                {record.description}
              </p>
              <nav
                aria-label={locale === "en" ? "Tutorial language" : "教程语言"}
                className="mt-6 flex flex-wrap gap-3 text-[14px] font-bold"
              >
                <a className="text-[#000036] underline decoration-[#a87be9] decoration-2 underline-offset-4" href={tutorialPath(record.slug, oppositeLocale)} lang={oppositeLocale}>
                  {languageLabel}
                </a>
                <a className="text-[#000036] underline decoration-[#a87be9] decoration-2 underline-offset-4" href={localHref(record.source.sourcePath, locale)}>
                  {locale === "en" ? "Source roadmap" : "来源路线"}
                </a>
              </nav>
            </header>

            <section
              aria-label={locale === "en" ? "Source attribution" : "来源署名"}
              className="mt-7 grid gap-3 rounded-[4px] border border-[#e4daf5] bg-[#faf7ff] p-4 text-[14px] leading-[20px] text-[#303030] md:grid-cols-2"
            >
              <p>
                <span className="font-bold text-[#000036]">{locale === "en" ? "Based on: " : "基于："}</span>
                <a className="underline" href={record.source.canonicalUrl} rel="noopener noreferrer">
                  {record.source.title}
                </a>
              </p>
              <p>
                <span className="font-bold text-[#000036]">{locale === "en" ? "Author: " : "作者："}</span>
                {sourceAuthor}
              </p>
              <p>
                <span className="font-bold text-[#000036]">{locale === "en" ? "Source path: " : "来源路径："}</span>
                <code>{record.source.sourcePath}</code>
              </p>
              <p>
                <span className="font-bold text-[#000036]">{locale === "en" ? "Updated: " : "更新："}</span>
                {sourceUpdated ?? capturedAt ?? record.snapshot.capturedAt}
              </p>
              {license ? (
                <p className="md:col-span-2">
                  <span className="font-bold text-[#000036]">{locale === "en" ? "License: " : "许可："}</span>
                  {licenseUrl ? <a className="underline" href={licenseUrl}>{license}</a> : license}
                </p>
              ) : null}
            </section>

            <div className="mt-10 grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)]">
              {record.toc.length > 0 ? (
                <aside className="lg:sticky lg:top-24 lg:self-start">
                  <details className="rounded-[4px] border border-[#ededed] bg-white p-4 lg:hidden">
                    <summary className="cursor-pointer text-[15px] font-bold text-[#000036]">
                      {locale === "en" ? "Contents" : "目录"}
                    </summary>
                    <TutorialToc locale={locale} record={record} />
                  </details>
                  <div className="hidden lg:block">
                    <h2 className="mb-3 text-[16px] font-bold text-[#000036]">
                      {locale === "en" ? "Contents" : "目录"}
                    </h2>
                    <TutorialToc locale={locale} record={record} />
                  </div>
                </aside>
              ) : null}

              <section
                className="tutorial-body min-w-0 text-[17px] leading-[28px] text-[#303030] md:text-[18px] md:leading-[30px] [&_.tutorial-table-wrapper]:my-8 [&_.tutorial-table-wrapper]:w-full [&_.tutorial-table-wrapper]:overflow-x-auto [&_.tutorial-table-wrapper]:rounded-[4px] [&_.tutorial-table-wrapper]:border [&_.tutorial-table-wrapper]:border-[#ededed] [&_a]:font-bold [&_a]:text-[#000036] [&_a]:underline [&_blockquote]:my-6 [&_blockquote]:border-l-4 [&_blockquote]:border-[#a87be9] [&_blockquote]:bg-[#faf7ff] [&_blockquote]:py-3 [&_blockquote]:pr-4 [&_blockquote]:pl-5 [&_code]:rounded-[3px] [&_code]:bg-[#f2f2f2] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_figcaption]:mt-2 [&_figcaption]:text-[14px] [&_figcaption]:leading-[20px] [&_figcaption]:text-[#606060] [&_figure]:my-8 [&_h1]:sr-only [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:text-[28px] [&_h2]:leading-[32px] [&_h2]:font-extrabold [&_h2]:text-[#000036] [&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:text-[22px] [&_h3]:leading-[27px] [&_h3]:font-bold [&_h3]:text-[#000036] [&_h4]:mt-6 [&_h4]:mb-2 [&_h4]:text-[19px] [&_h4]:font-bold [&_h4]:text-[#000036] [&_h5]:mt-5 [&_h5]:mb-2 [&_h5]:text-[17px] [&_h5]:font-bold [&_h5]:text-[#000036] [&_h6]:mt-5 [&_h6]:mb-2 [&_h6]:text-[15px] [&_h6]:font-bold [&_h6]:uppercase [&_h6]:text-[#000036] [&_iframe]:aspect-video [&_iframe]:w-full [&_iframe]:rounded-[4px] [&_iframe]:border-0 [&_img]:h-auto [&_img]:max-w-full [&_li]:my-2 [&_ol]:my-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-5 [&_pre]:my-6 [&_pre]:overflow-x-auto [&_pre]:rounded-[4px] [&_pre]:bg-[#000036] [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[#f2f2f2] [&_table]:min-w-[640px] [&_table]:border-collapse [&_table]:text-left [&_td]:border [&_td]:border-[#dedede] [&_td]:p-3 [&_th]:border [&_th]:border-[#dedede] [&_th]:bg-[#f7f2ff] [&_th]:p-3 [&_ul]:my-5 [&_ul]:list-disc [&_ul]:pl-6"
                // Tutorial HTML is content-addressed and validated by the model/import boundary before this server render boundary.
                dangerouslySetInnerHTML={{ __html: localHtml(html, locale) }}
              />
            </div>
          </article>
        </main>
      </div>
      <div data-learning-seo>
        <FooterSection content={content} locale={locale} />
      </div>
    </>
  );
}

function TutorialToc({ locale, record }: Readonly<{ locale: Locale; record: TutorialRecord }>) {
  return (
    <nav aria-label={locale === "en" ? "Tutorial table of contents" : "教程目录"}>
      <ol className="space-y-2 text-[14px] leading-[18px]">
        {record.toc.map((entry) => (
          <li className={entry.level > 2 ? "pl-4" : undefined} key={entry.id}>
            <a className="text-[#303030] hover:text-[#845bc0]" href={anchorHref(entry.id)}>
              {entry.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
