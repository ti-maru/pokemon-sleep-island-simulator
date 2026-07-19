import { z } from "zod";

export const persistedSettingsSchema = z
  .object({
    id: z.literal("app"),
    theme: z.enum(["system", "light", "dark"]),
    defaultInputMode: z.enum(["duration", "datetime"]),
    historyLimit: z.union([
      z.literal(25),
      z.literal(50),
      z.literal(100),
      z.null(),
    ]),
    timezone: z.string().min(1),
    verificationMode: z.boolean(),
    pwaPromptDismissed: z.boolean(),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export function defaultSettings(
  timezone = "Asia/Tokyo",
): import("./types").PersistedSettings {
  return persistedSettingsSchema.parse({
    id: "app",
    theme: "system",
    defaultInputMode: "duration",
    historyLimit: 50,
    timezone,
    verificationMode: false,
    pwaPromptDismissed: false,
    updatedAt: new Date(0).toISOString(),
  });
}
