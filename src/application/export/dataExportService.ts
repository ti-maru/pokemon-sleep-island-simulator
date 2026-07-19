import { dataManifest } from "../../data/masterData";
import { backupEnvelopeSchema } from "../../domain/backup/schema";
import type { BackupEnvelope } from "../../domain/backup/types";
import type {
  CalculationHistoryRecord,
  NamedSnapshot,
} from "../../domain/history/types";
import {
  sharePayloadSchema,
  type SharePayload,
} from "../../domain/sharing/schema";
import type { AppRepository } from "../persistence/AppRepository";

const APP_VERSION = "0.2.0";

export async function createBackup(
  repository: AppRepository,
  exportedAt = new Date().toISOString(),
): Promise<BackupEnvelope> {
  return backupEnvelopeSchema.parse({
    format: "pokemon-sleep-island-simulator-backup",
    schemaVersion: 1,
    appVersion: APP_VERSION,
    exportedAt,
    dataVersion: dataManifest.dataVersion,
    payload: await repository.readBackupPayload(),
  });
}

export function serializeBackup(backup: BackupEnvelope): string {
  return JSON.stringify(backupEnvelopeSchema.parse(backup), null, 2);
}

export function parseBackup(serialized: string): BackupEnvelope {
  return backupEnvelopeSchema.parse(JSON.parse(serialized) as unknown);
}

export async function restoreBackup(
  repository: AppRepository,
  serialized: string,
  mode: "replace" | "merge",
): Promise<BackupEnvelope> {
  const incoming = parseBackup(serialized);
  const safetyBackup = await createBackup(repository);
  if (mode === "merge") {
    const mergedSessions = new Map(
      [...safetyBackup.payload.sessions, ...incoming.payload.sessions].map(
        (session) => [session.id, session],
      ),
    );
    if (
      [...mergedSessions.values()].filter(({ status }) => status === "active")
        .length > 1
    ) {
      throw new Error(
        "統合後にアクティブな預け入れが複数になるため復元できません。",
      );
    }
  }
  await repository.restoreBackupPayload(incoming.payload, mode);
  return safetyBackup;
}

function csvCell(value: unknown): string {
  const text =
    value === null || value === undefined
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function historiesToCsv(
  histories: readonly CalculationHistoryRecord[],
): string {
  const headings = [
    "recordId",
    "startedAt",
    "endedAt",
    "timezone",
    "stayMinutes",
    "relaxSetting",
    "natureMultiplier",
    "expType",
    "predictedExp",
    "actualExp",
    "predictedLevelState",
    "actualLevelState",
    "difference",
    "ruleSetId",
    "dataVersion",
  ];
  const rows = histories
    .filter(({ kind }) => kind === "withdrawal")
    .map((history) => {
      const actualExp = history.actualResult?.actualExp ?? null;
      return [
        history.id,
        history.inputSnapshot.startedAt,
        history.inputSnapshot.endedAt,
        history.inputSnapshot.timezone,
        history.inputSnapshot.stayMinutes,
        history.actualResult?.relaxSetting ??
          history.inputSnapshot.relaxSetting,
        history.inputSnapshot.natureMultiplier,
        history.inputSnapshot.expType,
        history.originalResult.finalExp,
        actualExp,
        history.originalResult.levelResult,
        history.actualResult?.levelState ?? null,
        actualExp === null ? null : actualExp - history.originalResult.finalExp,
        history.originalResult.ruleSetId,
        history.originalResult.dataVersion,
      ];
    });
  return [headings, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}

export function historiesToVerificationJson(
  histories: readonly CalculationHistoryRecord[],
): string {
  const records = histories
    .filter(({ kind }) => kind === "withdrawal")
    .map((history) => ({
      recordId: history.id,
      startedAt: history.inputSnapshot.startedAt,
      endedAt: history.inputSnapshot.endedAt,
      timezone: history.inputSnapshot.timezone,
      stayMinutes: history.inputSnapshot.stayMinutes,
      relaxSetting:
        history.actualResult?.relaxSetting ??
        history.inputSnapshot.relaxSetting,
      natureMultiplier: history.inputSnapshot.natureMultiplier,
      expType: history.inputSnapshot.expType,
      predictedExp: history.originalResult.finalExp,
      actualExp: history.actualResult?.actualExp ?? null,
      predictedLevelState: history.originalResult.levelResult,
      actualLevelState: history.actualResult?.levelState ?? null,
      difference:
        history.actualResult?.actualExp === null ||
        history.actualResult?.actualExp === undefined
          ? null
          : history.actualResult.actualExp - history.originalResult.finalExp,
      ruleSetId: history.originalResult.ruleSetId,
      dataVersion: history.originalResult.dataVersion,
    }));
  return JSON.stringify(records, null, 2);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function base64UrlToBytes(encoded: string): Uint8Array {
  const padded = encoded
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(encoded.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

export function createSharePayload(
  snapshot: NamedSnapshot,
  scope: SharePayload["scope"],
): SharePayload {
  const strippedHistory =
    scope === "calculation"
      ? {
          ...snapshot.historyRecord,
          individualId: null,
          planId: null,
          depositSession: null,
          actualResult: null,
        }
      : scope === "growth"
        ? {
            ...snapshot.historyRecord,
            individualId: null,
            actualResult:
              snapshot.historyRecord.actualResult === null
                ? null
                : { ...snapshot.historyRecord.actualResult, note: "" },
            depositSession:
              snapshot.historyRecord.depositSession === null
                ? null
                : {
                    ...snapshot.historyRecord.depositSession,
                    individualId: null,
                    calculationSnapshot: {
                      ...snapshot.historyRecord.depositSession
                        .calculationSnapshot,
                      displayName: "共有された個体",
                    },
                  },
          }
        : snapshot.historyRecord;
  return sharePayloadSchema.parse({
    format: "pokemon-sleep-island-simulator-share",
    version: 1,
    scope,
    name: scope === "all" ? snapshot.name : null,
    historyRecord: strippedHistory,
  });
}

export function encodeSharePayload(payload: SharePayload): string {
  return bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify(sharePayloadSchema.parse(payload))),
  );
}

export function decodeSharePayload(encoded: string): SharePayload {
  const json = new TextDecoder().decode(base64UrlToBytes(encoded));
  return sharePayloadSchema.parse(JSON.parse(json) as unknown);
}
