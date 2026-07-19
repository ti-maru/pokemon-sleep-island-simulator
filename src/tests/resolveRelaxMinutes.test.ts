import { describe, expect, it } from "vitest";

import { resolveRelaxMinutes } from "../domain/napIsland/resolveRelaxMinutes";

describe("resolveRelaxMinutes", () => {
  it("returns zero when no set is used", () => {
    expect(resolveRelaxMinutes(20_000, { mode: "none" })).toBe(0);
  });

  it("converts tickets to continuous seven-day periods", () => {
    expect(
      resolveRelaxMinutes(30_000, { mode: "tickets", ticketCount: 2 }),
    ).toBe(20_160);
  });

  it("caps a duration at the stay", () => {
    expect(
      resolveRelaxMinutes(1_000, {
        mode: "duration",
        durationMinutes: 2_000,
      }),
    ).toBe(1_000);
  });

  it("rejects fractional ticket counts", () => {
    expect(() =>
      resolveRelaxMinutes(1_000, { mode: "tickets", ticketCount: 1.5 }),
    ).toThrow(RangeError);
  });
});
