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
