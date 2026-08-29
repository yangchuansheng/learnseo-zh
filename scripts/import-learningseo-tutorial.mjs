#!/usr/bin/env node

import {
  importTutorialDraft,
  logFailure,
  parseArgs,
  recordCliFailure,
  tutorialImportResultMessage,
  validateImportOptions,
} from "./lib/tutorial-importer.mjs";

const argv = process.argv.slice(2);

try {
  const options = validateImportOptions(parseArgs(argv));
  const result = await importTutorialDraft(options);
  console.log(tutorialImportResultMessage(result));
  console.log(`[tutorial-importer] generation ${result.generation}`);
  console.log(`[tutorial-importer] content ${result.englishContentFile} ${result.chineseContentFile}`);
} catch (error) {
  logFailure(await recordCliFailure(error, argv));
  process.exitCode = 1;
}
