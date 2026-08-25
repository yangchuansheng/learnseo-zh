import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { FooterSection } from "@/components/sites/learningseo-io-071dae18/root-8a5edab2/FooterSection";
import { HeaderNavigation } from "@/components/sites/learningseo-io-071dae18/root-8a5edab2/HeaderNavigation";
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
    alternates: { canonical: route.canonical },
  };
}

function SubpageDocument({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
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

  const className = ["learningseo-subpage", route.bodyClass]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <HeaderNavigation />
      <div className="gradient-header" aria-hidden="true" />
      <main id="content" className={route.mainClass || undefined}>
        <SubpageDocument html={route.html} />
      </main>
      <FooterSection />
    </div>
  );
}
