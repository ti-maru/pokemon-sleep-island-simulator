import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppDataStore } from "../../app/stores/appDataStore";
import {
  createSharePayload,
  decodeSharePayload,
  encodeSharePayload,
  parseBackup,
} from "../../application/export/dataExportService";
import type { BackupEnvelope } from "../../domain/backup/types";
import type {
  CalculationHistoryRecord,
  NamedSnapshot,
} from "../../domain/history/types";
import type { SharePayload } from "../../domain/sharing/schema";
import { useModalFocus } from "../../components/dialogs/useModalFocus";

type Tab = "history" | "snapshots" | "data";

function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function expDifference(history: CalculationHistoryRecord) {
  const actual = history.actualResult?.actualExp;
  return actual === null || actual === undefined
    ? null
    : actual - history.originalResult.finalExp;
}

function readIncomingShare(): { payload: SharePayload | null; error: string } {
  const encoded = new URLSearchParams(location.hash.slice(1)).get("share");
  if (encoded === null) return { payload: null, error: "" };
  try {
    return { payload: decodeSharePayload(encoded), error: "" };
  } catch {
    return { payload: null, error: "共有データを検証できませんでした。" };
  }
}

function ResultSummary({
  history,
}: {
  readonly history: CalculationHistoryRecord;
}) {
  const difference = expDifference(history);
  return (
    <dl className="history-result-grid">
      <div>
        <dt>予測EXP</dt>
        <dd>{history.originalResult.finalExp.toLocaleString("ja-JP")}</dd>
      </div>
      <div>
        <dt>実績EXP</dt>
        <dd>
          {history.actualResult?.actualExp?.toLocaleString("ja-JP") ?? "—"}
        </dd>
      </div>
      <div>
        <dt>差分</dt>
        <dd>
          {difference === null
            ? "—"
            : `${difference >= 0 ? "+" : ""}${difference}`}
        </dd>
      </div>
      <div>
        <dt>滞在</dt>
        <dd>{history.inputSnapshot.stayMinutes.toLocaleString("ja-JP")}分</dd>
      </div>
    </dl>
  );
}

export function HistoryPage() {
  const initialShare = useMemo(() => readIncomingShare(), []);
  const histories = useAppDataStore((state) => state.histories);
  const snapshots = useAppDataStore((state) => state.snapshots);
  const createSnapshot = useAppDataStore((state) => state.createSnapshot);
  const deleteHistory = useAppDataStore((state) => state.deleteHistory);
  const deleteSnapshot = useAppDataStore((state) => state.deleteSnapshot);
  const exportBackup = useAppDataStore((state) => state.exportBackup);
  const exportCsv = useAppDataStore((state) => state.exportCsv);
  const exportVerificationJson = useAppDataStore(
    (state) => state.exportVerificationJson,
  );
  const recalculateHistory = useAppDataStore(
    (state) => state.recalculateHistory,
  );
  const importBackup = useAppDataStore((state) => state.importBackup);
  const settings = useAppDataStore((state) => state.settings);
  const [tab, setTab] = useState<Tab>("history");
  const [snapshotTarget, setSnapshotTarget] =
    useState<CalculationHistoryRecord | null>(null);
  const [snapshotName, setSnapshotName] = useState("");
  const [compareIds, setCompareIds] = useState<readonly string[]>([]);
  const [shareTarget, setShareTarget] = useState<NamedSnapshot | null>(null);
  const [shareScope, setShareScope] =
    useState<SharePayload["scope"]>("calculation");
  const [incomingShare, setIncomingShare] = useState<SharePayload | null>(
    initialShare.payload,
  );
  const [message, setMessage] = useState(initialShare.error);
  const [restoreMode, setRestoreMode] = useState<
    "merge" | "replace" | "select"
  >("merge");
  const [pendingRestore, setPendingRestore] = useState<BackupEnvelope | null>(
    null,
  );
  const [restoreSelection, setRestoreSelection] = useState({
    individuals: true,
    sessions: true,
    plans: true,
    histories: true,
    snapshots: true,
    settings: true,
  });
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(25);
  const fileInput = useRef<HTMLInputElement>(null);
  const closeDialogs = useCallback(() => {
    setSnapshotTarget(null);
    setShareTarget(null);
    setIncomingShare(null);
    setPendingRestore(null);
  }, []);
  const dialogRef = useModalFocus(
    snapshotTarget !== null ||
      shareTarget !== null ||
      incomingShare !== null ||
      pendingRestore !== null,
    closeDialogs,
  );

  useEffect(() => {
    const receiveSharedData = () => {
      const nextShare = readIncomingShare();
      setIncomingShare(nextShare.payload);
      setMessage(nextShare.error);
    };
    window.addEventListener("hashchange", receiveSharedData);
    return () => window.removeEventListener("hashchange", receiveSharedData);
  }, []);

  const compared = useMemo(
    () =>
      compareIds
        .map((id) => snapshots.find((snapshot) => snapshot.id === id))
        .filter(Boolean) as NamedSnapshot[],
    [compareIds, snapshots],
  );

  const saveSnapshot = async () => {
    if (snapshotTarget === null || snapshotName.trim() === "") return;
    await createSnapshot(snapshotName.trim(), snapshotTarget);
    setSnapshotTarget(null);
    setSnapshotName("");
    setMessage("スナップショットを保存しました。");
  };

  const copyShareUrl = async () => {
    if (shareTarget === null) return;
    const encoded = encodeSharePayload(
      createSharePayload(shareTarget, shareScope),
    );
    const url = `${location.origin}${location.pathname}#share=${encoded}`;
    if (url.length > 8_000) {
      setMessage("共有URLが長すぎます。JSONバックアップを利用してください。");
      return;
    }
    await navigator.clipboard.writeText(url);
    setMessage(
      "共有URLをコピーしました。共有範囲を確認してから送信してください。",
    );
    setShareTarget(null);
  };

  const readBackupFile = async (file: File) => {
    try {
      const serialized = await file.text();
      if (restoreMode === "select") {
        setPendingRestore(parseBackup(serialized));
        return;
      }
      const safetyBackup = await importBackup(serialized, restoreMode);
      downloadText(
        `restore-safety-backup-${Date.now()}.json`,
        safetyBackup,
        "application/json",
      );
      setMessage(
        "復元しました。復元前データの安全バックアップも保存しました。",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `復元できません: ${error.message}`
          : "復元できませんでした。",
      );
    } finally {
      if (fileInput.current !== null) fileInput.current.value = "";
    }
  };

  const restoreSelected = async () => {
    if (pendingRestore === null) return;
    const selectedBackup: BackupEnvelope = {
      ...pendingRestore,
      payload: {
        individuals: restoreSelection.individuals
          ? pendingRestore.payload.individuals
          : [],
        sessions: restoreSelection.sessions
          ? pendingRestore.payload.sessions
          : [],
        plans: restoreSelection.plans ? pendingRestore.payload.plans : [],
        histories: restoreSelection.histories
          ? pendingRestore.payload.histories
          : [],
        snapshots: restoreSelection.snapshots
          ? pendingRestore.payload.snapshots
          : [],
        settings: restoreSelection.settings
          ? pendingRestore.payload.settings
          : settings,
      },
    };
    const safetyBackup = await importBackup(
      JSON.stringify(selectedBackup),
      "merge",
    );
    downloadText(
      `restore-safety-backup-${Date.now()}.json`,
      safetyBackup,
      "application/json",
    );
    setPendingRestore(null);
    setMessage(
      "選択したデータを統合しました。復元前の安全バックアップも保存しました。",
    );
  };

  return (
    <main className="management-page history-page">
      <header className="page-heading-block">
        <p className="eyebrow">RECORDS &amp; SHARE</p>
        <h1>履歴</h1>
        <p>
          計算時点のルールを保った記録、実績差分、名前付きスナップショットを管理します。
        </p>
      </header>

      {message !== "" && (
        <div className="inline-status" role="status">
          {message}
        </div>
      )}

      <div className="history-tabs" role="tablist" aria-label="履歴の種類">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "history"}
          onClick={() => setTab("history")}
        >
          自動履歴
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "snapshots"}
          onClick={() => setTab("snapshots")}
        >
          スナップショット
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "data"}
          onClick={() => setTab("data")}
        >
          データ管理
        </button>
      </div>

      {tab === "history" && (
        <section className="history-list" aria-label="自動履歴">
          {histories.length === 0 && (
            <div className="empty-state">
              <p>
                まだ履歴がありません。計算結果の保存や引き取りで記録されます。
              </p>
            </div>
          )}
          {histories.slice(0, visibleHistoryCount).map((history) => (
            <article className="history-card" key={history.id}>
              <header>
                <div>
                  <span>
                    {history.kind === "withdrawal" ? "引き取り" : "計算"}
                  </span>
                  <h2>{formatDate(history.createdAt)}</h2>
                </div>
                <small>{history.originalResult.ruleSetId}</small>
              </header>
              <ResultSummary history={history} />
              {history.latestRecalculatedResult !== null && (
                <p className="history-note">
                  最新ルール再計算:{" "}
                  {history.latestRecalculatedResult.finalExp.toLocaleString(
                    "ja-JP",
                  )}{" "}
                  EXP（元の予測との差{" "}
                  {history.latestRecalculatedResult.finalExp -
                    history.originalResult.finalExp >=
                  0
                    ? "+"
                    : ""}
                  {history.latestRecalculatedResult.finalExp -
                    history.originalResult.finalExp}
                  ）
                </p>
              )}
              {history.actualResult?.note && (
                <p className="history-note">{history.actualResult.note}</p>
              )}
              <div className="card-actions">
                <button
                  type="button"
                  onClick={() => {
                    setSnapshotTarget(history);
                    setSnapshotName(`記録 ${formatDate(history.createdAt)}`);
                  }}
                >
                  名前を付けて保存
                </button>
                <button
                  type="button"
                  onClick={() => void recalculateHistory(history.id)}
                >
                  最新ルールで再計算
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => void deleteHistory(history.id)}
                >
                  削除
                </button>
              </div>
            </article>
          ))}
          {visibleHistoryCount < histories.length && (
            <button
              type="button"
              className="load-more-button"
              onClick={() => setVisibleHistoryCount((count) => count + 25)}
            >
              さらに25件表示
            </button>
          )}
        </section>
      )}

      {tab === "snapshots" && (
        <section>
          {snapshots.length === 0 && (
            <div className="empty-state">
              <p>名前付きスナップショットはまだありません。</p>
            </div>
          )}
          <div className="history-list">
            {snapshots.map((snapshot) => (
              <article className="history-card" key={snapshot.id}>
                <header>
                  <div>
                    <span>SNAPSHOT</span>
                    <h2>{snapshot.name}</h2>
                  </div>
                  <small>{formatDate(snapshot.createdAt)}</small>
                </header>
                <ResultSummary history={snapshot.historyRecord} />
                <div className="card-actions">
                  <label className="compare-check">
                    <input
                      type="checkbox"
                      checked={compareIds.includes(snapshot.id)}
                      onChange={(event) =>
                        setCompareIds((ids) =>
                          event.target.checked
                            ? [...ids.slice(-1), snapshot.id]
                            : ids.filter((id) => id !== snapshot.id),
                        )
                      }
                    />
                    比較
                  </label>
                  <button
                    type="button"
                    onClick={() => setShareTarget(snapshot)}
                  >
                    共有
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void createSnapshot(
                        `${snapshot.name} のコピー`,
                        snapshot.historyRecord,
                      )
                    }
                  >
                    複製
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => void deleteSnapshot(snapshot.id)}
                  >
                    削除
                  </button>
                </div>
              </article>
            ))}
          </div>
          {compared.length === 2 && (
            <section
              className="comparison-panel"
              aria-label="スナップショット比較"
            >
              <h2>比較</h2>
              <div>
                <strong>{compared[0]?.name}</strong>
                <span>↔</span>
                <strong>{compared[1]?.name}</strong>
              </div>
              <p>
                予測EXP差:{" "}
                {Math.abs(
                  (compared[0]?.historyRecord.originalResult.finalExp ?? 0) -
                    (compared[1]?.historyRecord.originalResult.finalExp ?? 0),
                ).toLocaleString("ja-JP")}{" "}
                EXP
              </p>
            </section>
          )}
        </section>
      )}

      {tab === "data" && (
        <section className="data-management-grid">
          <article className="data-card">
            <h2>JSONバックアップ</h2>
            <p>
              個体・預け入れ・履歴・スナップショットを人間可読JSONで保存します。暗号化されず、個体名や履歴を閲覧できるため、他者へ渡したり公開ストレージへ置いたりしないでください。不要になったファイルはご自身で削除してください。
            </p>
            <button
              type="button"
              className="primary-button"
              onClick={() =>
                void exportBackup().then((text) =>
                  downloadText(
                    `pokemon-sleep-backup-${Date.now()}.json`,
                    text,
                    "application/json",
                  ),
                )
              }
            >
              バックアップを書き出す
            </button>
          </article>
          <article className="data-card">
            <h2>バックアップ復元</h2>
            <p>復元前には現在データの自動バックアップをダウンロードします。</p>
            <label>
              復元方法
              <select
                value={restoreMode}
                onChange={(event) =>
                  setRestoreMode(
                    event.target.value as "merge" | "replace" | "select",
                  )
                }
              >
                <option value="merge">既存データへ統合</option>
                <option value="replace">すべて置き換え</option>
                <option value="select">内容を確認して個別選択</option>
              </select>
            </label>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readBackupFile(file);
              }}
            />
          </article>
          <article className="data-card">
            <h2>検証データ</h2>
            <p>個体名を含まない引き取り実績をCSVまたはJSONで出力します。</p>
            <div className="card-actions">
              <button
                type="button"
                onClick={() =>
                  downloadText(
                    "withdrawal-verification.csv",
                    exportCsv(),
                    "text/csv;charset=utf-8",
                  )
                }
              >
                CSV
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadText(
                    "withdrawal-verification.json",
                    exportVerificationJson(),
                    "application/json",
                  )
                }
              >
                JSON
              </button>
            </div>
          </article>
        </section>
      )}

      {snapshotTarget !== null && (
        <div className="modal-backdrop">
          <section
            ref={dialogRef}
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="snapshot-heading"
          >
            <h2 id="snapshot-heading">スナップショットを保存</h2>
            <label>
              名前
              <input
                value={snapshotName}
                maxLength={100}
                onChange={(event) => setSnapshotName(event.target.value)}
              />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => void saveSnapshot()}
              >
                保存
              </button>
              <button type="button" onClick={() => setSnapshotTarget(null)}>
                戻る
              </button>
            </div>
          </section>
        </div>
      )}

      {shareTarget !== null && (
        <div className="modal-backdrop">
          <section
            ref={dialogRef}
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-heading"
          >
            <h2 id="share-heading">共有範囲を確認</h2>
            <label>
              含める情報
              <select
                value={shareScope}
                onChange={(event) =>
                  setShareScope(event.target.value as SharePayload["scope"])
                }
              >
                <option value="calculation">計算条件のみ</option>
                <option value="growth">育成状況を含む</option>
                <option value="all">個体名を含むすべて</option>
              </select>
            </label>
            <p>共有URLを受け取った側では、確認するまで端末へ保存されません。</p>
            <div className="modal-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => void copyShareUrl()}
              >
                URLをコピー
              </button>
              <button type="button" onClick={() => setShareTarget(null)}>
                戻る
              </button>
            </div>
          </section>
        </div>
      )}

      {incomingShare !== null && (
        <div className="modal-backdrop">
          <section
            ref={dialogRef}
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="incoming-share-heading"
          >
            <h2 id="incoming-share-heading">共有データを受信しました</h2>
            <p>
              予測EXP:{" "}
              {incomingShare.historyRecord.originalResult.finalExp.toLocaleString(
                "ja-JP",
              )}
              。一時表示だけでは端末内に保存しません。
            </p>
            <ResultSummary history={incomingShare.historyRecord} />
            <div className="modal-actions vertical-actions">
              <button type="button" onClick={() => setIncomingShare(null)}>
                一時利用
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  void createSnapshot(
                    incomingShare.name ?? "共有スナップショット",
                    incomingShare.historyRecord,
                  ).then(() => {
                    setIncomingShare(null);
                    history.replaceState(null, "", location.pathname);
                  })
                }
              >
                保存
              </button>
              <button
                type="button"
                onClick={() => {
                  setIncomingShare(null);
                  history.replaceState(null, "", location.pathname);
                }}
              >
                キャンセル
              </button>
            </div>
          </section>
        </div>
      )}

      {pendingRestore !== null && (
        <div className="modal-backdrop">
          <section
            ref={dialogRef}
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="select-restore-heading"
          >
            <h2 id="select-restore-heading">復元する内容を選択</h2>
            <p>
              選択したカテゴリだけを既存データへ統合します。同じIDはバックアップ側で更新します。
            </p>
            <div className="restore-selection">
              {(
                [
                  [
                    "individuals",
                    `個体 ${pendingRestore.payload.individuals.length}件`,
                  ],
                  [
                    "sessions",
                    `預け入れ ${pendingRestore.payload.sessions.length}件`,
                  ],
                  ["plans", `計画 ${pendingRestore.payload.plans.length}件`],
                  [
                    "histories",
                    `履歴 ${pendingRestore.payload.histories.length}件`,
                  ],
                  [
                    "snapshots",
                    `スナップショット ${pendingRestore.payload.snapshots.length}件`,
                  ],
                  ["settings", "設定"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={restoreSelection[key]}
                    onChange={(event) =>
                      setRestoreSelection((selection) => ({
                        ...selection,
                        [key]: event.target.checked,
                      }))
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => void restoreSelected()}
              >
                選択内容を復元
              </button>
              <button type="button" onClick={() => setPendingRestore(null)}>
                戻る
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
