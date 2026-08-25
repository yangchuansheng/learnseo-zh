import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["scripts/translate-learningseo-google-clean.mjs"], {
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
