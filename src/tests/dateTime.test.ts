import { describe, expect, it } from "vitest";

import {
  formatEpochInTimeZone,
  zonedDateTimeToEpochMs,
} from "../application/calculate/dateTime";
import {
  formatTimeZoneOption,
  getTimeZoneOptions,
  getTimeZoneSelectOptions,
  getUtcOffsetMinutes,
} from "../application/calculate/timeZoneOptions";

describe("zonedDateTimeToEpochMs", () => {
  it("provides unique IANA time zones ordered by current UTC offset", () => {
    const referenceEpochMs = Date.parse("2026-07-20T00:00:00Z");
    const options = getTimeZoneOptions("Europe/London", referenceEpochMs);
    const selectOptions = getTimeZoneSelectOptions(
      "Europe/London",
      referenceEpochMs,
    );

    expect(new Set(options).size).toBe(options.length);
    expect(options.length).toBeGreaterThan(20);
    expect(options).toContain("UTC");
    expect(options).toContain("Asia/Tokyo");
    expect(options).toContain("Europe/London");
    expect(selectOptions.map(({ offsetMinutes }) => offsetMinutes)).toEqual(
      [...selectOptions]
        .map(({ offsetMinutes }) => offsetMinutes)
        .sort((left, right) => left - right),
    );
    for (let index = 1; index < selectOptions.length; index += 1) {
      const previous = selectOptions[index - 1]!;
      const current = selectOptions[index]!;
      if (previous.offsetMinutes === current.offsetMinutes) {
        expect(previous.value.localeCompare(current.value, "en")).toBeLessThan(
          1,
        );
      }
    }
  });

  it("formats current UTC offsets including daylight saving and half-hour zones", () => {
    const summer = Date.parse("2026-07-20T00:00:00Z");
    const winter = Date.parse("2026-01-20T00:00:00Z");

    expect(formatTimeZoneOption("Asia/Tokyo", summer)).toBe(
      "UTC+09:00 — Asia/Tokyo",
    );
    expect(formatTimeZoneOption("UTC", summer)).toBe("UTC+00:00 — UTC");
    expect(formatTimeZoneOption("Asia/Kolkata", summer)).toBe(
      "UTC+05:30 — Asia/Kolkata",
    );
    expect(getUtcOffsetMinutes("America/New_York", summer)).toBe(-240);
    expect(getUtcOffsetMinutes("America/New_York", winter)).toBe(-300);
  });

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
