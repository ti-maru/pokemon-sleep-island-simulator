import { useCallback, useMemo, useState } from "react";

import { useAppDataStore } from "../../app/stores/appDataStore";
import {
  toDateTimeLocalValue,
  zonedDateTimeToEpochMs,
} from "../../application/calculate/dateTime";
import type { PokemonIndividual } from "../../domain/individuals/types";
import type { GrowthPlan, PlanSegment } from "../../domain/plans/types";
import type { RelaxSetting } from "../../domain/napIsland/types";
import { useModalFocus } from "../../components/dialogs/useModalFocus";

function formatDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function strategyName(strategy: GrowthPlan["strategy"]) {
  return strategy === "fastest"
    ? "最短到達"
    : strategy === "ticket-saving"
      ? "セット節約"
      : strategy === "seven-day"
        ? "7日単位"
        : "カスタム";
}

function relaxLabel(setting: RelaxSetting) {
  return setting.mode === "none"
    ? "なし"
    : setting.mode === "tickets"
      ? `${setting.ticketCount}枚`
      : `${setting.durationMinutes}分`;
}

export function GrowthPlansPanel({
  individual,
  onClose,
}: {
  readonly individual: PokemonIndividual;
  readonly onClose: () => void;
}) {
  const plans = useAppDataStore((state) => state.plans);
  const generate = useAppDataStore((state) => state.generatePlanOptions);
  const savePlan = useAppDataStore((state) => state.savePlan);
  const deletePlan = useAppDataStore((state) => state.deletePlan);
  const recalculatePlan = useAppDataStore((state) => state.recalculatePlan);
  const startSegment = useAppDataStore((state) => state.startPlanSegment);
  const defaultTimezone = useAppDataStore((state) => state.settings.timezone);
  const timezone = individual.targetTimezone ?? defaultTimezone;
  const [now] = useState(() => Date.now());
  const [startAt, setStartAt] = useState(() =>
    toDateTimeLocalValue(now, timezone),
  );
  const [targetLevel, setTargetLevel] = useState(
    individual.targetLevel ?? Math.min(70, individual.currentLevel + 10),
  );
  const [targetDate, setTargetDate] = useState(() =>
    individual.targetDate === null
      ? toDateTimeLocalValue(now + 90 * 24 * 60 * 60_000, timezone)
      : toDateTimeLocalValue(Date.parse(individual.targetDate), timezone),
  );
  const [options, setOptions] = useState<readonly GrowthPlan[]>([]);
  const [editing, setEditing] = useState<GrowthPlan | null>(null);
  const [message, setMessage] = useState("");
  const closeEditor = useCallback(() => setEditing(null), []);
  const editorDialogRef = useModalFocus(editing !== null, closeEditor);
  const saved = useMemo(
    () => plans.filter(({ individualId }) => individualId === individual.id),
    [individual.id, plans],
  );

  const generateOptions = () => {
    try {
      setOptions(
        generate({
          individualId: individual.id,
          targetLevel,
          targetDate:
            targetDate === ""
              ? null
              : new Date(
                  zonedDateTimeToEpochMs(targetDate, timezone),
                ).toISOString(),
          startAt: new Date(
            zonedDateTimeToEpochMs(startAt, timezone),
          ).toISOString(),
          timezone,
        }),
      );
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "計画を生成できませんでした。",
      );
    }
  };

  const editSegment = (
    segmentId: string,
    transform: (segment: PlanSegment) => PlanSegment,
  ) => {
    setEditing((plan) =>
      plan === null
        ? null
        : {
            ...plan,
            strategy: "custom",
            segments: plan.segments.map((segment) =>
              segment.id === segmentId ? transform(segment) : segment,
            ),
          },
    );
  };

  return (
    <section className="plan-workspace" aria-labelledby="plan-heading">
      <header className="plan-workspace-heading">
        <div>
          <p className="eyebrow">GROWTH PLAN</p>
          <h2 id="plan-heading">{individual.displayName}の育成計画</h2>
        </div>
        <button type="button" onClick={onClose}>
          閉じる
        </button>
      </header>

      {message !== "" && (
        <p className="form-alert" role="alert">
          {message}
        </p>
      )}
      <div className="plan-generator">
        <label>
          開始日時
          <input
            type="datetime-local"
            value={startAt}
            onChange={(event) => setStartAt(event.target.value)}
          />
        </label>
        <label>
          目標レベル
          <input
            type="number"
            min={individual.currentLevel}
            max="70"
            value={targetLevel}
            onChange={(event) => setTargetLevel(Number(event.target.value))}
          />
        </label>
        <label>
          目標日時
          <input
            type="datetime-local"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="primary-button"
          onClick={generateOptions}
        >
          3案を生成
        </button>
      </div>

      {options.length > 0 && (
        <div className="plan-options">
          {options.map((plan) => (
            <article className="plan-option" key={plan.id}>
              <span>{strategyName(plan.strategy)}</span>
              <h3>
                {plan.summary.reachable
                  ? `Lv.${plan.targetLevel}へ到達`
                  : `最大 Lv.${plan.summary.maximumLevel}`}
              </h3>
              <dl>
                <div>
                  <dt>完了予定</dt>
                  <dd>
                    {plan.summary.expectedEndAt === null
                      ? "—"
                      : formatDate(plan.summary.expectedEndAt, timezone)}
                  </dd>
                </div>
                <div>
                  <dt>セット</dt>
                  <dd>{plan.summary.ticketCount}枚</dd>
                </div>
                <div>
                  <dt>預け入れ回数</dt>
                  <dd>{plan.segments.length}回</dd>
                </div>
                <div>
                  <dt>不足EXP</dt>
                  <dd>{plan.summary.missingExp.toLocaleString("ja-JP")}</dd>
                </div>
              </dl>
              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  void savePlan(plan).then(() => {
                    setOptions([]);
                    setMessage("計画を保存しました。");
                  })
                }
              >
                この案を保存
              </button>
            </article>
          ))}
        </div>
      )}

      <div className="saved-plans">
        <h3>保存済み計画</h3>
        {saved.length === 0 && <p>保存済みの計画はありません。</p>}
        {saved.map((plan) => (
          <article className="saved-plan-card" key={plan.id}>
            <header>
              <div>
                <span>{strategyName(plan.strategy)}</span>
                <h3>{plan.name}</h3>
              </div>
              <strong>
                {plan.summary.reachable
                  ? `Lv.${plan.targetLevel} 到達`
                  : "条件内では未達"}
              </strong>
            </header>
            <div className="plan-segment-list">
              {plan.segments.map((segment, index) => (
                <div className="plan-segment-row" key={segment.id}>
                  <b>{index + 1}</b>
                  <span>
                    {formatDate(segment.startAt, segment.timezone)} →{" "}
                    {formatDate(segment.endAt, segment.timezone)}
                  </span>
                  <span>{relaxLabel(segment.relaxSetting)}</span>
                  <span>
                    {segment.expectedExp.toLocaleString("ja-JP")} EXP / Lv.
                    {segment.expectedEndState.level}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      void startSegment(plan.id, segment.id).then(() =>
                        setMessage("計画から預け入れを開始しました。"),
                      )
                    }
                  >
                    この回を開始
                  </button>
                </div>
              ))}
            </div>
            <div className="card-actions">
              <button type="button" onClick={() => setEditing(plan)}>
                期間・セットを編集
              </button>
              <button
                type="button"
                onClick={() => void recalculatePlan(plan.id)}
              >
                現在状態で再計算
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => void deletePlan(plan.id)}
              >
                削除
              </button>
            </div>
          </article>
        ))}
      </div>

      {editing !== null && (
        <div className="modal-backdrop">
          <section
            ref={editorDialogRef}
            className="modal-card wide-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-edit-heading"
          >
            <h2 id="plan-edit-heading">計画を編集</h2>
            <p>
              各回の終了日時とリラックスセットを変更できます。空白期間は次回の開始日時で調整します。
            </p>
            <div className="editable-segments">
              {editing.segments.map((segment, index) => (
                <fieldset key={segment.id}>
                  <legend>{index + 1}回目</legend>
                  <div className="two-column-fields">
                    <label>
                      開始
                      <input
                        type="datetime-local"
                        value={toDateTimeLocalValue(
                          Date.parse(segment.startAt),
                          segment.timezone,
                        )}
                        onChange={(event) =>
                          editSegment(segment.id, (current) => ({
                            ...current,
                            startAt: new Date(
                              zonedDateTimeToEpochMs(
                                event.target.value,
                                current.timezone,
                              ),
                            ).toISOString(),
                          }))
                        }
                      />
                    </label>
                    <label>
                      終了
                      <input
                        type="datetime-local"
                        value={toDateTimeLocalValue(
                          Date.parse(segment.endAt),
                          segment.timezone,
                        )}
                        onChange={(event) =>
                          editSegment(segment.id, (current) => ({
                            ...current,
                            endAt: new Date(
                              zonedDateTimeToEpochMs(
                                event.target.value,
                                current.timezone,
                              ),
                            ).toISOString(),
                          }))
                        }
                      />
                    </label>
                    <label>
                      セット
                      <select
                        value={segment.relaxSetting.mode}
                        onChange={(event) =>
                          editSegment(segment.id, (current) => ({
                            ...current,
                            relaxSetting:
                              event.target.value === "none"
                                ? { mode: "none" }
                                : event.target.value === "tickets"
                                  ? { mode: "tickets", ticketCount: 1 }
                                  : {
                                      mode: "duration",
                                      durationMinutes: 10_080,
                                    },
                          }))
                        }
                      >
                        <option value="none">なし</option>
                        <option value="tickets">枚数</option>
                        <option value="duration">時間</option>
                      </select>
                    </label>
                    {segment.relaxSetting.mode !== "none" && (
                      <label>
                        {segment.relaxSetting.mode === "tickets"
                          ? "枚数"
                          : "分数"}
                        <input
                          type="number"
                          min="0"
                          value={
                            segment.relaxSetting.mode === "tickets"
                              ? segment.relaxSetting.ticketCount
                              : segment.relaxSetting.durationMinutes
                          }
                          onChange={(event) =>
                            editSegment(segment.id, (current) => ({
                              ...current,
                              relaxSetting:
                                current.relaxSetting.mode === "tickets"
                                  ? {
                                      mode: "tickets",
                                      ticketCount: Number(event.target.value),
                                    }
                                  : {
                                      mode: "duration",
                                      durationMinutes: Number(
                                        event.target.value,
                                      ),
                                    },
                            }))
                          }
                        />
                      </label>
                    )}
                  </div>
                </fieldset>
              ))}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  void savePlan(editing).then(() => setEditing(null))
                }
              >
                再計算して保存
              </button>
              <button type="button" onClick={closeEditor}>
                戻る
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
