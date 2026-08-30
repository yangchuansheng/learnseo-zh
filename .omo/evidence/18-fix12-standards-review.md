Standards review evidence for issue 18 fix12

Scope checked:
- Fixed point: 058f8f52457297c32e62c5661e91b4d96a0a706f
- Requested committed diff: `git diff 058f8f5...HEAD -- scripts/lib/tutorial-importer.mjs scripts/check-tutorial-importer.mjs`
- Requested commit list: `git log 058f8f5..HEAD --oneline`
- Actual reviewed source delta: uncommitted working tree diff for the same two files, because requested committed diff and commit list were empty.

Standards sources:
- `AGENTS.md`
- `docs/research/INSPECTION_GUIDE.md`
- Provided smell baseline
- `code-review` skill process

Finding 1:
- Severity: hard documented-standard violation
- File: `scripts/lib/tutorial-importer.mjs`
- Hunk: `restoreCommittedBackups`
- Standard: `AGENTS.md` Coding Execution Guidelines: "Write the minimum code that satisfies the request" and "Avoid speculative features, one-off abstractions, unrequested configurability..."
- Evidence: the new `markerCandidates` array can only contain parsed marker candidates or `null`; the added filter removes `undefined`, a value this hunk does not produce.
- Quoted hunk:

```diff
+  const markerCandidates = [
+    await parseMarkerForRestore(markerBackupPath, "Backup import-generation.json", operationId),
+    await parseMarkerForRestore(markerPath, "Live import-generation.json", operationId),
+    ...(markerBackupExists ? [] : [null]),
+  ].filter((candidate) => candidate !== undefined);
```

Finding 2:
- Severity: judgement call, baseline smell
- Smell: Duplicated Code
- File: `scripts/check-tutorial-importer.mjs`
- Hunk: tampered backup marker scenario
- Evidence: the same Promise/all read shape is added twice for the same `atomicRestoreFiles` and content root.
- Quoted hunk:

```diff
+    const tamperedBackupMarkerBefore = await Promise.all(
+      atomicRestoreFiles.map((relative) => fs.readFile(path.join(tamperedBackupMarkerContentRoot, relative), "utf8")),
+    );
...
+      await Promise.all(
+        atomicRestoreFiles.map((relative) => fs.readFile(path.join(tamperedBackupMarkerContentRoot, relative), "utf8")),
+      ),
```

Validation:
- `git rev-parse 058f8f5` resolved the fixed point.
- `git diff 058f8f5...HEAD -- scripts/lib/tutorial-importer.mjs scripts/check-tutorial-importer.mjs` produced empty output.
- `git log 058f8f5..HEAD --oneline` produced empty output.
- `git diff -- scripts/lib/tutorial-importer.mjs scripts/check-tutorial-importer.mjs` produced the reviewed working tree diff.
- `git diff --check -- scripts/lib/tutorial-importer.mjs scripts/check-tutorial-importer.mjs` produced empty output.
