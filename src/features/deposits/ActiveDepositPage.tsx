import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppDataStore } from "../../app/stores/appDataStore";
import { calculateDepositProjection } from "../../application/deposits/depositService";
import { formatEpochInTimeZone } from "../../application/calculate/dateTime";
import { getExpCurve } from "../../domain/leveling/expCurve";
import { findTargetLevelTime } from "../../domain/leveling/findTargetLevelTime";
import type { RelaxSetting } from "../../domain/napIsland/types";
import messages from "../../i18n/ja.json";
import type { PlanWithdrawalUpdateMode } from "../../application/plans/growthPlanService";
import { useModalFocus } from "../../components/dialogs/useModalFocus";

const SEVEN_DAYS_MINUTES = 7 * 24 * 60;

function formatDuration(totalMinutes: number): string {
  const safe = Math.max(0, Math.floor(totalMinutes));
  const days = Math.floor(safe / (24 * 60));
  const hours = Math.floor((safe % (24 * 60)) / 60);
  const minutes = safe % 60;
  return [
    days > 0 ? `${days}日` : "",
    hours > 0 ? `${hours}時間` : "",
    `${minutes}分`,
  ]
    .filter(Boolean)
    .join(" ");
}

function requestedRelaxMinutes(setting: RelaxSetting): number {
  if (setting.mode === "none") return 0;
  return setting.mode === "tickets"
    ? setting.ticketCount * SEVEN_DAYS_MINUTES
    : setting.durationMinutes;
}

export function ActiveDepositPage() {
  const activeDeposit = useAppDataStore((state) => state.activeDeposit);
  const individuals = useAppDataStore((state) => state.individuals);
  const complete = useAppDataStore((state) => state.completeActiveDeposit);
  const cancel = useAppDataStore((state) => state.cancelActiveDeposit);
  const [now, setNow] = useState(() => Date.now());
  const [confirmation, setConfirmation] = useState<
    "complete" | "cancel" | null
  >(null);
  const [actualExp, setActualExp] = useState("");
  const [actualLevel, setActualLevel] = useState("");
  const [actualRemaining, setActualRemaining] = useState("");
  const [actualRelaxMode, setActualRelaxMode] =
    useState<RelaxSetting["mode"]>("none");
  const [actualRelaxAmount, setActualRelaxAmount] = useState("");
  const [note, setNote] = useState("");
  const [appliedSource, setAppliedSource] = useState<
    "actual-exp" | "actual-level"
  >("actual-level");
  const [planUpdateMode, setPlanUpdateMode] =
    useState<PlanWithdrawalUpdateMode>("keep-dates");
  const closeConfirmation = useCallback(() => setConfirmation(null), []);
  const confirmationDialogRef = useModalFocus(
    confirmation !== null,
    closeConfirmation,
  );

  useEffect(() => {
    const update = () => {
      if (!document.hidden) setNow(Date.now());
    };
    const interval = window.setInterval(update, 60_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  const projection = useMemo(
    () =>
      activeDeposit === null
        ? null
        : calculateDepositProjection(activeDeposit, now),
    [activeDeposit, now],
  );
  const individual =
    activeDeposit?.individualId === null || activeDeposit === null
      ? null
      : (individuals.find(({ id }) => id === activeDeposit.individualId) ??
        null);

  let nextLevelRemaining: number | null = null;
  let targetLevelRemaining: number | null = null;
  if (activeDeposit !== null && projection !== null) {
    const snapshot = activeDeposit.calculationSnapshot;
    const levelState = snapshot.levelState;
    if (levelState !== null && levelState.level < snapshot.levelCap) {
      const next = findTargetLevelTime({
        currentState: levelState,
        targetLevel: levelState.level + 1,
        curve: getExpCurve(snapshot.expType),
        relaxSetting: activeDeposit.relaxSetting,
        natureMultiplier: snapshot.natureMultiplier,
      });
      nextLevelRemaining =
        next.stayMinutes === null
          ? null
          : Math.max(0, next.stayMinutes - projection.stayMinutes);
    }
    if (
      levelState !== null &&
      individual !== null &&
      individual.targetLevel !== null
    ) {
      const target = findTargetLevelTime({
        currentState: levelState,
        targetLevel: individual.targetLevel,
        curve: getExpCurve(snapshot.expType),
        relaxSetting: activeDeposit.relaxSetting,
        natureMultiplier: snapshot.natureMultiplier,
      });
      targetLevelRemaining =
        target.stayMinutes === null
          ? null
          : Math.max(0, target.stayMinutes - projection.stayMinutes);
    }
  }

  const finish = async () => {
    if (confirmation === "complete") {
      const hasActualLevel =
        actualLevel !== "" &&
        (actualRemaining !== "" || Number(actualLevel) === 70);
      const hasActual =
        actualExp !== "" ||
        hasActualLevel ||
        note.trim() !== "" ||
        actualRelaxMode !== activeDeposit?.relaxSetting.mode;
      const relaxSetting: RelaxSetting =
        actualRelaxMode === "none"
          ? { mode: "none" }
          : actualRelaxMode === "tickets"
            ? {
                mode: "tickets",
                ticketCount: Math.max(0, Number(actualRelaxAmount) || 0),
              }
            : {
                mode: "duration",
                durationMinutes: Math.max(0, Number(actualRelaxAmount) || 0),
              };
      await complete(
        !hasActual
          ? undefined
          : {
              actualExp:
                actualExp === "" ? null : Math.max(0, Number(actualExp)),
              levelState: hasActualLevel
                ? {
                    level: Number(actualLevel),
                    remainingExpToNextLevel:
                      Number(actualLevel) === 70
                        ? null
                        : Number(actualRemaining),
                  }
                : null,
              relaxSetting,
              note: note.trim(),
              appliedSource:
                hasActualLevel && actualExp !== ""
                  ? appliedSource
                  : hasActualLevel
                    ? "actual-level"
                    : actualExp !== ""
                      ? "actual-exp"
                      : "prediction",
            },
        planUpdateMode,
      );
    }
    if (confirmation === "cancel") await cancel();
    setConfirmation(null);
  };

  const openCompletion = () => {
    if (activeDeposit !== null) {
      setActualRelaxMode(activeDeposit.relaxSetting.mode);
      setActualRelaxAmount(
        activeDeposit.relaxSetting.mode === "none"
          ? ""
          : String(
              activeDeposit.relaxSetting.mode === "tickets"
                ? activeDeposit.relaxSetting.ticketCount
                : activeDeposit.relaxSetting.durationMinutes,
            ),
      );
    }
    setActualExp("");
    setActualLevel("");
    setActualRemaining("");
    setNote("");
    setAppliedSource("actual-level");
    setConfirmation("complete");
  };

  return (
    <main className="management-page deposit-page">
      <header className="page-heading-block">
        <p className="eyebrow">ACTIVE SESSION</p>
        <h1>{messages["deposit.heading"]}</h1>
        <p>{messages["deposit.description"]}</p>
      </header>

      {activeDeposit === null || projection === null ? (
        <section className="empty-state deposit-empty">
          <div className="rest-island" aria-hidden="true">
            <span />
          </div>
          <p>{messages["deposit.empty"]}</p>
        </section>
      ) : (
        <section className="active-deposit-card">
          <div className="active-deposit-heading">
            <div>
              <span>預け入れ中</span>
              <h2>{activeDeposit.calculationSnapshot.displayName}</h2>
            </div>
            <div className="live-badge">
              <i /> LIVE
            </div>
          </div>

          <div className="deposit-hero-result">
            <div>
              <span>{messages["deposit.elapsed"]}</span>
              <strong>{formatDuration(projection.stayMinutes)}</strong>
            </div>
            <div>
              <span>{messages["deposit.predictedExp"]}</span>
              <strong>
                {projection.expResult.finalExp.toLocaleString("ja-JP")} EXP
              </strong>
            </div>
            <div>
              <span>{messages["deposit.predictedLevel"]}</span>
              <strong>
                {projection.levelResult === null
                  ? "—"
                  : `Lv.${projection.levelResult.afterLevel}`}
              </strong>
            </div>
          </div>

          <dl className="deposit-details">
            <div>
              <dt>{messages["deposit.startedAt"]}</dt>
              <dd>
                {formatEpochInTimeZone(
                  Date.parse(activeDeposit.startedAt),
                  activeDeposit.timezone,
                )}
              </dd>
            </div>
            <div>
              <dt>{messages["deposit.sevenDayRemaining"]}</dt>
              <dd>
                {formatDuration(
                  Math.max(0, SEVEN_DAYS_MINUTES - projection.stayMinutes),
                )}
              </dd>
            </div>
            <div>
              <dt>{messages["deposit.relaxRemaining"]}</dt>
              <dd>
                {activeDeposit.relaxSetting.mode === "none"
                  ? messages["common.none"]
                  : formatDuration(
                      Math.max(
                        0,
                        requestedRelaxMinutes(activeDeposit.relaxSetting) -
                          projection.stayMinutes,
                      ),
                    )}
              </dd>
            </div>
            <div>
              <dt>次レベルまで</dt>
              <dd>
                {nextLevelRemaining === null
                  ? "—"
                  : formatDuration(nextLevelRemaining)}
              </dd>
            </div>
            {targetLevelRemaining !== null && (
              <div>
                <dt>目標レベルまで</dt>
                <dd>{formatDuration(targetLevelRemaining)}</dd>
              </div>
            )}
          </dl>

          <div className="deposit-actions">
            <button
              type="button"
              className="primary-button"
              onClick={openCompletion}
            >
              {messages["deposit.complete"]}
            </button>
            <button
              type="button"
              className="danger-button"
              onClick={() => setConfirmation("cancel")}
            >
              {messages["deposit.cancel"]}
            </button>
          </div>
        </section>
      )}

      {confirmation !== null && (
        <div className="modal-backdrop">
          <section
            ref={confirmationDialogRef}
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="withdrawal-confirm-heading"
          >
            <h2 id="withdrawal-confirm-heading">
              {confirmation === "complete"
                ? messages["deposit.complete"]
                : messages["deposit.cancel"]}
            </h2>
            <p>
              {confirmation === "complete"
                ? messages["deposit.confirmComplete"]
                : messages["deposit.confirmCancel"]}
            </p>
            {confirmation === "complete" && (
              <div className="actual-result-form">
                <p className="form-hint">
                  ゲーム内実績は任意です。未入力なら予測値を個体へ反映します。
                </p>
                <div className="two-column-fields">
                  <label>
                    実際の獲得EXP
                    <input
                      type="number"
                      min="0"
                      value={actualExp}
                      onChange={(event) => setActualExp(event.target.value)}
                    />
                  </label>
                  <label>
                    実際の引き取り後Lv
                    <input
                      type="number"
                      min="1"
                      max="70"
                      value={actualLevel}
                      onChange={(event) => setActualLevel(event.target.value)}
                    />
                  </label>
                  <label>
                    次のレベルまでの残りEXP
                    <input
                      type="number"
                      min="0"
                      disabled={Number(actualLevel) === 70}
                      value={actualRemaining}
                      onChange={(event) =>
                        setActualRemaining(event.target.value)
                      }
                    />
                  </label>
                  <label>
                    実際のリラックスセット
                    <select
                      value={actualRelaxMode}
                      onChange={(event) =>
                        setActualRelaxMode(
                          event.target.value as RelaxSetting["mode"],
                        )
                      }
                    >
                      <option value="none">なし</option>
                      <option value="tickets">チケット枚数</option>
                      <option value="duration">適用時間</option>
                    </select>
                  </label>
                  {actualRelaxMode !== "none" && (
                    <label>
                      {actualRelaxMode === "tickets" ? "枚数" : "適用分数"}
                      <input
                        type="number"
                        min="0"
                        value={actualRelaxAmount}
                        onChange={(event) =>
                          setActualRelaxAmount(event.target.value)
                        }
                      />
                    </label>
                  )}
                </div>
                {actualExp !== "" && actualLevel !== "" && (
                  <label>
                    EXPとレベル状態が異なる場合の反映値
                    <select
                      value={appliedSource}
                      onChange={(event) =>
                        setAppliedSource(
                          event.target.value as "actual-exp" | "actual-level",
                        )
                      }
                    >
                      <option value="actual-level">実際のレベル状態</option>
                      <option value="actual-exp">実績EXPから計算</option>
                    </select>
                  </label>
                )}
                <label>
                  メモ
                  <textarea
                    maxLength={1000}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </label>
                {activeDeposit?.sourcePlanId !== null &&
                  activeDeposit?.sourcePlanId !== undefined && (
                    <label>
                      育成計画への反映
                      <select
                        value={planUpdateMode}
                        onChange={(event) =>
                          setPlanUpdateMode(
                            event.target.value as PlanWithdrawalUpdateMode,
                          )
                        }
                      >
                        <option value="keep-dates">
                          元の予定日を維持して再計算
                        </option>
                        <option value="continuous">実績終了から連続配置</option>
                        <option value="regenerate">目標から計画を再生成</option>
                        <option value="none">今回は更新しない</option>
                      </select>
                    </label>
                  )}
              </div>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className={
                  confirmation === "complete"
                    ? "primary-button"
                    : "danger-button"
                }
                onClick={() => void finish()}
              >
                実行する
              </button>
              <button type="button" onClick={closeConfirmation}>
                戻る
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
