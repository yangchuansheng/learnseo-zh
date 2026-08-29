import type { MetadataRoute } from "next";

import manifest from "@/components/sites/learningseo-io-071dae18/subpages/generated/manifest.json";
import { localHref, SITE_ORIGIN } from "@/components/sites/learningseo-io-071dae18/shared/links";
import { getPublishedTutorialPairs } from "@/lib/tutorials/manifest";
import { tutorialDateModified } from "@/lib/tutorials/seo";
import { tutorialUrl } from "@/lib/tutorials/url";

function routePath(canonical: string): string {
  return new URL(canonical).pathname;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = manifest.routes.filter((route) => !route.redirectTo);
  const legacyRoutes = routes.map((route) => {
    const pathname = routePath(route.canonical);
    return {
      url: new URL(localHref(pathname, "zh-CN"), SITE_ORIGIN).toString(),
      lastModified: manifest.generatedAt,
      alternates: {
        languages: {
          "zh-CN": new URL(localHref(pathname, "zh-CN"), SITE_ORIGIN).toString(),
          en: new URL(localHref(pathname, "en"), SITE_ORIGIN).toString(),
        },
      },
    };
  });

  const tutorialRoutes = (await getPublishedTutorialPairs()).map(({ zh }) => {
    const lastModified = tutorialDateModified(zh);
    return {
      url: tutorialUrl(zh.slug, "zh-CN"),
      ...(lastModified ? { lastModified } : {}),
      alternates: {
        languages: {
          "zh-CN": tutorialUrl(zh.slug, "zh-CN"),
          en: tutorialUrl(zh.slug, "en"),
        },
      },
    };
  });

  return [...legacyRoutes, ...tutorialRoutes];
}
