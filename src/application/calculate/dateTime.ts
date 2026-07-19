interface DateTimeParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

function parseDateTimeLocal(value: string): DateTimeParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);

  if (match === null) {
    throw new RangeError("日時を入力してください。");
  }

  const [, year, month, day, hour, minute] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
  };
}

function getPartsAt(epochMs: number, timezone: string): DateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(epochMs))
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function partsToUtc(parts: DateTimeParts): number {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  );
}

function partsEqual(left: DateTimeParts, right: DateTimeParts): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute
  );
}

export function isIanaTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("ja-JP", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function zonedDateTimeToEpochMs(
  value: string,
  timezone: string,
): number {
  if (!isIanaTimeZone(timezone)) {
    throw new RangeError("有効なタイムゾーンを選択してください。");
  }

  const requested = parseDateTimeLocal(value);
  const nominalUtc = partsToUtc(requested);
  const firstOffset = partsToUtc(getPartsAt(nominalUtc, timezone)) - nominalUtc;
  let candidate = nominalUtc - firstOffset;
  const secondOffset = partsToUtc(getPartsAt(candidate, timezone)) - candidate;
  candidate = nominalUtc - secondOffset;

  if (!partsEqual(getPartsAt(candidate, timezone), requested)) {
    throw new RangeError(
      "その地域では存在しない、または解釈できない日時です。",
    );
  }

  return candidate;
}

export function formatEpochInTimeZone(
  epochMs: number,
  timezone: string,
): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: timezone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(epochMs));
}

export function toDateTimeLocalValue(
  epochMs: number,
  timezone: string,
): string {
  const parts = getPartsAt(epochMs, timezone);
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}
