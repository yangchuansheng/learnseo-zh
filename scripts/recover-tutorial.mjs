#!/usr/bin/env node

import {
  logFailure,
  parseArgs,
  recoverTutorialImport,
} from "./lib/tutorial-importer.mjs";

try {
  const args = parseArgs(process.argv.slice(2));
  const result = await recoverTutorialImport({ operationId: args.operation });
  console.log(`[tutorial-importer] recovered ${result.operationId} as ${result.status}`);
  console.log(`[tutorial-importer] generation ${result.generation}`);
} catch (error) {
  logFailure(error);
  process.exitCode = 1;
}
