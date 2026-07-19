import type { DepositSession } from "../../domain/deposits/types";
import {
  depositSessionListSchema,
  depositSessionSchema,
} from "../../domain/deposits/schema";
import type { PokemonIndividual } from "../../domain/individuals/types";
import {
  pokemonIndividualListSchema,
  pokemonIndividualSchema,
} from "../../domain/individuals/schema";
import {
  ActiveDepositConflictError,
  type AppRepository,
} from "../../application/persistence/AppRepository";
import { AppDatabase } from "../db/AppDatabase";
import type { BackupPayload } from "../../domain/backup/types";
import { backupPayloadSchema } from "../../domain/backup/schema";
import type {
  CalculationHistoryRecord,
  NamedSnapshot,
} from "../../domain/history/types";
import {
  calculationHistoryRecordListSchema,
  calculationHistoryRecordSchema,
  namedSnapshotListSchema,
  namedSnapshotSchema,
} from "../../domain/history/schema";
import type { GrowthPlan } from "../../domain/plans/types";
import {
  growthPlanListSchema,
  growthPlanSchema,
} from "../../domain/plans/schema";
import type { PersistedSettings } from "../../domain/settings/types";
import {
  defaultSettings,
  persistedSettingsSchema,
} from "../../domain/settings/schema";

export class DexieAppRepository implements AppRepository {
  readonly mode = "indexeddb" as const;

  constructor(readonly database = new AppDatabase()) {}

  async initialize(): Promise<void> {
    await this.database.open();
    if ((await this.database.appSettings.get("app")) === undefined) {
      await this.database.appSettings.put(defaultSettings());
    }
  }

  async listIndividuals(): Promise<readonly PokemonIndividual[]> {
    return pokemonIndividualListSchema.parse(
      await this.database.individuals.orderBy("updatedAt").reverse().toArray(),
    );
  }

  async putIndividual(individual: PokemonIndividual): Promise<void> {
    await this.database.individuals.put(
      pokemonIndividualSchema.parse(individual),
    );
  }

  async deleteIndividual(id: string): Promise<void> {
    await this.database.transaction(
      "rw",
      this.database.individuals,
      this.database.depositSessions,
      this.database.growthPlans,
      async () => {
        await this.database.individuals.delete(id);
        const linkedSessions = await this.database.depositSessions
          .where("individualId")
          .equals(id)
          .toArray();
        await this.database.depositSessions.bulkPut(
          linkedSessions.map((session) => ({ ...session, individualId: null })),
        );
        await this.database.growthPlans
          .where("individualId")
          .equals(id)
          .delete();
      },
    );
  }

  async listDepositSessions(): Promise<readonly DepositSession[]> {
    return depositSessionListSchema.parse(
      await this.database.depositSessions
        .orderBy("startedAt")
        .reverse()
        .toArray(),
    );
  }

  async getActiveDeposit(): Promise<DepositSession | null> {
    const active = await this.database.depositSessions
      .where("status")
      .equals("active")
      .first();
    return active === undefined ? null : depositSessionSchema.parse(active);
  }

  async startDeposit(
    session: DepositSession,
    replaceActive: boolean,
  ): Promise<void> {
    const parsed = depositSessionSchema.parse(session);
    await this.database.transaction(
      "rw",
      this.database.depositSessions,
      async () => {
        const activeSessions = await this.database.depositSessions
          .where("status")
          .equals("active")
          .toArray();

        if (activeSessions.length > 0 && !replaceActive) {
          throw new ActiveDepositConflictError();
        }

        if (replaceActive) {
          const now = parsed.createdAt;
          await this.database.depositSessions.bulkPut(
            activeSessions.map((active) => ({
              ...active,
              status: "cancelled" as const,
              completedAt: now,
              updatedAt: now,
            })),
          );
        }

        await this.database.depositSessions.put(parsed);
      },
    );
  }

  async completeDeposit(
    session: DepositSession,
    updatedIndividual: PokemonIndividual | null,
    history?: CalculationHistoryRecord,
  ): Promise<void> {
    const parsedSession = depositSessionSchema.parse(session);
    const parsedIndividual =
      updatedIndividual === null
        ? null
        : pokemonIndividualSchema.parse(updatedIndividual);
    await this.database.transaction(
      "rw",
      this.database.depositSessions,
      this.database.individuals,
      this.database.histories,
      this.database.appSettings,
      async () => {
        await this.database.depositSessions.put(parsedSession);
        if (parsedIndividual !== null) {
          await this.database.individuals.put(parsedIndividual);
        }
        if (history !== undefined) {
          await this.database.histories.put(
            calculationHistoryRecordSchema.parse(history),
          );
          await this.trimHistories();
        }
      },
    );
  }

  async restoreDeposit(
    session: DepositSession,
    previousIndividual: PokemonIndividual | null,
    historyId?: string,
  ): Promise<void> {
    const parsedSession = depositSessionSchema.parse(session);
    const parsedIndividual =
      previousIndividual === null
        ? null
        : pokemonIndividualSchema.parse(previousIndividual);
    await this.database.transaction(
      "rw",
      this.database.depositSessions,
      this.database.individuals,
      this.database.histories,
      async () => {
        await this.database.depositSessions.put(parsedSession);
        if (parsedIndividual !== null) {
          await this.database.individuals.put(parsedIndividual);
        }
        if (historyId !== undefined)
          await this.database.histories.delete(historyId);
      },
    );
  }

  async listHistories(): Promise<readonly CalculationHistoryRecord[]> {
    return calculationHistoryRecordListSchema.parse(
      await this.database.histories.orderBy("createdAt").reverse().toArray(),
    );
  }

  async putHistory(history: CalculationHistoryRecord): Promise<void> {
    await this.database.transaction(
      "rw",
      this.database.histories,
      this.database.appSettings,
      async () => {
        await this.database.histories.put(
          calculationHistoryRecordSchema.parse(history),
        );
        await this.trimHistories();
      },
    );
  }

  async deleteHistory(id: string): Promise<void> {
    await this.database.histories.delete(id);
  }

  async listSnapshots(): Promise<readonly NamedSnapshot[]> {
    return namedSnapshotListSchema.parse(
      await this.database.snapshots.orderBy("createdAt").reverse().toArray(),
    );
  }

  async putSnapshot(snapshot: NamedSnapshot): Promise<void> {
    await this.database.snapshots.put(namedSnapshotSchema.parse(snapshot));
  }

  async deleteSnapshot(id: string): Promise<void> {
    await this.database.snapshots.delete(id);
  }

  async listGrowthPlans(): Promise<readonly GrowthPlan[]> {
    return growthPlanListSchema.parse(
      await this.database.growthPlans.orderBy("updatedAt").reverse().toArray(),
    );
  }

  async putGrowthPlan(plan: GrowthPlan): Promise<void> {
    await this.database.growthPlans.put(growthPlanSchema.parse(plan));
  }

  async deleteGrowthPlan(id: string): Promise<void> {
    await this.database.growthPlans.delete(id);
  }

  async getSettings(): Promise<PersistedSettings> {
    return persistedSettingsSchema.parse(
      (await this.database.appSettings.get("app")) ?? defaultSettings(),
    );
  }

  async putSettings(settings: PersistedSettings): Promise<void> {
    await this.database.transaction(
      "rw",
      this.database.appSettings,
      this.database.histories,
      async () => {
        await this.database.appSettings.put(
          persistedSettingsSchema.parse(settings),
        );
        await this.trimHistories();
      },
    );
  }

  async readBackupPayload(): Promise<BackupPayload> {
    const [individuals, sessions, histories, snapshots, plans, settings] =
      await Promise.all([
        this.listIndividuals(),
        this.listDepositSessions(),
        this.listHistories(),
        this.listSnapshots(),
        this.listGrowthPlans(),
        this.getSettings(),
      ]);
    return backupPayloadSchema.parse({
      individuals,
      sessions,
      histories,
      snapshots,
      plans,
      settings,
    });
  }

  async restoreBackupPayload(
    payload: BackupPayload,
    mode: "replace" | "merge",
  ): Promise<void> {
    const parsed = backupPayloadSchema.parse(payload);
    await this.database.transaction(
      "rw",
      [
        this.database.individuals,
        this.database.depositSessions,
        this.database.histories,
        this.database.snapshots,
        this.database.growthPlans,
        this.database.appSettings,
      ],
      async () => {
        if (mode === "replace") {
          await Promise.all([
            this.database.individuals.clear(),
            this.database.depositSessions.clear(),
            this.database.histories.clear(),
            this.database.snapshots.clear(),
            this.database.growthPlans.clear(),
            this.database.appSettings.clear(),
          ]);
        }
        await Promise.all([
          this.database.individuals.bulkPut([...parsed.individuals]),
          this.database.depositSessions.bulkPut([...parsed.sessions]),
          this.database.histories.bulkPut([...parsed.histories]),
          this.database.snapshots.bulkPut([...parsed.snapshots]),
          this.database.growthPlans.bulkPut([...parsed.plans]),
          this.database.appSettings.put(parsed.settings),
        ]);
      },
    );
  }

  private async trimHistories(): Promise<void> {
    const limit =
      (await this.database.appSettings.get("app"))?.historyLimit ?? 50;
    if (limit === null) return;
    const obsoleteIds = await this.database.histories
      .orderBy("createdAt")
      .reverse()
      .offset(limit)
      .primaryKeys();
    await this.database.histories.bulkDelete(obsoleteIds);
  }
}
