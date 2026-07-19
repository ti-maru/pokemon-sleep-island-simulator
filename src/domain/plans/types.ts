import type { LevelState } from "../leveling/types";
import type { RelaxSetting } from "../napIsland/types";
import type { EntityId, ISODateTime } from "../shared/types";

export interface PlanSegment {
  readonly id: EntityId;
  readonly startAt: ISODateTime;
  readonly endAt: ISODateTime;
  readonly timezone: string;
  readonly relaxSetting: RelaxSetting;
  readonly expectedExp: number;
  readonly expectedEndState: LevelState;
  readonly status: "planned" | "active" | "completed" | "skipped";
}

export interface GrowthPlan {
  readonly id: EntityId;
  readonly individualId: EntityId;
  readonly name: string;
  readonly strategy: "fastest" | "ticket-saving" | "seven-day" | "custom";
  readonly targetLevel: number | null;
  readonly targetDate: ISODateTime | null;
  readonly segments: readonly PlanSegment[];
  readonly status: "draft" | "active" | "completed" | "archived";
  readonly summary: {
    readonly reachable: boolean;
    readonly expectedEndAt: ISODateTime | null;
    readonly totalExpectedExp: number;
    readonly ticketCount: number;
    readonly missingExp: number;
    readonly maximumLevel: number;
  };
  readonly createdAt: ISODateTime;
  readonly updatedAt: ISODateTime;
}
