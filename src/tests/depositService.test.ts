import { describe, expect, it } from "vitest";

import {
  calculateDepositProjection,
  completeDeposit,
  createDepositSession,
  undoWithdrawal,
} from "../application/deposits/depositService";
import type { PokemonIndividual } from "../domain/individuals/types";
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

const startedAt = "2026-07-01T00:00:00.000Z";

function individual(): PokemonIndividual {
  return {
    id: "individual-1",
    pokemonId: null,
    displayName: "育成対象",
    natureId: null,
    expEffectOverride: null,
    expTypeOverride: 600,
    currentLevel: 1,
    remainingExpToNextLevel: 54,
    targetLevel: null,
    targetDate: null,
    targetTimezone: null,
    createdAt: startedAt,
    updatedAt: startedAt,
  };
}

function activeSession() {
  return createDepositSession(
    {
      individualId: "individual-1",
      startedAt,
      timezone: "Asia/Tokyo",
      plannedEndAt: null,
      relaxSetting: { mode: "none" },
      calculationSnapshot: {
        displayName: "育成対象",
        expType: 600,
        natureMultiplier: 1,
        levelState: { level: 1, remainingExpToNextLevel: 54 },
        levelCap: 70,
      },
    },
    startedAt,
  );
}

describe("deposit service", () => {
  it("projects EXP and levels without mutating the session", () => {
    const session = activeSession();
    const before = structuredClone(session);
    const projection = calculateDepositProjection(
      session,
      Date.parse(startedAt) + 7 * 24 * 60 * 60_000,
    );

    expect(projection.stayMinutes).toBe(10_080);
    expect(projection.expResult.finalExp).toBeGreaterThan(0);
    expect(projection.levelResult?.afterLevel).toBeGreaterThan(1);
    expect(session).toEqual(before);
  });

  it("completes a withdrawal atomically and restores it with undo", async () => {
    const repository = new LocalStorageAppRepository(new MemoryStorage());
    const savedIndividual = individual();
    const session = activeSession();
    await repository.initialize();
    await repository.putIndividual(savedIndividual);
    await repository.startDeposit(session, false);

    const completedAt = "2026-07-08T00:00:00.000Z";
    const undoRecord = await completeDeposit(
      repository,
      session,
      savedIndividual,
      completedAt,
    );
    expect(await repository.getActiveDeposit()).toBeNull();
    expect((await repository.listDepositSessions())[0]?.status).toBe(
      "completed",
    );
    expect(
      (await repository.listIndividuals())[0]?.currentLevel,
    ).toBeGreaterThan(1);
    expect((await repository.listHistories())[0]?.kind).toBe("withdrawal");

    await undoWithdrawal(repository, undoRecord);
    expect((await repository.getActiveDeposit())?.id).toBe(session.id);
    expect((await repository.listIndividuals())[0]).toEqual(savedIndividual);
    expect(await repository.listHistories()).toEqual([]);
  });

  it("stores conflicting actual values and applies the explicitly selected source", async () => {
    const repository = new LocalStorageAppRepository(new MemoryStorage());
    const savedIndividual = individual();
    const session = activeSession();
    await repository.initialize();
    await repository.putIndividual(savedIndividual);
    await repository.startDeposit(session, false);

    await completeDeposit(
      repository,
      session,
      savedIndividual,
      "2026-07-08T00:00:00.000Z",
      {
        actualExp: 0,
        levelState: { level: 5, remainingExpToNextLevel: 100 },
        relaxSetting: { mode: "tickets", ticketCount: 1 },
        note: "ゲーム画面を確認",
        appliedSource: "actual-level",
      },
    );

    expect(await repository.listIndividuals()).toMatchObject([
      { currentLevel: 5, remainingExpToNextLevel: 100 },
    ]);
    expect((await repository.listHistories())[0]?.actualResult).toMatchObject({
      actualExp: 0,
      levelState: { level: 5, remainingExpToNextLevel: 100 },
      appliedSource: "actual-level",
    });
  });
});
