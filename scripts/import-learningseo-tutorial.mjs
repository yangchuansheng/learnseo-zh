#!/usr/bin/env node

import { importTutorialDraft, logFailure, parseArgs, validateImportOptions } from "./lib/tutorial-importer.mjs";

try {
  const result = await importTutorialDraft(validateImportOptions(parseArgs(process.argv.slice(2))));
  console.log(`[tutorial-importer] imported ${result.slug} as ${result.status}`);
  console.log(`[tutorial-importer] generation ${result.generation}`);
  console.log(`[tutorial-importer] content ${result.englishContentFile} ${result.chineseContentFile}`);
} catch (error) {
  logFailure(error);
  process.exitCode = 1;
}
