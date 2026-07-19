import type { PokemonIndividual } from "../../domain/individuals/types";
import type { GrowthPlan, PlanSegment } from "../../domain/plans/types";
import { growthPlanSchema } from "../../domain/plans/schema";
import type { LevelState } from "../../domain/leveling/types";
import type { RelaxSetting } from "../../domain/napIsland/types";
import { calculateNapIslandExp } from "../../domain/napIsland/calculateNapIslandExp";
import { applyExpToLevel } from "../../domain/leveling/applyExpToLevel";
import { findTargetLevelTime } from "../../domain/leveling/findTargetLevelTime";
import { getExpCurve } from "../../domain/leveling/expCurve";
import { snapshotIndividual } from "../deposits/depositService";
import type { AppRepository } from "../persistence/AppRepository";

const WEEK_MINUTES = 7 * 24 * 60;
const MAX_MINUTES = 365 * 24 * 60;

function id(prefix: string): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${prefix}-${Date.now()}-${Math.random()}`
  );
}

interface PlanContext {
  readonly individual: PokemonIndividual;
  readonly targetLevel: number;
  readonly targetDate: string | null;
  readonly startAt: string;
  readonly timezone: string;
}

interface PlanCalculationContext extends PlanContext {
  readonly expType: 600 | 900 | 1080 | 1320;
  readonly natureMultiplier: number;
  readonly initialState: LevelState;
}

function context(input: PlanContext): PlanCalculationContext {
  if (
    input.targetLevel < input.individual.currentLevel ||
    input.targetLevel > 70
  ) {
    throw new Error("目標レベルは現在レベル以上、Lv.70以下にしてください。");
  }
  const snapshot = snapshotIndividual(input.individual);
  if (snapshot.levelState === null) throw new Error("レベル状態が必要です。");
  return {
    ...input,
    expType: snapshot.expType,
    natureMultiplier: snapshot.natureMultiplier,
    initialState: snapshot.levelState,
  };
}

function calculateSegment(
  planContext: PlanCalculationContext,
  state: LevelState,
  startEpochMs: number,
  durationMinutes: number,
  relaxSetting: RelaxSetting,
): PlanSegment {
  const exp = calculateNapIslandExp({
    stayMinutes: durationMinutes,
    relaxSetting,
    natureMultiplier: planContext.natureMultiplier,
  });
  const level = applyExpToLevel(
    state,
    exp.finalExp,
    getExpCurve(planContext.expType),
    70,
  );
  return {
    id: id("segment"),
    startAt: new Date(startEpochMs).toISOString(),
    endAt: new Date(startEpochMs + durationMinutes * 60_000).toISOString(),
    timezone: planContext.timezone,
    relaxSetting,
    expectedExp: exp.finalExp,
    expectedEndState: {
      level: level.afterLevel,
      remainingExpToNextLevel: level.remainingExpToNextLevel,
    },
    status: "planned",
  };
}

function targetTime(
  planContext: PlanCalculationContext,
  state: LevelState,
  relaxSetting: RelaxSetting,
) {
  return findTargetLevelTime({
    currentState: state,
    targetLevel: planContext.targetLevel,
    curve: getExpCurve(planContext.expType),
    relaxSetting,
    natureMultiplier: planContext.natureMultiplier,
  });
}

function buildPlan(
  planContext: PlanCalculationContext,
  strategy: GrowthPlan["strategy"],
  name: string,
  segments: readonly PlanSegment[],
  missingExp: number,
  now: string,
): GrowthPlan {
  const last = segments.at(-1);
  const maximumLevel =
    last?.expectedEndState.level ?? planContext.initialState.level;
  return growthPlanSchema.parse({
    id: id("plan"),
    individualId: planContext.individual.id,
    name,
    strategy,
    targetLevel: planContext.targetLevel,
    targetDate: planContext.targetDate,
    segments,
    status: "draft",
    summary: {
      reachable: maximumLevel >= planContext.targetLevel,
      expectedEndAt: last?.endAt ?? null,
      totalExpectedExp: segments.reduce(
        (total, segment) => total + segment.expectedExp,
        0,
      ),
      ticketCount: segments.reduce(
        (total, segment) =>
          total +
          (segment.relaxSetting.mode === "tickets"
            ? segment.relaxSetting.ticketCount
            : 0),
        0,
      ),
      missingExp,
      maximumLevel,
    },
    createdAt: now,
    updatedAt: now,
  });
}

function fastest(planContext: PlanCalculationContext, now: string): GrowthPlan {
  const relaxSetting: RelaxSetting = {
    mode: "tickets",
    ticketCount: Math.ceil(MAX_MINUTES / WEEK_MINUTES),
  };
  const target = targetTime(
    planContext,
    planContext.initialState,
    relaxSetting,
  );
  const duration = target.stayMinutes ?? MAX_MINUTES;
  const segment = calculateSegment(
    planContext,
    planContext.initialState,
    Date.parse(planContext.startAt),
    duration,
    {
      mode: "tickets",
      ticketCount: Math.ceil(duration / WEEK_MINUTES),
    },
  );
  return buildPlan(
    planContext,
    "fastest",
    "最短到達",
    [segment],
    target.missingExp,
    now,
  );
}

function ticketSaving(
  planContext: PlanCalculationContext,
  now: string,
): GrowthPlan {
  const availableMinutes =
    planContext.targetDate === null
      ? MAX_MINUTES
      : Math.max(
          0,
          Math.floor(
            (Date.parse(planContext.targetDate) -
              Date.parse(planContext.startAt)) /
              60_000,
          ),
        );
  const maximumTickets = Math.ceil(
    Math.min(MAX_MINUTES, availableMinutes) / WEEK_MINUTES,
  );
  let chosenTickets: number | null = null;
  let chosenDuration = availableMinutes;
  let missingExp = 0;
  for (let tickets = 0; tickets <= maximumTickets; tickets += 1) {
    const setting: RelaxSetting =
      tickets === 0
        ? { mode: "none" }
        : { mode: "tickets", ticketCount: tickets };
    const target = targetTime(planContext, planContext.initialState, setting);
    missingExp = target.missingExp;
    if (target.stayMinutes !== null && target.stayMinutes <= availableMinutes) {
      chosenTickets = tickets;
      chosenDuration = target.stayMinutes;
      break;
    }
  }
  const tickets = chosenTickets ?? maximumTickets;
  const setting: RelaxSetting =
    tickets === 0
      ? { mode: "none" }
      : { mode: "tickets", ticketCount: tickets };
  const segment = calculateSegment(
    planContext,
    planContext.initialState,
    Date.parse(planContext.startAt),
    Math.min(MAX_MINUTES, chosenDuration),
    setting,
  );
  return buildPlan(
    planContext,
    "ticket-saving",
    "セット節約",
    [segment],
    missingExp,
    now,
  );
}

function sevenDay(
  planContext: PlanCalculationContext,
  now: string,
): GrowthPlan {
  const segments: PlanSegment[] = [];
  let state = planContext.initialState;
  let start = Date.parse(planContext.startAt);
  let missingExp = 0;
  for (
    let index = 0;
    index < Math.ceil(MAX_MINUTES / WEEK_MINUTES);
    index += 1
  ) {
    const target = targetTime(planContext, state, { mode: "none" });
    missingExp = target.missingExp;
    const duration = Math.min(WEEK_MINUTES, target.stayMinutes ?? WEEK_MINUTES);
    const segment = calculateSegment(planContext, state, start, duration, {
      mode: "none",
    });
    segments.push(segment);
    state = segment.expectedEndState;
    start = Date.parse(segment.endAt);
    if (state.level >= planContext.targetLevel || duration <= 0) break;
  }
  return buildPlan(
    planContext,
    "seven-day",
    "7日単位",
    segments,
    missingExp,
    now,
  );
}

export function generateGrowthPlanOptions(
  input: PlanContext,
): readonly GrowthPlan[] {
  const planContext = context(input);
  const now = new Date().toISOString();
  return [
    fastest(planContext, now),
    ticketSaving(planContext, now),
    sevenDay(planContext, now),
  ];
}

export function recalculateGrowthPlan(
  plan: GrowthPlan,
  individual: PokemonIndividual,
  now = new Date().toISOString(),
): GrowthPlan {
  const planContext = context({
    individual,
    targetLevel: plan.targetLevel ?? individual.currentLevel,
    targetDate: plan.targetDate,
    startAt: plan.segments[0]?.startAt ?? now,
    timezone:
      plan.segments[0]?.timezone ?? individual.targetTimezone ?? "Asia/Tokyo",
  });
  let state = planContext.initialState;
  const segments = plan.segments.map((segment) => {
    if (segment.status === "completed" || segment.status === "skipped") {
      state = segment.expectedEndState;
      return segment;
    }
    const recalculated = calculateSegment(
      planContext,
      state,
      Date.parse(segment.startAt),
      Math.max(
        0,
        Math.floor(
          (Date.parse(segment.endAt) - Date.parse(segment.startAt)) / 60_000,
        ),
      ),
      segment.relaxSetting,
    );
    state = recalculated.expectedEndState;
    return { ...recalculated, id: segment.id, status: segment.status };
  });
  const rebuilt = buildPlan(planContext, "custom", plan.name, segments, 0, now);
  return growthPlanSchema.parse({
    ...rebuilt,
    id: plan.id,
    strategy: plan.strategy === "custom" ? "custom" : plan.strategy,
    status: plan.status,
    createdAt: plan.createdAt,
    updatedAt: now,
  });
}

export async function saveGrowthPlan(
  repository: AppRepository,
  plan: GrowthPlan,
): Promise<void> {
  await repository.putGrowthPlan(growthPlanSchema.parse(plan));
}

export type PlanWithdrawalUpdateMode =
  "keep-dates" | "continuous" | "regenerate" | "none";

export function updatePlanAfterWithdrawal(
  plan: GrowthPlan,
  segmentId: string,
  individualAfter: PokemonIndividual,
  completedAt: string,
  mode: PlanWithdrawalUpdateMode,
): GrowthPlan {
  if (mode === "none") return plan;
  const segmentIndex = plan.segments.findIndex(
    ({ id: candidateId }) => candidateId === segmentId,
  );
  if (segmentIndex < 0) return plan;
  const completed = plan.segments.map((segment, index) =>
    index === segmentIndex
      ? {
          ...segment,
          endAt: completedAt,
          expectedEndState: {
            level: individualAfter.currentLevel,
            remainingExpToNextLevel: individualAfter.remainingExpToNextLevel,
          },
          status: "completed" as const,
        }
      : segment,
  );

  if (mode === "regenerate") {
    const options = generateGrowthPlanOptions({
      individual: individualAfter,
      targetLevel: plan.targetLevel ?? individualAfter.currentLevel,
      targetDate: plan.targetDate,
      startAt: completedAt,
      timezone:
        plan.segments[segmentIndex]?.timezone ??
        individualAfter.targetTimezone ??
        "Asia/Tokyo",
    });
    const regenerated =
      options.find(({ strategy }) => strategy === plan.strategy) ?? options[0];
    if (regenerated === undefined) return plan;
    return growthPlanSchema.parse({
      ...regenerated,
      id: plan.id,
      name: plan.name,
      createdAt: plan.createdAt,
      updatedAt: completedAt,
      status:
        individualAfter.currentLevel >= (plan.targetLevel ?? 70)
          ? "completed"
          : "active",
      segments: [
        ...completed.slice(0, segmentIndex + 1),
        ...regenerated.segments,
      ],
    });
  }

  let cursor = Date.parse(completedAt);
  const shifted = completed.map((segment, index) => {
    if (
      mode !== "continuous" ||
      index <= segmentIndex ||
      segment.status !== "planned"
    ) {
      return segment;
    }
    const duration = Math.max(
      0,
      Date.parse(segment.endAt) - Date.parse(segment.startAt),
    );
    const next = {
      ...segment,
      startAt: new Date(cursor).toISOString(),
      endAt: new Date(cursor + duration).toISOString(),
    };
    cursor += duration;
    return next;
  });
  const recalculated = recalculateGrowthPlan(
    growthPlanSchema.parse({
      ...plan,
      segments: shifted,
      updatedAt: completedAt,
    }),
    individualAfter,
    completedAt,
  );
  return growthPlanSchema.parse({
    ...recalculated,
    status:
      individualAfter.currentLevel >= (plan.targetLevel ?? 70)
        ? "completed"
        : "active",
  });
}
