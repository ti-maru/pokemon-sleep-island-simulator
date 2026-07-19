import { z } from "zod";

import { depositSessionListSchema } from "../deposits/schema";
import {
  calculationHistoryRecordListSchema,
  namedSnapshotListSchema,
} from "../history/schema";
import { pokemonIndividualListSchema } from "../individuals/schema";
import { growthPlanListSchema } from "../plans/schema";
import { persistedSettingsSchema } from "../settings/schema";

export const backupPayloadSchema = z
  .object({
    individuals: pokemonIndividualListSchema,
    sessions: depositSessionListSchema,
    histories: calculationHistoryRecordListSchema,
    snapshots: namedSnapshotListSchema,
    plans: growthPlanListSchema,
    settings: persistedSettingsSchema,
  })
  .strict()
  .superRefine((payload, context) => {
    if (
      payload.sessions.filter(({ status }) => status === "active").length > 1
    ) {
      context.addIssue({
        code: "custom",
        path: ["sessions"],
        message: "アクティブな預け入れは1件だけ復元できます。",
      });
    }
  });

export const backupEnvelopeSchema = z
  .object({
    format: z.literal("pokemon-sleep-island-simulator-backup"),
    schemaVersion: z.literal(1),
    appVersion: z.string().min(1),
    exportedAt: z.iso.datetime({ offset: true }),
    dataVersion: z.string().min(1),
    payload: backupPayloadSchema,
  })
  .strict();
