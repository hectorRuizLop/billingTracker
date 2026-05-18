"use strict";

// active when runing cds test outside jest that doesn't load test/setup.js
const { spawnSync } = require("child_process");
const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["cds", "test", ...process.argv.slice(2)],
  { env: { ...process.env, NODE_ENV: "test" }, stdio: "inherit" },
);
process.exit(result.status ?? 0);
