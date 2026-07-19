import { z } from "zod";

import { calculationHistoryRecordSchema } from "../history/schema";

export const sharePayloadSchema = z
  .object({
    format: z.literal("pokemon-sleep-island-simulator-share"),
    version: z.literal(1),
    scope: z.enum(["calculation", "growth", "all"]),
    name: z.string().max(100).nullable(),
    historyRecord: calculationHistoryRecordSchema,
  })
  .strict();

export type SharePayload = z.infer<typeof sharePayloadSchema>;
