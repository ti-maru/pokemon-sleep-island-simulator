import type { DepositSession } from "../../domain/deposits/types";
import type { PokemonIndividual } from "../../domain/individuals/types";
import type { BackupPayload } from "../../domain/backup/types";
import type {
  CalculationHistoryRecord,
  NamedSnapshot,
} from "../../domain/history/types";
import type { GrowthPlan } from "../../domain/plans/types";
import type { PersistedSettings } from "../../domain/settings/types";
import type {
  AppRepository,
  StorageMode,
} from "../../application/persistence/AppRepository";

export class ResilientAppRepository implements AppRepository {
  private activeRepository: AppRepository;

  constructor(
    private readonly primary: AppRepository,
    private readonly fallback: AppRepository,
  ) {
    this.activeRepository = primary;
  }

  get mode(): StorageMode {
    return this.activeRepository.mode;
  }

  async initialize(): Promise<void> {
    try {
      await this.primary.initialize();
      this.activeRepository = this.primary;
    } catch {
      await this.fallback.initialize();
      this.activeRepository = this.fallback;
    }
  }

  listIndividuals(): Promise<readonly PokemonIndividual[]> {
    return this.activeRepository.listIndividuals();
  }

  putIndividual(individual: PokemonIndividual): Promise<void> {
    return this.activeRepository.putIndividual(individual);
  }

  deleteIndividual(id: string): Promise<void> {
    return this.activeRepository.deleteIndividual(id);
  }

  listDepositSessions(): Promise<readonly DepositSession[]> {
    return this.activeRepository.listDepositSessions();
  }

  getActiveDeposit(): Promise<DepositSession | null> {
    return this.activeRepository.getActiveDeposit();
  }

  startDeposit(session: DepositSession, replaceActive: boolean): Promise<void> {
    return this.activeRepository.startDeposit(session, replaceActive);
  }

  completeDeposit(
    session: DepositSession,
    updatedIndividual: PokemonIndividual | null,
    history?: CalculationHistoryRecord,
  ): Promise<void> {
    return this.activeRepository.completeDeposit(
      session,
      updatedIndividual,
      history,
    );
  }

  restoreDeposit(
    session: DepositSession,
    previousIndividual: PokemonIndividual | null,
    historyId?: string,
  ): Promise<void> {
    return this.activeRepository.restoreDeposit(
      session,
      previousIndividual,
      historyId,
    );
  }

  listHistories(): Promise<readonly CalculationHistoryRecord[]> {
    return this.activeRepository.listHistories();
  }

  putHistory(history: CalculationHistoryRecord): Promise<void> {
    return this.activeRepository.putHistory(history);
  }

  deleteHistory(id: string): Promise<void> {
    return this.activeRepository.deleteHistory(id);
  }

  listSnapshots(): Promise<readonly NamedSnapshot[]> {
    return this.activeRepository.listSnapshots();
  }

  putSnapshot(snapshot: NamedSnapshot): Promise<void> {
    return this.activeRepository.putSnapshot(snapshot);
  }

  deleteSnapshot(id: string): Promise<void> {
    return this.activeRepository.deleteSnapshot(id);
  }

  listGrowthPlans(): Promise<readonly GrowthPlan[]> {
    return this.activeRepository.listGrowthPlans();
  }

  putGrowthPlan(plan: GrowthPlan): Promise<void> {
    return this.activeRepository.putGrowthPlan(plan);
  }

  deleteGrowthPlan(id: string): Promise<void> {
    return this.activeRepository.deleteGrowthPlan(id);
  }

  getSettings(): Promise<PersistedSettings> {
    return this.activeRepository.getSettings();
  }

  putSettings(settings: PersistedSettings): Promise<void> {
    return this.activeRepository.putSettings(settings);
  }

  readBackupPayload(): Promise<BackupPayload> {
    return this.activeRepository.readBackupPayload();
  }

  restoreBackupPayload(
    payload: BackupPayload,
    mode: "replace" | "merge",
  ): Promise<void> {
    return this.activeRepository.restoreBackupPayload(payload, mode);
  }
}
