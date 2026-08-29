import { createHash } from "node:crypto";

import type { Locale } from "@/lib/localization";
import {
  assertTutorialSlug,
  isTutorialSlug,
  normalizeSourceKey,
  tutorialPath,
} from "./url";

export const TUTORIAL_SCHEMA_VERSION = 1 as const;

export const TUTORIAL_STATUSES = ["draft", "review", "published", "stale"] as const;
export type TutorialStatus = (typeof TUTORIAL_STATUSES)[number];

export const TUTORIAL_ALLOWED_EMBED_HOSTS = [
  "embeds.beehiiv.com",
  "player.vimeo.com",
  "www.youtube.com",
  "www.youtube-nocookie.com",
  "youtube.com",
] as const;

export const TUTORIAL_SEMANTIC_TAGS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "ul",
  "ol",
  "li",
  "a",
  "table",
  "code",
  "pre",
  "blockquote",
  "img",
  "figure",
  "figcaption",
  "iframe",
] as const;
export type TutorialSemanticTag = (typeof TUTORIAL_SEMANTIC_TAGS)[number];
export type TutorialContentMetrics = Readonly<Partial<Record<TutorialSemanticTag, number>>>;

export type TutorialInlineNode = Readonly<
  | { type: "text"; text: string }
  | { type: "inline-code"; code: string }
  | { type: "link"; href: string; children: readonly TutorialInlineNode[] }
>;

export type TutorialContentBlock = Readonly<
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; id?: string; children: readonly TutorialInlineNode[] }
  | { type: "paragraph"; children: readonly TutorialInlineNode[] }
  | { type: "list"; ordered: boolean; items: readonly TutorialContentBlock[] }
  | { type: "table"; rows: readonly (readonly TutorialInlineNode[])[] }
  | { type: "code"; code: string; language?: string; block: boolean }
  | { type: "blockquote"; children: readonly TutorialContentBlock[]; cite?: string }
  | { type: "image"; src: string; alt: string; caption?: string }
  | { type: "embed"; src: string; title: string }
>;

export type TutorialContentDocument = readonly TutorialContentBlock[];

export const TUTORIAL_REVIEW_CHECKLIST_KEYS = [
  "contentComplete",
  "dataPreserved",
  "factsPreserved",
  "logicPreserved",
  "terminologyCorrect",
  "chineseNatural",
  "authorVoicePreserved",
  "linksPreserved",
  "mediaVerified",
  "attributionPresent",
  "seoVerified",
] as const;
export type TutorialReviewChecklistKey = (typeof TUTORIAL_REVIEW_CHECKLIST_KEYS)[number];
export type TutorialReviewChecklist = Readonly<
  Record<TutorialReviewChecklistKey, boolean>
>;

export const TUTORIAL_QUALIFICATION_CHECKLIST_KEYS = [
  "publiclyAccessible",
  "continuousBody",
  "topicComplete",
  "singlePage",
  "canonicalVerified",
] as const;
export type TutorialQualificationChecklistKey =
  (typeof TUTORIAL_QUALIFICATION_CHECKLIST_KEYS)[number];
export type TutorialQualificationChecklist = Readonly<
  Record<TutorialQualificationChecklistKey, boolean>
>;

export type Sha256 = string;
export type TutorialContentFile = `${string}.html`;

export type TutorialLicense = string | Readonly<{
  text: string;
  url?: string;
}>;

export type TutorialSource = Readonly<{
  title: string;
  provider: string;
  author: string | null;
  canonicalUrl: string;
  sourcePath: string;
  requestedUrl: string;
  finalUrl: string;
  contentType: string;
  license?: TutorialLicense;
}>;

export type TutorialMedia = Readonly<{
  path: string;
  sha256: Sha256;
  alt: string;
  sourceUrl?: string;
  width?: number;
  height?: number;
  id?: string;
}>;

export type TutorialTocEntry = Readonly<{
  id: string;
  title: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
}>;

export type TutorialSnapshotHistory = Readonly<{
  version: number;
  canonicalUrl: string;
  sourceContentHash: Sha256;
  contentHash: Sha256;
  translationContentHash?: Sha256;
  contentFile?: TutorialContentFile;
  translationContentFile?: TutorialContentFile;
  pageCanonicalUrl?: string;
  canonicalMatched?: boolean;
  requestedUrl?: string;
  finalUrl?: string;
  capturedAt?: string;
  sourceUpdatedAt?: string;
  recordedAt?: string;
  rollbackOf?: number;
  operationId?: string;
}>;

export type TutorialSnapshot = Readonly<{
  version: number;
  capturedAt: string;
  sourceUpdatedAt?: string;
  pageCanonicalUrl: string;
  canonicalMatched: boolean;
  requestedUrl: string;
  finalUrl: string;
  sourceContentHash: Sha256;
  contentHash: Sha256;
  translationContentHash?: Sha256;
  history: readonly TutorialSnapshotHistory[];
  rollbackOf?: number;
}>;

export type TutorialTranslation = Readonly<{
  sourceLanguage: "en";
  language: "zh-CN";
  translator: string | null;
  translatedAt: string | null;
  reviewedAt: string | null;
  sourceSections: number;
  translatedSections: number;
  contentHash?: Sha256;
  contentFile?: TutorialContentFile;
}>;

export type TutorialReviewDecision = "pending" | "approved" | "changes-requested";
export type TutorialReviewHistoryEntry = Readonly<{
  decision: TutorialReviewDecision;
  reviewer: string | null;
  reviewedAt: string | null;
  notes: string;
  version?: number;
  operationId?: string;
}>;
export type TutorialReview = Readonly<{
  decision: TutorialReviewDecision;
  reviewer: string | null;
  reviewedAt: string | null;
  notes: string;
  checklist: TutorialReviewChecklist;
  history: readonly TutorialReviewHistoryEntry[];
}>;

export type TutorialQualificationDecision = "pending" | "qualified" | "rejected";
export type TutorialQualification = Readonly<{
  decision: TutorialQualificationDecision;
  reviewer: string | null;
  reviewedAt: string | null;
  checklist: TutorialQualificationChecklist;
}>;

export type TutorialSeo = Readonly<{
  title: string;
  description: string;
  indexable: boolean;
  dateModified?: string;
}>;

export type TutorialSourceAlias = Readonly<{
  sourceKey: string;
  slug: string;
  sourceUrl?: string;
  createdAt?: string;
  reason?: string;
}>;

export type TutorialRecord = Readonly<{
  slug: string;
  path: string;
  title: string;
  description: string;
  provider: string;
  status: TutorialStatus;
  sourceKey: string;
  source: TutorialSource;
  snapshot: TutorialSnapshot;
  activeVersion: number;
  translation: TutorialTranslation;
  review: TutorialReview;
  qualification: TutorialQualification;
  contentFile: TutorialContentFile | null;
  toc: readonly TutorialTocEntry[];
  media: readonly TutorialMedia[];
  contentMetrics: TutorialContentMetrics;
  seo: TutorialSeo;
  redirectTo?: string | null;
}>;

export type TutorialResourceLinkReport = Readonly<Record<string, unknown>>;

export type TutorialManifest = Readonly<{
  schemaVersion: typeof TUTORIAL_SCHEMA_VERSION;
  locale: Locale;
  generation: string | null;
  activeVersion: number | null;
  available: boolean;
  routes: readonly TutorialRecord[];
  aliases: readonly TutorialSourceAlias[];
  resourceLinkReport?: TutorialResourceLinkReport;
}>;

export type TutorialManifestPair = Readonly<{
  zh: TutorialManifest;
  en: TutorialManifest;
  generation: string;
}>;

export type TutorialPublicationPair = Readonly<{
  zh: TutorialRecord;
  en: TutorialRecord;
  generation: string;
}>;

export type TutorialHtmlValidation = Readonly<{
  metrics: TutorialContentMetrics;
  headingIds: readonly string[];
}>;

export const TUTORIAL_MANIFEST_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://learningseo.io/schemas/tutorial-manifest.json",
  type: "object",
  required: ["schemaVersion", "locale", "generation", "activeVersion", "routes", "aliases"],
  properties: {
    schemaVersion: { const: TUTORIAL_SCHEMA_VERSION },
    locale: { enum: ["en", "zh-CN"] },
    generation: { type: ["string", "null"] },
    activeVersion: { type: ["integer", "null"], minimum: 1 },
    routes: { type: "array", items: { "$ref": "#/$defs/tutorialRecord" } },
    aliases: { type: "array", items: { "$ref": "#/$defs/sourceAlias" } },
  },
  $defs: {
    sourceAlias: {
      type: "object",
      required: ["sourceKey", "slug"],
      properties: {
        sourceKey: { type: "string", format: "uri" },
        slug: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
      },
      additionalProperties: false,
    },
    tutorialRecord: {
      type: "object",
      required: [
        "slug",
        "path",
        "title",
        "description",
        "provider",
        "status",
        "source",
        "snapshot",
        "activeVersion",
        "translation",
        "review",
        "qualification",
        "contentFile",
        "toc",
        "media",
        "contentMetrics",
        "seo",
      ],
      properties: {
        slug: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
        path: { type: "string" },
        title: { type: "string", minLength: 1 },
        description: { type: "string", minLength: 1 },
        provider: { type: "string", minLength: 1 },
        status: { enum: [...TUTORIAL_STATUSES] },
        sourceKey: { type: "string", format: "uri" },
        source: { "$ref": "#/$defs/source" },
        snapshot: { "$ref": "#/$defs/snapshot" },
        activeVersion: { type: "integer", minimum: 1 },
        translation: { "$ref": "#/$defs/translation" },
        review: { "$ref": "#/$defs/review" },
        qualification: { "$ref": "#/$defs/qualification" },
        contentFile: { type: ["string", "null"], pattern: "^[a-f0-9]{64}\\.html$" },
        toc: { type: "array" },
        media: { type: "array" },
        contentMetrics: { type: "object", additionalProperties: { type: "integer", minimum: 0 } },
        seo: { "$ref": "#/$defs/seo" },
        redirectTo: { type: ["string", "null"] },
      },
      additionalProperties: false,
    },
    source: {
      type: "object",
      required: ["title", "provider", "author", "canonicalUrl", "sourcePath", "requestedUrl", "finalUrl", "contentType"],
      properties: {
        title: { type: "string", minLength: 1 },
        provider: { type: "string", minLength: 1 },
        author: { type: ["string", "null"] },
        canonicalUrl: { type: "string", format: "uri", pattern: "^https://" },
        sourcePath: { type: "string", minLength: 1 },
        requestedUrl: { type: "string", format: "uri", pattern: "^https://" },
        finalUrl: { type: "string", format: "uri", pattern: "^https://" },
        contentType: { type: "string", pattern: "^text/html(?:;|$)" },
        license: { anyOf: [{ type: "string", minLength: 1 }, { type: "object" }] },
      },
      additionalProperties: false,
    },
    snapshot: {
      type: "object",
      required: ["version", "capturedAt", "pageCanonicalUrl", "canonicalMatched", "requestedUrl", "finalUrl", "sourceContentHash", "contentHash", "history"],
      properties: {
        version: { type: "integer", minimum: 1 },
        capturedAt: { type: "string", format: "date-time" },
        sourceUpdatedAt: { type: "string" },
        pageCanonicalUrl: { type: "string", format: "uri", pattern: "^https://" },
        canonicalMatched: { type: "boolean" },
        requestedUrl: { type: "string", format: "uri", pattern: "^https://" },
        finalUrl: { type: "string", format: "uri", pattern: "^https://" },
        sourceContentHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
        contentHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
        translationContentHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
        history: { type: "array" },
        rollbackOf: { type: "integer", minimum: 1 },
      },
      additionalProperties: false,
    },
    translation: {
      type: "object",
      required: ["sourceLanguage", "language", "translator", "translatedAt", "reviewedAt", "sourceSections", "translatedSections"],
      properties: {
        sourceLanguage: { const: "en" },
        language: { const: "zh-CN" },
        translator: { type: ["string", "null"] },
        translatedAt: { type: ["string", "null"] },
        reviewedAt: { type: ["string", "null"] },
        sourceSections: { type: "integer", minimum: 0 },
        translatedSections: { type: "integer", minimum: 0 },
        contentHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
        contentFile: { type: "string", pattern: "^[a-f0-9]{64}\\.html$" },
      },
      additionalProperties: false,
    },
    review: {
      type: "object",
      required: ["decision", "reviewer", "reviewedAt", "notes", "checklist", "history"],
      properties: {
        decision: { enum: ["pending", "approved", "changes-requested"] },
        reviewer: { type: ["string", "null"] },
        reviewedAt: { type: ["string", "null"] },
        notes: { type: "string", minLength: 1 },
        checklist: { type: "object" },
        history: { type: "array" },
      },
      additionalProperties: false,
    },
    qualification: {
      type: "object",
      required: ["decision", "reviewer", "reviewedAt", "checklist"],
      properties: {
        decision: { enum: ["pending", "qualified", "rejected"] },
        reviewer: { type: ["string", "null"] },
        reviewedAt: { type: ["string", "null"] },
        checklist: { type: "object" },
      },
      additionalProperties: false,
    },
    seo: {
      type: "object",
      required: ["title", "description", "indexable"],
      properties: {
        title: { type: "string", minLength: 1 },
        description: { type: "string", minLength: 1 },
        indexable: { type: "boolean" },
        dateModified: { type: "string", format: "date-time" },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const;

export const tutorialManifestSchema = TUTORIAL_MANIFEST_SCHEMA;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function nullableString(value: unknown, label: string): string | null {
  if (value === null || value === undefined) return null;
  return requiredString(value, label);
}

function chooseAliasedValue(
  object: JsonRecord,
  keys: readonly string[],
  label: string,
): unknown {
  const present = keys.filter((key) => object[key] !== undefined);
  if (present.length > 1) {
    const first = object[present[0]];
    if (present.some((key) => !sameJsonValue(first, object[key]))) {
      throw new Error(`${label} has conflicting aliases: ${present.join(", ")}`);
    }
  }
  return present.length ? object[present[0]] : undefined;
}

function sameJsonValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function parseHttpsUrl(value: unknown, label: string): string {
  const raw = requiredString(value, label);
  if (/[\u0000-\u0020\u007f]/.test(raw)) {
    throw new Error(`${label} must not contain control whitespace`);
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${label} must be an absolute HTTPS URL`);
  }
  if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) {
    throw new Error(`${label} must be an absolute HTTPS URL`);
  }
  try {
    normalizeSourceKey(raw);
  } catch {
    throw new Error(`${label} must be an absolute HTTPS URL`);
  }
  return raw;
}

function parseOptionalHttpsUrl(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  return parseHttpsUrl(value, label);
}

export function isSha256(value: unknown): value is Sha256 {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function requiredSha256(value: unknown, label: string): Sha256 {
  if (!isSha256(value)) throw new Error(`${label} must be a SHA-256 hex digest`);
  return value.toLowerCase();
}

function parseContentFile(value: unknown, label: string): TutorialContentFile | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !/^[a-f0-9]{64}\.html$/i.test(value)) {
    throw new Error(`${label} must be a content-addressed SHA-256 filename`);
  }
  return value.toLowerCase() as TutorialContentFile;
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return Number(value);
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return Number(value);
}

function optionalDate(value: unknown, label: string): string | null {
  const result = nullableString(value, label);
  if (result !== null && !Number.isFinite(Date.parse(result))) {
    throw new Error(`${label} must be a valid date`);
  }
  return result;
}

function dateString(value: unknown, label: string): string {
  const result = requiredString(value, label);
  if (!Number.isFinite(Date.parse(result))) throw new Error(`${label} must be a valid date`);
  return result;
}

function parseStatus(value: unknown, label: string): TutorialStatus {
  if (typeof value === "string" && TUTORIAL_STATUSES.includes(value as TutorialStatus)) {
    return value as TutorialStatus;
  }
  throw new Error(`${label} must be draft, review, published, or stale`);
}

function parseSource(value: unknown, label: string): TutorialSource {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  const canonicalUrl = parseHttpsUrl(value.canonicalUrl, `${label}.canonicalUrl`);
  const requestedUrl = parseHttpsUrl(
    chooseAliasedValue(value, ["requestedUrl", "requested"], `${label}.requestedUrl`) ?? canonicalUrl,
    `${label}.requestedUrl`,
  );
  const finalUrl = parseHttpsUrl(
    chooseAliasedValue(value, ["finalUrl", "final"], `${label}.finalUrl`) ?? canonicalUrl,
    `${label}.finalUrl`,
  );
  const contentType = requiredString(
    chooseAliasedValue(value, ["contentType", "responseContentType"], `${label}.contentType`) ??
      "text/html",
    `${label}.contentType`,
  ).toLowerCase();
  if (contentType !== "text/html" && !contentType.startsWith("text/html;")) {
    throw new Error(`${label}.contentType must be text/html`);
  }

  const license = value.license;
  let normalizedLicense: TutorialLicense | undefined;
  if (license !== undefined && license !== null) {
    if (typeof license === "string") {
      normalizedLicense = requiredString(license, `${label}.license`);
    } else if (isRecord(license)) {
      normalizedLicense = {
        text: requiredString(license.text, `${label}.license.text`),
        ...(license.url === undefined ? {} : { url: parseHttpsUrl(license.url, `${label}.license.url`) }),
      };
    } else {
      throw new Error(`${label}.license must be text or an object`);
    }
  }

  return {
    title: requiredString(value.title, `${label}.title`),
    provider: requiredString(value.provider, `${label}.provider`),
    author: nullableString(value.author, `${label}.author`),
    canonicalUrl,
    sourcePath: requiredString(value.sourcePath, `${label}.sourcePath`),
    requestedUrl,
    finalUrl,
    contentType,
    ...(normalizedLicense === undefined ? {} : { license: normalizedLicense }),
  };
}

function parseHistoryEntry(value: unknown, label: string, sourceCanonical: string): TutorialSnapshotHistory {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  const canonicalUrl = parseHttpsUrl(value.canonicalUrl ?? sourceCanonical, `${label}.canonicalUrl`);
  const contentFile = parseContentFile(value.contentFile, `${label}.contentFile`);
  const translationContentFile = parseContentFile(
    value.translationContentFile,
    `${label}.translationContentFile`,
  );
  const sourceContentHash = requiredSha256(value.sourceContentHash, `${label}.sourceContentHash`);
  const contentHash = requiredSha256(value.contentHash, `${label}.contentHash`);
  if (contentFile && !contentFile.startsWith(`${contentHash}.`)) {
    throw new Error(`${label}.contentFile must match contentHash`);
  }
  return {
    version: positiveInteger(value.version, `${label}.version`),
    canonicalUrl,
    sourceContentHash,
    contentHash,
    ...(value.translationContentHash === undefined
      ? {}
      : { translationContentHash: requiredSha256(value.translationContentHash, `${label}.translationContentHash`) }),
    ...(contentFile ? { contentFile } : {}),
    ...(translationContentFile ? { translationContentFile } : {}),
    ...(value.pageCanonicalUrl === undefined
      ? {}
      : { pageCanonicalUrl: parseHttpsUrl(value.pageCanonicalUrl, `${label}.pageCanonicalUrl`) }),
    ...(value.canonicalMatched === undefined
      ? {}
      : { canonicalMatched: value.canonicalMatched === true }),
    ...(value.requestedUrl === undefined
      ? {}
      : { requestedUrl: parseHttpsUrl(value.requestedUrl, `${label}.requestedUrl`) }),
    ...(value.finalUrl === undefined
      ? {}
      : { finalUrl: parseHttpsUrl(value.finalUrl, `${label}.finalUrl`) }),
    ...(value.capturedAt === undefined ? {} : { capturedAt: dateString(value.capturedAt, `${label}.capturedAt`) }),
    ...(value.sourceUpdatedAt === undefined
      ? {}
      : { sourceUpdatedAt: requiredString(value.sourceUpdatedAt, `${label}.sourceUpdatedAt`) }),
    ...(value.recordedAt === undefined ? {} : { recordedAt: dateString(value.recordedAt, `${label}.recordedAt`) }),
    ...(value.rollbackOf === undefined ? {} : { rollbackOf: positiveInteger(value.rollbackOf, `${label}.rollbackOf`) }),
    ...(value.operationId === undefined ? {} : { operationId: requiredString(value.operationId, `${label}.operationId`) }),
  };
}

function parseSnapshot(value: unknown, label: string, source: TutorialSource): TutorialSnapshot {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  const sourceContentHash = requiredSha256(value.sourceContentHash, `${label}.sourceContentHash`);
  const contentHash = requiredSha256(value.contentHash, `${label}.contentHash`);
  const historyValue = value.history;
  if (!Array.isArray(historyValue)) throw new Error(`${label}.history must be an array`);
  const history = historyValue.map((entry, index) =>
    parseHistoryEntry(entry, `${label}.history[${index}]`, source.canonicalUrl),
  );
  const translationContentHash = value.translationContentHash === undefined
    ? undefined
    : requiredSha256(value.translationContentHash, `${label}.translationContentHash`);
  if (typeof value.canonicalMatched !== "boolean") {
    throw new Error(`${label}.canonicalMatched must be boolean`);
  }
  const pageCanonicalUrl = parseHttpsUrl(
    value.pageCanonicalUrl ?? source.canonicalUrl,
    `${label}.pageCanonicalUrl`,
  );
  if (value.canonicalMatched && normalizeSourceKey(pageCanonicalUrl) !== normalizeSourceKey(source.canonicalUrl)) {
    throw new Error(`${label}.pageCanonicalUrl must match source.canonicalUrl when canonicalMatched`);
  }
  return {
    version: positiveInteger(value.version, `${label}.version`),
    capturedAt: dateString(value.capturedAt, `${label}.capturedAt`),
    ...(value.sourceUpdatedAt === undefined
      ? {}
      : { sourceUpdatedAt: requiredString(value.sourceUpdatedAt, `${label}.sourceUpdatedAt`) }),
    pageCanonicalUrl,
    canonicalMatched: value.canonicalMatched,
    requestedUrl: parseHttpsUrl(value.requestedUrl ?? source.requestedUrl, `${label}.requestedUrl`),
    finalUrl: parseHttpsUrl(value.finalUrl ?? source.finalUrl, `${label}.finalUrl`),
    sourceContentHash,
    contentHash,
    ...(translationContentHash === undefined ? {} : { translationContentHash }),
    history,
    ...(value.rollbackOf === undefined
      ? {}
      : { rollbackOf: positiveInteger(value.rollbackOf, `${label}.rollbackOf`) }),
  };
}

function parseChecklist<T extends readonly string[]>(
  value: unknown,
  keys: T,
  label: string,
): Readonly<Record<T[number], boolean>> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  const keySet = new Set<string>(keys);
  for (const key of keys) {
    if (typeof value[key] !== "boolean") throw new Error(`${label}.${key} must be boolean`);
  }
  for (const key of Object.keys(value)) {
    if (!keySet.has(key)) throw new Error(`${label} contains unsupported checklist key ${key}`);
  }
  return Object.fromEntries(keys.map((key) => [key, value[key] as boolean])) as Readonly<
    Record<T[number], boolean>
  >;
}

function parseTranslation(value: unknown, label: string): TutorialTranslation {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  const sourceSections = nonNegativeInteger(
    chooseAliasedValue(value, ["sourceSections", "sourceSectionCount"], `${label}.sourceSections`),
    `${label}.sourceSections`,
  );
  const translatedSections = nonNegativeInteger(
    chooseAliasedValue(value, ["translatedSections", "translatedSectionCount"], `${label}.translatedSections`),
    `${label}.translatedSections`,
  );
  const contentHash = value.contentHash === undefined
    ? undefined
    : requiredSha256(value.contentHash, `${label}.contentHash`);
  const contentFile = parseContentFile(value.contentFile, `${label}.contentFile`);
  if (contentFile && contentHash && !contentFile.startsWith(contentHash)) {
    throw new Error(`${label}.contentFile must match contentHash`);
  }
  if (value.sourceLanguage !== "en") throw new Error(`${label}.sourceLanguage must be en`);
  if (value.language !== "zh-CN") throw new Error(`${label}.language must be zh-CN`);
  return {
    sourceLanguage: "en",
    language: "zh-CN",
    translator: nullableString(value.translator, `${label}.translator`),
    translatedAt: optionalDate(value.translatedAt, `${label}.translatedAt`),
    reviewedAt: optionalDate(value.reviewedAt, `${label}.reviewedAt`),
    sourceSections,
    translatedSections,
    ...(contentHash === undefined ? {} : { contentHash }),
    ...(contentFile ? { contentFile } : {}),
  };
}

function parseReviewHistory(value: unknown, label: string): TutorialReviewHistoryEntry {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  const decision = value.decision;
  if (decision !== "pending" && decision !== "approved" && decision !== "changes-requested") {
    throw new Error(`${label}.decision is invalid`);
  }
  return {
    decision,
    reviewer: nullableString(value.reviewer, `${label}.reviewer`),
    reviewedAt: optionalDate(value.reviewedAt, `${label}.reviewedAt`),
    notes: requiredString(value.notes ?? "review history", `${label}.notes`),
    ...(value.version === undefined ? {} : { version: positiveInteger(value.version, `${label}.version`) }),
    ...(value.operationId === undefined ? {} : { operationId: requiredString(value.operationId, `${label}.operationId`) }),
  };
}

function parseReview(value: unknown, label: string): TutorialReview {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  const decision = value.decision;
  if (decision !== "pending" && decision !== "approved" && decision !== "changes-requested") {
    throw new Error(`${label}.decision is invalid`);
  }
  const history = value.history;
  if (!Array.isArray(history)) throw new Error(`${label}.history must be an array`);
  return {
    decision,
    reviewer: nullableString(value.reviewer, `${label}.reviewer`),
    reviewedAt: optionalDate(value.reviewedAt, `${label}.reviewedAt`),
    notes: requiredString(value.notes ?? "review pending", `${label}.notes`),
    checklist: parseChecklist(value.checklist, TUTORIAL_REVIEW_CHECKLIST_KEYS, `${label}.checklist`),
    history: history.map((entry, index) => parseReviewHistory(entry, `${label}.history[${index}]`)),
  };
}

function parseQualification(value: unknown, label: string): TutorialQualification {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  const rawDecision = value.decision;
  const decision = rawDecision === "approved" ? "qualified" : rawDecision;
  if (decision !== "pending" && decision !== "qualified" && decision !== "rejected") {
    throw new Error(`${label}.decision is invalid`);
  }
  return {
    decision,
    reviewer: nullableString(value.reviewer, `${label}.reviewer`),
    reviewedAt: optionalDate(value.reviewedAt, `${label}.reviewedAt`),
    checklist: parseChecklist(
      value.checklist,
      TUTORIAL_QUALIFICATION_CHECKLIST_KEYS,
      `${label}.checklist`,
    ),
  };
}

function parseSeo(value: unknown, label: string): TutorialSeo {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  const dateModified = value.dateModified === undefined
    ? undefined
    : dateString(value.dateModified, `${label}.dateModified`);
  return {
    title: requiredString(value.title, `${label}.title`),
    description: requiredString(value.description, `${label}.description`),
    indexable: value.indexable === true,
    ...(dateModified === undefined ? {} : { dateModified }),
  };
}

function parseMedia(value: unknown, label: string): TutorialMedia {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  const path = requiredString(
    chooseAliasedValue(value, ["path", "src"], `${label}.path`),
    `${label}.path`,
  );
  if (
    !path.startsWith("/") ||
    path.includes("\\") ||
    path.includes("..") ||
    (() => {
      try {
        return decodeURIComponent(path).includes("..");
      } catch {
        return true;
      }
    })() ||
    /^[a-z][a-z\d+.-]*:/i.test(path) ||
    path.includes("?") ||
    path.includes("#")
  ) {
    throw new Error(`${label}.path must be a repository-local media path`);
  }
  const sha256 = requiredSha256(
    chooseAliasedValue(value, ["sha256", "hash", "contentHash"], `${label}.sha256`),
    `${label}.sha256`,
  );
  const sourceUrl = parseOptionalHttpsUrl(value.sourceUrl, `${label}.sourceUrl`);
  const width = value.width === undefined ? undefined : positiveInteger(value.width, `${label}.width`);
  const height = value.height === undefined ? undefined : positiveInteger(value.height, `${label}.height`);
  return {
    path,
    sha256,
    alt: requiredString(value.alt, `${label}.alt`),
    ...(sourceUrl === undefined ? {} : { sourceUrl }),
    ...(width === undefined ? {} : { width }),
    ...(height === undefined ? {} : { height }),
    ...(value.id === undefined ? {} : { id: requiredString(value.id, `${label}.id`) }),
  };
}

function parseToc(value: unknown, label: string): readonly TutorialTocEntry[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`${label}[${index}] must be an object`);
    const level = positiveInteger(entry.level, `${label}[${index}].level`);
    if (level > 6) throw new Error(`${label}[${index}].level must be between 1 and 6`);
    return {
      id: requiredString(entry.id, `${label}[${index}].id`),
      title: requiredString(entry.title, `${label}[${index}].title`),
      level: level as TutorialTocEntry["level"],
    };
  });
}

function parseMetrics(value: unknown, label: string): TutorialContentMetrics {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  const allowed = new Set<string>(TUTORIAL_SEMANTIC_TAGS);
  const result: Record<string, number> = {};
  for (const [key, count] of Object.entries(value)) {
    if (!allowed.has(key)) throw new Error(`${label} contains unsupported semantic key ${key}`);
    result[key] = nonNegativeInteger(count, `${label}.${key}`);
  }
  return result as TutorialContentMetrics;
}

function parseRecord(value: unknown, locale: Locale, index: number): TutorialRecord {
  const label = `Tutorial route ${index}`;
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  const slug = assertTutorialSlug(requiredString(value.slug, `${label}.slug`));
  const expectedPath = tutorialPath(slug, locale);
  const routePath = requiredString(value.path, `${label}.path`);
  if (routePath !== expectedPath) throw new Error(`Tutorial route ${slug} path must be ${expectedPath}`);
  const status = parseStatus(value.status, `${label}.status`);
  const source = parseSource(value.source, `${label} ${slug}.source`);
  const sourceKey = normalizeSourceKey(source.canonicalUrl);
  if (
    value.sourceKey !== undefined &&
    normalizeSourceKey(parseHttpsUrl(value.sourceKey, `${label} ${slug}.sourceKey`)) !== sourceKey
  ) {
    throw new Error(`Tutorial route ${slug} sourceKey does not match source.canonicalUrl`);
  }
  const snapshot = parseSnapshot(value.snapshot, `${label} ${slug}.snapshot`, source);
  const activeVersion = positiveInteger(value.activeVersion, `${label} ${slug}.activeVersion`);
  const translation = parseTranslation(value.translation, `${label} ${slug}.translation`);
  const review = parseReview(value.review, `${label} ${slug}.review`);
  const qualificationValue = chooseAliasedValue(
    value,
    ["qualification", "eligibility"],
    `${label} ${slug}.qualification`,
  );
  const qualification = parseQualification(qualificationValue, `${label} ${slug}.qualification`);
  const contentHash = snapshot.contentHash;
  const contentFile = parseContentFile(value.contentFile, `${label} ${slug}.contentFile`);
  if (contentFile && !contentFile.startsWith(contentHash)) {
    throw new Error(`Tutorial route ${slug} contentFile must match snapshot.contentHash`);
  }
  if (status === "published" && activeVersion !== snapshot.version) {
    throw new Error(`Tutorial route ${slug} published activeVersion must match snapshot.version`);
  }
  const mediaValue = value.media;
  if (!Array.isArray(mediaValue)) throw new Error(`Tutorial route ${slug}.media must be an array`);
  const media = mediaValue.map((entry, mediaIndex) =>
    parseMedia(entry, `Tutorial route ${slug}.media[${mediaIndex}]`),
  );
  const seo = parseSeo(value.seo, `Tutorial route ${slug}.seo`);
  const redirectTo = value.redirectTo === undefined || value.redirectTo === null
    ? value.redirectTo ?? undefined
    : requiredString(value.redirectTo, `Tutorial route ${slug}.redirectTo`);
  if (status === "published") {
    if (!contentFile) throw new Error(`Tutorial route ${slug} published records require contentFile`);
    if (!snapshot.canonicalMatched) throw new Error(`Tutorial route ${slug} canonical match is unverified`);
    if (seo.indexable !== true) throw new Error(`Tutorial route ${slug} published records must be indexable`);
    if (review.decision !== "approved") throw new Error(`Tutorial route ${slug} published records require approved review`);
    if (qualification.decision !== "qualified") throw new Error(`Tutorial route ${slug} published records require qualification`);
    if (translation.sourceSections !== translation.translatedSections) {
      throw new Error(`Tutorial route ${slug} translation section count differs`);
    }
    if (!TUTORIAL_REVIEW_CHECKLIST_KEYS.every((key) => review.checklist[key])) {
      throw new Error(`Tutorial route ${slug} review checklist is incomplete`);
    }
    if (!TUTORIAL_QUALIFICATION_CHECKLIST_KEYS.every((key) => qualification.checklist[key])) {
      throw new Error(`Tutorial route ${slug} qualification checklist is incomplete`);
    }
  } else if (seo.indexable) {
    throw new Error(`Tutorial route ${slug} preview records must be noindex`);
  }
  return {
    slug,
    path: routePath,
    title: requiredString(value.title, `Tutorial route ${slug}.title`),
    description: requiredString(value.description, `Tutorial route ${slug}.description`),
    provider: requiredString(value.provider, `Tutorial route ${slug}.provider`),
    status,
    sourceKey,
    source,
    snapshot,
    activeVersion,
    translation,
    review,
    qualification,
    contentFile,
    toc: parseToc(value.toc, `Tutorial route ${slug}.toc`),
    media,
    contentMetrics: parseMetrics(value.contentMetrics, `Tutorial route ${slug}.contentMetrics`),
    seo,
    ...(redirectTo === undefined ? {} : { redirectTo }),
  };
}

function parseAlias(value: unknown, index: number): TutorialSourceAlias {
  const label = `Tutorial alias ${index}`;
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  const sourceKeyValue = chooseAliasedValue(value, ["sourceKey", "from"], `${label}.sourceKey`);
  const sourceKey = normalizeSourceKey(parseHttpsUrl(sourceKeyValue, `${label}.sourceKey`));
  const slug = assertTutorialSlug(requiredString(value.slug ?? value.to, `${label}.slug`));
  const sourceUrl = parseOptionalHttpsUrl(value.sourceUrl, `${label}.sourceUrl`);
  const createdAt = value.createdAt === undefined ? undefined : dateString(value.createdAt, `${label}.createdAt`);
  const reason = value.reason === undefined ? undefined : requiredString(value.reason, `${label}.reason`);
  return {
    sourceKey,
    slug,
    ...(sourceUrl === undefined ? {} : { sourceUrl }),
    ...(createdAt === undefined ? {} : { createdAt }),
    ...(reason === undefined ? {} : { reason }),
  };
}

function parseAliases(value: unknown, label: string): readonly TutorialSourceAlias[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.map((entry, index) => parseAlias(entry, index));
  if (!isRecord(value)) throw new Error(`${label} must be an array or source-key map`);
  return Object.entries(value).map(([sourceKey, target], index) =>
    parseAlias({ sourceKey, slug: target }, index),
  );
}

function parseRoutes(value: JsonRecord, filePath: string): unknown[] {
  const keys = ["routes", "records", "tutorials"] as const;
  const present = keys.filter((key) => value[key] !== undefined);
  if (!present.length) throw new Error(`Tutorial manifest ${filePath} must contain routes`);
  const first = value[present[0]];
  if (!Array.isArray(first)) throw new Error(`Tutorial manifest ${filePath} ${present[0]} must be an array`);
  for (const key of present.slice(1)) {
    if (!Array.isArray(value[key]) || !sameJsonValue(first, value[key])) {
      throw new Error(`Tutorial manifest ${filePath} has conflicting route aliases`);
    }
  }
  return first;
}

export function parseTutorialManifest(
  value: unknown,
  locale: Locale,
  filePath = "tutorial manifest",
): TutorialManifest {
  if (!isRecord(value)) throw new Error(`Tutorial manifest ${filePath} must be an object`);
  if (value.schemaVersion !== undefined && value.schemaVersion !== TUTORIAL_SCHEMA_VERSION) {
    throw new Error(`Tutorial manifest ${filePath} schemaVersion must be ${TUTORIAL_SCHEMA_VERSION}`);
  }
  if (value.locale !== undefined && value.locale !== locale) {
    throw new Error(`Tutorial manifest ${filePath} locale must be ${locale}`);
  }
  const generationValue = chooseAliasedValue(
    value,
    ["generation", "commitGeneration"],
    `Tutorial manifest ${filePath}.generation`,
  );
  const generation = generationValue === null || generationValue === undefined
    ? null
    : requiredString(generationValue, `Tutorial manifest ${filePath}.generation`);
  const activeVersionValue = value.activeVersion;
  const activeVersion = activeVersionValue === null || activeVersionValue === undefined
    ? null
    : positiveInteger(activeVersionValue, `Tutorial manifest ${filePath}.activeVersion`);
  const routes = parseRoutes(value, filePath).map((entry, index) => parseRecord(entry, locale, index));
  const slugs = new Set<string>();
  const sourceOwners = new Map<string, string>();
  for (const route of routes) {
    if (slugs.has(route.slug)) throw new Error(`Duplicate tutorial slug: ${route.slug}`);
    slugs.add(route.slug);
    const owner = sourceOwners.get(route.sourceKey);
    if (owner && owner !== route.slug) {
      throw new Error(`Tutorial source key ${route.sourceKey} is owned by both ${owner} and ${route.slug}`);
    }
    sourceOwners.set(route.sourceKey, route.slug);
  }
  const aliases = parseAliases(value.aliases, `Tutorial manifest ${filePath}.aliases`);
  const aliasOwners = new Set<string>();
  for (const alias of aliases) {
    if (aliasOwners.has(alias.sourceKey)) throw new Error(`Duplicate tutorial alias: ${alias.sourceKey}`);
    aliasOwners.add(alias.sourceKey);
    if (!slugs.has(alias.slug)) throw new Error(`Tutorial alias target is missing: ${alias.slug}`);
    if (sourceOwners.has(alias.sourceKey)) {
      throw new Error(`Tutorial alias source key is already owned: ${alias.sourceKey}`);
    }
  }
  const resourceLinkReport = isRecord(value.resourceLinkReport)
    ? value.resourceLinkReport
    : undefined;
  return {
    schemaVersion: TUTORIAL_SCHEMA_VERSION,
    locale,
    generation,
    activeVersion,
    available: true,
    routes,
    aliases,
    ...(resourceLinkReport === undefined ? {} : { resourceLinkReport }),
  };
}

export function validateTutorialRecord(value: unknown, locale: Locale, index = 0): TutorialRecord {
  return parseRecord(value, locale, index);
}

export function validateTutorialManifest(value: unknown, locale: Locale, filePath = "tutorial manifest") {
  return parseTutorialManifest(value, locale, filePath);
}

export function validateTutorialManifestPair(
  zhManifest: TutorialManifest,
  enManifest: TutorialManifest,
): TutorialManifestPair {
  if (zhManifest.locale !== "zh-CN") throw new Error("Chinese tutorial manifest locale must be zh-CN");
  if (enManifest.locale !== "en") throw new Error("English tutorial manifest locale must be en");
  if (!zhManifest.available || !enManifest.available) {
    throw new Error("Both tutorial locale manifests must be available");
  }
  if (!zhManifest.generation || zhManifest.generation !== enManifest.generation) {
    throw new Error("Tutorial locale manifests must share one generation");
  }
  if (zhManifest.activeVersion !== enManifest.activeVersion) {
    throw new Error("Tutorial locale manifests must share one activeVersion");
  }
  const englishBySlug = new Map(enManifest.routes.map((route) => [route.slug, route]));
  const chineseBySlug = new Map(zhManifest.routes.map((route) => [route.slug, route]));
  for (const [slug, zh] of chineseBySlug) {
    const en = englishBySlug.get(slug);
    if (!en) throw new Error(`English tutorial route is missing: ${slug}`);
    if (zh.path !== tutorialPath(slug, "zh-CN") || en.path !== tutorialPath(slug, "en")) {
      throw new Error(`Tutorial route path pairing failed: ${slug}`);
    }
    if (zh.status !== en.status) throw new Error(`Tutorial status pairing failed: ${slug}`);
    if (zh.snapshot.version !== en.snapshot.version) throw new Error(`Tutorial version pairing failed: ${slug}`);
    if (zh.activeVersion !== en.activeVersion) throw new Error(`Tutorial activeVersion pairing failed: ${slug}`);
    if (zh.sourceKey !== en.sourceKey) throw new Error(`Tutorial canonical pairing failed: ${slug}`);
    if (!sameJsonValue(zh.contentMetrics, en.contentMetrics)) {
      throw new Error(`Tutorial content metrics pairing failed: ${slug}`);
    }
  }
  for (const slug of englishBySlug.keys()) {
    if (!chineseBySlug.has(slug)) throw new Error(`Chinese tutorial route is missing: ${slug}`);
  }
  if (!sameJsonValue(zhManifest.aliases, enManifest.aliases)) {
    throw new Error("Tutorial source aliases must be paired");
  }
  return { zh: zhManifest, en: enManifest, generation: zhManifest.generation };
}

export function validateTutorialManifestPairOwnership(
  zhManifest: TutorialManifest,
  enManifest: TutorialManifest,
): void {
  const owners = new Map<string, string>();
  for (const route of [...zhManifest.routes, ...enManifest.routes]) {
    const owner = owners.get(route.sourceKey);
    if (owner && owner !== route.slug) {
      throw new Error(`Tutorial source key ${route.sourceKey} is owned by both ${owner} and ${route.slug}`);
    }
    owners.set(route.sourceKey, route.slug);
  }
}

function openingTags(html: string, tag: string): readonly string[] {
  return [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, "gi"))].map((match) => match[0]);
}

function attributeMap(source: string): Map<string, string> {
  return new Map(
    [...source.matchAll(/([:\w-]+)\s*=\s*(["'])([\s\S]*?)\2/g)].map((match) => [
      match[1].toLowerCase(),
      match[3],
    ]),
  );
}

function validateUrlAttribute(value: string, label: string, options: { local?: boolean } = {}): void {
  if (!value || /[\u0000-\u0020\u007f]/.test(value)) throw new Error(`${label} must be a safe URL`);
  if (/^(?:javascript|vbscript|data):/i.test(value)) throw new Error(`${label} uses a dangerous URL protocol`);
  if (options.local) {
    if (!value.startsWith("/") || value.startsWith("//") || value.includes("..")) {
      throw new Error(`${label} must be a repository-local path`);
    }
    return;
  }
  if (/^(?:https?:|mailto:|tel:|#|\/)/i.test(value)) return;
  throw new Error(`${label} must use an approved URL form`);
}

export function validateTutorialHtml(
  html: string,
  label = "tutorial content",
  options: Readonly<{ requireTags?: readonly string[]; requireSingleH1?: boolean }> = {},
): TutorialHtmlValidation {
  if (typeof html !== "string" || !html.trim()) throw new Error(`${label} HTML must not be empty`);
  const allowedTags = new Set([
    "a", "article", "blockquote", "br", "code", "cite", "div", "em", "figcaption", "figure",
    "h1", "h2", "h3", "h4", "h5", "h6", "iframe", "img", "li", "ol", "p", "pre", "q",
    "small", "span", "strong", "sub", "sup", "table", "tbody", "td", "tfoot", "th", "thead",
    "time", "tr", "ul",
  ]);
  const safeAttributes = new Set([
    "allow", "allowfullscreen", "alt", "aria-label", "aria-describedby", "cite", "class", "colspan",
    "datetime", "decoding", "frameborder", "height", "href", "id", "lang", "loading", "referrerpolicy",
    "rel", "rowspan", "scope", "src", "tabindex", "target", "title", "width",
  ]);
  const tags = [...html.matchAll(/<\/?([a-z][\w:-]*)\b[^>]*>/gi)].map((match) => match[1].toLowerCase());
  for (const tag of tags) {
    if (!allowedTags.has(tag)) throw new Error(`${label} contains unsupported <${tag}>`);
  }
  if (/<(?:script|style|object|embed|base|meta|link|form)\b/i.test(html)) {
    throw new Error(`${label} contains a dangerous tag`);
  }
  if (/\bon[a-z-]+\s*=|\bsrcdoc\s*=|\bstyle\s*=/i.test(html)) {
    throw new Error(`${label} contains an executable or inline-style attribute`);
  }
  for (const match of html.matchAll(/<([a-z][\w:-]*)\b([^>]*)>/gi)) {
    const tag = match[1].toLowerCase();
    const attrs = attributeMap(match[0]);
    for (const key of attrs.keys()) {
      if (!safeAttributes.has(key)) throw new Error(`${label} contains unsupported attribute ${key}`);
    }
    for (const [key, value] of attrs) {
      if (["href", "src", "cite"].includes(key)) validateUrlAttribute(value, `${label} ${tag}.${key}`);
    }
    if (tag === "img") {
      const src = attrs.get("src");
      if (!src) throw new Error(`${label} image src is missing`);
      validateUrlAttribute(src, `${label} image src`, { local: true });
      if (!attrs.get("alt")?.trim()) throw new Error(`${label} image alt is missing`);
    }
    if (tag === "iframe") {
      const src = attrs.get("src");
      const title = attrs.get("title");
      if (!src || !title?.trim()) throw new Error(`${label} iframe requires src and title`);
      let parsed: URL;
      try {
        parsed = new URL(src);
      } catch {
        throw new Error(`${label} iframe src must be an absolute HTTPS URL`);
      }
      if (parsed.protocol !== "https:" || !(TUTORIAL_ALLOWED_EMBED_HOSTS as readonly string[]).includes(parsed.hostname.toLowerCase())) {
        throw new Error(`${label} iframe host is outside the allowlist`);
      }
    }
  }
  const headingIds: string[] = [];
  let previousHeading = 0;
  for (const match of html.matchAll(/<h([1-6])\b([^>]*)>/gi)) {
    const level = Number(match[1]);
    if (level > previousHeading + 1) throw new Error(`${label} heading hierarchy jumps from h${previousHeading}`);
    previousHeading = level;
    const id = attributeMap(match[0]).get("id");
    if (id) headingIds.push(id);
  }
  const h1Count = openingTags(html, "h1").length;
  if ((options.requireSingleH1 ?? true) && h1Count !== 1) throw new Error(`${label} must contain one h1`);
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = attributeMap(match[0]);
    if (!attrs.get("href")) throw new Error(`${label} anchor is missing href`);
    const text = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const imageAlt = [...match[2].matchAll(/<img\b[^>]*\balt\s*=\s*(["'])(.*?)\1[^>]*>/gi)]
      .map((image) => image[2])
      .join(" ");
    if (!`${text} ${imageAlt}`.trim() && !attrs.get("aria-label")?.trim() && !attrs.get("title")?.trim()) {
      throw new Error(`${label} anchor accessible name is missing`);
    }
  }
  const metrics = Object.fromEntries(
    TUTORIAL_SEMANTIC_TAGS
      .map((tag): [string, number] => [tag, openingTags(html, tag).length])
      .filter(([, count]) => count > 0),
  ) as TutorialContentMetrics;
  for (const requiredTag of options.requireTags ?? []) {
    if (!tags.includes(requiredTag.toLowerCase())) throw new Error(`${label} is missing <${requiredTag}>`);
  }
  return { metrics, headingIds };
}

export function sha256(value: string | Uint8Array): Sha256 {
  return createHash("sha256").update(value).digest("hex");
}

export function validateContentHash(content: string | Uint8Array, expected: unknown, label = "content"):
  void {
  const hash = requiredSha256(expected, `${label} hash`);
  if (sha256(content) !== hash) throw new Error(`${label} hash does not match expected SHA-256`);
}

export function assertTutorialContentFile(value: unknown, label = "contentFile"): TutorialContentFile {
  const parsed = parseContentFile(value, label);
  if (!parsed) throw new Error(`${label} is required`);
  return parsed;
}

export function isTutorialRecord(value: unknown): value is TutorialRecord {
  try {
    validateTutorialRecord(value, "en");
    return true;
  } catch {
    return false;
  }
}

export { assertTutorialSlug, isTutorialSlug, normalizeSourceKey };
