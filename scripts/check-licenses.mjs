import { spawnSync } from "node:child_process";

const allowedLicenses = new Set([
  "(MIT OR CC0-1.0)",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "BlueOak-1.0.0",
  "CC-BY-4.0",
  "CC0-1.0",
  "ISC",
  "MIT",
  "MIT AND ISC",
  "MIT-0",
  "MPL-2.0",
]);

const result = spawnSync("pnpm", ["licenses", "list", "--json"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});

if (result.status !== 0) {
  process.stderr.write(
    result.stderr || "依存ライセンス一覧を取得できませんでした。\n",
  );
  process.exit(result.status ?? 1);
}

const grouped = JSON.parse(result.stdout);
const licenses = Object.keys(grouped);
const rejected = licenses.filter((license) => !allowedLicenses.has(license));

if (rejected.length > 0) {
  process.stderr.write(
    `許可リスト外の依存ライセンスがあります: ${rejected.join(", ")}\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `依存ライセンス検査: ${licenses.length}種類すべて許可済みです。\n`,
);
