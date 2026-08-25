import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import {
  generatedRoot,
  normalizePath,
  siteOrigin,
  validateGeneratedSite,
} from "./lib/learningseo-subpages.mjs";

const manifest = JSON.parse(
  await fs.readFile(path.join(generatedRoot, "manifest.json"), "utf8"),
);
const contentRoot = path.join(generatedRoot, "content");
const stats = await validateGeneratedSite({ contentRoot, manifest });
const routePaths = new Set(
  manifest.routes.map((route) => normalizePath(route.sourcePath)),
);

const css = await fs.readFile(path.join(generatedRoot, "subpage.css"), "utf8");
assert.match(css, /^\/\* AUTO-GENERATED\. DO NOT EDIT\. \*\//);
assert.doesNotMatch(css, /@import|url\((["']?)https?:\/\//i);
assert.doesNotMatch(css, /#roadmap\s+\.roadmap-item/);

for (const match of css.matchAll(/url\((["']?)(\/[^)"']+)\1\)/g)) {
  const target = path.join("public", decodeURIComponent(match[2]));
  const file = await fs.stat(target);
  assert.ok(file.isFile(), "Missing CSS asset: " + match[2]);
}

const rootContent = JSON.parse(
  await fs.readFile(
    "src/components/sites/learningseo-io-071dae18/root-8a5edab2/content.json",
    "utf8",
  ),
);
const hrefs = [];
const walk = (value) => {
  if (Array.isArray(value)) {
    value.forEach(walk);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (key === "href" && typeof child === "string") hrefs.push(child);
    walk(child);
  }
};
walk(rootContent);

for (const href of hrefs) {
  const target = new URL(href, siteOrigin);
  if (target.origin !== siteOrigin || path.posix.extname(target.pathname)) {
    continue;
  }
  assert.ok(
    routePaths.has(normalizePath(target.pathname)),
    "Root content points to a missing route: " + href,
  );
}

console.log(
  "Validated " +
    stats.routes +
    " routes, " +
    stats.contentFiles +
    " content files, " +
    stats.internalLinks +
    " internal links, and " +
    stats.assets +
    " local assets.",
);
