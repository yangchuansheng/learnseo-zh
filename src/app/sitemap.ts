import type { MetadataRoute } from "next";

import manifest from "@/components/sites/learningseo-io-071dae18/subpages/generated/manifest.json";
import { localHref, SITE_ORIGIN } from "@/components/sites/learningseo-io-071dae18/shared/links";

function routePath(canonical: string): string {
  return new URL(canonical).pathname;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = manifest.routes.filter((route) => !route.redirectTo);
  return routes.map((route) => {
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
}
