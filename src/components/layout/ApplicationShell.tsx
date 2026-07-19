import { lazy, Suspense, useCallback, useEffect, useState } from "react";

import { useAppDataStore } from "../../app/stores/appDataStore";
import messages from "../../i18n/ja.json";
import { PageErrorBoundary } from "../errors/PageErrorBoundary";
import { useModalFocus } from "../dialogs/useModalFocus";

const CalculatorPage = lazy(() =>
  import("../../features/calculator/CalculatorPage").then((module) => ({
    default: module.CalculatorPage,
  })),
);
const ActiveDepositPage = lazy(() =>
  import("../../features/deposits/ActiveDepositPage").then((module) => ({
    default: module.ActiveDepositPage,
  })),
);
const IndividualsPage = lazy(() =>
  import("../../features/individuals/IndividualsPage").then((module) => ({
    default: module.IndividualsPage,
  })),
);
const HistoryPage = lazy(() =>
  import("../../features/history/HistoryPage").then((module) => ({
    default: module.HistoryPage,
  })),
);
const SettingsPage = lazy(() =>
  import("../../features/settings/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  })),
);
const GuidePage = lazy(() =>
  import("../../features/guide/GuidePage").then((module) => ({
    default: module.GuidePage,
  })),
);

type Page =
  "calculator" | "deposit" | "individuals" | "history" | "guide" | "settings";

export function ApplicationShell() {
  const [page, setPage] = useState<Page>(() =>
    new URLSearchParams(location.hash.slice(1)).has("share")
      ? "history"
      : "calculator",
  );
  const initialize = useAppDataStore((state) => state.initialize);
  const initialized = useAppDataStore((state) => state.initialized);
  const loading = useAppDataStore((state) => state.loading);
  const error = useAppDataStore((state) => state.error);
  const clearError = useAppDataStore((state) => state.clearError);
  const storageMode = useAppDataStore((state) => state.storageMode);
  const activeDeposit = useAppDataStore((state) => state.activeDeposit);
  const pendingDeposit = useAppDataStore((state) => state.pendingDeposit);
  const resolveConflict = useAppDataStore(
    (state) => state.resolveDepositConflict,
  );
  const lastUndo = useAppDataStore((state) => state.lastUndo);
  const undo = useAppDataStore((state) => state.undoLastWithdrawal);
  const theme = useAppDataStore((state) => state.settings.theme);
  const closeConflict = useCallback(() => {
    void resolveConflict("abort");
  }, [resolveConflict]);
  const conflictDialogRef = useModalFocus(
    pendingDeposit !== null,
    closeConflict,
  );

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    const openIncomingShare = () => {
      if (new URLSearchParams(location.hash.slice(1)).has("share")) {
        setPage("history");
      }
    };
    window.addEventListener("hashchange", openIncomingShare);
    return () => window.removeEventListener("hashchange", openIncomingShare);
  }, []);

  useEffect(() => {
    if (theme === "system") {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = theme;
    }
  }, [theme]);

  return (
    <div className="app-frame">
      <nav className="main-nav" aria-label="メインナビゲーション">
        <button
          type="button"
          aria-current={page === "calculator" ? "page" : undefined}
          onClick={() => setPage("calculator")}
        >
          <span aria-hidden="true">⌁</span>
          {messages["nav.calculator"]}
        </button>
        <button
          type="button"
          aria-current={page === "deposit" ? "page" : undefined}
          onClick={() => setPage("deposit")}
        >
          <span aria-hidden="true">◷</span>
          {messages["nav.deposit"]}
          {activeDeposit !== null && (
            <i className="active-dot" aria-label="預け入れ中" />
          )}
        </button>
        <button
          type="button"
          aria-current={page === "individuals" ? "page" : undefined}
          onClick={() => setPage("individuals")}
        >
          <span aria-hidden="true">◇</span>
          {messages["nav.individuals"]}
        </button>
        <button
          type="button"
          aria-current={page === "history" ? "page" : undefined}
          onClick={() => setPage("history")}
        >
          <span aria-hidden="true">≋</span>
          履歴
        </button>
        <button
          type="button"
          aria-current={page === "guide" ? "page" : undefined}
          onClick={() => setPage("guide")}
        >
          <span aria-hidden="true">?</span>
          {messages["nav.guide"]}
        </button>
        <button
          type="button"
          aria-current={page === "settings" ? "page" : undefined}
          onClick={() => setPage("settings")}
        >
          <span aria-hidden="true">⚙</span>
          設定
        </button>
      </nav>

      {storageMode === "localstorage" && (
        <div className="storage-banner" role="status">
          {messages["storage.fallback"]}
        </div>
      )}
      {error !== null && (
        <div className="error-banner" role="alert">
          <span>
            {messages["storage.error"]} {error}
          </span>
          <button type="button" onClick={clearError}>
            {messages["storage.dismiss"]}
          </button>
        </div>
      )}

      {!initialized && loading ? (
        <main className="loading-screen" aria-busy="true">
          読み込み中…
        </main>
      ) : (
        <PageErrorBoundary pageKey={page}>
          <Suspense
            fallback={
              <main className="loading-screen" aria-busy="true">
                画面を読み込み中…
              </main>
            }
          >
            {page === "calculator" && <CalculatorPage />}
            {page === "deposit" && <ActiveDepositPage />}
            {page === "individuals" && <IndividualsPage />}
            {page === "history" && <HistoryPage />}
            {page === "guide" && <GuidePage />}
            {page === "settings" && <SettingsPage />}
          </Suspense>
        </PageErrorBoundary>
      )}

      {pendingDeposit !== null && (
        <div className="modal-backdrop">
          <section
            ref={conflictDialogRef}
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deposit-conflict-heading"
          >
            <h2 id="deposit-conflict-heading">
              {messages["deposit.conflictHeading"]}
            </h2>
            <p>{messages["deposit.conflictDescription"]}</p>
            <div className="modal-actions vertical-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => void resolveConflict("complete")}
              >
                {messages["deposit.switchComplete"]}
              </button>
              <button
                type="button"
                onClick={() => void resolveConflict("cancel")}
              >
                {messages["deposit.switchCancel"]}
              </button>
              <button
                type="button"
                onClick={() => void resolveConflict("abort")}
              >
                {messages["deposit.switchAbort"]}
              </button>
            </div>
          </section>
        </div>
      )}

      {lastUndo !== null && activeDeposit === null && (
        <div className="undo-toast" role="status">
          <span>{messages["deposit.completed"]}</span>
          <button type="button" onClick={() => void undo()}>
            {messages["deposit.undo"]}
          </button>
        </div>
      )}

      <footer className="app-footer">
        <p>{messages["footer.notice"]}</p>
        <a
          href="https://www.pokemonsleep.net/news/343231333934393334303235363832393531/"
          target="_blank"
          rel="noreferrer"
        >
          計算ルールの参照元（公式告知）
        </a>
      </footer>
    </div>
  );
}
