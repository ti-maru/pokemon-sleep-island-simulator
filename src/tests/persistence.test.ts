import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import {
  ActiveDepositConflictError,
  type AppRepository,
} from "../application/persistence/AppRepository";
import type { DepositSession } from "../domain/deposits/types";
import type { PokemonIndividual } from "../domain/individuals/types";
import { AppDatabase } from "../infrastructure/db/AppDatabase";
import { DexieAppRepository } from "../infrastructure/repositories/DexieAppRepository";
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

const now = "2026-07-19T00:00:00.000Z";

function individual(id = "individual-1"): PokemonIndividual {
  return {
    id,
    pokemonId: null,
    displayName: "テスト個体",
    natureId: null,
    expEffectOverride: null,
    expTypeOverride: 600,
    currentLevel: 1,
    remainingExpToNextLevel: 54,
    targetLevel: 10,
    targetDate: null,
    targetTimezone: null,
    createdAt: now,
    updatedAt: now,
  };
}

function session(
  id: string,
  individualId: string | null = "individual-1",
): DepositSession {
  return {
    id,
    individualId,
    startedAt: now,
    timezone: "Asia/Tokyo",
    plannedEndAt: null,
    relaxSetting: { mode: "none" },
    calculationSnapshot: {
      displayName: "テスト個体",
      expType: 600,
      natureMultiplier: 1,
      levelState: { level: 1, remainingExpToNextLevel: 54 },
      levelCap: 70,
    },
    sourcePlanId: null,
    sourcePlanSegmentId: null,
    status: "active",
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

const databases: AppDatabase[] = [];

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()));
});

function repositoryCases(): readonly [string, () => AppRepository][] {
  return [
    [
      "localStorage fallback",
      () => new LocalStorageAppRepository(new MemoryStorage()),
    ],
    [
      "IndexedDB",
      () => {
        const database = new AppDatabase(`test-${crypto.randomUUID()}`);
        databases.push(database);
        return new DexieAppRepository(database);
      },
    ],
  ];
}

describe.each(repositoryCases())("%s repository", (_name, createRepository) => {
  it("persists individuals and unlinks sessions when an individual is deleted", async () => {
    const repository = createRepository();
    await repository.initialize();
    await repository.putIndividual(individual());
    await repository.startDeposit(session("session-1"), false);

    expect(await repository.listIndividuals()).toHaveLength(1);
    await repository.deleteIndividual("individual-1");

    expect(await repository.listIndividuals()).toEqual([]);
    expect(
      (await repository.listDepositSessions())[0]?.individualId,
    ).toBeNull();
  });

  it("enforces one active deposit and can atomically replace it", async () => {
    const repository = createRepository();
    await repository.initialize();
    await repository.startDeposit(session("session-1", null), false);

    await expect(
      repository.startDeposit(session("session-2", null), false),
    ).rejects.toBeInstanceOf(ActiveDepositConflictError);

    await repository.startDeposit(session("session-2", null), true);
    const sessions = await repository.listDepositSessions();
    expect(
      sessions.filter(({ status }) => status === "active").map(({ id }) => id),
    ).toEqual(["session-2"]);
    expect(sessions.find(({ id }) => id === "session-1")?.status).toBe(
      "cancelled",
    );
  });

  it("persists validated application settings", async () => {
    const repository = createRepository();
    await repository.initialize();
    const initial = await repository.getSettings();
    expect(initial.historyLimit).toBe(50);

    await repository.putSettings({
      ...initial,
      theme: "dark",
      historyLimit: 25,
      updatedAt: "2026-07-19T01:00:00.000Z",
    });
    expect(await repository.getSettings()).toMatchObject({
      theme: "dark",
      historyLimit: 25,
    });
  });
});

describe("fallback migrations", () => {
  it("migrates the phase 3 envelope without losing individuals", async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "pokemon-sleep-island-simulator-data-v1",
      JSON.stringify({
        schemaVersion: 1,
        individuals: [individual()],
        depositSessions: [],
      }),
    );
    const repository = new LocalStorageAppRepository(storage);

    await repository.initialize();

    expect((await repository.listIndividuals())[0]?.id).toBe("individual-1");
    expect((await repository.getSettings()).historyLimit).toBe(50);
    expect(await repository.listGrowthPlans()).toEqual([]);
  });
});
