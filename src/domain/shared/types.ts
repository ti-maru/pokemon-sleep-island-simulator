export type EntityId = string;
export type ISODateTime = string;
export type IanaTimeZone = string;

export type DataConfidence =
  | "official"
  | "multi-source-verified"
  | "single-source"
  | "provisional"
  | "needs-review";

export interface AuditMeta {
  readonly createdAt: ISODateTime;
  readonly updatedAt: ISODateTime;
  readonly dataVersion: string;
  readonly sourceRefs: readonly string[];
  readonly confidence: DataConfidence;
}
