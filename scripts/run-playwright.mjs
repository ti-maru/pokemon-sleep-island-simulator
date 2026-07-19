import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const temporaryDirectory = fileURLToPath(
  new URL("../.tmp/playwright/", import.meta.url),
);
const playwrightEntryPoint = fileURLToPath(
  new URL("../node_modules/@playwright/test/cli.js", import.meta.url),
);

mkdirSync(temporaryDirectory, { recursive: true });

const result = spawnSync(
  process.execPath,
  [playwrightEntryPoint, "test", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      TEMP: temporaryDirectory,
      TMP: temporaryDirectory,
      TMPDIR: temporaryDirectory,
    },
  },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
