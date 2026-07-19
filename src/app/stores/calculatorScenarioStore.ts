import { create } from "zustand";

import type { CustomScenario } from "../../features/calculator/calculatorTypes";
import messages from "../../i18n/ja.json";

interface CalculatorScenarioState {
  readonly scenarios: readonly CustomScenario[];
  addScenario: (stayMinutes: number) => void;
  duplicateScenario: (id: string) => void;
  removeScenario: (id: string) => void;
  updateScenario: (
    id: string,
    changes: Partial<Omit<CustomScenario, "id">>,
  ) => void;
  resetScenarios: () => void;
}

function createId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `scenario-${Date.now()}-${Math.random()}`
  );
}

function splitMinutes(stayMinutes: number) {
  const safeMinutes = Math.max(0, Math.floor(stayMinutes));
  return {
    days: Math.floor(safeMinutes / (24 * 60)),
    hours: Math.floor((safeMinutes % (24 * 60)) / 60),
    minutes: safeMinutes % 60,
  };
}

export const useCalculatorScenarioStore = create<CalculatorScenarioState>(
  (set) => ({
    scenarios: [],
    addScenario: (stayMinutes) =>
      set((state) => ({
        scenarios: [
          ...state.scenarios,
          {
            id: createId(),
            name: messages["scenario.custom"].replace(
              "{number}",
              String(state.scenarios.length + 1),
            ),
            ...splitMinutes(stayMinutes),
            relaxMode: "none",
            ticketCount: 1,
            relaxDurationMinutes: 7 * 24 * 60,
          },
        ],
      })),
    duplicateScenario: (id) =>
      set((state) => {
        const source = state.scenarios.find((scenario) => scenario.id === id);
        if (source === undefined) return state;

        return {
          scenarios: [
            ...state.scenarios,
            {
              ...source,
              id: createId(),
              name: `${source.name} ${messages["scenario.copySuffix"]}`,
            },
          ],
        };
      }),
    removeScenario: (id) =>
      set((state) => ({
        scenarios: state.scenarios.filter((scenario) => scenario.id !== id),
      })),
    updateScenario: (id, changes) =>
      set((state) => ({
        scenarios: state.scenarios.map((scenario) =>
          scenario.id === id ? { ...scenario, ...changes } : scenario,
        ),
      })),
    resetScenarios: () => set({ scenarios: [] }),
  }),
);
