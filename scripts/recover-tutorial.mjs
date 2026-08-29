#!/usr/bin/env node

import {
  logFailure,
  parseArgs,
  recordCliFailure,
  recoverTutorialImport,
} from "./lib/tutorial-importer.mjs";

const argv = process.argv.slice(2);

try {
  const args = parseArgs(argv);
  const result = await recoverTutorialImport({ operationId: args.operation, actor: args.actor });
  console.log(`[tutorial-importer] recovered ${result.operationId} as ${result.status}`);
  console.log(`[tutorial-importer] generation ${result.generation}`);
} catch (error) {
  logFailure(await recordCliFailure(error, argv));
  process.exitCode = 1;
}
