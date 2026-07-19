import { describe, expect, it } from "vitest";

import {
  dataManifest,
  expCurves,
  formatPokemonDisplayName,
  napIslandRuleSet,
  natureMaster,
  pokemonByDexNo,
  pokemonExpTypeMaster,
} from "../data/masterData";
import { EXP_TYPES } from "../domain/leveling/types";

describe("master data", () => {
  it("keeps manifest references aligned", () => {
    expect(dataManifest.ruleSetId).toBe(napIslandRuleSet.id);
    expect(dataManifest.expCurveVersion).toBe(expCurves[600].dataVersion);
  });

  it("defines monotonic EXP curves through level 70", () => {
    for (const expType of EXP_TYPES) {
      const curve = expCurves[expType];

      expect(curve.maxDefinedLevel).toBe(70);
      for (let level = 2; level <= curve.maxDefinedLevel; level += 1) {
        expect(curve.cumulativeExpToReachLevel[level]).toBeGreaterThan(
          curve.cumulativeExpToReachLevel[level - 1] ?? -1,
        );
      }
    }

    expect(expCurves[600].cumulativeExpToReachLevel[70]).toBe(82_162);
    expect(expCurves[900].cumulativeExpToReachLevel[70]).toBe(123_243);
    expect(expCurves[1080].cumulativeExpToReachLevel[70]).toBe(147_892);
    expect(expCurves[1320].cumulativeExpToReachLevel[70]).toBe(180_756);
  });

  it("defines all 25 natures with the expected EXP effect groups", () => {
    expect(natureMaster.natures).toHaveLength(25);
    expect(
      natureMaster.natures.filter(({ expEffect }) => expEffect === "up"),
    ).toHaveLength(4);
    expect(
      natureMaster.natures.filter(({ expEffect }) => expEffect === "down"),
    ).toHaveLength(4);
    expect(
      natureMaster.natures.filter(({ expEffect }) => expEffect === "neutral"),
    ).toHaveLength(17);
  });

  it("contains the complete reviewed roster and its EXP types", () => {
    expect(pokemonExpTypeMaster.coverage).toBe(
      "implemented-roster-with-exp-types",
    );
    expect(pokemonExpTypeMaster.pokemon).toHaveLength(241);
    expect(new Set(pokemonExpTypeMaster.pokemon.map(({ id }) => id)).size).toBe(
      pokemonExpTypeMaster.pokemon.length,
    );
    expect(
      new Set(pokemonExpTypeMaster.pokemon.map(({ nameJa }) => nameJa)).size,
    ).toBe(pokemonExpTypeMaster.pokemon.length);
    expect(
      pokemonExpTypeMaster.pokemon.find(({ nameJa }) => nameJa === "フシギダネ")
        ?.expType,
    ).toBe(600);
    expect(
      pokemonExpTypeMaster.pokemon.find(({ nameJa }) => nameJa === "カイリュー")
        ?.expType,
    ).toBe(900);
    expect(
      pokemonExpTypeMaster.pokemon.find(({ nameJa }) => nameJa === "ダークライ")
        ?.expType,
    ).toBe(1320);
  });

  it("orders Pokémon by Pokédex number and formats numbers with at least 3 digits", () => {
    const dexNumbers = pokemonByDexNo.map(({ dexNo }) => Number(dexNo));

    expect(dexNumbers).toEqual(
      [...dexNumbers].sort((left, right) => left - right),
    );
    expect(formatPokemonDisplayName(pokemonByDexNo[0]!)).toBe(
      "No.001 フシギダネ",
    );
    expect(
      formatPokemonDisplayName({ dexNo: "1024", nameJa: "テラパゴス" }),
    ).toBe("No.1024 テラパゴス");
  });
});
