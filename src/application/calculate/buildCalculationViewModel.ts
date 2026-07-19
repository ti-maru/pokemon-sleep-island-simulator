import {
  napIslandRuleSet,
  natureMaster,
  pokemonExpTypeMaster,
} from "../../data/masterData";
import { applyExpToLevel } from "../../domain/leveling/applyExpToLevel";
import { getExpCurve } from "../../domain/leveling/expCurve";
import { findTargetLevelTime } from "../../domain/leveling/findTargetLevelTime";
import type {
  ExpType,
  LevelResult,
  LevelState,
} from "../../domain/leveling/types";
import { calculateNapIslandExp } from "../../domain/napIsland/calculateNapIslandExp";
import {
  calculateCompletedStayMinutes,
  getMaximumAccumulationMinutes,
} from "../../domain/napIsland/calculateStayMinutes";
import type { RelaxSetting } from "../../domain/napIsland/types";
import messages from "../../i18n/ja.json";
import type {
  CalculationViewModel,
  CalculatorFormValues,
  CustomScenario,
  ScenarioResult,
} from "../../features/calculator/calculatorTypes";
import { zonedDateTimeToEpochMs } from "./dateTime";

const MINUTES_PER_DAY = 24 * 60;

function durationToMinutes(
  days: number,
  hours: number,
  minutes: number,
): number {
  return Math.max(0, Math.floor(days * MINUTES_PER_DAY + hours * 60 + minutes));
}

function resolveRelaxSetting(values: CalculatorFormValues): RelaxSetting {
  switch (values.relaxMode) {
    case "none":
      return { mode: "none" };
    case "tickets":
      return { mode: "tickets", ticketCount: values.ticketCount };
    case "duration":
      return {
        mode: "duration",
        durationMinutes: durationToMinutes(
          values.relaxDays,
          values.relaxHours,
          values.relaxMinutes,
        ),
      };
  }
}

function resolveCustomRelaxSetting(scenario: CustomScenario): RelaxSetting {
  switch (scenario.relaxMode) {
    case "none":
      return { mode: "none" };
    case "tickets":
      return {
        mode: "tickets",
        ticketCount: Math.max(0, Math.floor(scenario.ticketCount)),
      };
    case "duration":
      return {
        mode: "duration",
        durationMinutes: Math.max(0, Math.floor(scenario.relaxDurationMinutes)),
      };
  }
}

function resolveExpType(values: CalculatorFormValues): ExpType {
  const pokemon = pokemonExpTypeMaster.pokemon.find(
    ({ id }) => id === values.pokemonId,
  );

  if (!values.expTypeOverride && pokemon !== undefined) {
    return pokemon.expType;
  }

  return Number(values.expType) as ExpType;
}

function resolveNatureMultiplier(values: CalculatorFormValues): number {
  if (values.natureInputMode === "nature") {
    return (
      natureMaster.natures.find(({ id }) => id === values.natureId)
        ?.multiplier ?? 1
    );
  }

  return (
    natureMaster.natures.find(({ expEffect }) => expEffect === values.expEffect)
      ?.multiplier ?? 1
  );
}

function resolveLevelState(values: CalculatorFormValues): LevelState | null {
  if (!values.levelEnabled) return null;

  return {
    level: values.currentLevel,
    remainingExpToNextLevel:
      values.currentLevel === 70 ? null : values.remainingExpToNextLevel,
  };
}

function getRequestedRelaxMinutes(setting: RelaxSetting): number {
  switch (setting.mode) {
    case "none":
      return 0;
    case "tickets":
      return setting.ticketCount * 7 * MINUTES_PER_DAY;
    case "duration":
      return setting.durationMinutes;
  }
}

export function buildCalculationViewModel(
  values: CalculatorFormValues,
  customScenarios: readonly CustomScenario[],
  nowEpochMs = Date.now(),
): CalculationViewModel {
  const startEpochMs =
    values.inputMode === "datetime"
      ? zonedDateTimeToEpochMs(values.startAt, values.timezone)
      : null;
  const endEpochMs =
    values.inputMode === "datetime"
      ? values.endMode === "now"
        ? nowEpochMs
        : zonedDateTimeToEpochMs(values.endAt, values.timezone)
      : null;
  const stayMinutes =
    startEpochMs === null || endEpochMs === null
      ? durationToMinutes(
          values.durationDays,
          values.durationHours,
          values.durationMinutes,
        )
      : calculateCompletedStayMinutes(startEpochMs, endEpochMs);
  const relaxSetting = resolveRelaxSetting(values);
  const natureMultiplier = resolveNatureMultiplier(values);
  const expType = resolveExpType(values);
  const curve = getExpCurve(expType);
  const levelState = resolveLevelState(values);
  const calculateExp = (minutes: number, setting = relaxSetting) =>
    calculateNapIslandExp({
      stayMinutes: minutes,
      relaxSetting: setting,
      natureMultiplier,
    });
  const calculateLevel = (exp: number): LevelResult | null =>
    levelState === null
      ? null
      : applyExpToLevel(levelState, exp, curve, values.levelCap);
  const expResult = calculateExp(stayMinutes);
  const levelResult = calculateLevel(expResult.finalExp);
  const currentAfterLevel = levelResult?.afterLevel ?? null;

  const createScenario = (
    id: string,
    name: string,
    kind: ScenarioResult["kind"],
    minutes: number,
    setting = relaxSetting,
  ): ScenarioResult => {
    const result = calculateExp(minutes, setting);
    const scenarioLevel = calculateLevel(result.finalExp);

    return {
      id,
      name,
      kind,
      stayMinutes: result.eligibleMinutes,
      waitMinutes: result.eligibleMinutes - expResult.eligibleMinutes,
      exp: result.finalExp,
      expDifference: result.finalExp - expResult.finalExp,
      levelResult: scenarioLevel,
      levelDifference:
        scenarioLevel === null || currentAfterLevel === null
          ? null
          : scenarioLevel.afterLevel - currentAfterLevel,
      relaxSetting: setting,
    };
  };

  const scenarios: ScenarioResult[] = [
    createScenario(
      "current",
      messages["scenario.current"],
      "current",
      stayMinutes,
    ),
  ];
  const thresholdMinutes = napIslandRuleSet.fullRewardThresholdMinutes;

  if (stayMinutes < thresholdMinutes) {
    scenarios.push(
      createScenario(
        "seven-day",
        messages["scenario.sevenDay"],
        "automatic",
        thresholdMinutes,
      ),
    );
  }

  const requestedRelaxMinutes = getRequestedRelaxMinutes(relaxSetting);
  if (requestedRelaxMinutes > stayMinutes) {
    scenarios.push(
      createScenario(
        "relax-end",
        messages["scenario.relaxEnd"],
        "automatic",
        requestedRelaxMinutes,
      ),
    );
  }

  let nextLevelStayMinutes: number | null = null;
  let targetLevelStayMinutes: number | null = null;
  let targetLevelMissingExp: number | null = null;

  if (
    levelState !== null &&
    levelState.level < values.levelCap &&
    levelState.level < curve.maxDefinedLevel
  ) {
    const nextLevelTime = findTargetLevelTime({
      currentState: levelState,
      targetLevel: levelState.level + 1,
      curve,
      relaxSetting,
      natureMultiplier,
    });
    nextLevelStayMinutes = nextLevelTime.stayMinutes;
    if (nextLevelTime.stayMinutes !== null) {
      scenarios.push(
        createScenario(
          "next-level",
          messages["scenario.nextLevel"],
          "automatic",
          nextLevelTime.stayMinutes,
        ),
      );
    }
  }

  if (levelState !== null && values.targetLevelEnabled) {
    const targetLevelTime = findTargetLevelTime({
      currentState: levelState,
      targetLevel: values.targetLevel,
      curve,
      relaxSetting,
      natureMultiplier,
    });
    targetLevelStayMinutes = targetLevelTime.stayMinutes;
    targetLevelMissingExp = targetLevelTime.reachable
      ? null
      : targetLevelTime.missingExp;
    if (targetLevelTime.stayMinutes !== null) {
      scenarios.push(
        createScenario(
          "target-level",
          messages["scenario.targetLevel"].replace(
            "{level}",
            String(values.targetLevel),
          ),
          "automatic",
          targetLevelTime.stayMinutes,
        ),
      );
    }
  }

  let targetDateStayMinutes: number | null = null;
  if (values.targetDateEnabled && startEpochMs !== null) {
    const targetEpochMs = zonedDateTimeToEpochMs(
      values.targetDate,
      values.timezone,
    );
    targetDateStayMinutes = calculateCompletedStayMinutes(
      startEpochMs,
      targetEpochMs,
    );
    scenarios.push(
      createScenario(
        "target-date",
        messages["scenario.targetDate"],
        "automatic",
        targetDateStayMinutes,
      ),
    );
  }

  const maximumMinutes = getMaximumAccumulationMinutes(
    napIslandRuleSet.maxAccumulation,
  );
  const maximumScenario = createScenario(
    "maximum",
    messages["scenario.maximum"],
    "automatic",
    maximumMinutes,
  );
  scenarios.push(maximumScenario);

  for (const customScenario of customScenarios) {
    scenarios.push(
      createScenario(
        customScenario.id,
        customScenario.name,
        "custom",
        durationToMinutes(
          customScenario.days,
          customScenario.hours,
          customScenario.minutes,
        ),
        resolveCustomRelaxSetting(customScenario),
      ),
    );
  }

  const sevenDayResult = calculateExp(Math.max(stayMinutes, thresholdMinutes));

  return {
    stayMinutes: expResult.eligibleMinutes,
    startEpochMs,
    timezone: values.timezone,
    expType,
    levelCap: values.levelCap,
    levelState,
    natureMultiplier,
    relaxSetting,
    expResult,
    levelResult,
    scenarios,
    sevenDayWaitMinutes: Math.max(0, thresholdMinutes - stayMinutes),
    sevenDayExpDifference: sevenDayResult.finalExp - expResult.finalExp,
    nextLevelStayMinutes,
    targetLevelStayMinutes,
    targetLevelMissingExp,
    maximumReachableLevel: maximumScenario.levelResult?.afterLevel ?? null,
    targetDateStayMinutes,
    targetDateRequiresStart: values.targetDateEnabled && startEpochMs === null,
  };
}
