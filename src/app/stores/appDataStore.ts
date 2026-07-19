import { create } from "zustand";

import {
  cancelDeposit,
  completeDeposit,
  createDepositSession,
  type StartDepositInput,
  type WithdrawalActualInput,
  type WithdrawalUndoRecord,
  undoWithdrawal,
  snapshotIndividual,
} from "../../application/deposits/depositService";
import {
  createIndividual,
  duplicateIndividual,
  type IndividualInput,
  updateIndividual,
} from "../../application/individuals/individualService";
import type { DepositSession } from "../../domain/deposits/types";
import type { PokemonIndividual } from "../../domain/individuals/types";
import type { StorageMode } from "../../application/persistence/AppRepository";
import { getAppRepository } from "../../infrastructure/repositories/createAppRepository";
import type {
  CalculationHistoryRecord,
  NamedSnapshot,
} from "../../domain/history/types";
import type { CalculationViewModel } from "../../features/calculator/calculatorTypes";
import type { GrowthPlan } from "../../domain/plans/types";
import type { PersistedSettings } from "../../domain/settings/types";
import {
  defaultSettings,
  persistedSettingsSchema,
} from "../../domain/settings/schema";
import {
  createCalculationHistory,
  recalculateHistoryWithLatestRules,
  saveNamedSnapshot,
} from "../../application/history/historyService";
import {
  createBackup,
  historiesToCsv,
  historiesToVerificationJson,
  restoreBackup,
  serializeBackup,
} from "../../application/export/dataExportService";
import {
  generateGrowthPlanOptions,
  recalculateGrowthPlan,
  type PlanWithdrawalUpdateMode,
  updatePlanAfterWithdrawal,
} from "../../application/plans/growthPlanService";

type ConflictResolution = "complete" | "cancel" | "abort";

interface AppDataState {
  readonly initialized: boolean;
  readonly loading: boolean;
  readonly error: string | null;
  readonly storageMode: StorageMode | null;
  readonly individuals: readonly PokemonIndividual[];
  readonly sessions: readonly DepositSession[];
  readonly histories: readonly CalculationHistoryRecord[];
  readonly snapshots: readonly NamedSnapshot[];
  readonly plans: readonly GrowthPlan[];
  readonly settings: PersistedSettings;
  readonly activeDeposit: DepositSession | null;
  readonly pendingDeposit: DepositSession | null;
  readonly lastUndo: WithdrawalUndoRecord | null;
  readonly lastUndoPlan: GrowthPlan | null;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  createIndividual: (input: IndividualInput) => Promise<PokemonIndividual>;
  updateIndividual: (id: string, input: IndividualInput) => Promise<void>;
  duplicateIndividual: (id: string) => Promise<void>;
  deleteIndividual: (id: string) => Promise<void>;
  requestDeposit: (input: StartDepositInput) => Promise<void>;
  resolveDepositConflict: (resolution: ConflictResolution) => Promise<void>;
  completeActiveDeposit: (
    actualInput?: WithdrawalActualInput,
    planUpdateMode?: PlanWithdrawalUpdateMode,
  ) => Promise<void>;
  cancelActiveDeposit: () => Promise<void>;
  undoLastWithdrawal: () => Promise<void>;
  recordCalculation: (
    model: CalculationViewModel,
  ) => Promise<CalculationHistoryRecord>;
  createSnapshot: (
    name: string,
    history: CalculationHistoryRecord,
  ) => Promise<void>;
  deleteHistory: (id: string) => Promise<void>;
  deleteSnapshot: (id: string) => Promise<void>;
  recalculateHistory: (id: string) => Promise<void>;
  exportBackup: () => Promise<string>;
  exportCsv: () => string;
  exportVerificationJson: () => string;
  importBackup: (
    serialized: string,
    mode: "replace" | "merge",
  ) => Promise<string>;
  generatePlanOptions: (input: {
    individualId: string;
    targetLevel: number;
    targetDate: string | null;
    startAt: string;
    timezone: string;
  }) => readonly GrowthPlan[];
  savePlan: (plan: GrowthPlan) => Promise<void>;
  deletePlan: (id: string) => Promise<void>;
  recalculatePlan: (id: string) => Promise<void>;
  startPlanSegment: (planId: string, segmentId: string) => Promise<void>;
  updateSettings: (
    patch: Partial<Omit<PersistedSettings, "id" | "updatedAt">>,
  ) => Promise<void>;
  clearError: () => void;
}

async function loadData() {
  const repository = getAppRepository();
  const [
    individuals,
    sessions,
    activeDeposit,
    histories,
    snapshots,
    plans,
    settings,
  ] = await Promise.all([
    repository.listIndividuals(),
    repository.listDepositSessions(),
    repository.getActiveDeposit(),
    repository.listHistories(),
    repository.listSnapshots(),
    repository.listGrowthPlans(),
    repository.getSettings(),
  ]);
  return {
    individuals,
    sessions,
    activeDeposit,
    histories,
    snapshots,
    plans,
    settings,
    storageMode: repository.mode,
  };
}

export const useAppDataStore = create<AppDataState>((set, get) => ({
  initialized: false,
  loading: false,
  error: null,
  storageMode: null,
  individuals: [],
  sessions: [],
  histories: [],
  snapshots: [],
  plans: [],
  settings: defaultSettings(),
  activeDeposit: null,
  pendingDeposit: null,
  lastUndo: null,
  lastUndoPlan: null,

  initialize: async () => {
    if (get().initialized || get().loading) return;
    set({ loading: true, error: null });
    try {
      const repository = getAppRepository();
      await repository.initialize();
      set({ ...(await loadData()), initialized: true, loading: false });
    } catch (error) {
      set({
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "保存領域を初期化できませんでした。",
      });
    }
  },

  refresh: async () => {
    try {
      set({ ...(await loadData()), error: null });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "データを読み込めませんでした。",
      });
    }
  },

  createIndividual: async (input) => {
    const individual = await createIndividual(getAppRepository(), input);
    await get().refresh();
    return individual;
  },

  updateIndividual: async (id, input) => {
    const existing = get().individuals.find(
      (individual) => individual.id === id,
    );
    if (existing === undefined) throw new Error("個体が見つかりません。");
    await updateIndividual(getAppRepository(), existing, input);
    await get().refresh();
  },

  duplicateIndividual: async (id) => {
    const existing = get().individuals.find(
      (individual) => individual.id === id,
    );
    if (existing === undefined) throw new Error("個体が見つかりません。");
    await duplicateIndividual(getAppRepository(), existing);
    await get().refresh();
  },

  deleteIndividual: async (id) => {
    await getAppRepository().deleteIndividual(id);
    await get().refresh();
  },

  requestDeposit: async (input) => {
    const session = createDepositSession(input);
    if (get().activeDeposit !== null) {
      set({ pendingDeposit: session });
      return;
    }
    await getAppRepository().startDeposit(session, false);
    await get().refresh();
  },

  resolveDepositConflict: async (resolution) => {
    const pending = get().pendingDeposit;
    const active = get().activeDeposit;
    if (pending === null || active === null) {
      set({ pendingDeposit: null });
      return;
    }
    if (resolution === "abort") {
      set({ pendingDeposit: null });
      return;
    }

    if (resolution === "complete") {
      const individual =
        active.individualId === null
          ? null
          : (get().individuals.find(({ id }) => id === active.individualId) ??
            null);
      await completeDeposit(getAppRepository(), active, individual);
      await getAppRepository().startDeposit(pending, false);
    } else {
      await getAppRepository().startDeposit(pending, true);
    }
    if (pending.sourcePlanId !== null && pending.sourcePlanSegmentId !== null) {
      const plan = get().plans.find(({ id }) => id === pending.sourcePlanId);
      if (plan !== undefined) {
        await getAppRepository().putGrowthPlan({
          ...plan,
          status: "active",
          segments: plan.segments.map((segment) =>
            segment.id === pending.sourcePlanSegmentId
              ? { ...segment, status: "active" as const }
              : segment,
          ),
          updatedAt: new Date().toISOString(),
        });
      }
    }
    set({ pendingDeposit: null, lastUndo: null, lastUndoPlan: null });
    await get().refresh();
  },

  completeActiveDeposit: async (actualInput, planUpdateMode = "keep-dates") => {
    const session = get().activeDeposit;
    if (session === null) return;
    const previousPlan =
      session.sourcePlanId === null
        ? null
        : (get().plans.find(({ id }) => id === session.sourcePlanId) ?? null);
    const individual =
      session.individualId === null
        ? null
        : (get().individuals.find(({ id }) => id === session.individualId) ??
          null);
    const undoRecord = await completeDeposit(
      getAppRepository(),
      session,
      individual,
      new Date().toISOString(),
      actualInput,
    );
    set({
      lastUndo: undoRecord,
      lastUndoPlan: planUpdateMode === "none" ? null : previousPlan,
    });
    await get().refresh();
    if (
      previousPlan !== null &&
      session.sourcePlanSegmentId !== null &&
      planUpdateMode !== "none"
    ) {
      const individualAfter = get().individuals.find(
        ({ id }) => id === previousPlan.individualId,
      );
      if (individualAfter !== undefined) {
        await getAppRepository().putGrowthPlan(
          updatePlanAfterWithdrawal(
            previousPlan,
            session.sourcePlanSegmentId,
            individualAfter,
            new Date().toISOString(),
            planUpdateMode,
          ),
        );
        await get().refresh();
      }
    }
  },

  cancelActiveDeposit: async () => {
    const session = get().activeDeposit;
    if (session === null) return;
    await cancelDeposit(getAppRepository(), session);
    set({ lastUndo: null, lastUndoPlan: null });
    await get().refresh();
  },

  undoLastWithdrawal: async () => {
    const record = get().lastUndo;
    if (record === null || get().activeDeposit !== null) return;
    await undoWithdrawal(getAppRepository(), record);
    const previousPlan = get().lastUndoPlan;
    if (previousPlan !== null)
      await getAppRepository().putGrowthPlan(previousPlan);
    set({ lastUndo: null, lastUndoPlan: null });
    await get().refresh();
  },

  recordCalculation: async (model) => {
    const history = createCalculationHistory(model);
    await getAppRepository().putHistory(history);
    await get().refresh();
    return history;
  },

  createSnapshot: async (name, history) => {
    await saveNamedSnapshot(getAppRepository(), name, history);
    await get().refresh();
  },

  deleteHistory: async (id) => {
    await getAppRepository().deleteHistory(id);
    await get().refresh();
  },

  deleteSnapshot: async (id) => {
    await getAppRepository().deleteSnapshot(id);
    await get().refresh();
  },

  recalculateHistory: async (id) => {
    const history = get().histories.find((candidate) => candidate.id === id);
    if (history === undefined) throw new Error("履歴が見つかりません。");
    await getAppRepository().putHistory(
      recalculateHistoryWithLatestRules(history),
    );
    await get().refresh();
  },

  exportBackup: async () =>
    serializeBackup(await createBackup(getAppRepository())),

  exportCsv: () => historiesToCsv(get().histories),

  exportVerificationJson: () => historiesToVerificationJson(get().histories),

  importBackup: async (serialized, mode) => {
    const safetyBackup = await restoreBackup(
      getAppRepository(),
      serialized,
      mode,
    );
    await get().refresh();
    return serializeBackup(safetyBackup);
  },

  generatePlanOptions: (input) => {
    const individual = get().individuals.find(
      ({ id }) => id === input.individualId,
    );
    if (individual === undefined) throw new Error("個体が見つかりません。");
    return generateGrowthPlanOptions({ ...input, individual });
  },

  savePlan: async (plan) => {
    const individual = get().individuals.find(
      ({ id }) => id === plan.individualId,
    );
    if (individual === undefined) throw new Error("個体が見つかりません。");
    await getAppRepository().putGrowthPlan(
      plan.strategy === "custom"
        ? recalculateGrowthPlan(plan, individual)
        : plan,
    );
    await get().refresh();
  },

  deletePlan: async (id) => {
    await getAppRepository().deleteGrowthPlan(id);
    await get().refresh();
  },

  recalculatePlan: async (id) => {
    const plan = get().plans.find((candidate) => candidate.id === id);
    if (plan === undefined) throw new Error("計画が見つかりません。");
    const individual = get().individuals.find(
      ({ id: individualId }) => individualId === plan.individualId,
    );
    if (individual === undefined) throw new Error("個体が見つかりません。");
    await getAppRepository().putGrowthPlan(
      recalculateGrowthPlan(plan, individual),
    );
    await get().refresh();
  },

  startPlanSegment: async (planId, segmentId) => {
    const plan = get().plans.find(({ id }) => id === planId);
    const segment = plan?.segments.find(({ id }) => id === segmentId);
    const individual =
      plan === undefined
        ? undefined
        : get().individuals.find(({ id }) => id === plan.individualId);
    if (
      plan === undefined ||
      segment === undefined ||
      individual === undefined
    ) {
      throw new Error("計画セグメントを開始できません。");
    }
    const startsImmediately = get().activeDeposit === null;
    await get().requestDeposit({
      individualId: individual.id,
      startedAt: new Date().toISOString(),
      timezone: segment.timezone,
      plannedEndAt: new Date(
        Date.now() +
          Math.max(0, Date.parse(segment.endAt) - Date.parse(segment.startAt)),
      ).toISOString(),
      relaxSetting: segment.relaxSetting,
      calculationSnapshot: snapshotIndividual(individual),
      sourcePlanId: plan.id,
      sourcePlanSegmentId: segment.id,
    });
    if (startsImmediately) {
      await getAppRepository().putGrowthPlan({
        ...plan,
        status: "active",
        segments: plan.segments.map((candidate) =>
          candidate.id === segment.id
            ? { ...candidate, status: "active" as const }
            : candidate,
        ),
        updatedAt: new Date().toISOString(),
      });
      await get().refresh();
    }
  },

  updateSettings: async (patch) => {
    const settings = persistedSettingsSchema.parse({
      ...get().settings,
      ...patch,
      id: "app",
      updatedAt: new Date().toISOString(),
    });
    await getAppRepository().putSettings(settings);
    await get().refresh();
  },

  clearError: () => set({ error: null }),
}));
