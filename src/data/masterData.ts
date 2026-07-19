import dataManifestJson from "./data-manifest.json";
import expCurvesJson from "./exp-curves.json";
import napIslandRulesJson from "./nap-island-rules.json";
import naturesJson from "./natures.json";
import pokemonExpTypesJson from "./pokemon-exp-types.json";
import {
  dataManifestSchema,
  expCurveMasterSchema,
  napIslandRuleSetSchema,
  natureMasterSchema,
  pokemonExpTypeMasterSchema,
} from "./schemas";
import type { ExpCurve, ExpType } from "../domain/leveling/types";
import { EXP_TYPES } from "../domain/leveling/types";

export const napIslandRuleSet = Object.freeze(
  napIslandRuleSetSchema.parse(napIslandRulesJson),
);

const expCurveMaster = expCurveMasterSchema.parse(expCurvesJson);

function materializeExpCurve(expType: ExpType): ExpCurve {
  const multiplier =
    expCurveMaster.typeMultipliers[
      String(expType) as keyof typeof expCurveMaster.typeMultipliers
    ];
  const cumulativeExpToReachLevel = Object.fromEntries(
    Object.entries(expCurveMaster.baseCumulativeExpToReachLevel).map(
      ([level, cumulativeExp]) => [
        Number(level),
        Math.round(cumulativeExp * multiplier),
      ],
    ),
  );

  return Object.freeze({
    id: `exp-curve-${expType}-${expCurveMaster.dataVersion}`,
    expType,
    maxDefinedLevel: expCurveMaster.maxDefinedLevel,
    cumulativeExpToReachLevel: Object.freeze(cumulativeExpToReachLevel),
    dataVersion: expCurveMaster.dataVersion,
  });
}

export const expCurves = Object.freeze(
  Object.fromEntries(
    EXP_TYPES.map((expType) => [expType, materializeExpCurve(expType)]),
  ) as Record<ExpType, ExpCurve>,
);

export const natureMaster = Object.freeze(
  natureMasterSchema.parse(naturesJson),
);
export const pokemonExpTypeMaster = Object.freeze(
  pokemonExpTypeMasterSchema.parse(pokemonExpTypesJson),
);
export const pokemonByDexNo = Object.freeze(
  [...pokemonExpTypeMaster.pokemon].sort(
    (left, right) => Number(left.dexNo) - Number(right.dexNo),
  ),
);

export function formatPokemonDexNo(dexNo: string): string {
  return Number(dexNo).toString().padStart(3, "0");
}

export function formatPokemonDisplayName(pokemon: {
  dexNo: string;
  nameJa: string;
}): string {
  return `No.${formatPokemonDexNo(pokemon.dexNo)} ${pokemon.nameJa}`;
}
export const dataManifest = Object.freeze(
  dataManifestSchema.parse(dataManifestJson),
);

if (dataManifest.ruleSetId !== napIslandRuleSet.id) {
  throw new Error(
    "The data manifest references an unknown nap island rule set.",
  );
}

if (dataManifest.expCurveVersion !== expCurveMaster.dataVersion) {
  throw new Error("The data manifest and EXP curve versions do not match.");
}

if (dataManifest.natureVersion !== natureMaster.dataVersion) {
  throw new Error("The data manifest and nature versions do not match.");
}

if (dataManifest.pokemonExpTypeVersion !== pokemonExpTypeMaster.dataVersion) {
  throw new Error(
    "The data manifest and Pokémon EXP type versions do not match.",
  );
}
