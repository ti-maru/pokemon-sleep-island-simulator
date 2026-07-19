import { z } from "zod";

export const relaxSettingSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("none") }).strict(),
  z
    .object({
      mode: z.literal("tickets"),
      ticketCount: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      mode: z.literal("duration"),
      durationMinutes: z.number().int().nonnegative(),
    })
    .strict(),
]);
