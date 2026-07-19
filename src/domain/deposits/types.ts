import type { ExpType, LevelState } from "../leveling/types";
import type { RelaxSetting } from "../napIsland/types";
import type { EntityId, IanaTimeZone, ISODateTime } from "../shared/types";

export interface DepositCalculationSnapshot {
  readonly displayName: string;
  readonly expType: ExpType;
  readonly natureMultiplier: number;
  readonly levelState: LevelState | null;
  readonly levelCap: number;
}

export interface DepositSession {
  readonly id: EntityId;
  readonly individualId: EntityId | null;
  readonly startedAt: ISODateTime;
  readonly timezone: IanaTimeZone;
  readonly plannedEndAt: ISODateTime | null;
  readonly relaxSetting: RelaxSetting;
  readonly calculationSnapshot: DepositCalculationSnapshot;
  readonly sourcePlanId: EntityId | null;
  readonly sourcePlanSegmentId: EntityId | null;
  readonly status: "active" | "completed" | "cancelled";
  readonly completedAt: ISODateTime | null;
  readonly createdAt: ISODateTime;
  readonly updatedAt: ISODateTime;
}
