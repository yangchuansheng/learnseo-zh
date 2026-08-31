import assert from "node:assert/strict";

import {
  assertActiveExternalCardTargets,
  collectRightsAudit,
  sourceDefinitions,
  validateAuditEvidence,
} from "./audit-seo-fundamentals-rights.mjs";

const evidence = await collectRightsAudit();
await validateAuditEvidence(evidence);

for (const definition of sourceDefinitions) {
  const source = evidence.sources.find(({ sourceId }) => sourceId === definition.sourceId);
  assert.ok(source, `Missing ${definition.sourceId}`);
  assert.equal(source.collection.status, "collected-in-memory");
  assert.equal(source.contentType, "text/html");
  assert.equal(source.terms.status, 200);
  assert.equal(source.terms.contentType?.split(";", 1)[0].toLowerCase(), "text/html");
  assert.equal(source.terms.finalUrl, definition.termsUrl);
  assert.match(source.terms.contentHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(source.terms.signals, {
    ownershipLanguage: true,
    permissionLanguage: true,
    copyRestrictionLanguage: true,
    openLicenseLanguage: false,
  });
  assert.deepEqual(
    source.terms.sourceAssertions,
    Object.fromEntries(definition.termsAssertions.map(([id]) => [id, true])),
    `${definition.sourceId} lacks source-specific terms evidence`,
  );
  assert.equal(source.rights.disposition, "rights-gated-external");
  assert.equal(source.externalDisposition.cardAction, "keep-external");
  assert.equal(source.externalDisposition.routeSlug, null);
  assert.equal(source.importArtifacts.published, false);
  assert.equal(source.canonicalUrl, definition.expectedCanonicalUrl);
}

const ahrefs = evidence.sources.find(({ sourceId }) => sourceId === "ahrefs-seo-basics");
const mangools = evidence.sources.find(({ sourceId }) => sourceId === "mangools-complete-seo-guide");
assert.equal(ahrefs.sourceUpdatedAt, null);
assert.deepEqual(ahrefs.updateEvidence, {
  jsonLdDateModified: null,
  articleModifiedTimeOrVisibleDate: null,
  httpLastModified: ahrefs.httpLastModified,
});
assert.ok(ahrefs.rights.reasonCodes.includes("source-update-missing"));
assert.match(mangools.updateEvidence.jsonLdDateModified ?? "", /^\d{4}-\d{2}-\d{2}T/);
assert.match(mangools.updateEvidence.articleModifiedTimeOrVisibleDate ?? "", /^\d{4}-\d{2}-\d{2}T/);
assert.equal(mangools.sourceUpdatedAt, mangools.updateEvidence.jsonLdDateModified);

await assertActiveExternalCardTargets();

console.log(`Validated ${sourceDefinitions.length} Wave 2 sources as rights-gated external resources.`);
