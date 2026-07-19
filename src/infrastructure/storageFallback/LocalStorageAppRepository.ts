import { z } from "zod";

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

const FALLBACK_KEY = "pokemon-sleep-island-simulator-data-v1";
function limitHistories(
  histories: readonly CalculationHistoryRecord[],
  limit: PersistedSettings["historyLimit"],
) {
  if (limit === null) return [...histories];
  return [...histories]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

const fallbackEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(4),
    individuals: pokemonIndividualListSchema,
    depositSessions: depositSessionListSchema,
    histories: calculationHistoryRecordListSchema,
    snapshots: namedSnapshotListSchema,
    plans: growthPlanListSchema,
    settings: persistedSettingsSchema,
  })
  .strict();

const legacyEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(1),
    individuals: pokemonIndividualListSchema,
    depositSessions: depositSessionListSchema,
  })
  .strict();

const phaseFourEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(2),
    individuals: pokemonIndividualListSchema,
    depositSessions: depositSessionListSchema,
    histories: calculationHistoryRecordListSchema,
    snapshots: namedSnapshotListSchema,
  })
  .strict();

const phaseFiveEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(3),
    individuals: pokemonIndividualListSchema,
    depositSessions: depositSessionListSchema,
    histories: calculationHistoryRecordListSchema,
    snapshots: namedSnapshotListSchema,
    plans: growthPlanListSchema,
  })
  .strict();

type FallbackEnvelope = z.infer<typeof fallbackEnvelopeSchema>;

const EMPTY_ENVELOPE: FallbackEnvelope = {
  schemaVersion: 4,
  individuals: [],
  depositSessions: [],
  histories: [],
  snapshots: [],
  plans: [],
  settings: defaultSettings(),
};

export class LocalStorageAppRepository implements AppRepository {
  readonly mode = "localstorage" as const;

  constructor(private readonly storage: Storage) {}

  async initialize(): Promise<void> {
    const envelope = this.read();
    this.write(envelope);
  }

  async listIndividuals(): Promise<readonly PokemonIndividual[]> {
    return [...this.read().individuals].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
  }

  async putIndividual(individual: PokemonIndividual): Promise<void> {
    const parsed = pokemonIndividualSchema.parse(individual);
    this.mutate((envelope) => ({
      ...envelope,
      individuals: [
        ...envelope.individuals.filter(({ id }) => id !== parsed.id),
        parsed,
      ],
    }));
  }

  async deleteIndividual(id: string): Promise<void> {
    this.mutate((envelope) => ({
      ...envelope,
      individuals: envelope.individuals.filter(
        (individual) => individual.id !== id,
      ),
      depositSessions: envelope.depositSessions.map((session) =>
        session.individualId === id
          ? { ...session, individualId: null }
          : session,
      ),
      plans: envelope.plans.filter((plan) => plan.individualId !== id),
    }));
  }

  async listDepositSessions(): Promise<readonly DepositSession[]> {
    return [...this.read().depositSessions].sort((left, right) =>
      right.startedAt.localeCompare(left.startedAt),
    );
  }

  async getActiveDeposit(): Promise<DepositSession | null> {
    return (
      this.read().depositSessions.find(({ status }) => status === "active") ??
      null
    );
  }

  async startDeposit(
    session: DepositSession,
    replaceActive: boolean,
  ): Promise<void> {
    const parsed = depositSessionSchema.parse(session);
    this.mutate((envelope) => {
      const active = envelope.depositSessions.filter(
        ({ status }) => status === "active",
      );
      if (active.length > 0 && !replaceActive) {
        throw new ActiveDepositConflictError();
      }

      const sessions = envelope.depositSessions
        .filter(({ id }) => id !== parsed.id)
        .map((existing) =>
          replaceActive && existing.status === "active"
            ? {
                ...existing,
                status: "cancelled" as const,
                completedAt: parsed.createdAt,
                updatedAt: parsed.createdAt,
              }
            : existing,
        );

      return { ...envelope, depositSessions: [...sessions, parsed] };
    });
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
    this.mutate((envelope) => ({
      ...envelope,
      depositSessions: [
        ...envelope.depositSessions.filter(({ id }) => id !== parsedSession.id),
        parsedSession,
      ],
      individuals:
        parsedIndividual === null
          ? envelope.individuals
          : [
              ...envelope.individuals.filter(
                ({ id }) => id !== parsedIndividual.id,
              ),
              parsedIndividual,
            ],
      histories: limitHistories(
        history === undefined
          ? envelope.histories
          : [
              ...envelope.histories.filter(({ id }) => id !== history.id),
              calculationHistoryRecordSchema.parse(history),
            ],
        envelope.settings.historyLimit,
      ),
    }));
  }

  async restoreDeposit(
    session: DepositSession,
    previousIndividual: PokemonIndividual | null,
    historyId?: string,
  ): Promise<void> {
    await this.completeDeposit(session, previousIndividual);
    if (historyId !== undefined) {
      this.mutate((envelope) => ({
        ...envelope,
        histories: envelope.histories.filter(({ id }) => id !== historyId),
      }));
    }
  }

  async listHistories(): Promise<readonly CalculationHistoryRecord[]> {
    return [...this.read().histories].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }

  async putHistory(history: CalculationHistoryRecord): Promise<void> {
    const parsed = calculationHistoryRecordSchema.parse(history);
    this.mutate((envelope) => ({
      ...envelope,
      histories: limitHistories(
        [...envelope.histories.filter(({ id }) => id !== parsed.id), parsed],
        envelope.settings.historyLimit,
      ),
    }));
  }

  async deleteHistory(id: string): Promise<void> {
    this.mutate((envelope) => ({
      ...envelope,
      histories: envelope.histories.filter((history) => history.id !== id),
    }));
  }

  async listSnapshots(): Promise<readonly NamedSnapshot[]> {
    return [...this.read().snapshots].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }

  async putSnapshot(snapshot: NamedSnapshot): Promise<void> {
    const parsed = namedSnapshotSchema.parse(snapshot);
    this.mutate((envelope) => ({
      ...envelope,
      snapshots: [
        ...envelope.snapshots.filter(({ id }) => id !== parsed.id),
        parsed,
      ],
    }));
  }

  async deleteSnapshot(id: string): Promise<void> {
    this.mutate((envelope) => ({
      ...envelope,
      snapshots: envelope.snapshots.filter((snapshot) => snapshot.id !== id),
    }));
  }

  async listGrowthPlans(): Promise<readonly GrowthPlan[]> {
    return [...this.read().plans].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
  }

  async putGrowthPlan(plan: GrowthPlan): Promise<void> {
    const parsed = growthPlanSchema.parse(plan);
    this.mutate((envelope) => ({
      ...envelope,
      plans: [...envelope.plans.filter(({ id }) => id !== parsed.id), parsed],
    }));
  }

  async deleteGrowthPlan(id: string): Promise<void> {
    this.mutate((envelope) => ({
      ...envelope,
      plans: envelope.plans.filter((plan) => plan.id !== id),
    }));
  }

  async getSettings(): Promise<PersistedSettings> {
    return this.read().settings;
  }

  async putSettings(settings: PersistedSettings): Promise<void> {
    const parsed = persistedSettingsSchema.parse(settings);
    this.mutate((envelope) => ({
      ...envelope,
      settings: parsed,
      histories: limitHistories(envelope.histories, parsed.historyLimit),
    }));
  }

  async readBackupPayload(): Promise<BackupPayload> {
    const {
      individuals,
      depositSessions: sessions,
      histories,
      snapshots,
      plans,
      settings,
    } = this.read();
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
    this.mutate((current) => {
      if (mode === "replace") {
        return {
          schemaVersion: 4,
          individuals: [...parsed.individuals],
          depositSessions: [...parsed.sessions],
          histories: [...parsed.histories],
          snapshots: [...parsed.snapshots],
          plans: [...parsed.plans],
          settings: parsed.settings,
        };
      }
      const mergeById = <T extends { readonly id: string }>(
        existing: readonly T[],
        incoming: readonly T[],
      ) => [
        ...new Map(
          [...existing, ...incoming].map((item) => [item.id, item]),
        ).values(),
      ];
      return {
        schemaVersion: 4,
        individuals: mergeById(current.individuals, parsed.individuals),
        depositSessions: mergeById(current.depositSessions, parsed.sessions),
        histories: mergeById(current.histories, parsed.histories),
        snapshots: mergeById(current.snapshots, parsed.snapshots),
        plans: mergeById(current.plans, parsed.plans),
        settings:
          parsed.settings.updatedAt >= current.settings.updatedAt
            ? parsed.settings
            : current.settings,
      };
    });
  }

  private read(): FallbackEnvelope {
    const serialized = this.storage.getItem(FALLBACK_KEY);
    if (serialized === null) return EMPTY_ENVELOPE;
    const raw = JSON.parse(serialized) as unknown;
    const current = fallbackEnvelopeSchema.safeParse(raw);
    if (current.success) return current.data;
    const phaseFive = phaseFiveEnvelopeSchema.safeParse(raw);
    if (phaseFive.success) {
      return {
        ...phaseFive.data,
        schemaVersion: 4,
        settings: defaultSettings(),
      };
    }
    const phaseFour = phaseFourEnvelopeSchema.safeParse(raw);
    if (phaseFour.success) {
      return {
        ...phaseFour.data,
        schemaVersion: 4,
        plans: [],
        settings: defaultSettings(),
      };
    }
    const legacy = legacyEnvelopeSchema.parse(raw);
    return {
      schemaVersion: 4,
      individuals: legacy.individuals,
      depositSessions: legacy.depositSessions,
      histories: [],
      snapshots: [],
      plans: [],
      settings: defaultSettings(),
    };
  }

  private write(envelope: FallbackEnvelope): void {
    this.storage.setItem(
      FALLBACK_KEY,
      JSON.stringify(fallbackEnvelopeSchema.parse(envelope)),
    );
  }

  private mutate(
    transform: (envelope: FallbackEnvelope) => FallbackEnvelope,
  ): void {
    this.write(transform(this.read()));
  }
}
