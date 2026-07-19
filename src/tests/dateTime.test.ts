import { describe, expect, it } from "vitest";

import {
  formatEpochInTimeZone,
  zonedDateTimeToEpochMs,
} from "../application/calculate/dateTime";

describe("zonedDateTimeToEpochMs", () => {
  it("interprets a local value in the selected IANA timezone", () => {
    expect(zonedDateTimeToEpochMs("2026-07-20T02:00", "Asia/Tokyo")).toBe(
      Date.parse("2026-07-19T17:00:00Z"),
    );
  });

  it("rejects a nonexistent daylight-saving time", () => {
    expect(() =>
      zonedDateTimeToEpochMs("2026-03-08T02:30", "America/New_York"),
    ).toThrow(RangeError);
  });

  it("formats an epoch in the selected timezone", () => {
    expect(
      formatEpochInTimeZone(Date.parse("2026-07-19T17:00:00Z"), "Asia/Tokyo"),
    ).toContain("2:00");
  });
});
