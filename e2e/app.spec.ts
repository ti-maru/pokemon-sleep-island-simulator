import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function createIndividual(page: Page, name = "E2E育成個体") {
  await page
    .getByRole("navigation", { name: "メインナビゲーション" })
    .getByRole("button", { name: "個体", exact: true })
    .click();
  await page.getByRole("button", { name: "新しい個体を作成" }).click();
  await page.getByRole("textbox", { name: "管理名", exact: true }).fill(name);
  await page.getByRole("button", { name: "個体を保存" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

test("EXP計算と主要画面に重大なaxe違反がない", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByTestId("gained-exp")).toHaveText("1,050");
  await page.getByLabel("レベル計算を利用する").check();
  await expect(page.locator(".level-summary")).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);
});

test("個体作成、預け入れ、実績引き取り、Undo", async ({ page }) => {
  await page.goto("./");
  await createIndividual(page);
  const card = page.locator(".entity-card").filter({ hasText: "E2E育成個体" });
  await card.getByRole("button", { name: "預け入れ開始" }).click();
  await page.getByRole("button", { name: "開始する" }).click();
  await page
    .getByRole("navigation", { name: "メインナビゲーション" })
    .getByRole("button", { name: /^預け入れ/u })
    .click();
  await expect(
    page.getByRole("heading", { name: "E2E育成個体" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "引き取り完了" }).click();
  await page.getByLabel("実際の獲得EXP").fill("0");
  await page.getByLabel("実際の引き取り後Lv").fill("1");
  await page.getByLabel("次のレベルまでの残りEXP").fill("54");
  await page.getByRole("button", { name: "実行する" }).click();
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeVisible();
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(
    page.getByRole("heading", { name: "E2E育成個体" }),
  ).toBeVisible();
});

test("3種類の育成計画を生成できる", async ({ page }) => {
  await page.goto("./");
  await createIndividual(page, "計画E2E個体");
  const card = page.locator(".entity-card").filter({ hasText: "計画E2E個体" });
  await card.getByRole("button", { name: "育成計画" }).click();
  await page.getByRole("button", { name: "3案を生成" }).click();
  await expect(page.locator(".plan-option")).toHaveCount(3);
  await expect(page.locator(".plan-option")).toContainText([
    "最短到達",
    "セット節約",
    "7日単位",
  ]);
  await page
    .locator(".plan-option")
    .first()
    .getByRole("button", { name: "この案を保存" })
    .click();
  await page.getByRole("button", { name: "この回を開始" }).first().click();
  await expect(
    page.getByText("計画から預け入れを開始しました。"),
  ).toBeVisible();
});

test("バックアップを書き出して復元できる", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Blobダウンロードの代表検証はChromiumで実行します。",
  );
  await page.goto("./");
  await page.getByRole("button", { name: "履歴", exact: true }).click();
  await page.getByRole("tab", { name: "データ管理" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "バックアップを書き出す" }).click();
  const backupDownload = await downloadPromise;
  expect(backupDownload.suggestedFilename()).toMatch(
    /pokemon-sleep-backup-.*\.json/u,
  );
  const backupPath = await backupDownload.path();
  expect(backupPath).not.toBeNull();

  const safetyDownloadPromise = page.waitForEvent("download");
  await page.locator('input[type="file"]').setInputFiles(backupPath ?? "");
  expect((await safetyDownloadPromise).suggestedFilename()).toMatch(
    /restore-safety-backup-.*\.json/u,
  );
  await expect(page.getByText(/復元しました/u)).toBeVisible();
});

test("スナップショットを共有URLで受信できる", async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Clipboard APIの代表検証はChromiumで実行します。",
  );
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("./");
  await page.getByRole("button", { name: "履歴に保存" }).click();
  await page.getByRole("button", { name: "履歴", exact: true }).click();
  await page.getByRole("button", { name: "名前を付けて保存" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "保存" }).click();
  await page.getByRole("tab", { name: "スナップショット" }).click();
  await page.getByRole("button", { name: "共有" }).click();
  await page.getByRole("button", { name: "URLをコピー" }).click();
  const shareUrl = await page.evaluate(() => navigator.clipboard.readText());

  await page.goto(shareUrl);
  await expect(
    page.getByRole("heading", { name: "共有データを受信しました" }),
  ).toBeVisible();
});

test("テーマを切り替えられる", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "設定" }).click();
  await page.getByLabel("テーマ").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("調整後の入力とガイドを利用できる", async ({ page }) => {
  await page.goto("./");

  await expect(page.getByLabel("ポケモン").locator("option")).toHaveCount(242);
  await page.getByRole("radio", { name: "EXP下降" }).check();
  await expect(page.getByRole("radio", { name: "EXP下降" })).toBeChecked();
  await expect(page.getByText("目標レベル", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "ガイド", exact: true }).click();
  await expect(page.getByRole("heading", { name: "簡易ヘルプ" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "更新履歴" })).toBeVisible();

  await page.getByRole("button", { name: "設定", exact: true }).click();
  await expect(page.getByRole("heading", { name: "簡易ヘルプ" })).toHaveCount(
    0,
  );
  expect(
    await page.getByLabel("IANAタイムゾーン").locator("option").count(),
  ).toBeGreaterThan(20);
  await page.getByLabel("テーマ").selectOption("dark");

  await page.getByRole("button", { name: "個体", exact: true }).click();
  await page.getByRole("button", { name: "新しい個体を作成" }).click();
  const managementName = page.getByRole("textbox", {
    name: "管理名",
    exact: true,
  });
  const colors = await managementName.evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, text: style.color };
  });
  expect(colors.background).toBe("rgb(16, 40, 43)");
  expect(colors.text).toBe("rgb(229, 242, 239)");
});

test("キーボードでナビゲーションへ到達できる", async ({
  page,
  browserName,
}, testInfo) => {
  test.skip(
    testInfo.project.name.includes("iphone") ||
      testInfo.project.name.includes("android"),
    "ハードウェアキーボードの代表検証はデスクトップ構成で実行します。",
  );
  await page.goto("./");
  const tabKey = browserName === "webkit" ? "Alt+Tab" : "Tab";
  const navigation = page.getByRole("navigation", {
    name: "メインナビゲーション",
  });
  await page.keyboard.press(tabKey);
  await expect(
    navigation.getByRole("button", { name: "計算", exact: true }),
  ).toBeFocused();
  await page.keyboard.press(tabKey);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "預け入れ" })).toBeVisible();
});

test("PWAキャッシュからオフライン起動できる", async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Service Workerの代表検証はChromiumで実行します。",
  );
  await page.goto("./");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId("gained-exp")).toHaveText("1,050");
  await context.setOffline(false);
});

test("IndexedDBが使えない場合はlocalStorageへフォールバックする", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "フォールバックの代表検証はChromiumで実行します。",
  );
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
  });
  await page.goto("./");
  await expect(page.getByText(/簡易保存モード/u)).toBeVisible();
  await expect(page.getByTestId("gained-exp")).toHaveText("1,050");
});
