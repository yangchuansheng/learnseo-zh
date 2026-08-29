import { createHash } from "node:crypto";

import type { Locale } from "@/lib/localization";
import {
  assertTutorialSlug,
  isTutorialSlug,
  normalizeSourceKey,
  safeTutorialRedirect,
  tutorialSlugFromPath,
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

const TUTORIAL_MEDIA_PATH_PREFIX = "/sites/learningseo-io-071dae18/tutorials/";
const REPOSITORY_LOCAL_PATH_PATTERN =
  "^/(?!/)(?!.*[\\u0000-\\u001f\\u007f\\\\?#])(?!.*/(?:\\.|\\.\\.)(?:/|$))(?!.*%(?:0[0-9a-fA-F]|2[eEfF]))(?!.*//).+$";
const REPOSITORY_LOCAL_PATH_REGEX = new RegExp(REPOSITORY_LOCAL_PATH_PATTERN);

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

export type TutorialHeadingEntry = Readonly<{
  id: string;
  level: TutorialTocEntry["level"];
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

export type TutorialRefreshCandidate = Readonly<{
  status: "draft" | "review" | "stale";
  version: number;
  operationId: string;
  createdAt: string;
  title: string;
  description: string;
  sourceContentHash: Sha256;
  contentHash: Sha256;
  translationContentHash: Sha256;
  contentFile: TutorialContentFile;
  translationContentFile: TutorialContentFile;
  toc: readonly TutorialTocEntry[];
  media: readonly TutorialMedia[];
  contentMetrics: TutorialContentMetrics;
  seo: TutorialSeo;
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
  refreshCandidate?: TutorialRefreshCandidate;
}>;

export type TutorialResourceLinkReport = Readonly<{
  total: number;
  unique: number;
  converted: number;
  fallback: number;
  rendered: number;
  duplicateOccurrences: number;
  unknownFragments: number;
  occurrences: readonly TutorialResourceLinkOccurrence[];
}>;

export type TutorialResourceLinkOccurrence = Readonly<{
  sourceKey: string;
  slug: string | null;
  fragment: string | null;
  converted: boolean;
}>;

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
  headingEntries: readonly TutorialHeadingEntry[];
}>;

export function isTutorialBootstrapManifest(
  manifest: Pick<TutorialManifest, "generation" | "routes" | "aliases">,
): boolean {
  return manifest.generation === "tutorial-generation-0" &&
    manifest.routes.length === 0 &&
    manifest.aliases.length === 0;
}

const ISO_DATE_TIME_PATTERN = "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$";
const isoDateTimeSchema = {
  type: "string",
  format: "date-time",
  pattern: ISO_DATE_TIME_PATTERN,
} as const;

export const TUTORIAL_MANIFEST_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://learningseo.io/schemas/tutorial-manifest.json",
  type: "object",
  required: ["schemaVersion", "locale", "generation", "activeVersion", "routes", "aliases"],
  properties: {
    $schema: { const: "https://learningseo.io/schemas/tutorial-manifest.json" },
    schemaVersion: { const: TUTORIAL_SCHEMA_VERSION },
    locale: { enum: ["en", "zh-CN"] },
    generation: { type: ["string", "null"] },
    activeVersion: { type: ["integer", "null"], minimum: 1 },
    routes: { type: "array", items: { "$ref": "#/$defs/tutorialRecord" } },
    aliases: { type: "array", items: { "$ref": "#/$defs/sourceAlias" } },
    resourceLinkReport: { "$ref": "#/$defs/resourceLinkReport" },
  },
  $defs: {
    sourceAlias: {
      type: "object",
      required: ["sourceKey", "slug"],
      properties: {
        sourceKey: { type: "string", format: "uri", pattern: "^https://" },
        slug: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
        sourceUrl: { type: "string", format: "uri", pattern: "^https://" },
        createdAt: isoDateTimeSchema,
        reason: { type: "string", minLength: 1 },
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
        "sourceKey",
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
        sourceKey: { type: "string", format: "uri", pattern: "^https://" },
        source: { "$ref": "#/$defs/source" },
        snapshot: { "$ref": "#/$defs/snapshot" },
        activeVersion: { type: "integer", minimum: 1 },
        translation: { "$ref": "#/$defs/translation" },
        review: { "$ref": "#/$defs/review" },
        qualification: { "$ref": "#/$defs/qualification" },
        contentFile: { type: ["string", "null"], pattern: "^[a-f0-9]{64}\\.html$" },
        toc: { type: "array", items: { "$ref": "#/$defs/tocEntry" } },
        media: { type: "array", items: { "$ref": "#/$defs/media" } },
        contentMetrics: {
          type: "object",
          properties: Object.fromEntries(
            TUTORIAL_SEMANTIC_TAGS.map((key) => [key, { type: "integer", minimum: 0 }]),
          ),
          additionalProperties: false,
        },
        seo: { "$ref": "#/$defs/seo" },
        redirectTo: { type: ["string", "null"] },
        refreshCandidate: { "$ref": "#/$defs/refreshCandidate" },
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
        sourcePath: {
          type: "string",
          pattern: REPOSITORY_LOCAL_PATH_PATTERN,
        },
        requestedUrl: { type: "string", format: "uri", pattern: "^https://" },
        finalUrl: { type: "string", format: "uri", pattern: "^https://" },
        contentType: { type: "string", pattern: "^text/html(?:;|$)" },
        license: {
          anyOf: [
            { type: "string", minLength: 1 },
            {
              type: "object",
              required: ["text"],
              properties: {
                text: { type: "string", minLength: 1 },
                url: { type: "string", format: "uri", pattern: "^https://" },
              },
              additionalProperties: false,
            },
          ],
        },
      },
      additionalProperties: false,
    },
    snapshot: {
      type: "object",
      required: ["version", "capturedAt", "pageCanonicalUrl", "canonicalMatched", "requestedUrl", "finalUrl", "sourceContentHash", "contentHash", "history"],
      properties: {
        version: { type: "integer", minimum: 1 },
        capturedAt: isoDateTimeSchema,
        sourceUpdatedAt: isoDateTimeSchema,
        pageCanonicalUrl: { type: "string", format: "uri", pattern: "^https://" },
        canonicalMatched: { type: "boolean" },
        requestedUrl: { type: "string", format: "uri", pattern: "^https://" },
        finalUrl: { type: "string", format: "uri", pattern: "^https://" },
        sourceContentHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
        contentHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
        translationContentHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
        history: { type: "array", items: { "$ref": "#/$defs/snapshotHistory" } },
        rollbackOf: { type: "integer", minimum: 1 },
      },
      additionalProperties: false,
    },
    snapshotHistory: {
      type: "object",
      required: ["version", "canonicalUrl", "sourceContentHash", "contentHash"],
      properties: {
        version: { type: "integer", minimum: 1 },
        canonicalUrl: { type: "string", format: "uri", pattern: "^https://" },
        sourceContentHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
        contentHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
        translationContentHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
        contentFile: { type: "string", pattern: "^[a-f0-9]{64}\\.html$" },
        translationContentFile: { type: "string", pattern: "^[a-f0-9]{64}\\.html$" },
        pageCanonicalUrl: { type: "string", format: "uri", pattern: "^https://" },
        canonicalMatched: { type: "boolean" },
        requestedUrl: { type: "string", format: "uri", pattern: "^https://" },
        finalUrl: { type: "string", format: "uri", pattern: "^https://" },
        capturedAt: isoDateTimeSchema,
        sourceUpdatedAt: isoDateTimeSchema,
        recordedAt: isoDateTimeSchema,
        rollbackOf: { type: "integer", minimum: 1 },
        operationId: { type: "string", minLength: 1 },
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
        translatedAt: { ...isoDateTimeSchema, type: ["string", "null"] },
        reviewedAt: { ...isoDateTimeSchema, type: ["string", "null"] },
        sourceSections: { type: "integer", minimum: 0 },
        translatedSections: { type: "integer", minimum: 0 },
        contentHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
        contentFile: { type: "string", pattern: "^[a-f0-9]{64}\\.html$" },
      },
      additionalProperties: false,
    },
    refreshCandidate: {
      type: "object",
      required: [
        "status",
        "version",
        "operationId",
        "createdAt",
        "title",
        "description",
        "sourceContentHash",
        "contentHash",
        "translationContentHash",
        "contentFile",
        "translationContentFile",
        "toc",
        "media",
        "contentMetrics",
        "seo",
      ],
      properties: {
        status: { enum: ["draft", "review", "stale"] },
        version: { type: "integer", minimum: 1 },
        operationId: { type: "string", minLength: 1 },
        createdAt: isoDateTimeSchema,
        title: { type: "string", minLength: 1 },
        description: { type: "string", minLength: 1 },
        sourceContentHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
        contentHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
        translationContentHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
        contentFile: { type: "string", pattern: "^[a-f0-9]{64}\\.html$" },
        translationContentFile: { type: "string", pattern: "^[a-f0-9]{64}\\.html$" },
        toc: { type: "array", items: { "$ref": "#/$defs/tocEntry" } },
        media: { type: "array", items: { "$ref": "#/$defs/media" } },
        contentMetrics: {
          type: "object",
          properties: Object.fromEntries(
            TUTORIAL_SEMANTIC_TAGS.map((key) => [key, { type: "integer", minimum: 0 }]),
          ),
          additionalProperties: false,
        },
        seo: { "$ref": "#/$defs/seo" },
      },
      additionalProperties: false,
    },
    review: {
      type: "object",
      required: ["decision", "reviewer", "reviewedAt", "notes", "checklist", "history"],
      properties: {
        decision: { enum: ["pending", "approved", "changes-requested"] },
        reviewer: { type: ["string", "null"] },
        reviewedAt: { ...isoDateTimeSchema, type: ["string", "null"] },
        notes: { type: "string", minLength: 1 },
        checklist: { "$ref": "#/$defs/reviewChecklist" },
        history: { type: "array", items: { "$ref": "#/$defs/reviewHistory" } },
      },
      additionalProperties: false,
    },
    reviewHistory: {
      type: "object",
      required: ["decision", "reviewer", "reviewedAt", "notes"],
      properties: {
        decision: { enum: ["pending", "approved", "changes-requested"] },
        reviewer: { type: ["string", "null"] },
        reviewedAt: { ...isoDateTimeSchema, type: ["string", "null"] },
        notes: { type: "string", minLength: 1 },
        version: { type: "integer", minimum: 1 },
        operationId: { type: "string", minLength: 1 },
      },
      additionalProperties: false,
    },
    reviewChecklist: {
      type: "object",
      required: [...TUTORIAL_REVIEW_CHECKLIST_KEYS],
      properties: Object.fromEntries(
        TUTORIAL_REVIEW_CHECKLIST_KEYS.map((key) => [key, { type: "boolean" }]),
      ),
      additionalProperties: false,
    },
    qualification: {
      type: "object",
      required: ["decision", "reviewer", "reviewedAt", "checklist"],
      properties: {
        decision: { enum: ["pending", "qualified", "rejected"] },
        reviewer: { type: ["string", "null"] },
        reviewedAt: { ...isoDateTimeSchema, type: ["string", "null"] },
        checklist: { "$ref": "#/$defs/qualificationChecklist" },
      },
      additionalProperties: false,
    },
    qualificationChecklist: {
      type: "object",
      required: [...TUTORIAL_QUALIFICATION_CHECKLIST_KEYS],
      properties: Object.fromEntries(
        TUTORIAL_QUALIFICATION_CHECKLIST_KEYS.map((key) => [key, { type: "boolean" }]),
      ),
      additionalProperties: false,
    },
    tocEntry: {
      type: "object",
      required: ["id", "title", "level"],
      properties: {
        id: { type: "string", minLength: 1 },
        title: { type: "string", minLength: 1 },
        level: { type: "integer", minimum: 1, maximum: 6 },
      },
      additionalProperties: false,
    },
    media: {
      type: "object",
      required: ["path", "sha256", "alt"],
      properties: {
        path: {
          type: "string",
          pattern: "^/sites/learningseo-io-071dae18/tutorials/(?!.*//)(?!.*(?:^|/)\\.\\.?(?:/|$))[^?#\\\\]+$",
        },
        sha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
        alt: { type: "string", minLength: 1 },
        sourceUrl: { type: "string", format: "uri", pattern: "^https://" },
        width: { type: "integer", minimum: 1 },
        height: { type: "integer", minimum: 1 },
        id: { type: "string", minLength: 1 },
      },
      additionalProperties: false,
    },
    resourceLinkReport: {
      type: "object",
      required: [
        "total",
        "unique",
        "converted",
        "fallback",
        "rendered",
        "duplicateOccurrences",
        "unknownFragments",
        "occurrences",
      ],
      properties: {
        total: { type: "integer", minimum: 0 },
        unique: { type: "integer", minimum: 0 },
        converted: { type: "integer", minimum: 0 },
        fallback: { type: "integer", minimum: 0 },
        rendered: { type: "integer", minimum: 0 },
        duplicateOccurrences: { type: "integer", minimum: 0 },
        unknownFragments: { type: "integer", minimum: 0 },
        occurrences: { type: "array", items: { "$ref": "#/$defs/resourceLinkOccurrence" } },
      },
      additionalProperties: false,
    },
    resourceLinkOccurrence: {
      type: "object",
      required: ["sourceKey", "slug", "fragment", "converted"],
      properties: {
        sourceKey: { type: "string", format: "uri", pattern: "^https://" },
        slug: { type: ["string", "null"], pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
        fragment: { type: ["string", "null"] },
        converted: { type: "boolean" },
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
        dateModified: isoDateTimeSchema,
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

function assertAllowedKeys(
  value: JsonRecord,
  label: string,
  allowedKeys: readonly string[],
): void {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label} contains unsupported key ${key}`);
  }
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

function requiredNullableString(value: unknown, label: string): string | null {
  if (value === undefined) throw new Error(`${label} is required`);
  return nullableString(value, label);
}

function sameJsonValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function comparableMedia(media: readonly TutorialMedia[]) {
  return media.map(({ path, sha256, sourceUrl, width, height, id }) => ({
    path,
    sha256,
    sourceUrl: sourceUrl ?? null,
    width: width ?? null,
    height: height ?? null,
    id: id ?? null,
  }));
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
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function requiredSha256(value: unknown, label: string): Sha256 {
  if (!isSha256(value)) throw new Error(`${label} must be a SHA-256 hex digest`);
  return value;
}

function parseContentFile(value: unknown, label: string): TutorialContentFile | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !/^[a-f0-9]{64}\.html$/.test(value)) {
    throw new Error(`${label} must be a content-addressed SHA-256 filename`);
  }
  return value as TutorialContentFile;
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
  if (result !== null && !isIsoDateTime(result)) {
    throw new Error(`${label} must be an ISO date-time`);
  }
  return result;
}

function nullableDate(value: unknown, label: string): string | null {
  if (value === undefined) throw new Error(`${label} is required`);
  return optionalDate(value, label);
}

function dateString(value: unknown, label: string): string {
  const result = requiredString(value, label);
  if (!isIsoDateTime(result)) throw new Error(`${label} must be an ISO date-time`);
  return result;
}

function isIsoDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value));
}

function parseStatus(value: unknown, label: string): TutorialStatus {
  if (typeof value === "string" && TUTORIAL_STATUSES.includes(value as TutorialStatus)) {
    return value as TutorialStatus;
  }
  throw new Error(`${label} must be draft, review, published, or stale`);
}

function parseSource(value: unknown, label: string): TutorialSource {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  assertAllowedKeys(value, label, [
    "title",
    "provider",
    "author",
    "canonicalUrl",
    "sourcePath",
    "requestedUrl",
    "finalUrl",
    "contentType",
    "license",
  ]);
  const canonicalUrl = parseHttpsUrl(value.canonicalUrl, `${label}.canonicalUrl`);
  const requestedUrl = parseHttpsUrl(value.requestedUrl, `${label}.requestedUrl`);
  const finalUrl = parseHttpsUrl(value.finalUrl, `${label}.finalUrl`);
  const contentType = requiredString(
    value.contentType,
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
      assertAllowedKeys(license, `${label}.license`, ["text", "url"]);
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
    author: requiredNullableString(value.author, `${label}.author`),
    canonicalUrl,
    sourcePath: (() => {
      const sourcePath = requiredString(value.sourcePath, `${label}.sourcePath`);
      validateRepositoryLocalPath(sourcePath, `${label}.sourcePath`);
      return sourcePath;
    })(),
    requestedUrl,
    finalUrl,
    contentType,
    ...(normalizedLicense === undefined ? {} : { license: normalizedLicense }),
  };
}

function parseHistoryEntry(value: unknown, label: string, sourceCanonical: string): TutorialSnapshotHistory {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  assertAllowedKeys(value, label, [
    "version",
    "canonicalUrl",
    "sourceContentHash",
    "contentHash",
    "translationContentHash",
    "contentFile",
    "translationContentFile",
    "pageCanonicalUrl",
    "canonicalMatched",
    "requestedUrl",
    "finalUrl",
    "capturedAt",
    "sourceUpdatedAt",
    "recordedAt",
    "rollbackOf",
    "operationId",
  ]);
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
  if (translationContentFile && value.translationContentHash !== undefined) {
    const translationContentHash = requiredSha256(value.translationContentHash, `${label}.translationContentHash`);
    if (!translationContentFile.startsWith(`${translationContentHash}.`)) {
      throw new Error(`${label}.translationContentFile must match translationContentHash`);
    }
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
      : (() => {
        if (typeof value.canonicalMatched !== "boolean") {
          throw new Error(`${label}.canonicalMatched must be boolean`);
        }
        return { canonicalMatched: value.canonicalMatched };
      })()),
    ...(value.requestedUrl === undefined
      ? {}
      : { requestedUrl: parseHttpsUrl(value.requestedUrl, `${label}.requestedUrl`) }),
    ...(value.finalUrl === undefined
      ? {}
      : { finalUrl: parseHttpsUrl(value.finalUrl, `${label}.finalUrl`) }),
    ...(value.capturedAt === undefined ? {} : { capturedAt: dateString(value.capturedAt, `${label}.capturedAt`) }),
    ...(value.sourceUpdatedAt === undefined
      ? {}
      : { sourceUpdatedAt: dateString(value.sourceUpdatedAt, `${label}.sourceUpdatedAt`) }),
    ...(value.recordedAt === undefined ? {} : { recordedAt: dateString(value.recordedAt, `${label}.recordedAt`) }),
    ...(value.rollbackOf === undefined ? {} : { rollbackOf: positiveInteger(value.rollbackOf, `${label}.rollbackOf`) }),
    ...(value.operationId === undefined ? {} : { operationId: requiredString(value.operationId, `${label}.operationId`) }),
  };
}

function parseSnapshot(value: unknown, label: string, source: TutorialSource): TutorialSnapshot {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  assertAllowedKeys(value, label, [
    "version",
    "capturedAt",
    "sourceUpdatedAt",
    "pageCanonicalUrl",
    "canonicalMatched",
    "requestedUrl",
    "finalUrl",
    "sourceContentHash",
    "contentHash",
    "translationContentHash",
    "history",
    "rollbackOf",
  ]);
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
      : { sourceUpdatedAt: dateString(value.sourceUpdatedAt, `${label}.sourceUpdatedAt`) }),
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
  assertAllowedKeys(value, label, [
    "sourceLanguage",
    "language",
    "translator",
    "translatedAt",
    "reviewedAt",
    "sourceSections",
    "translatedSections",
    "contentHash",
    "contentFile",
  ]);
  const sourceSections = nonNegativeInteger(value.sourceSections, `${label}.sourceSections`);
  const translatedSections = nonNegativeInteger(value.translatedSections, `${label}.translatedSections`);
  const contentHash = value.contentHash === undefined
    ? undefined
    : requiredSha256(value.contentHash, `${label}.contentHash`);
  const contentFile = parseContentFile(value.contentFile, `${label}.contentFile`);
  if (contentFile && !contentHash) {
    throw new Error(`${label}.contentFile requires contentHash`);
  }
  if (contentFile && contentHash && !contentFile.startsWith(contentHash)) {
    throw new Error(`${label}.contentFile must match contentHash`);
  }
  if (value.sourceLanguage !== "en") throw new Error(`${label}.sourceLanguage must be en`);
  if (value.language !== "zh-CN") throw new Error(`${label}.language must be zh-CN`);
  return {
    sourceLanguage: "en",
    language: "zh-CN",
    translator: requiredNullableString(value.translator, `${label}.translator`),
    translatedAt: nullableDate(value.translatedAt, `${label}.translatedAt`),
    reviewedAt: nullableDate(value.reviewedAt, `${label}.reviewedAt`),
    sourceSections,
    translatedSections,
    ...(contentHash === undefined ? {} : { contentHash }),
    ...(contentFile ? { contentFile } : {}),
  };
}

function parseReviewHistory(value: unknown, label: string): TutorialReviewHistoryEntry {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  assertAllowedKeys(value, label, [
    "decision",
    "reviewer",
    "reviewedAt",
    "notes",
    "version",
    "operationId",
  ]);
  const decision = value.decision;
  if (decision !== "pending" && decision !== "approved" && decision !== "changes-requested") {
    throw new Error(`${label}.decision is invalid`);
  }
  return {
    decision,
    reviewer: requiredNullableString(value.reviewer, `${label}.reviewer`),
    reviewedAt: nullableDate(value.reviewedAt, `${label}.reviewedAt`),
    notes: requiredString(value.notes, `${label}.notes`),
    ...(value.version === undefined ? {} : { version: positiveInteger(value.version, `${label}.version`) }),
    ...(value.operationId === undefined ? {} : { operationId: requiredString(value.operationId, `${label}.operationId`) }),
  };
}

function parseReview(value: unknown, label: string): TutorialReview {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  assertAllowedKeys(value, label, [
    "decision",
    "reviewer",
    "reviewedAt",
    "notes",
    "checklist",
    "history",
  ]);
  const decision = value.decision;
  if (decision !== "pending" && decision !== "approved" && decision !== "changes-requested") {
    throw new Error(`${label}.decision is invalid`);
  }
  const history = value.history;
  if (!Array.isArray(history)) throw new Error(`${label}.history must be an array`);
  return {
    decision,
    reviewer: requiredNullableString(value.reviewer, `${label}.reviewer`),
    reviewedAt: nullableDate(value.reviewedAt, `${label}.reviewedAt`),
    notes: requiredString(value.notes, `${label}.notes`),
    checklist: parseChecklist(value.checklist, TUTORIAL_REVIEW_CHECKLIST_KEYS, `${label}.checklist`),
    history: history.map((entry, index) => parseReviewHistory(entry, `${label}.history[${index}]`)),
  };
}

function parseQualification(value: unknown, label: string): TutorialQualification {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  assertAllowedKeys(value, label, ["decision", "reviewer", "reviewedAt", "checklist"]);
  const decision = value.decision;
  if (decision !== "pending" && decision !== "qualified" && decision !== "rejected") {
    throw new Error(`${label}.decision is invalid`);
  }
  return {
    decision,
    reviewer: requiredNullableString(value.reviewer, `${label}.reviewer`),
    reviewedAt: nullableDate(value.reviewedAt, `${label}.reviewedAt`),
    checklist: parseChecklist(
      value.checklist,
      TUTORIAL_QUALIFICATION_CHECKLIST_KEYS,
      `${label}.checklist`,
    ),
  };
}

function parseSeo(value: unknown, label: string): TutorialSeo {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  assertAllowedKeys(value, label, ["title", "description", "indexable", "dateModified"]);
  if (typeof value.indexable !== "boolean") throw new Error(`${label}.indexable must be boolean`);
  const dateModified = value.dateModified === undefined
    ? undefined
    : dateString(value.dateModified, `${label}.dateModified`);
  return {
    title: requiredString(value.title, `${label}.title`),
    description: requiredString(value.description, `${label}.description`),
    indexable: value.indexable,
    ...(dateModified === undefined ? {} : { dateModified }),
  };
}

function parseMedia(value: unknown, label: string): TutorialMedia {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  assertAllowedKeys(value, label, ["path", "sha256", "alt", "sourceUrl", "width", "height", "id"]);
  const path = requiredString(value.path, `${label}.path`);
  validateRepositoryLocalPath(path, `${label}.path`, { media: true });
  const sha256 = requiredSha256(
    value.sha256,
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
    assertAllowedKeys(entry, `${label}[${index}]`, ["id", "title", "level"]);
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

function parseRefreshCandidate(value: unknown, label: string, locale: Locale): TutorialRefreshCandidate | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  assertAllowedKeys(value, label, [
    "status",
    "version",
    "operationId",
    "createdAt",
    "title",
    "description",
    "sourceContentHash",
    "contentHash",
    "translationContentHash",
    "contentFile",
    "translationContentFile",
    "toc",
    "media",
    "contentMetrics",
    "seo",
  ]);
  const status = parseStatus(value.status, `${label}.status`);
  if (status === "published") throw new Error(`${label}.status must be a preview status`);
  const contentHash = requiredSha256(value.contentHash, `${label}.contentHash`);
  const translationContentHash = requiredSha256(value.translationContentHash, `${label}.translationContentHash`);
  const contentFile = parseContentFile(value.contentFile, `${label}.contentFile`);
  const translationContentFile = parseContentFile(value.translationContentFile, `${label}.translationContentFile`);
  const localeContentHash = locale === "en" ? contentHash : translationContentHash;
  if (!contentFile?.startsWith(`${localeContentHash}.`)) throw new Error(`${label}.contentFile must match locale contentHash`);
  if (!translationContentFile?.startsWith(`${translationContentHash}.`)) {
    throw new Error(`${label}.translationContentFile must match translationContentHash`);
  }
  const mediaValue = value.media;
  if (!Array.isArray(mediaValue)) throw new Error(`${label}.media must be an array`);
  const seo = parseSeo(value.seo, `${label}.seo`);
  if (seo.indexable) throw new Error(`${label}.seo must be noindex`);
  return {
    status,
    version: positiveInteger(value.version, `${label}.version`),
    operationId: requiredString(value.operationId, `${label}.operationId`),
    createdAt: dateString(value.createdAt, `${label}.createdAt`),
    title: requiredString(value.title, `${label}.title`),
    description: requiredString(value.description, `${label}.description`),
    sourceContentHash: requiredSha256(value.sourceContentHash, `${label}.sourceContentHash`),
    contentHash,
    translationContentHash,
    contentFile,
    translationContentFile,
    toc: parseToc(value.toc, `${label}.toc`),
    media: mediaValue.map((entry, index) => parseMedia(entry, `${label}.media[${index}]`)),
    contentMetrics: parseMetrics(value.contentMetrics, `${label}.contentMetrics`),
    seo,
  };
}

function parseRecord(value: unknown, locale: Locale, index: number): TutorialRecord {
  const label = `Tutorial route ${index}`;
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  assertAllowedKeys(value, label, [
    "slug",
    "path",
    "title",
    "description",
    "provider",
    "status",
    "sourceKey",
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
    "redirectTo",
    "refreshCandidate",
  ]);
  const slug = assertTutorialSlug(requiredString(value.slug, `${label}.slug`));
  const expectedPath = tutorialPath(slug, locale);
  const routePath = requiredString(value.path, `${label}.path`);
  if (routePath !== expectedPath) throw new Error(`Tutorial route ${slug} path must be ${expectedPath}`);
  const status = parseStatus(value.status, `${label}.status`);
  const source = parseSource(value.source, `${label} ${slug}.source`);
  const sourceKey = normalizeSourceKey(source.canonicalUrl);
  if (
    normalizeSourceKey(parseHttpsUrl(value.sourceKey, `${label} ${slug}.sourceKey`)) !== sourceKey
  ) {
    throw new Error(`Tutorial route ${slug} sourceKey does not match source.canonicalUrl`);
  }
  const snapshot = parseSnapshot(value.snapshot, `${label} ${slug}.snapshot`, source);
  const activeVersion = positiveInteger(value.activeVersion, `${label} ${slug}.activeVersion`);
  const translation = parseTranslation(value.translation, `${label} ${slug}.translation`);
  const review = parseReview(value.review, `${label} ${slug}.review`);
  const qualification = parseQualification(value.qualification, `${label} ${slug}.qualification`);
  const contentHash = snapshot.contentHash;
  const contentFile = parseContentFile(value.contentFile, `${label} ${slug}.contentFile`);
  const routeContentHash = locale === "en" ? contentHash : snapshot.translationContentHash;
  if (locale === "zh-CN" && contentFile && !routeContentHash) {
    throw new Error(`Tutorial route ${slug} contentFile requires snapshot.translationContentHash`);
  }
  if (contentFile && routeContentHash && !contentFile.startsWith(routeContentHash)) {
    throw new Error(
      `Tutorial route ${slug} contentFile must match ${locale === "en" ? "snapshot.contentHash" : "snapshot.translationContentHash"}`,
    );
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
  const refreshCandidate = parseRefreshCandidate(value.refreshCandidate, `Tutorial route ${slug}.refreshCandidate`, locale);
  const redirectTo = value.redirectTo === undefined || value.redirectTo === null
    ? value.redirectTo ?? undefined
    : requiredString(value.redirectTo, `Tutorial route ${slug}.redirectTo`);
  if (status === "published") {
    if (!contentFile) throw new Error(`Tutorial route ${slug} published records require contentFile`);
    if (!snapshot.canonicalMatched) throw new Error(`Tutorial route ${slug} canonical match is unverified`);
    if (!snapshot.sourceUpdatedAt) throw new Error(`Tutorial route ${slug} published records require sourceUpdatedAt`);
    if (!snapshot.translationContentHash) {
      throw new Error(`Tutorial route ${slug} published records require translationContentHash`);
    }
    if (seo.indexable !== true) throw new Error(`Tutorial route ${slug} published records must be indexable`);
    if (review.decision !== "approved") throw new Error(`Tutorial route ${slug} published records require approved review`);
    if (!review.reviewer) throw new Error(`Tutorial route ${slug} published records require review reviewer`);
    if (!review.reviewedAt) throw new Error(`Tutorial route ${slug} published records require review timestamp`);
    if (qualification.decision !== "qualified") throw new Error(`Tutorial route ${slug} published records require qualification`);
    if (!qualification.reviewer) throw new Error(`Tutorial route ${slug} published records require qualification reviewer`);
    if (!qualification.reviewedAt) throw new Error(`Tutorial route ${slug} published records require qualification timestamp`);
    if (!translation.translator) throw new Error(`Tutorial route ${slug} published records require translator`);
    if (!translation.translatedAt) throw new Error(`Tutorial route ${slug} published records require translatedAt`);
    if (!translation.reviewedAt) throw new Error(`Tutorial route ${slug} published records require translation review timestamp`);
    if (translation.sourceSections < 1 || translation.translatedSections < 1) {
      throw new Error(`Tutorial route ${slug} published records require positive bilingual sections`);
    }
    if (translation.sourceSections !== translation.translatedSections) {
      throw new Error(`Tutorial route ${slug} translation section count differs`);
    }
    if (!translation.contentHash) throw new Error(`Tutorial route ${slug} published records require translation contentHash`);
    if (!translation.contentFile) throw new Error(`Tutorial route ${slug} published records require translation contentFile`);
    if (translation.contentHash !== snapshot.translationContentHash) {
      throw new Error(`Tutorial route ${slug} translation contentHash must match snapshot.translationContentHash`);
    }
    if (translation.contentFile && !translation.contentFile.startsWith(translation.contentHash)) {
      throw new Error(`Tutorial route ${slug} translation contentFile must match translation.contentHash`);
    }
    if (locale === "zh-CN" && translation.contentFile !== contentFile) {
      throw new Error(`Tutorial route ${slug} translation contentFile must match contentFile`);
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
    ...(refreshCandidate === undefined ? {} : { refreshCandidate }),
  };
}

function parseAlias(value: unknown, index: number): TutorialSourceAlias {
  const label = `Tutorial alias ${index}`;
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  assertAllowedKeys(value, label, ["sourceKey", "slug", "sourceUrl", "createdAt", "reason"]);
  const sourceKey = normalizeSourceKey(parseHttpsUrl(value.sourceKey, `${label}.sourceKey`));
  const slug = assertTutorialSlug(requiredString(value.slug, `${label}.slug`));
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
  if (Array.isArray(value)) return value.map((entry, index) => parseAlias(entry, index));
  throw new Error(`${label} must be an array`);
}

function parseResourceLinkOccurrence(value: unknown, label: string): TutorialResourceLinkOccurrence {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  assertAllowedKeys(value, label, ["sourceKey", "slug", "fragment", "converted"]);
  const converted = value.converted;
  if (typeof converted !== "boolean") throw new Error(`${label}.converted must be boolean`);
  const sourceKey = normalizeSourceKey(parseHttpsUrl(value.sourceKey, `${label}.sourceKey`));
  const slug = value.slug === null
    ? null
    : assertTutorialSlug(requiredString(value.slug, `${label}.slug`));
  const fragment = value.fragment === null ? null : requiredString(value.fragment, `${label}.fragment`);
  if (converted && !slug) throw new Error(`${label}.slug is required for converted occurrences`);
  return { sourceKey, slug, fragment, converted };
}

function isPublishedTutorialRoute(route: TutorialRecord): boolean {
  return route.status === "published" && route.redirectTo === undefined;
}

function resourceLinkOwners(
  routes: readonly TutorialRecord[],
  aliases: readonly TutorialSourceAlias[],
): ReadonlyMap<string, string> {
  const routesBySlug = new Map(routes.map((route) => [route.slug, route]));
  const owners = new Map<string, string>();
  for (const route of routes) {
    if (isPublishedTutorialRoute(route)) owners.set(route.sourceKey, route.slug);
  }
  for (const alias of aliases) {
    const route = routesBySlug.get(alias.slug);
    if (route && isPublishedTutorialRoute(route)) owners.set(alias.sourceKey, route.slug);
  }
  return owners;
}

function parseResourceLinkReport(
  value: unknown,
  label: string,
  routes: readonly TutorialRecord[],
  aliases: readonly TutorialSourceAlias[],
): TutorialResourceLinkReport | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  assertAllowedKeys(value, label, [
    "total",
    "unique",
    "converted",
    "fallback",
    "rendered",
    "duplicateOccurrences",
    "unknownFragments",
    "occurrences",
  ]);
  const total = nonNegativeInteger(value.total, `${label}.total`);
  const unique = nonNegativeInteger(value.unique, `${label}.unique`);
  const converted = nonNegativeInteger(value.converted, `${label}.converted`);
  const fallback = nonNegativeInteger(value.fallback, `${label}.fallback`);
  const rendered = nonNegativeInteger(value.rendered, `${label}.rendered`);
  const duplicateOccurrences = nonNegativeInteger(value.duplicateOccurrences, `${label}.duplicateOccurrences`);
  const unknownFragments = nonNegativeInteger(value.unknownFragments, `${label}.unknownFragments`);
  if (!Array.isArray(value.occurrences)) throw new Error(`${label}.occurrences must be an array`);
  const occurrences = value.occurrences.map((entry, index) =>
    parseResourceLinkOccurrence(entry, `${label}.occurrences[${index}]`),
  );
  const report = {
    total,
    unique,
    converted,
    fallback,
    rendered,
    duplicateOccurrences,
    unknownFragments,
    occurrences,
  };
  if (converted + fallback !== total) {
    throw new Error(`${label} converted plus fallback must equal total`);
  }
  if (occurrences.length !== total) {
    throw new Error(`${label}.occurrences length must equal total`);
  }
  const convertedOccurrenceCount = occurrences.filter((occurrence) => occurrence.converted).length;
  if (convertedOccurrenceCount !== converted) {
    throw new Error(`${label}.occurrences converted count must equal converted`);
  }
  if (new Set(occurrences.map((occurrence) => occurrence.sourceKey)).size !== unique) {
    throw new Error(`${label}.occurrences unique sourceKey count must equal unique`);
  }
  const slugBySourceKey = new Map<string, string>();
  const owners = resourceLinkOwners(routes, aliases);
  for (const occurrence of occurrences) {
    if (!occurrence.converted || !occurrence.slug) continue;
    const slug = slugBySourceKey.get(occurrence.sourceKey);
    if (slug && slug !== occurrence.slug) {
      throw new Error(`${label}.occurrences converted sourceKey must resolve to one slug`);
    }
    const ownerSlug = owners.get(occurrence.sourceKey);
    if (!ownerSlug) {
      throw new Error(`${label}.occurrences converted sourceKey must resolve to a published route`);
    }
    if (ownerSlug !== occurrence.slug) {
      throw new Error(`${label}.occurrences converted slug must match sourceKey owner`);
    }
    slugBySourceKey.set(occurrence.sourceKey, occurrence.slug);
  }
  const unknownFragmentCount = occurrences.filter(
    (occurrence) => !occurrence.converted && occurrence.fragment !== null,
  ).length;
  if (unknownFragments !== unknownFragmentCount) {
    throw new Error(`${label}.unknownFragments must match fallback occurrence fragments`);
  }
  if (rendered !== total * 2) {
    throw new Error(`${label}.rendered must equal bilingual anchor count`);
  }
  if (duplicateOccurrences !== total - unique) {
    throw new Error(`${label}.duplicateOccurrences must equal total minus unique`);
  }
  if (unknownFragments > fallback) {
    throw new Error(`${label}.unknownFragments must be covered by fallback`);
  }
  return report;
}

function validateTutorialRedirectGraph(
  routes: readonly TutorialRecord[],
  locale: Locale,
): void {
  const recordsBySlug = new Map(routes.map((route) => [route.slug, route]));
  for (const route of routes) {
    if (route.redirectTo === undefined || route.redirectTo === null) continue;
    const visited = new Set([route.slug]);
    let current = route;
    while (current.redirectTo !== undefined && current.redirectTo !== null) {
      const safeTarget = safeTutorialRedirect(current.redirectTo, locale, current.slug);
      if (!safeTarget) {
        throw new Error(`Unsafe tutorial redirect from ${current.path}: ${current.redirectTo}`);
      }
      const targetSlug = tutorialSlugFromPath(safeTarget, locale);
      if (!targetSlug) throw new Error(`Tutorial redirect target is invalid: ${safeTarget}`);
      if (visited.has(targetSlug)) throw new Error(`Tutorial redirect cycle detected at ${current.path}`);
      const next = recordsBySlug.get(targetSlug);
      if (!next) throw new Error(`Tutorial redirect target is missing: ${safeTarget}`);
      visited.add(targetSlug);
      current = next;
    }
  }
}

export function parseTutorialManifest(
  value: unknown,
  locale: Locale,
  filePath = "tutorial manifest",
): TutorialManifest {
  if (!isRecord(value)) throw new Error(`Tutorial manifest ${filePath} must be an object`);
  const allowedKeys = new Set([
    "$schema",
    "schemaVersion",
    "locale",
    "generation",
    "activeVersion",
    "routes",
    "aliases",
    "resourceLinkReport",
  ]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) throw new Error(`Tutorial manifest ${filePath} contains unsupported key ${key}`);
  }
  if (
    value.$schema !== undefined &&
    value.$schema !== TUTORIAL_MANIFEST_SCHEMA.$id
  ) {
    throw new Error(`Tutorial manifest ${filePath} $schema must be ${TUTORIAL_MANIFEST_SCHEMA.$id}`);
  }
  if (value.schemaVersion !== TUTORIAL_SCHEMA_VERSION) {
    throw new Error(`Tutorial manifest ${filePath} schemaVersion must be ${TUTORIAL_SCHEMA_VERSION}`);
  }
  if (value.locale !== locale) {
    throw new Error(`Tutorial manifest ${filePath} locale must be ${locale}`);
  }
  const generation = value.generation === null
    ? null
    : requiredString(value.generation, `Tutorial manifest ${filePath}.generation`);
  const activeVersionValue = value.activeVersion;
  const activeVersion = activeVersionValue === null
    ? null
    : positiveInteger(activeVersionValue, `Tutorial manifest ${filePath}.activeVersion`);
  if (!Array.isArray(value.routes)) {
    throw new Error(`Tutorial manifest ${filePath}.routes must be an array`);
  }
  const routes = value.routes.map((entry, index) => parseRecord(entry, locale, index));
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
  const routesBySlug = new Map(routes.map((route) => [route.slug, route]));
  const aliasOwners = new Set<string>();
  for (const alias of aliases) {
    if (aliasOwners.has(alias.sourceKey)) throw new Error(`Duplicate tutorial alias: ${alias.sourceKey}`);
    aliasOwners.add(alias.sourceKey);
    const target = routesBySlug.get(alias.slug);
    if (!target) throw new Error(`Tutorial alias target is missing: ${alias.slug}`);
    if (target.redirectTo !== undefined) throw new Error(`Tutorial alias target must be a non-redirect route: ${alias.slug}`);
    if (sourceOwners.has(alias.sourceKey)) {
      throw new Error(`Tutorial alias source key is already owned: ${alias.sourceKey}`);
    }
  }
  validateTutorialRedirectGraph(routes, locale);
  const resourceLinkReport = parseResourceLinkReport(
    value.resourceLinkReport,
    `Tutorial manifest ${filePath}.resourceLinkReport`,
    routes,
    aliases,
  );
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
    if (
      normalizeSourceKey(zh.source.canonicalUrl) !== normalizeSourceKey(en.source.canonicalUrl) ||
      normalizeSourceKey(zh.source.requestedUrl) !== normalizeSourceKey(en.source.requestedUrl) ||
      normalizeSourceKey(zh.source.finalUrl) !== normalizeSourceKey(en.source.finalUrl) ||
      zh.source.title !== en.source.title ||
      zh.source.provider !== en.source.provider ||
      zh.source.author !== en.source.author ||
      zh.source.sourcePath !== en.source.sourcePath ||
      zh.source.contentType !== en.source.contentType ||
      !sameJsonValue(zh.source.license ?? null, en.source.license ?? null)
    ) {
      throw new Error(`Tutorial source pairing failed: ${slug}`);
    }
    if (
      zh.snapshot.sourceContentHash !== en.snapshot.sourceContentHash ||
      zh.snapshot.contentHash !== en.snapshot.contentHash ||
      zh.snapshot.translationContentHash !== en.snapshot.translationContentHash
    ) {
      throw new Error(`Tutorial content hash pairing failed: ${slug}`);
    }
    if (
      en.contentFile !== `${en.snapshot.contentHash}.html` ||
      zh.snapshot.translationContentHash === undefined ||
      zh.contentFile !== `${zh.snapshot.translationContentHash}.html` ||
      zh.translation.contentFile !== zh.contentFile ||
      en.translation.contentFile !== zh.contentFile ||
      zh.translation.contentHash !== zh.snapshot.translationContentHash ||
      en.translation.contentHash !== zh.snapshot.translationContentHash
    ) {
      throw new Error(`Tutorial content file pairing failed: ${slug}`);
    }
    if (Boolean(zh.refreshCandidate) !== Boolean(en.refreshCandidate)) {
      throw new Error(`Tutorial refresh candidate pairing failed: ${slug}`);
    }
    if (zh.refreshCandidate && en.refreshCandidate) {
      const zhCandidate = zh.refreshCandidate;
      const enCandidate = en.refreshCandidate;
      if (
        zhCandidate.status !== enCandidate.status ||
        zhCandidate.version !== enCandidate.version ||
        zhCandidate.operationId !== enCandidate.operationId ||
        zhCandidate.sourceContentHash !== enCandidate.sourceContentHash ||
        zhCandidate.contentHash !== enCandidate.contentHash ||
        zhCandidate.translationContentHash !== enCandidate.translationContentHash ||
        enCandidate.contentFile !== `${enCandidate.contentHash}.html` ||
        zhCandidate.contentFile !== `${zhCandidate.translationContentHash}.html` ||
        zhCandidate.translationContentFile !== `${zhCandidate.translationContentHash}.html` ||
        enCandidate.translationContentFile !== `${zhCandidate.translationContentHash}.html`
      ) {
        throw new Error(`Tutorial refresh candidate pairing failed: ${slug}`);
      }
      if (!sameJsonValue(zhCandidate.contentMetrics, enCandidate.contentMetrics)) {
        throw new Error(`Tutorial refresh candidate metrics pairing failed: ${slug}`);
      }
      if (
        !sameJsonValue(
          zhCandidate.toc.map(({ id, level }) => ({ id, level })),
          enCandidate.toc.map(({ id, level }) => ({ id, level })),
        )
      ) {
        throw new Error(`Tutorial refresh candidate TOC pairing failed: ${slug}`);
      }
      if (
        !sameJsonValue(
          comparableMedia(zhCandidate.media),
          comparableMedia(enCandidate.media),
        )
      ) {
        throw new Error(`Tutorial refresh candidate media pairing failed: ${slug}`);
      }
      if (
        zhCandidate.seo.indexable !== enCandidate.seo.indexable ||
        (zhCandidate.seo.dateModified ?? null) !== (enCandidate.seo.dateModified ?? null)
      ) {
        throw new Error(`Tutorial refresh candidate SEO pairing failed: ${slug}`);
      }
    }
    if (!sameJsonValue(zh.contentMetrics, en.contentMetrics)) {
      throw new Error(`Tutorial content metrics pairing failed: ${slug}`);
    }
    if (
      !sameJsonValue(
        zh.toc.map(({ id, level }) => ({ id, level })),
        en.toc.map(({ id, level }) => ({ id, level })),
      )
    ) {
      throw new Error(`Tutorial TOC pairing failed: ${slug}`);
    }
    if (
      !sameJsonValue(
        comparableMedia(zh.media),
        comparableMedia(en.media),
      )
    ) {
      throw new Error(`Tutorial media pairing failed: ${slug}`);
    }
  }
  for (const slug of englishBySlug.keys()) {
    if (!chineseBySlug.has(slug)) throw new Error(`Chinese tutorial route is missing: ${slug}`);
  }
  if (!sameJsonValue(zhManifest.aliases, enManifest.aliases)) {
    throw new Error("Tutorial source aliases must be paired");
  }
  if (!sameJsonValue(zhManifest.resourceLinkReport ?? null, enManifest.resourceLinkReport ?? null)) {
    throw new Error("Tutorial resource link reports must be paired");
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

function attributeMap(source: string, label = "HTML tag"): Map<string, string> {
  const tag = source.match(/^<\/?[a-z][\w:-]*\b/i)?.[0] ?? "";
  const body = source
    .slice(tag.length)
    .replace(/\/?>\s*$/, "");
  const attrs = new Map<string, string>();
  for (const match of body.matchAll(/(?:^|\s)([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    const key = match[1].toLowerCase();
    if (attrs.has(key)) throw new Error(`${label} contains duplicate attribute ${key}`);
    attrs.set(key, match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attrs;
}

function validateRepositoryLocalPath(
  raw: string,
  label: string,
  options: { allowQueryHash?: boolean; media?: boolean } = {},
): void {
  let parsed: URL;
  let decodedPath: string;
  try {
    parsed = new URL(raw, "https://learningseo.io");
    decodedPath = decodeURIComponent(parsed.pathname);
  } catch {
    throw new Error(`${label} must be a repository-local path`);
  }
  const normalized = options.allowQueryHash
    ? `${parsed.pathname}${parsed.search}${parsed.hash}`
    : parsed.pathname;
  const localPath = options.allowQueryHash ? parsed.pathname : raw;
  const pathSegments = decodedPath.split("/");
  if (
    parsed.origin !== "https://learningseo.io" ||
    normalized !== raw ||
    !REPOSITORY_LOCAL_PATH_REGEX.test(localPath) ||
    /[\u0000-\u001f\u007f]/.test(decodedPath) ||
    decodedPath.includes("\\") ||
    pathSegments.includes(".") ||
    pathSegments.includes("..") ||
    pathSegments.slice(1, -1).includes("") ||
    (options.media && !decodedPath.startsWith(TUTORIAL_MEDIA_PATH_PREFIX))
  ) {
    throw new Error(`${label} must be a repository-local path`);
  }
}

function validateUrlAttribute(value: string, label: string, options: { local?: boolean } = {}): void {
  const raw = value.trim();
  if (!raw || /[\u0000-\u0020\u007f]/.test(raw)) throw new Error(`${label} must be a safe URL`);
  if (/^(?:javascript|vbscript|data):/i.test(raw)) throw new Error(`${label} uses a dangerous URL protocol`);
  if (options.local || raw.startsWith("/")) {
    validateRepositoryLocalPath(raw, label, {
      allowQueryHash: !options.local,
      media: options.local,
    });
    return;
  }
  if (raw.startsWith("#")) return;
  if (/^(?:mailto|tel):/i.test(raw)) return;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return;
  } catch {
    throw new Error(`${label} must use an approved URL form`);
  }
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
  const elementIds = new Set<string>();
  for (const match of html.matchAll(/<([a-z][\w:-]*)\b([^>]*)>/gi)) {
    const tag = match[1].toLowerCase();
    const attrs = attributeMap(match[0], `${label} <${tag}>`);
    for (const key of attrs.keys()) {
      if (!safeAttributes.has(key)) throw new Error(`${label} contains unsupported attribute ${key}`);
    }
    const id = attrs.get("id");
    if (id) {
      if (elementIds.has(id)) throw new Error(`${label} contains duplicate id ${id}`);
      elementIds.add(id);
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
  const headingEntries: TutorialHeadingEntry[] = [];
  const headingIds = new Set<string>();
  let previousHeading = 0;
  for (const match of html.matchAll(/<h([1-6])\b([^>]*)>/gi)) {
    const level = Number(match[1]) as TutorialTocEntry["level"];
    if (level > previousHeading + 1) throw new Error(`${label} heading hierarchy jumps from h${previousHeading}`);
    previousHeading = level;
    const id = attributeMap(match[0], `${label} h${level}`).get("id");
    if (id) {
      if (headingIds.has(id)) throw new Error(`${label} contains duplicate heading id ${id}`);
      headingIds.add(id);
      headingEntries.push({ id, level });
    }
  }
  const h1Count = openingTags(html, "h1").length;
  if ((options.requireSingleH1 ?? true) && h1Count !== 1) throw new Error(`${label} must contain one h1`);
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = attributeMap(match[0], `${label} anchor`);
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
  return { metrics, headingIds: headingEntries.map(({ id }) => id), headingEntries };
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

export function isTutorialRecord(value: unknown, locale?: Locale): value is TutorialRecord {
  try {
    if (locale) validateTutorialRecord(value, locale);
    else {
      try {
        validateTutorialRecord(value, "en");
      } catch {
        validateTutorialRecord(value, "zh-CN");
      }
    }
    return true;
  } catch {
    return false;
  }
}

export { assertTutorialSlug, isTutorialSlug, normalizeSourceKey };
