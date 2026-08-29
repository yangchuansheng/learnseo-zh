#!/usr/bin/env node

import {
  importTutorialDraft,
  logFailure,
  parseArgs,
  tutorialImportResultMessage,
  validateImportOptions,
} from "./lib/tutorial-importer.mjs";

try {
  const options = validateImportOptions(parseArgs(process.argv.slice(2)));
  const result = await importTutorialDraft(options);
  console.log(tutorialImportResultMessage(result));
  console.log(`[tutorial-importer] generation ${result.generation}`);
  console.log(`[tutorial-importer] content ${result.englishContentFile} ${result.chineseContentFile}`);
} catch (error) {
  logFailure(error);
  process.exitCode = 1;
}
