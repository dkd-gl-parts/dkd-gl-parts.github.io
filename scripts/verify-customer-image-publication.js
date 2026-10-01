"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");

const testFile = path.resolve(__dirname, "../tests/customer-image-publication.test.cjs");
const result = spawnSync(process.execPath, ["--test", testFile], { stdio: "inherit" });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
