import { useEffect, useState } from "react";

import { useAppDataStore } from "../../app/stores/appDataStore";
import { getTimeZoneOptions } from "../../application/calculate/timeZoneOptions";
import { isIanaTimeZone } from "../../application/calculate/dateTime";
import type { PersistedSettings } from "../../domain/settings/types";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function formatBytes(bytes: number | undefined) {
  if (bytes === undefined) return "取得できません";
  return `${(bytes / 1024 / 1024).toLocaleString("ja-JP", { maximumFractionDigits: 1 })} MB`;
}

export function SettingsPage() {
  const settings = useAppDataStore((state) => state.settings);
  const updateSettings = useAppDataStore((state) => state.updateSettings);
  const histories = useAppDataStore((state) => state.histories);
  const snapshots = useAppDataStore((state) => state.snapshots);
  const plans = useAppDataStore((state) => state.plans);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [storage, setStorage] = useState<{
    usage: number | undefined;
    quota: number | undefined;
  }>({ usage: undefined, quota: undefined });
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(
    null,
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    void navigator.storage?.estimate().then((estimate) => {
      setStorage({ usage: estimate.usage, quota: estimate.quota });
    });
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const update = <K extends keyof Omit<PersistedSettings, "id" | "updatedAt">>(
    key: K,
    value: PersistedSettings[K],
  ) => void updateSettings({ [key]: value });

  const saveTimezone = () => {
    if (!isIanaTimeZone(timezone)) {
      setMessage("有効なIANAタイムゾーンを選択してください。");
      return;
    }
    void updateSettings({ timezone }).then(() =>
      setMessage("タイムゾーンを保存しました。"),
    );
  };

  const install = async () => {
    if (installPrompt === null) {
      setMessage(
        "このブラウザでは、ブラウザメニューの「アプリをインストール」を利用してください。",
      );
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setMessage(
      choice.outcome === "accepted"
        ? "インストールを開始しました。"
        : "インストールをキャンセルしました。",
    );
    setInstallPrompt(null);
  };

  return (
    <main className="management-page settings-page">
      <header className="page-heading-block">
        <p className="eyebrow">PREFERENCES</p>
        <h1>設定</h1>
        <p>表示、保存件数、既定入力、オフライン利用を管理します。</p>
      </header>
      {message !== "" && (
        <div className="inline-status" role="status">
          {message}
        </div>
      )}
      <div className="settings-grid">
        <section className="settings-card">
          <h2>表示</h2>
          <label>
            テーマ
            <select
              value={settings.theme}
              onChange={(event) =>
                update(
                  "theme",
                  event.target.value as PersistedSettings["theme"],
                )
              }
            >
              <option value="system">システム設定</option>
              <option value="light">ライト</option>
              <option value="dark">ダーク</option>
            </select>
          </label>
          <label>
            既定の入力方式
            <select
              value={settings.defaultInputMode}
              onChange={(event) =>
                update(
                  "defaultInputMode",
                  event.target.value as PersistedSettings["defaultInputMode"],
                )
              }
            >
              <option value="duration">経過時間</option>
              <option value="datetime">開始・終了日時</option>
            </select>
          </label>
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={settings.verificationMode}
              onChange={(event) =>
                update("verificationMode", event.target.checked)
              }
            />
            検証用の詳細情報を表示
          </label>
        </section>
        <section className="settings-card">
          <h2>日時</h2>
          <label>
            IANAタイムゾーン
            <select
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
            >
              {getTimeZoneOptions(timezone).map((timeZone) => (
                <option key={timeZone} value={timeZone}>
                  {timeZone}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={saveTimezone}>
            保存
          </button>
        </section>
        <section className="settings-card">
          <h2>履歴と容量</h2>
          <label>
            自動履歴の保存件数
            <select
              value={settings.historyLimit ?? "unlimited"}
              onChange={(event) =>
                update(
                  "historyLimit",
                  event.target.value === "unlimited"
                    ? null
                    : (Number(event.target.value) as 25 | 50 | 100),
                )
              }
            >
              <option value="25">25件</option>
              <option value="50">50件</option>
              <option value="100">100件</option>
              <option value="unlimited">無制限</option>
            </select>
          </label>
          <dl className="storage-stats">
            <div>
              <dt>使用量</dt>
              <dd>{formatBytes(storage.usage)}</dd>
            </div>
            <div>
              <dt>利用可能枠</dt>
              <dd>{formatBytes(storage.quota)}</dd>
            </div>
            <div>
              <dt>保存内容</dt>
              <dd>
                履歴 {histories.length} / スナップショット {snapshots.length} /
                計画 {plans.length}
              </dd>
            </div>
          </dl>
          <p>
            容量不足時は、名前付きスナップショットや個体を自動削除せず、履歴件数を減らしてください。
          </p>
        </section>
        <section className="settings-card">
          <h2>アプリとして利用</h2>
          <p>
            初回読み込み後は、計算・個体・履歴をオフラインでも利用できます。
          </p>
          <button
            type="button"
            className="primary-button"
            onClick={() => void install()}
          >
            インストール案内を表示
          </button>
        </section>
      </div>
    </main>
  );
}
