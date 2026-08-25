import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const siteOrigin = "https://learningseo.io";
export const siteKey = "learningseo-io-071dae18";
export const generatedRoot = path.resolve(
  "src/components/sites",
  siteKey,
  "subpages/generated",
);

export const internalLinkRewrites = new Map([
  [
    "/seo_roadmap/seo-fundamentals/introduction-to-seo-learning-seo-1/",
    "/seo_roadmap/seo-fundamentals/",
  ],
]);

const generatedHeader = "<!-- AUTO-GENERATED. DO NOT EDIT. -->\n";

export function normalizePath(pathname) {
  const pathWithLeadingSlash = pathname.startsWith("/")
    ? pathname
    : `/${pathname}`;
  return pathWithLeadingSlash === "/"
    ? "/"
    : `${pathWithLeadingSlash.replace(/\/+$/, "")}/`;
}

export function contentDocument(html) {
  return `${generatedHeader}${html.trim()}\n`;
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function writeFileAtomic(target, value) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}-${crypto.randomUUID()}`;

  try {
    await fs.writeFile(temporary, value);
    await fs.rename(temporary, target);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
}

export async function replaceDirectoryAtomic(staged, target) {
  const backup = `${target}.backup-${crypto.randomUUID()}`;
  let hasPrevious = false;

  try {
    await fs.rename(target, backup);
    hasPrevious = true;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  try {
    await fs.rename(staged, target);
  } catch (error) {
    if (hasPrevious) await fs.rename(backup, target);
    throw error;
  }

  if (hasPrevious) await fs.rm(backup, { recursive: true, force: true });
}

export function validateRoutes(routes) {
  if (!Array.isArray(routes) || routes.length === 0) {
    throw new Error("Route input must contain a non-empty routes array.");
  }

  const sourcePaths = new Set();
  for (const route of routes) {
    if (route.error) {
      throw new Error(`${route.sourcePath || route.sourceUrl}: ${route.error}`);
    }
    if (!route.sourcePath || !route.title) {
      throw new Error("Every route needs sourcePath and title.");
    }

    const sourcePath = normalizePath(route.sourcePath);
    if (sourcePaths.has(sourcePath)) {
      throw new Error(`Duplicate route: ${sourcePath}`);
    }
    sourcePaths.add(sourcePath);

    const canonical = new URL(
      route.canonical || route.finalUrl || route.sourceUrl,
      siteOrigin,
    );
    if (canonical.origin !== siteOrigin) {
      throw new Error(`External canonical for ${sourcePath}: ${canonical.href}`);
    }
  }
}

export async function sanitizeRouteHtml(page, route, mediaEntries = []) {
  const result = await page.evaluate(
    ({ html, sourcePath, mediaEntries, linkRewrites, origin }) => {
      const allowedTags = new Set([
        "a",
        "article",
        "blockquote",
        "br",
        "button",
        "circle",
        "cite",
        "code",
        "div",
        "em",
        "figcaption",
        "figure",
        "g",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "header",
        "hr",
        "i",
        "iframe",
        "img",
        "li",
        "line",
        "noscript",
        "ol",
        "p",
        "path",
        "pre",
        "rect",
        "section",
        "small",
        "span",
        "strong",
        "sub",
        "sup",
        "svg",
        "table",
        "tbody",
        "td",
        "th",
        "thead",
        "time",
        "tr",
        "ul",
      ]);
      const dangerousTags = new Set([
        "base",
        "embed",
        "link",
        "meta",
        "object",
        "script",
        "style",
      ]);
      const globalAttributes = new Set([
        "class",
        "id",
        "role",
        "title",
      ]);
      const attributesByTag = new Map([
        ["a", new Set(["href", "rel", "target"])],
        ["button", new Set(["type"])],
        [
          "circle",
          new Set(["fill", "r", "stroke", "stroke-width", "transform"]),
        ],
        ["g", new Set(["transform"])],
        ["iframe", new Set([
          "allow",
          "allowfullscreen",
          "data-cookieblock-src",
          "data-src",
          "frameborder",
          "height",
          "referrerpolicy",
          "scrolling",
          "src",
          "width",
        ])],
        ["img", new Set([
          "alt",
          "decoding",
          "draggable",
          "fetchpriority",
          "height",
          "sizes",
          "src",
          "srcset",
          "data-src",
          "width",
        ])],
        [
          "line",
          new Set([
            "fill",
            "stroke",
            "stroke-width",
            "x1",
            "x2",
            "y1",
            "y2",
          ]),
        ],
        [
          "path",
          new Set(["d", "fill", "stroke", "stroke-dasharray", "stroke-width"]),
        ],
        [
          "rect",
          new Set([
            "fill",
            "height",
            "rx",
            "ry",
            "stroke",
            "stroke-width",
            "transform",
            "width",
          ]),
        ],
        [
          "svg",
          new Set([
            "fill",
            "height",
            "shape-rendering",
            "text-rendering",
            "viewbox",
            "width",
            "xmlns",
            "xmlns:xlink",
          ]),
        ],
        ["table", new Set(["border"])],
        ["td", new Set(["colspan", "rowspan"])],
        ["th", new Set(["colspan", "rowspan", "scope"])],
        ["time", new Set(["datetime"])],
      ]);
      const allowedStyleProperties = new Set([
        "background-color",
        "background-image",
        "border",
        "border-collapse",
        "border-radius",
        "box-sizing",
        "color",
        "font-family",
        "font-size",
        "font-weight",
        "height",
        "list-style-type",
        "margin",
        "text-align",
        "white-space-collapse",
        "width",
      ]);
      const iframeHosts = new Set([
        "embeds.beehiiv.com",
        "player.vimeo.com",
        "www.youtube.com",
        "www.youtube-nocookie.com",
        "youtube.com",
      ]);
      const mediaMap = new Map();
      for (const [remote, local] of mediaEntries) {
        mediaMap.set(remote, local);
        try {
          mediaMap.set(new URL(remote).pathname, local);
        } catch {}
      }
      const rewrites = new Map(linkRewrites);
      const errors = [];
      const warnings = new Set();
      const template = document.createElement("template");
      template.innerHTML = html || "";
      const root = template.content;

      const localizeKnownMedia = (value) => {
        if (mediaMap.has(value)) return mediaMap.get(value);
        try {
          const parsed = new URL(value, origin);
          return mediaMap.get(parsed.href) || mediaMap.get(parsed.pathname) || value;
        } catch {
          return value;
        }
      };

      const normalizeUrl = (rawValue, kind) => {
        const original = rawValue.trim();
        const schemeProbe = original.replace(/[\x00-\x20\x7f]/g, "");
        if (/^(?:javascript|vbscript|data:text\/html):/i.test(schemeProbe)) {
          errors.push(`Dangerous ${kind} URL: ${original}`);
          return "";
        }
        const normalizedWhitespace =
          kind === "href"
            ? original.replace(/[\x00-\x1f\x7f]/g, " ")
            : original;
        const mapped = localizeKnownMedia(normalizedWhitespace);
        if (!mapped) return "";
        if (/[\x00-\x1f\x7f]/.test(mapped)) {
          errors.push(`Control character in ${kind} URL: ${mapped}`);
          return "";
        }
        if (kind === "image" && /^https?:\/\/.*https?:\/\//i.test(mapped)) {
          warnings.add(`Removed malformed image URL: ${mapped}`);
          return "";
        }
        if (mapped.startsWith("#")) return mapped;
        if (mapped.startsWith("/")) {
          if (kind === "image" && !mapped.startsWith("/sites/")) {
            errors.push("Unlocalized " + kind + " URL: " + mapped);
            return "";
          }
          return kind === "href" ? rewrites.get(mapped) || mapped : mapped;
        }
        if (kind === "image" && /^data:image\/(?:avif|gif|jpeg|png|svg\+xml|webp);/i.test(mapped)) {
          return mapped;
        }

        let parsed;
        try {
          parsed = new URL(mapped, origin);
        } catch {
          errors.push(`Invalid ${kind} URL: ${mapped}`);
          return "";
        }

        if (parsed.origin === origin) {
          const local = `${parsed.pathname}${parsed.search}${parsed.hash}`;
          return kind === "href" ? rewrites.get(local) || local : local;
        }
        if (kind === "href" && ["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol)) {
          return parsed.href;
        }
        if (kind === "iframe" && parsed.protocol === "https:" && iframeHosts.has(parsed.hostname)) {
          return parsed.href;
        }

        errors.push(`External ${kind} URL is outside policy: ${mapped}`);
        return "";
      };

      const normalizeSrcset = (value) =>
        value
          .split(",")
          .map((candidate) => {
            const [url, ...descriptors] = candidate.trim().split(/\s+/);
            const normalized = normalizeUrl(url, "image");
            return [normalized, ...descriptors].filter(Boolean).join(" ");
          })
          .filter(Boolean)
          .join(", ");

      const sanitizeStyle = (element) => {
        const original = element.getAttribute("style") || "";
        const parsed = document.createElement("span");
        parsed.setAttribute("style", original);
        element.removeAttribute("style");

        for (const property of Array.from(parsed.style)) {
          if (!allowedStyleProperties.has(property)) continue;
          let value = parsed.style.getPropertyValue(property);
          if (property === "background-image") {
            let valid = true;
            value = value.replace(/url\((['"]?)(.*?)\1\)/gi, (_match, _quote, url) => {
              const normalized = normalizeUrl(url, "image");
              if (!normalized) valid = false;
              return `url("${normalized}")`;
            });
            if (!valid) continue;
          }
          element.style.setProperty(property, value);
        }
        if (!element.getAttribute("style")) element.removeAttribute("style");
      };

      const roadmap = root.querySelector("#roadmap");
      const activeItem = roadmap?.querySelector(".roadmap-item.active") || null;
      const activeItemHref = activeItem
        ?.querySelector(".roadmap-item-title h3 a")
        ?.getAttribute("href") || null;
      const activeLinkHref = roadmap?.querySelector("a.active")?.getAttribute("href") || null;
      const roadmapItemCurrent = Boolean(
        activeItem?.querySelector(".tag, h3.active"),
      );
      const hasRoadmap = Boolean(roadmap);
      roadmap?.remove();

      for (const element of Array.from(root.querySelectorAll("*"))) {
        const tag = element.localName.toLowerCase();
        if (dangerousTags.has(tag)) {
          errors.push(`Dangerous tag: <${tag}>`);
          element.remove();
          continue;
        }
        if (!allowedTags.has(tag)) {
          warnings.add(`Unwrapped unknown tag: <${tag}>`);
          element.replaceWith(...element.childNodes);
        }
      }

      for (const element of Array.from(root.querySelectorAll("*"))) {
        const tag = element.localName.toLowerCase();
        const tagAttributes = attributesByTag.get(tag) || new Set();
        for (const attribute of Array.from(element.attributes)) {
          const name = attribute.name.toLowerCase();
          if (name.startsWith("on") || name === "srcdoc") {
            errors.push(`Dangerous attribute ${name} on <${tag}>`);
            element.removeAttribute(attribute.name);
            continue;
          }
          if (name === "style") {
            sanitizeStyle(element);
            continue;
          }
          if (
            globalAttributes.has(name) ||
            tagAttributes.has(name) ||
            /^aria-[a-z-]+$/.test(name)
          ) {
            continue;
          }
          element.removeAttribute(attribute.name);
        }

        if (tag === "a" && element.hasAttribute("href")) {
          element.setAttribute(
            "href",
            normalizeUrl(element.getAttribute("href"), "href"),
          );
          if (element.getAttribute("target") === "_blank") {
            element.setAttribute("rel", "noopener noreferrer");
          }
        }
        if (tag === "img") {
          const lazySource = element.getAttribute("data-src");
          if (!element.getAttribute("src") && lazySource) {
            element.setAttribute("src", lazySource);
          }
          element.removeAttribute("data-src");
          if (element.hasAttribute("src")) {
            element.setAttribute(
              "src",
              normalizeUrl(element.getAttribute("src"), "image"),
            );
          }
          if (element.hasAttribute("srcset")) {
            const srcset = element.getAttribute("srcset");
            if (
              srcset.includes("/wp-content/") &&
              element.getAttribute("src")?.startsWith("/sites/")
            ) {
              warnings.add("Removed stale remote srcset");
              element.removeAttribute("srcset");
            } else {
              element.setAttribute("srcset", normalizeSrcset(srcset));
            }
          }
        }
        if (tag === "iframe") {
          for (const attribute of ["src", "data-src", "data-cookieblock-src"]) {
            if (element.hasAttribute(attribute)) {
              element.setAttribute(
                attribute,
                normalizeUrl(element.getAttribute(attribute), "iframe"),
              );
            }
          }
          const lazySource = element.getAttribute("data-src");
          if (lazySource && new URL(lazySource).hostname === "embeds.beehiiv.com") {
            element.setAttribute("src", lazySource);
            element.removeAttribute("data-src");
          }
          element.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
          if (!element.getAttribute("title")) {
            element.setAttribute("title", "Embedded content");
          }
        }
      }

      for (const anchor of root.querySelectorAll('a[href^="/wp-content/uploads/"]')) {
        const localImage = anchor.querySelector('img[src^="/sites/"]');
        if (localImage) {
          anchor.setAttribute("href", localImage.getAttribute("src"));
        } else {
          errors.push(`Unlocalized asset link: ${anchor.getAttribute("href")}`);
        }
      }

      const asButton = (element) => {
        if (element.localName === "button") {
          element.setAttribute("type", "button");
          return element;
        }
        const button = document.createElement("button");
        for (const attribute of Array.from(element.attributes)) {
          button.setAttribute(attribute.name, attribute.value);
        }
        button.setAttribute("type", "button");
        button.append(...element.childNodes);
        element.replaceWith(button);
        return button;
      };

      root.querySelectorAll(".accordion-title").forEach((element, index) => {
        const button = asButton(element);
        const answer = button.closest(".accordion-item")?.querySelector(".accordion-text");
        if (!answer) return;
        const answerId = answer.id || `subpage-faq-${index + 1}`;
        answer.id = answerId;
        button.dataset.subpageAction = "faq";
        button.setAttribute("aria-controls", answerId);
        button.setAttribute("aria-expanded", "false");
        answer.setAttribute("aria-hidden", "true");
      });

      root.querySelectorAll(".video .play").forEach((element) => {
        const button = asButton(element);
        const title = button.closest(".video")?.querySelector(".video-title")?.textContent?.trim();
        button.dataset.subpageAction = "video";
        button.setAttribute("aria-label", `Play ${title || "video"}`);
      });

      root.querySelectorAll(".tip-share-btn").forEach((element, index) => {
        const button = asButton(element);
        const popover = button.closest(".tip-share")?.querySelector(".tip-share-content");
        if (!popover) return;
        const popoverId = popover.id || `subpage-share-${index + 1}`;
        popover.id = popoverId;
        button.dataset.subpageAction = "share";
        button.setAttribute("aria-controls", popoverId);
        button.setAttribute("aria-expanded", "false");
        popover.setAttribute("aria-hidden", "true");
      });

      root.querySelectorAll(".resources-sidebar-toggle").forEach((element, index) => {
        const button = asButton(element);
        const sidebar = button.parentElement?.querySelector(".resources-sidebar");
        if (!sidebar) return;
        const sidebarId = sidebar.id || `subpage-resources-${index + 1}`;
        sidebar.id = sidebarId;
        button.dataset.subpageAction = "sidebar";
        button.setAttribute("aria-controls", sidebarId);
        button.setAttribute("aria-expanded", "false");
      });

      root.querySelectorAll("button.tip-linkedin").forEach((button) => {
        const tipId = button.closest(".tip")?.id;
        if (!tipId) return;
        const anchor = document.createElement("a");
        for (const attribute of Array.from(button.attributes)) {
          if (attribute.name !== "type") {
            anchor.setAttribute(attribute.name, attribute.value);
          }
        }
        const sharedUrl = `${origin}${sourcePath}#${tipId}`;
        anchor.href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(sharedUrl)}`;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.append(...button.childNodes);
        button.replaceWith(anchor);
      });

      return {
        activeItemHref: activeItemHref
          ? normalizeUrl(activeItemHref, "href")
          : null,
        activeLinkHref: activeLinkHref
          ? normalizeUrl(activeLinkHref, "href")
          : null,
        errors,
        hasRoadmap,
        html: template.innerHTML.trim(),
        roadmapItemCurrent,
        warnings: Array.from(warnings),
      };
    },
    {
      html: route.html || "",
      linkRewrites: Array.from(internalLinkRewrites),
      mediaEntries,
      origin: siteOrigin,
      sourcePath: normalizePath(route.sourcePath),
    },
  );

  if (result.errors.length) {
    throw new Error(
      `${route.sourcePath}:\n${result.errors.map((error) => `- ${error}`).join("\n")}`,
    );
  }

  return result;
}

export async function validateGeneratedSite({
  contentRoot,
  manifest,
  publicRoot = path.resolve("public"),
}) {
  const failures = [];
  const routePaths = new Set(
    manifest.routes.map((route) => normalizePath(route.sourcePath)),
  );
  const referencedContent = new Set();
  const checkedAssets = new Set();
  let internalLinks = 0;

  const fail = (message) => failures.push(message);
  const publicFile = async (pathname) => {
    let decoded;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      fail("Invalid encoded asset path: " + pathname);
      return;
    }
    const target = path.join(publicRoot, decoded.replace(/^\/+/, ""));
    if (!target.startsWith(publicRoot + path.sep)) {
      fail("Asset path escapes public root: " + pathname);
      return;
    }
    if (checkedAssets.has(target)) return;
    checkedAssets.add(target);
    try {
      const stat = await fs.stat(target);
      if (!stat.isFile()) fail("Local asset is not a file: " + pathname);
    } catch {
      fail("Missing local asset: " + pathname);
    }
  };

  const validateLocalTarget = async (rawValue, sourcePath, kind) => {
    const value = rawValue
      .replaceAll("&amp;", "&")
      .replaceAll("&quot;", '"')
      .trim()
      .replace(/^(["'])(.*)\1$/, "$2");
    if (!value || value.startsWith("#") || value.startsWith("data:image/")) {
      return;
    }

    let parsed;
    try {
      parsed = new URL(value, siteOrigin);
    } catch {
      fail(sourcePath + ": invalid " + kind + " URL " + value);
      return;
    }
    if (parsed.origin !== siteOrigin) return;

    if (path.posix.extname(parsed.pathname)) {
      await publicFile(parsed.pathname);
      return;
    }
    internalLinks += 1;
    const targetPath = normalizePath(parsed.pathname);
    if (!routePaths.has(targetPath)) {
      fail(
        sourcePath +
          ": missing internal " +
          kind +
          " target " +
          targetPath,
      );
    }
  };

  for (const route of manifest.routes) {
    const sourcePath = normalizePath(route.sourcePath);
    if (route.redirectTo && !routePaths.has(normalizePath(route.redirectTo))) {
      fail(sourcePath + ": missing redirect target " + route.redirectTo);
    }
    if (new URL(route.canonical, siteOrigin).origin !== siteOrigin) {
      fail(sourcePath + ": external canonical " + route.canonical);
    }
    if (!route.contentFile) continue;
    if (!/^[a-f0-9]{64}\.html$/.test(route.contentFile)) {
      fail(sourcePath + ": invalid content filename " + route.contentFile);
      continue;
    }

    referencedContent.add(route.contentFile);
    const document = await fs.readFile(
      path.join(contentRoot, route.contentFile),
      "utf8",
    );
    if (sha256(document) + ".html" !== route.contentFile) {
      fail(sourcePath + ": content hash mismatch " + route.contentFile);
    }

    const unsafePatterns = [
      [/<\s*(?:base|embed|link|meta|object|script|style)\b/i, "dangerous tag"],
      [/\s+on[a-z0-9_-]+\s*=/i, "event attribute"],
      [/\s+srcdoc\s*=/i, "srcdoc attribute"],
      [
        /\b(?:href|src)\s*=\s*["']\s*(?:javascript|vbscript|data:text\/html):/i,
        "dangerous URL protocol",
      ],
    ];
    for (const [pattern, label] of unsafePatterns) {
      if (pattern.test(document)) fail(sourcePath + ": " + label);
    }

    for (const match of document.matchAll(/\bhref="([^"]*)"/gi)) {
      await validateLocalTarget(match[1], sourcePath, "href");
    }
    for (const match of document.matchAll(/\bsrc="([^"]*)"/gi)) {
      await validateLocalTarget(match[1], sourcePath, "src");
    }
    for (const match of document.matchAll(/\bsrcset="([^"]*)"/gi)) {
      for (const candidate of match[1].split(",")) {
        await validateLocalTarget(
          candidate.trim().split(/\s+/)[0],
          sourcePath,
          "srcset",
        );
      }
    }
    for (const style of document.matchAll(/\bstyle="([^"]*)"/gi)) {
      for (const match of style[1].matchAll(/url\((["']?)(.*?)\1\)/g)) {
        await validateLocalTarget(match[2], sourcePath, "style asset");
      }
    }
  }

  const files = (await fs.readdir(contentRoot)).filter((file) =>
    file.endsWith(".html"),
  );
  for (const file of files) {
    if (!referencedContent.has(file)) fail("Orphan content file: " + file);
  }
  for (const file of referencedContent) {
    if (!files.includes(file)) fail("Missing content file: " + file);
  }

  if (failures.length) {
    throw new Error(
      "Generated site validation failed:\n" +
        failures.map((failure) => "- " + failure).join("\n"),
    );
  }

  return {
    assets: checkedAssets.size,
    contentFiles: referencedContent.size,
    internalLinks,
    routes: manifest.routes.length,
  };
}
