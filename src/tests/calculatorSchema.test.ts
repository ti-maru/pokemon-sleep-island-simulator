import { describe, expect, it } from "vitest";

import { calculatorSchema } from "../features/calculator/calculatorSchema";
import type { CalculatorFormValues } from "../features/calculator/calculatorTypes";

const validValues: CalculatorFormValues = {
  inputMode: "duration",
  durationDays: 7,
  durationHours: 0,
  durationMinutes: 0,
  startAt: "2026-07-13T02:00",
  endMode: "specified",
  endAt: "2026-07-20T02:00",
  timezone: "Asia/Tokyo",
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

describe("calculatorSchema", () => {
  it("accepts a complete valid calculator input", () => {
    expect(calculatorSchema.safeParse(validValues).success).toBe(true);
  });

  it("rejects an end datetime before the start", () => {
    const result = calculatorSchema.safeParse({
      ...validValues,
      inputMode: "datetime",
      endAt: "2026-07-12T02:00",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(({ path }) => path[0] === "endAt")).toBe(
        true,
      );
    }
  });

  it("validates remaining EXP against the effective curve", () => {
    const result = calculatorSchema.safeParse({
      ...validValues,
      levelEnabled: true,
      currentLevel: 1,
      remainingExpToNextLevel: 55,
    });

    expect(result.success).toBe(false);
  });
});
