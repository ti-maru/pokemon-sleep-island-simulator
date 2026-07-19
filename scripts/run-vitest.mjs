import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const temporaryDirectory = fileURLToPath(
  new URL("../.tmp/vitest/", import.meta.url),
);
const vitestEntryPoint = fileURLToPath(
  new URL("../node_modules/vitest/vitest.mjs", import.meta.url),
);

mkdirSync(temporaryDirectory, { recursive: true });

const result = spawnSync(process.execPath, [vitestEntryPoint, "run"], {
  stdio: "inherit",
  env: {
    ...process.env,
    TEMP: temporaryDirectory,
    TMP: temporaryDirectory,
    TMPDIR: temporaryDirectory,
  },
});

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
