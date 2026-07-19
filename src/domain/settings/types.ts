export interface PersistedSettings {
  readonly id: "app";
  readonly theme: "system" | "light" | "dark";
  readonly defaultInputMode: "duration" | "datetime";
  readonly historyLimit: 25 | 50 | 100 | null;
  readonly timezone: string;
  readonly verificationMode: boolean;
  readonly pwaPromptDismissed: boolean;
  readonly updatedAt: string;
}
