#!/usr/bin/env node

import {
  collectTutorialSnapshot,
  logFailure,
  parseArgs,
  recordCliFailure,
  validateCollectOptions,
  writeJsonFile,
} from "./lib/tutorial-importer.mjs";

const argv = process.argv.slice(2);

try {
  const options = validateCollectOptions(parseArgs(argv));
  const snapshot = await collectTutorialSnapshot(options);
  await writeJsonFile(options.output, snapshot);
  console.log(`[tutorial-importer] collected ${snapshot.slug} from ${snapshot.canonicalUrl}`);
  console.log(`[tutorial-importer] wrote ${options.output}`);
} catch (error) {
  logFailure(await recordCliFailure(error, argv));
  process.exitCode = 1;
}
