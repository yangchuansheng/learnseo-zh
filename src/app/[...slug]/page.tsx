import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { SubpageDocument } from "@/components/sites/learningseo-io-071dae18/subpages/SubpageDocument";
import subpageManifest from "@/components/sites/learningseo-io-071dae18/subpages/generated/manifest.json";
import { localHref } from "@/components/sites/learningseo-io-071dae18/shared/links";

type SubpageParams = Promise<{ slug: string[] }>;
type SubpageRoute = {
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

const subpageRoutes: readonly SubpageRoute[] = subpageManifest.routes;
const contentRoot = path.join(
  process.cwd(),
  "src/components/sites/learningseo-io-071dae18/subpages/generated/content",
);

export const dynamicParams = false;

function normalizePath(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return path === "/" ? "/" : `${path.replace(/\/+$/, "")}/`;
}

function pathFromSlug(slug: string[]): string {
  return normalizePath(`/${slug.join("/")}`);
}

function findRoute(pathname: string): SubpageRoute | undefined {
  const normalizedPath = normalizePath(pathname);
  return subpageRoutes.find(
    (route) => normalizePath(route.sourcePath) === normalizedPath,
  );
}

function pathSegments(pathname: string): string[] {
  return normalizePath(pathname).split("/").filter(Boolean);
}

export function generateStaticParams(): Array<{ slug: string[] }> {
  return subpageRoutes
    .filter((route) => normalizePath(route.sourcePath) !== "/")
    .map((route) => ({ slug: pathSegments(route.sourcePath) }));
}

async function loadContent(contentFile: string | null): Promise<string> {
  if (!contentFile || !/^[a-f0-9]{64}\.html$/.test(contentFile)) {
    throw new Error(`Invalid generated content file: ${contentFile}`);
  }
  return readFile(path.join(contentRoot, contentFile), "utf8");
}

export async function generateMetadata({
  params,
}: {
  params: SubpageParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const route = findRoute(pathFromSlug(slug));

  if (!route) {
    notFound();
  }

  return {
    title: route.title,
    description: route.description,
    alternates: { canonical: localHref(route.canonical) },
  };
}

export default async function SubpagePage({
  params,
}: {
  params: SubpageParams;
}) {
  const { slug } = await params;
  const route = findRoute(pathFromSlug(slug));

  if (!route) {
    notFound();
  }

  if (route.redirectTo) {
    permanentRedirect(localHref(route.redirectTo));
  }

  const html = await loadContent(route.contentFile);

  return (
    <SubpageDocument
      bodyClass={route.bodyClass}
      hasRoadmap={route.hasRoadmap}
      mainClass={route.mainClass || ""}
      html={html}
      roadmapItemCurrent={route.roadmapItemCurrent}
      roadmapItemHref={route.roadmapItemHref}
      roadmapLinkHref={route.roadmapLinkHref}
    />
  );
}
