import { describe, expect, it } from "vitest";

import {
  generateGrowthPlanOptions,
  recalculateGrowthPlan,
  updatePlanAfterWithdrawal,
} from "../application/plans/growthPlanService";
import type { PokemonIndividual } from "../domain/individuals/types";

const startAt = "2026-07-20T00:00:00.000Z";

function individual(): PokemonIndividual {
  return {
    id: "individual-1",
    pokemonId: null,
    displayName: "計画対象",
    natureId: null,
    expEffectOverride: null,
    expTypeOverride: 600,
    currentLevel: 1,
    remainingExpToNextLevel: 54,
    targetLevel: 20,
    targetDate: "2027-07-20T00:00:00.000Z",
    targetTimezone: "Asia/Tokyo",
    createdAt: startAt,
    updatedAt: startAt,
  };
}

describe("growth plan service", () => {
  it("generates fastest, ticket-saving, and seven-day strategies", () => {
    const plans = generateGrowthPlanOptions({
      individual: individual(),
      targetLevel: 20,
      targetDate: "2027-07-20T00:00:00.000Z",
      startAt,
      timezone: "Asia/Tokyo",
    });

    expect(plans.map(({ strategy }) => strategy)).toEqual([
      "fastest",
      "ticket-saving",
      "seven-day",
    ]);
    expect(plans.every(({ segments }) => segments.length > 0)).toBe(true);
    expect(plans[1]?.summary.ticketCount).toBeLessThanOrEqual(
      plans[0]?.summary.ticketCount ?? 0,
    );
    expect(
      plans[2]?.segments
        .slice(0, -1)
        .every(
          (segment) =>
            Date.parse(segment.endAt) - Date.parse(segment.startAt) ===
            7 * 24 * 60 * 60_000,
        ),
    ).toBe(true);
  });

  it("recalculates manual segment edits while preserving plan identity", () => {
    const original = generateGrowthPlanOptions({
      individual: individual(),
      targetLevel: 20,
      targetDate: null,
      startAt,
      timezone: "Asia/Tokyo",
    })[0];
    expect(original).toBeDefined();
    if (original === undefined) return;
    const edited = {
      ...original,
      strategy: "custom" as const,
      segments: original.segments.map((segment, index) =>
        index === 0
          ? {
              ...segment,
              endAt: new Date(
                Date.parse(segment.endAt) + 24 * 60 * 60_000,
              ).toISOString(),
            }
          : segment,
      ),
    };
    const recalculated = recalculateGrowthPlan(
      edited,
      individual(),
      "2026-07-21T00:00:00.000Z",
    );

    expect(recalculated.id).toBe(original.id);
    expect(recalculated.createdAt).toBe(original.createdAt);
    expect(recalculated.strategy).toBe("custom");
    expect(recalculated.summary.totalExpectedExp).toBeGreaterThan(
      original.summary.totalExpectedExp,
    );
  });

  it("marks the source segment completed and can shift remaining sessions continuously", () => {
    const original = generateGrowthPlanOptions({
      individual: individual(),
      targetLevel: 20,
      targetDate: null,
      startAt,
      timezone: "Asia/Tokyo",
    })[2];
    expect(original?.segments.length).toBeGreaterThan(1);
    if (original === undefined || original.segments[0] === undefined) return;
    const after = {
      ...individual(),
      currentLevel: 5,
      remainingExpToNextLevel: 100,
    };
    const completedAt = "2026-07-28T00:00:00.000Z";
    const updated = updatePlanAfterWithdrawal(
      original,
      original.segments[0].id,
      after,
      completedAt,
      "continuous",
    );

    expect(updated.segments[0]?.status).toBe("completed");
    expect(updated.segments[0]?.endAt).toBe(completedAt);
    expect(updated.segments[1]?.startAt).toBe(completedAt);
  });
});
