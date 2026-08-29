#!/usr/bin/env node

import { collectTutorialSnapshot, logFailure, parseArgs, validateCollectOptions, writeJsonFile } from "./lib/tutorial-importer.mjs";

try {
  const options = validateCollectOptions(parseArgs(process.argv.slice(2)));
  const snapshot = await collectTutorialSnapshot(options);
  await writeJsonFile(options.output, snapshot);
  console.log(`[tutorial-importer] collected ${snapshot.slug} from ${snapshot.canonicalUrl}`);
  console.log(`[tutorial-importer] wrote ${options.output}`);
} catch (error) {
  logFailure(error);
  process.exitCode = 1;
}
