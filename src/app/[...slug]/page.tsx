import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { SubpageDocument } from "@/components/sites/learningseo-io-071dae18/subpages/SubpageDocument";
import { localHref } from "@/components/sites/learningseo-io-071dae18/shared/links";
import subpageData from "@/components/sites/learningseo-io-071dae18/subpages/data.json";

type SubpageParams = Promise<{ slug: string[] }>;
type SubpageRoute = (typeof subpageData.routes)[number];

function normalizePath(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return path === "/" ? "/" : `${path.replace(/\/+$/, "")}/`;
}

function pathFromSlug(slug: string[]): string {
  return normalizePath(`/${slug.join("/")}`);
}

function findRoute(pathname: string): SubpageRoute | undefined {
  const normalizedPath = normalizePath(pathname);
  return subpageData.routes.find(
    (route) => normalizePath(route.sourcePath) === normalizedPath,
  );
}

function pathSegments(pathname: string): string[] {
  return normalizePath(pathname).split("/").filter(Boolean);
}

export function generateStaticParams(): Array<{ slug: string[] }> {
  return subpageData.routes
    .filter((route) => normalizePath(route.sourcePath) !== "/")
    .map((route) => ({ slug: pathSegments(route.sourcePath) }));
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
    redirect(route.redirectTo);
  }

  return (
    <SubpageDocument
      bodyClass={route.bodyClass}
      mainClass={route.mainClass || ""}
      html={route.html}
    />
  );
}
