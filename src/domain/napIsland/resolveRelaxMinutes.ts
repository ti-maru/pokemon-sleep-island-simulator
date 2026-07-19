import type { RelaxSetting } from "./types";

export const RELAX_TICKET_MINUTES = 7 * 24 * 60;

export function resolveRelaxMinutes(
  stayMinutes: number,
  setting: RelaxSetting,
): number {
  if (!Number.isFinite(stayMinutes)) {
    throw new RangeError("stayMinutes must be finite.");
  }

  const completedStayMinutes = Math.max(0, Math.floor(stayMinutes));

  if (setting.mode === "none") {
    return 0;
  }

  const requestedMinutes =
    setting.mode === "tickets"
      ? setting.ticketCount * RELAX_TICKET_MINUTES
      : setting.durationMinutes;

  if (!Number.isFinite(requestedMinutes) || requestedMinutes < 0) {
    throw new RangeError(
      "The relax setting must be a non-negative finite value.",
    );
  }

  if (setting.mode === "tickets" && !Number.isInteger(setting.ticketCount)) {
    throw new RangeError("ticketCount must be an integer.");
  }

  return Math.min(completedStayMinutes, Math.floor(requestedMinutes));
}
