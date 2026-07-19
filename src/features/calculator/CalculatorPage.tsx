import { zodResolver } from "@hookform/resolvers/zod";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useForm, useWatch } from "react-hook-form";

import { useCalculatorScenarioStore } from "../../app/stores/calculatorScenarioStore";
import { useAppDataStore } from "../../app/stores/appDataStore";
import { buildCalculationViewModel } from "../../application/calculate/buildCalculationViewModel";
import {
  formatEpochInTimeZone,
  isIanaTimeZone,
  toDateTimeLocalValue,
} from "../../application/calculate/dateTime";
import { getTimeZoneOptions } from "../../application/calculate/timeZoneOptions";
import { dataManifest, pokemonExpTypeMaster } from "../../data/masterData";
import type { RelaxSetting } from "../../domain/napIsland/types";
import messages from "../../i18n/ja.json";
import { calculatorSchema } from "./calculatorSchema";
import type {
  CalculationViewModel,
  CalculatorFormValues,
  ScenarioResult,
} from "./calculatorTypes";
import { CustomScenarioEditor } from "./components/CustomScenarioEditor";
import { useModalFocus } from "../../components/dialogs/useModalFocus";

const GrowthChart = lazy(() => import("../graph/GrowthChart"));

const MINUTES_PER_DAY = 24 * 60;
const PREFERENCE_KEYS = {
  inputMode: "nap-island-calculator-input-mode",
  draft: "nap-island-calculator-draft-v2",
} as const;

function readCalculatorDraft(): CalculatorFormValues | null {
  try {
    const serialized = localStorage.getItem(PREFERENCE_KEYS.draft);
    if (serialized === null) return null;
    const parsed = calculatorSchema.safeParse(
      JSON.parse(serialized) as unknown,
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function readPreference<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  try {
    const value = localStorage.getItem(key);
    return allowed.includes(value as T) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

function writePreference(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The calculator remains usable when storage is unavailable.
  }
}

function getDefaultValues(): CalculatorFormValues {
  const resolvedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezone = isIanaTimeZone(resolvedTimezone)
    ? resolvedTimezone
    : "Asia/Tokyo";
  const now = Date.now();

  return {
    inputMode: readPreference(
      PREFERENCE_KEYS.inputMode,
      ["duration", "datetime"],
      "duration",
    ),
    durationDays: 7,
    durationHours: 0,
    durationMinutes: 0,
    startAt: toDateTimeLocalValue(now - 7 * 24 * 60 * 60_000, timezone),
    endMode: "now",
    endAt: toDateTimeLocalValue(now, timezone),
    timezone,
    relaxMode: "none",
    ticketCount: 1,
    relaxDays: 7,
    relaxHours: 0,
    relaxMinutes: 0,
    expEffect: "neutral",
    pokemonId: "",
    expTypeOverride: false,
    expType: "600",
    levelEnabled: false,
    currentLevel: 1,
    remainingExpToNextLevel: 54,
    levelCap: 70,
  };
}

function formatDuration(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(totalMinutes));
  const days = Math.floor(safeMinutes / MINUTES_PER_DAY);
  const hours = Math.floor((safeMinutes % MINUTES_PER_DAY) / 60);
  const minutes = safeMinutes % 60;
  const parts = [];
  if (days > 0) parts.push(`${days}日`);
  if (hours > 0) parts.push(`${hours}時間`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}分`);
  return parts.join(" ");
}

function formatRelax(setting: RelaxSetting): string {
  switch (setting.mode) {
    case "none":
      return messages["common.none"];
    case "tickets":
      return `${setting.ticketCount}枚`;
    case "duration":
      return formatDuration(setting.durationMinutes);
  }
}

function formatDecimal(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString("ja-JP")
    : value.toLocaleString("ja-JP", { maximumFractionDigits: 2 });
}

function ResultPanel({
  model,
  canSaveIndividual,
  onSaveIndividual,
  onStartDeposit,
  onSaveHistory,
  verificationMode,
}: {
  readonly model: CalculationViewModel;
  readonly canSaveIndividual: boolean;
  readonly onSaveIndividual: () => void;
  readonly onStartDeposit: () => void;
  readonly onSaveHistory: () => void;
  readonly verificationMode: boolean;
}) {
  const levelResult = model.levelResult;

  return (
    <aside className="result-column" aria-live="polite">
      <section className="result-card" aria-labelledby="result-heading">
        <div className="section-kicker">{messages["result.heading"]}</div>
        <h2 id="result-heading" className="result-value">
          <span data-testid="gained-exp">
            {model.expResult.finalExp.toLocaleString("ja-JP")}
          </span>
          <small>EXP</small>
        </h2>
        <p className="result-label">{messages["result.gainedExp"]}</p>

        {levelResult !== null && (
          <div className="level-summary">
            <div>
              <span>{messages["result.levelChange"]}</span>
              <strong>
                Lv.{levelResult.beforeLevel} → Lv.{levelResult.afterLevel}
              </strong>
            </div>
            <div>
              <span>{messages["result.gainedLevels"]}</span>
              <strong>+{levelResult.gainedLevels}</strong>
            </div>
            <div>
              <span>{messages["result.remainingExp"]}</span>
              <strong>
                {levelResult.remainingExpToNextLevel === null
                  ? messages["result.capReached"]
                  : `${levelResult.remainingExpToNextLevel.toLocaleString("ja-JP")} EXP`}
              </strong>
            </div>
          </div>
        )}

        <details className="breakdown">
          <summary>{messages["result.breakdown"]}</summary>
          <dl>
            <div>
              <dt>{messages["result.stay"]}</dt>
              <dd>{formatDuration(model.expResult.eligibleMinutes)}</dd>
            </div>
            <div>
              <dt>{messages["result.baseExp"]}</dt>
              <dd>{formatDecimal(model.expResult.baseRawExp)}</dd>
            </div>
            <div>
              <dt>{messages["result.relaxExp"]}</dt>
              <dd>{formatDecimal(model.expResult.relaxRawExp)}</dd>
            </div>
            <div>
              <dt>{messages["result.relaxApplied"]}</dt>
              <dd>{formatDuration(model.expResult.relaxMinutes)}</dd>
            </div>
            <div>
              <dt>{messages["result.early"]}</dt>
              <dd>
                {model.expResult.earlyWithdrawalApplied
                  ? messages["result.earlyApplied"]
                  : messages["result.earlyNone"]}
              </dd>
            </div>
            <div>
              <dt>{messages["result.nature"]}</dt>
              <dd>×{model.natureMultiplier}</dd>
            </div>
            <div>
              <dt>{messages["result.levelCap"]}</dt>
              <dd>Lv.{model.levelCap}</dd>
            </div>
          </dl>
        </details>
        {verificationMode && (
          <dl className="verification-details">
            <div>
              <dt>ルールセット</dt>
              <dd>{model.expResult.ruleSetId}</dd>
            </div>
            <div>
              <dt>データ版</dt>
              <dd>{dataManifest.dataVersion}</dd>
            </div>
          </dl>
        )}
        <div className="result-actions">
          <button
            type="button"
            onClick={onSaveIndividual}
            disabled={!canSaveIndividual}
          >
            {messages["result.saveIndividual"]}
          </button>
          <button type="button" onClick={onStartDeposit}>
            {messages["result.startDeposit"]}
          </button>
          <button type="button" onClick={onSaveHistory}>
            履歴に保存
          </button>
        </div>
      </section>

      <section className="insight-card" aria-labelledby="insight-heading">
        <h2 id="insight-heading">{messages["insight.heading"]}</h2>
        <ul>
          <li>
            {model.sevenDayWaitMinutes > 0
              ? messages["insight.sevenDay"]
                  .replace(
                    "{duration}",
                    formatDuration(model.sevenDayWaitMinutes),
                  )
                  .replace(
                    "{exp}",
                    model.sevenDayExpDifference.toLocaleString("ja-JP"),
                  )
              : messages["insight.sevenDayDone"]}
          </li>
          {model.nextLevelStayMinutes !== null && (
            <li>
              {messages["insight.nextLevel"].replace(
                "{duration}",
                formatDuration(model.nextLevelStayMinutes),
              )}
            </li>
          )}
          {model.maximumReachableLevel !== null && (
            <li>
              {messages["insight.maximumLevel"].replace(
                "{level}",
                String(model.maximumReachableLevel),
              )}
            </li>
          )}
        </ul>
      </section>
    </aside>
  );
}

function ScenarioRow({
  scenario,
  model,
}: {
  readonly scenario: ScenarioResult;
  readonly model: CalculationViewModel;
}) {
  const condition =
    model.startEpochMs === null
      ? formatDuration(scenario.stayMinutes)
      : formatEpochInTimeZone(
          model.startEpochMs + scenario.stayMinutes * 60_000,
          model.timezone,
        );

  return (
    <tr data-scenario-kind={scenario.kind}>
      <th scope="row">
        <strong>{scenario.name}</strong>
        <span>{condition}</span>
      </th>
      <td>
        {scenario.waitMinutes <= 0
          ? messages["common.current"]
          : `+${formatDuration(scenario.waitMinutes)}`}
      </td>
      <td>{scenario.exp.toLocaleString("ja-JP")}</td>
      <td className={scenario.expDifference >= 0 ? "positive" : "negative"}>
        {scenario.expDifference >= 0 ? "+" : ""}
        {scenario.expDifference.toLocaleString("ja-JP")}
      </td>
      <td>
        {scenario.levelResult === null
          ? "—"
          : `Lv.${scenario.levelResult.afterLevel}${
              scenario.levelDifference === null
                ? ""
                : ` (${scenario.levelDifference >= 0 ? "+" : ""}${scenario.levelDifference})`
            }`}
      </td>
      <td>{formatRelax(scenario.relaxSetting)}</td>
    </tr>
  );
}

export function CalculatorPage() {
  const [nowEpochMs, setNowEpochMs] = useState(() => Date.now());
  const [savePanelOpen, setSavePanelOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const closeSavePanel = useCallback(() => setSavePanelOpen(false), []);
  const saveDialogRef = useModalFocus(savePanelOpen, closeSavePanel);
  const createSavedIndividual = useAppDataStore(
    (state) => state.createIndividual,
  );
  const requestDeposit = useAppDataStore((state) => state.requestDeposit);
  const recordCalculation = useAppDataStore((state) => state.recordCalculation);
  const persistedDefaults = useAppDataStore((state) => state.settings);
  const defaultValues = useMemo(
    () =>
      readCalculatorDraft() ?? {
        ...getDefaultValues(),
        inputMode: persistedDefaults.defaultInputMode,
        timezone: persistedDefaults.timezone,
      },
    [persistedDefaults.defaultInputMode, persistedDefaults.timezone],
  );
  const scenarios = useCalculatorScenarioStore((state) => state.scenarios);
  const addScenario = useCalculatorScenarioStore((state) => state.addScenario);
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useForm<CalculatorFormValues>({
    resolver: zodResolver(calculatorSchema),
    defaultValues,
    mode: "onChange",
  });
  const values = useWatch({ control });
  const inputMode = values.inputMode;
  const endMode = values.endMode;
  const relaxMode = values.relaxMode;
  const levelEnabled = values.levelEnabled;
  const selectedPokemon = pokemonExpTypeMaster.pokemon.find(
    ({ id }) => id === values.pokemonId,
  );
  const parsedValues = calculatorSchema.safeParse(values);
  const model = useMemo(() => {
    if (!parsedValues.success) return null;
    try {
      return buildCalculationViewModel(
        parsedValues.data,
        scenarios,
        nowEpochMs,
      );
    } catch {
      return null;
    }
  }, [nowEpochMs, parsedValues, scenarios]);

  useEffect(() => {
    if (inputMode !== undefined) {
      writePreference(PREFERENCE_KEYS.inputMode, inputMode);
    }
  }, [inputMode]);

  useEffect(() => {
    if (!parsedValues.success) return;
    try {
      localStorage.setItem(
        PREFERENCE_KEYS.draft,
        JSON.stringify(calculatorSchema.parse(parsedValues.data)),
      );
    } catch {
      // The current in-memory input remains usable when storage is unavailable.
    }
  }, [parsedValues]);

  useEffect(() => {
    if (selectedPokemon !== undefined && !values.expTypeOverride) {
      setValue(
        "expType",
        String(selectedPokemon.expType) as CalculatorFormValues["expType"],
        { shouldValidate: true },
      );
    }
  }, [selectedPokemon, setValue, values.expTypeOverride]);

  useEffect(() => {
    if (inputMode !== "datetime" || endMode !== "now") return undefined;
    const interval = window.setInterval(
      () => setNowEpochMs(Date.now()),
      60_000,
    );
    return () => window.clearInterval(interval);
  }, [endMode, inputMode]);

  const applyPreset = (days: number) => {
    setValue("durationDays", days, { shouldValidate: true });
    setValue("durationHours", 0, { shouldValidate: true });
    setValue("durationMinutes", 0, { shouldValidate: true });
  };

  const saveIndividualFromCalculation = async () => {
    if (
      model === null ||
      !parsedValues.success ||
      !parsedValues.data.levelEnabled ||
      saveName.trim().length === 0
    )
      return;
    const validValues = parsedValues.data;
    await createSavedIndividual({
      pokemonId: validValues.pokemonId || null,
      displayName: saveName.trim(),
      natureId: null,
      expEffectOverride: validValues.expEffect,
      expTypeOverride:
        validValues.expTypeOverride || validValues.pokemonId === ""
          ? model.expType
          : null,
      currentLevel: validValues.currentLevel,
      remainingExpToNextLevel:
        validValues.currentLevel === 70
          ? null
          : validValues.remainingExpToNextLevel,
      targetLevel: null,
      targetDate: null,
      targetTimezone: null,
    });
    await recordCalculation(model);
    setSavePanelOpen(false);
    setActionMessage("個体を保存しました。");
  };

  const startDepositFromCalculation = async () => {
    if (model === null || !parsedValues.success) return;
    const validValues = parsedValues.data;
    const selectedName = pokemonExpTypeMaster.pokemon.find(
      ({ id }) => id === validValues.pokemonId,
    )?.nameJa;
    await requestDeposit({
      individualId: null,
      startedAt: new Date().toISOString(),
      timezone: validValues.timezone,
      plannedEndAt: null,
      relaxSetting: model.relaxSetting,
      calculationSnapshot: {
        displayName: saveName.trim() || selectedName || "計算中のポケモン",
        expType: model.expType,
        natureMultiplier: model.natureMultiplier,
        levelState: validValues.levelEnabled
          ? {
              level: validValues.currentLevel,
              remainingExpToNextLevel:
                validValues.currentLevel === 70
                  ? null
                  : validValues.remainingExpToNextLevel,
            }
          : null,
        levelCap: validValues.levelCap,
      },
    });
    await recordCalculation(model);
    setActionMessage("預け入れを開始しました。");
  };

  return (
    <>
      <header className="hero">
        <div className="hero-orbit" aria-hidden="true" />
        <img
          className="hero-island-mark"
          src={`${import.meta.env.BASE_URL}island-mark.svg`}
          alt="月と小さな島を描いたオリジナルイラスト"
        />
        <div className="hero-content">
          <p className="eyebrow">{messages["app.badge"]}</p>
          <h1>{messages["app.title"]}</h1>
          <p>{messages["app.subtitle"]}</p>
        </div>
      </header>

      <main className="page-shell">
        <div className="calculator-layout">
          <form
            className="form-column"
            onSubmit={(event) => event.preventDefault()}
          >
            <section className="panel" aria-labelledby="conditions-heading">
              <div className="panel-heading">
                <span className="step-number">01</span>
                <h2 id="conditions-heading">
                  {messages["calculator.heading"]}
                </h2>
              </div>

              <div
                className="tabs"
                role="tablist"
                aria-label={messages["calculator.heading"]}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={inputMode === "duration"}
                  aria-controls="duration-panel"
                  onClick={() =>
                    setValue("inputMode", "duration", { shouldValidate: true })
                  }
                >
                  {messages["calculator.durationTab"]}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={inputMode === "datetime"}
                  aria-controls="datetime-panel"
                  onClick={() =>
                    setValue("inputMode", "datetime", { shouldValidate: true })
                  }
                >
                  {messages["calculator.datetimeTab"]}
                </button>
              </div>

              {inputMode === "duration" ? (
                <div id="duration-panel" role="tabpanel" className="stack">
                  <div className="duration-grid">
                    <label>
                      <span>{messages["calculator.days"]}</span>
                      <input
                        type="number"
                        min="0"
                        {...register("durationDays", { valueAsNumber: true })}
                      />
                      {errors.durationDays?.message && (
                        <small className="field-error">
                          {errors.durationDays.message}
                        </small>
                      )}
                    </label>
                    <label>
                      <span>{messages["calculator.hours"]}</span>
                      <input
                        type="number"
                        min="0"
                        max="23"
                        {...register("durationHours", { valueAsNumber: true })}
                      />
                      {errors.durationHours?.message && (
                        <small className="field-error">
                          {errors.durationHours.message}
                        </small>
                      )}
                    </label>
                    <label>
                      <span>{messages["calculator.minutes"]}</span>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        {...register("durationMinutes", {
                          valueAsNumber: true,
                        })}
                      />
                      {errors.durationMinutes?.message && (
                        <small className="field-error">
                          {errors.durationMinutes.message}
                        </small>
                      )}
                    </label>
                  </div>
                  <div>
                    <span className="field-label">
                      {messages["calculator.presets"]}
                    </span>
                    <div className="preset-row">
                      {[1, 3, 7, 14, 30].map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => applyPreset(days)}
                        >
                          {days}日
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div id="datetime-panel" role="tabpanel" className="stack">
                  <label>
                    <span>{messages["calculator.startAt"]}</span>
                    <input type="datetime-local" {...register("startAt")} />
                    {errors.startAt?.message && (
                      <small className="field-error">
                        {errors.startAt.message}
                      </small>
                    )}
                  </label>
                  <fieldset className="choice-group">
                    <legend>{messages["calculator.endAt"]}</legend>
                    <label>
                      <input
                        type="radio"
                        value="now"
                        {...register("endMode")}
                      />
                      {messages["calculator.endNow"]}
                    </label>
                    <label>
                      <input
                        type="radio"
                        value="specified"
                        {...register("endMode")}
                      />
                      {messages["calculator.endSpecified"]}
                    </label>
                  </fieldset>
                  {endMode === "specified" && (
                    <label>
                      <span>{messages["calculator.endAt"]}</span>
                      <input type="datetime-local" {...register("endAt")} />
                      {errors.endAt?.message && (
                        <small className="field-error">
                          {errors.endAt.message}
                        </small>
                      )}
                    </label>
                  )}
                  <label>
                    <span>{messages["calculator.timezone"]}</span>
                    <select {...register("timezone")}>
                      {getTimeZoneOptions(values.timezone).map((timeZone) => (
                        <option key={timeZone} value={timeZone}>
                          {timeZone}
                        </option>
                      ))}
                    </select>
                    {errors.timezone?.message && (
                      <small className="field-error">
                        {errors.timezone.message}
                      </small>
                    )}
                  </label>
                </div>
              )}
            </section>

            <section className="panel" aria-labelledby="boost-heading">
              <div className="panel-heading">
                <span className="step-number">02</span>
                <h2 id="boost-heading">
                  {messages["calculator.relaxHeading"]}
                </h2>
              </div>
              <fieldset className="segmented-choice">
                <legend className="sr-only">
                  {messages["calculator.relaxHeading"]}
                </legend>
                <label>
                  <input type="radio" value="none" {...register("relaxMode")} />
                  <span>{messages["calculator.relaxNone"]}</span>
                </label>
                <label>
                  <input
                    type="radio"
                    value="tickets"
                    {...register("relaxMode")}
                  />
                  <span>{messages["calculator.relaxTickets"]}</span>
                </label>
                <label>
                  <input
                    type="radio"
                    value="duration"
                    {...register("relaxMode")}
                  />
                  <span>{messages["calculator.relaxDuration"]}</span>
                </label>
              </fieldset>
              {relaxMode === "tickets" && (
                <label className="compact-field">
                  <span>{messages["calculator.ticketCount"]}</span>
                  <input
                    type="number"
                    min="0"
                    {...register("ticketCount", { valueAsNumber: true })}
                  />
                  {errors.ticketCount?.message && (
                    <small className="field-error">
                      {errors.ticketCount.message}
                    </small>
                  )}
                </label>
              )}
              {relaxMode === "duration" && (
                <div className="duration-grid compact-grid">
                  <label>
                    <span>{messages["calculator.days"]}</span>
                    <input
                      type="number"
                      min="0"
                      {...register("relaxDays", { valueAsNumber: true })}
                    />
                    {errors.relaxDays?.message && (
                      <small className="field-error">
                        {errors.relaxDays.message}
                      </small>
                    )}
                  </label>
                  <label>
                    <span>{messages["calculator.hours"]}</span>
                    <input
                      type="number"
                      min="0"
                      max="23"
                      {...register("relaxHours", { valueAsNumber: true })}
                    />
                    {errors.relaxHours?.message && (
                      <small className="field-error">
                        {errors.relaxHours.message}
                      </small>
                    )}
                  </label>
                  <label>
                    <span>{messages["calculator.minutes"]}</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      {...register("relaxMinutes", { valueAsNumber: true })}
                    />
                    {errors.relaxMinutes?.message && (
                      <small className="field-error">
                        {errors.relaxMinutes.message}
                      </small>
                    )}
                  </label>
                </div>
              )}

              <div className="subsection">
                <h3>{messages["calculator.natureHeading"]}</h3>
                <fieldset className="segmented-choice">
                  <legend className="sr-only">
                    {messages["calculator.natureHeading"]}
                  </legend>
                  <label>
                    <input type="radio" value="up" {...register("expEffect")} />
                    <span>{messages["calculator.expUp"]}</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="neutral"
                      {...register("expEffect")}
                    />
                    <span>{messages["calculator.expNeutral"]}</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="down"
                      {...register("expEffect")}
                    />
                    <span>{messages["calculator.expDown"]}</span>
                  </label>
                </fieldset>
              </div>
            </section>

            <section className="panel" aria-labelledby="growth-heading">
              <div className="panel-heading">
                <span className="step-number">03</span>
                <h2 id="growth-heading">
                  {messages["calculator.pokemonHeading"]}
                </h2>
              </div>
              <div className="two-column-fields">
                <label>
                  <span>{messages["calculator.pokemon"]}</span>
                  <select {...register("pokemonId")}>
                    <option value="">
                      {messages["calculator.pokemonManual"]}
                    </option>
                    {pokemonExpTypeMaster.pokemon.map((pokemon) => (
                      <option key={pokemon.id} value={pokemon.id}>
                        {pokemon.nameJa}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{messages["calculator.expType"]}</span>
                  <select
                    {...register("expType")}
                    disabled={
                      selectedPokemon !== undefined && !values.expTypeOverride
                    }
                  >
                    {([600, 900, 1080, 1320] as const).map((expType) => (
                      <option key={expType} value={expType}>
                        {expType}タイプ
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {selectedPokemon !== undefined && (
                <label className="checkbox-row">
                  <input type="checkbox" {...register("expTypeOverride")} />
                  <span>{messages["calculator.overrideExpType"]}</span>
                </label>
              )}

              <div className="subsection">
                <h3>{messages["calculator.levelHeading"]}</h3>
                <label className="checkbox-row feature-toggle">
                  <input type="checkbox" {...register("levelEnabled")} />
                  <span>{messages["calculator.enableLevel"]}</span>
                </label>
                {levelEnabled && (
                  <div className="stack">
                    <div className="two-column-fields">
                      <label>
                        <span>{messages["calculator.currentLevel"]}</span>
                        <input
                          type="number"
                          min="1"
                          max="70"
                          {...register("currentLevel", { valueAsNumber: true })}
                        />
                        {errors.currentLevel?.message && (
                          <small className="field-error">
                            {errors.currentLevel.message}
                          </small>
                        )}
                      </label>
                      <label>
                        <span>{messages["calculator.remainingExp"]}</span>
                        <input
                          type="number"
                          min="0"
                          disabled={values.currentLevel === 70}
                          {...register("remainingExpToNextLevel", {
                            valueAsNumber: true,
                          })}
                        />
                        {errors.remainingExpToNextLevel?.message && (
                          <small className="field-error">
                            {errors.remainingExpToNextLevel.message}
                          </small>
                        )}
                      </label>
                    </div>
                    <details>
                      <summary>{messages["calculator.advanced"]}</summary>
                      <label className="compact-field">
                        <span>{messages["calculator.levelCap"]}</span>
                        <input
                          type="number"
                          min="1"
                          max="70"
                          {...register("levelCap", { valueAsNumber: true })}
                        />
                        {errors.levelCap?.message && (
                          <small className="field-error">
                            {errors.levelCap.message}
                          </small>
                        )}
                      </label>
                    </details>
                  </div>
                )}
              </div>
            </section>
          </form>

          {model === null ? (
            <aside className="result-column">
              <section className="result-card empty-result">
                <p>{messages["calculator.inputError"]}</p>
              </section>
            </aside>
          ) : (
            <ResultPanel
              model={model}
              canSaveIndividual={values.levelEnabled === true}
              onSaveIndividual={() => setSavePanelOpen(true)}
              onStartDeposit={() => void startDepositFromCalculation()}
              onSaveHistory={() =>
                void recordCalculation(model).then(() =>
                  setActionMessage("計算履歴を保存しました。"),
                )
              }
              verificationMode={persistedDefaults.verificationMode}
            />
          )}
        </div>

        {model !== null && (
          <section
            ref={saveDialogRef}
            className="scenario-section"
            aria-labelledby="scenario-heading"
          >
            <div className="scenario-header">
              <div>
                <p className="eyebrow">COMPARE</p>
                <h2 id="scenario-heading">{messages["scenario.heading"]}</h2>
                <p>{messages["scenario.description"]}</p>
              </div>
              <button
                className="primary-button"
                type="button"
                onClick={() => addScenario(model.stayMinutes)}
              >
                <span aria-hidden="true">＋</span>
                {messages["scenario.add"]}
              </button>
            </div>

            <div
              className="table-scroll"
              role="region"
              aria-label="シナリオ比較表"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>{messages["scenario.condition"]}</th>
                    <th>{messages["scenario.wait"]}</th>
                    <th>{messages["scenario.exp"]}</th>
                    <th>{messages["scenario.delta"]}</th>
                    <th>{messages["scenario.level"]}</th>
                    <th>{messages["scenario.relax"]}</th>
                  </tr>
                </thead>
                <tbody>
                  {model.scenarios.map((scenario) => (
                    <ScenarioRow
                      key={scenario.id}
                      scenario={scenario}
                      model={model}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {scenarios.length > 0 && <CustomScenarioEditor />}
          </section>
        )}

        {model !== null && (
          <Suspense
            fallback={
              <section className="scenario-section" aria-busy="true">
                グラフを読み込み中…
              </section>
            }
          >
            <GrowthChart model={model} />
          </Suspense>
        )}

        {actionMessage !== null && (
          <div className="inline-status" role="status">
            <span>{actionMessage}</span>
            <button type="button" onClick={() => setActionMessage(null)}>
              閉じる
            </button>
          </div>
        )}
      </main>

      {savePanelOpen && (
        <div className="modal-backdrop">
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-individual-heading"
          >
            <h2 id="save-individual-heading">
              {messages["result.saveIndividual"]}
            </h2>
            <label>
              <span>{messages["result.saveName"]}</span>
              <input
                value={saveName}
                onChange={(event) => setSaveName(event.target.value)}
              />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="primary-button"
                disabled={saveName.trim().length === 0}
                onClick={() => void saveIndividualFromCalculation()}
              >
                {messages["result.saveConfirm"]}
              </button>
              <button type="button" onClick={closeSavePanel}>
                {messages["result.saveCancel"]}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
