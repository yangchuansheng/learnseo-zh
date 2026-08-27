import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { getSiteContent } from "../root-8a5edab2/content";
import type { Locale } from "@/lib/localization";
import { SubpageDocument } from "./SubpageDocument";
import englishManifest from "./generated/manifest.json";
import chineseManifest from "./generated/manifest.zh-CN.json";
import { localHref, SITE_ORIGIN } from "../shared/links";

export type SubpageParams = Promise<{ slug: string[] }>;

export type SubpageRoute = {
  bodyClass: string;
  canonical: string;
  contentFile: string | null;
  description: string;
  finalPath: string;
  hasRoadmap: boolean;
  mainClass: string;
  redirectTo: string | null;
  roadmapItemCurrent: boolean;
  roadmapItemHref: string | null;
  roadmapLinkHref: string | null;
  sourcePath: string;
  title: string;
};

const manifests = {
  en: englishManifest,
  "zh-CN": chineseManifest,
} as const;

const contentRoots = {
  en: "content",
  "zh-CN": "content-zh-CN",
} as const;

function normalizePath(pathname: string): string {
  const pathWithLeadingSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return pathWithLeadingSlash === "/"
    ? "/"
    : `${pathWithLeadingSlash.replace(/\/+$/, "")}/`;
}

function pathFromSlug(slug: string[]): string {
  return normalizePath(`/${slug.join("/")}`);
}

function pathSegments(pathname: string): string[] {
  return normalizePath(pathname).split("/").filter(Boolean);
}

export function subpageRoutes(locale: Locale): readonly SubpageRoute[] {
  return manifests[locale].routes as readonly SubpageRoute[];
}

export function findSubpageRoute(locale: Locale, pathname: string): SubpageRoute | undefined {
  const normalizedPath = normalizePath(pathname);
  return subpageRoutes(locale).find(
    (route) => normalizePath(route.sourcePath) === normalizedPath,
  );
}

export function generateSubpageStaticParams(locale: Locale): Array<{ slug: string[] }> {
  return subpageRoutes(locale)
    .filter((route) => normalizePath(route.sourcePath) !== "/")
    .map((route) => ({ slug: pathSegments(route.sourcePath) }));
}

function absoluteLocalizedUrl(pathname: string, locale: Locale): string {
  return new URL(localHref(pathname, locale), SITE_ORIGIN).toString();
}

export async function generateSubpageMetadata(
  locale: Locale,
  params: SubpageParams,
): Promise<Metadata> {
  const { slug } = await params;
  const route = findSubpageRoute(locale, pathFromSlug(slug));
  if (!route) notFound();

  return {
    title: route.title,
    description: route.description,
    alternates: {
      canonical: absoluteLocalizedUrl(route.canonical, locale),
      languages: {
        "zh-CN": absoluteLocalizedUrl(route.canonical, "zh-CN"),
        en: absoluteLocalizedUrl(route.canonical, "en"),
      },
    },
  };
}

async function loadContent(locale: Locale, contentFile: string | null): Promise<string> {
  if (!contentFile || !/^[a-f0-9]{64}\.html$/.test(contentFile)) {
    throw new Error(`Invalid generated content file: ${contentFile}`);
  }
  const contentRoot = path.join(
    process.cwd(),
    "src/components/sites/learningseo-io-071dae18/subpages/generated",
    contentRoots[locale],
  );
  return readFile(path.join(contentRoot, contentFile), "utf8");
}

export async function renderSubpagePage(locale: Locale, params: SubpageParams) {
  const { slug } = await params;
  const route = findSubpageRoute(locale, pathFromSlug(slug));
  if (!route) notFound();

  if (route.redirectTo) {
    permanentRedirect(localHref(route.redirectTo, locale));
  }

  const html = await loadContent(locale, route.contentFile);
  return (
    <SubpageDocument
      bodyClass={route.bodyClass}
      content={getSiteContent(locale)}
      hasRoadmap={route.hasRoadmap}
      html={html}
      locale={locale}
      mainClass={route.mainClass || ""}
      roadmapItemCurrent={route.roadmapItemCurrent}
      roadmapItemHref={route.roadmapItemHref}
      roadmapLinkHref={route.roadmapLinkHref}
    />
  );
}
