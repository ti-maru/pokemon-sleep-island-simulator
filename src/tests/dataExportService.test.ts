import { describe, expect, it } from "vitest";

import {
  createBackup,
  createSharePayload,
  decodeSharePayload,
  encodeSharePayload,
  historiesToCsv,
  historiesToVerificationJson,
  restoreBackup,
  serializeBackup,
} from "../application/export/dataExportService";
import { createWithdrawalHistory } from "../application/history/historyService";
import type { DepositSession } from "../domain/deposits/types";
import type { NamedSnapshot } from "../domain/history/types";
import { LocalStorageAppRepository } from "../infrastructure/storageFallback/LocalStorageAppRepository";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const completedAt = "2026-07-08T00:00:00.000Z";
const session: DepositSession = {
  id: "session-共有",
  individualId: "secret-name-id",
  startedAt: "2026-07-01T00:00:00.000Z",
  timezone: "Asia/Tokyo",
  plannedEndAt: null,
  relaxSetting: { mode: "none" },
  calculationSnapshot: {
    displayName: "秘密の個体名",
    expType: 600,
    natureMultiplier: 1,
    levelState: { level: 1, remainingExpToNextLevel: 54 },
    levelCap: 70,
  },
  sourcePlanId: null,
  sourcePlanSegmentId: null,
  status: "active",
  completedAt: null,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};
const history = createWithdrawalHistory(
  session,
  {
    stayMinutes: 10_080,
    expResult: {
      stayMinutes: 10_080,
      eligibleMinutes: 10_080,
      relaxMinutes: 0,
      baseRawExp: 1_050,
      relaxRawExp: 0,
      grossRawExp: 1_050,
      earlyWithdrawalApplied: false,
      withdrawalAdjustedExp: 1_050,
      natureMultiplier: 1,
      finalExp: 1_050,
      ruleSetId: "nap-island-2026-07-20-provisional-v1",
    },
    levelResult: null,
  },
  {
    actualExp: 1_000,
    levelState: null,
    relaxSetting: { mode: "none" },
    note: "検証",
    appliedSource: "actual-exp",
  },
  completedAt,
);
const snapshot: NamedSnapshot = {
  id: "snapshot-1",
  name: "日本語スナップショット",
  historyRecord: history,
  createdAt: completedAt,
  updatedAt: completedAt,
};

describe("data export service", () => {
  it("round-trips a validated backup and creates a pre-restore safety backup", async () => {
    const source = new LocalStorageAppRepository(new MemoryStorage());
    const target = new LocalStorageAppRepository(new MemoryStorage());
    await source.initialize();
    await target.initialize();
    await source.putHistory(history);
    await source.putSnapshot(snapshot);

    const backup = await createBackup(source, completedAt);
    const safety = await restoreBackup(
      target,
      serializeBackup(backup),
      "replace",
    );

    expect(safety.payload.histories).toEqual([]);
    expect((await target.listHistories())[0]?.id).toBe(history.id);
    expect((await target.listSnapshots())[0]?.name).toBe(snapshot.name);
  });

  it("encodes Unicode share data and strips names in calculation-only scope", () => {
    const decoded = decodeSharePayload(
      encodeSharePayload(createSharePayload(snapshot, "calculation")),
    );
    expect(decoded.name).toBeNull();
    expect(decoded.historyRecord.individualId).toBeNull();
    expect(decoded.historyRecord.depositSession).toBeNull();
    expect(
      JSON.stringify(createSharePayload(snapshot, "growth")),
    ).not.toContain("秘密の個体名");
  });

  it("exports anonymous verification CSV with predicted and actual differences", () => {
    const csv = historiesToCsv([history]);
    expect(csv).toContain('"1050"');
    expect(csv).toContain('"1000"');
    expect(csv).toContain('"-50"');
    expect(csv).not.toContain("秘密の個体名");
    expect(historiesToVerificationJson([history])).not.toContain(
      "秘密の個体名",
    );
  });

  it("rejects unsupported future backup versions without partially importing", async () => {
    const repository = new LocalStorageAppRepository(new MemoryStorage());
    await repository.initialize();
    const backup = await createBackup(repository, completedAt);
    const future = JSON.stringify({ ...backup, schemaVersion: 999 });

    await expect(
      restoreBackup(repository, future, "replace"),
    ).rejects.toThrow();
    expect(await repository.listHistories()).toEqual([]);
  });
});
