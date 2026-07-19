const PREFERRED_TIME_ZONES = ["Asia/Tokyo", "UTC"] as const;

const FALLBACK_TIME_ZONES = [
  "Africa/Cairo",
  "Africa/Johannesburg",
  "America/Anchorage",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/New_York",
  "America/Sao_Paulo",
  "Asia/Bangkok",
  "Asia/Dubai",
  "Asia/Hong_Kong",
  "Asia/Jakarta",
  "Asia/Kolkata",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Taipei",
  "Australia/Brisbane",
  "Australia/Sydney",
  "Europe/Berlin",
  "Europe/London",
  "Europe/Moscow",
  "Europe/Paris",
  "Pacific/Auckland",
  "Pacific/Honolulu",
] as const;

function readSupportedTimeZones(): readonly string[] {
  const supportedValuesOf = (
    Intl as typeof Intl & {
      supportedValuesOf?: (key: "timeZone") => string[];
    }
  ).supportedValuesOf;

  if (supportedValuesOf === undefined) return FALLBACK_TIME_ZONES;

  try {
    return supportedValuesOf("timeZone");
  } catch {
    return FALLBACK_TIME_ZONES;
  }
}

const DISCOVERED_TIME_ZONES = readSupportedTimeZones();

export function getTimeZoneOptions(currentValue?: string): readonly string[] {
  const preferred = [
    ...PREFERRED_TIME_ZONES,
    ...(currentValue === undefined ? [] : [currentValue]),
  ];
  const preferredSet = new Set(preferred);
  const remaining = [...DISCOVERED_TIME_ZONES]
    .filter((timeZone) => !preferredSet.has(timeZone))
    .sort((left, right) => left.localeCompare(right, "en"));

  return [...new Set([...preferred, ...remaining])];
}

export function getUtcOffsetMinutes(
  timeZone: string,
  referenceEpochMs = Date.now(),
): number {
  const minuteEpochMs = Math.floor(referenceEpochMs / 60_000) * 60_000;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(minuteEpochMs))
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  const zonedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
  );

  return Math.round((zonedAsUtc - minuteEpochMs) / 60_000);
}

export function formatTimeZoneOption(
  timeZone: string,
  referenceEpochMs = Date.now(),
): string {
  const offsetMinutes = getUtcOffsetMinutes(timeZone, referenceEpochMs);
  const absoluteMinutes = Math.abs(offsetMinutes);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, "0");
  const minutes = String(absoluteMinutes % 60).padStart(2, "0");

  return `UTC${sign}${hours}:${minutes} — ${timeZone}`;
}
