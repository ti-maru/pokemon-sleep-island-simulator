import { calculateNapIslandExp } from "../../domain/napIsland/calculateNapIslandExp";
import { applyExpToLevel } from "../../domain/leveling/applyExpToLevel";
import { getExpCurve } from "../../domain/leveling/expCurve";
import type { CalculationViewModel } from "../../features/calculator/calculatorTypes";

const WEEK_MINUTES = 7 * 24 * 60;

export interface GrowthPoint {
  readonly minute: number;
  readonly day: number;
  readonly exp: number;
  readonly level: number | null;
  readonly label: string | null;
  readonly important: boolean;
}

function relaxEnd(model: CalculationViewModel): number | null {
  return model.relaxSetting.mode === "none"
    ? null
    : model.relaxSetting.mode === "tickets"
      ? model.relaxSetting.ticketCount * WEEK_MINUTES
      : model.relaxSetting.durationMinutes;
}

export function buildGrowthSeries(
  model: CalculationViewModel,
  rangeMinutes: number,
  sampleCount = 72,
): readonly GrowthPoint[] {
  const cappedRange = Math.max(1, Math.floor(rangeMinutes));
  const important = new Map<number, string>();
  const mark = (minute: number, label: string) => {
    const existing = important.get(minute);
    important.set(
      minute,
      existing === undefined ? label : `${existing}・${label}`,
    );
  };
  mark(0, "開始");
  if (WEEK_MINUTES <= cappedRange) mark(WEEK_MINUTES, "7日到達");
  const relaxEndMinute = relaxEnd(model);
  if (relaxEndMinute !== null && relaxEndMinute <= cappedRange) {
    mark(relaxEndMinute, "セット終了");
  }
  for (const scenario of model.scenarios) {
    if (scenario.stayMinutes <= cappedRange)
      mark(scenario.stayMinutes, scenario.name);
  }

  const minutes = new Set<number>(important.keys());
  for (let index = 0; index <= sampleCount; index += 1) {
    minutes.add(Math.round((cappedRange * index) / sampleCount));
  }
  const curve = getExpCurve(model.expType);
  const points = [...minutes]
    .sort((left, right) => left - right)
    .map((minute) => {
      const exp = calculateNapIslandExp({
        stayMinutes: minute,
        relaxSetting: model.relaxSetting,
        natureMultiplier: model.natureMultiplier,
      });
      const levelResult =
        model.levelState === null
          ? null
          : applyExpToLevel(
              model.levelState,
              exp.finalExp,
              curve,
              model.levelCap,
            );
      return {
        minute,
        day: minute / (24 * 60),
        exp: exp.finalExp,
        level: levelResult?.afterLevel ?? null,
        label: important.get(minute) ?? null,
        important: important.has(minute),
      };
    });

  if (model.levelState !== null) {
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      if (
        previous !== undefined &&
        current !== undefined &&
        previous.level !== null &&
        current.level !== null &&
        current.level > previous.level
      ) {
        mark(current.minute, `Lv.${current.level}`);
      }
    }
  }

  return points.map((point) => ({
    ...point,
    label: important.get(point.minute) ?? point.label,
    important: important.has(point.minute),
  }));
}
