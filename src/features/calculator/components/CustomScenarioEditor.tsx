import { useCalculatorScenarioStore } from "../../../app/stores/calculatorScenarioStore";
import messages from "../../../i18n/ja.json";

function numericValue(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

export function CustomScenarioEditor() {
  const scenarios = useCalculatorScenarioStore((state) => state.scenarios);
  const updateScenario = useCalculatorScenarioStore(
    (state) => state.updateScenario,
  );
  const duplicateScenario = useCalculatorScenarioStore(
    (state) => state.duplicateScenario,
  );
  const removeScenario = useCalculatorScenarioStore(
    (state) => state.removeScenario,
  );

  return (
    <div className="custom-scenarios">
      {scenarios.map((scenario) => (
        <article key={scenario.id} className="custom-scenario-card">
          <label className="scenario-name">
            <span>{messages["scenario.name"]}</span>
            <input
              value={scenario.name}
              onChange={(event) =>
                updateScenario(scenario.id, { name: event.target.value })
              }
            />
          </label>
          <div className="duration-grid compact-grid">
            <label>
              <span>{messages["calculator.days"]}</span>
              <input
                type="number"
                min="0"
                value={scenario.days}
                onChange={(event) =>
                  updateScenario(scenario.id, {
                    days: numericValue(event.target.value),
                  })
                }
              />
            </label>
            <label>
              <span>{messages["calculator.hours"]}</span>
              <input
                type="number"
                min="0"
                max="23"
                value={scenario.hours}
                onChange={(event) =>
                  updateScenario(scenario.id, {
                    hours: Math.min(23, numericValue(event.target.value)),
                  })
                }
              />
            </label>
            <label>
              <span>{messages["calculator.minutes"]}</span>
              <input
                type="number"
                min="0"
                max="59"
                value={scenario.minutes}
                onChange={(event) =>
                  updateScenario(scenario.id, {
                    minutes: Math.min(59, numericValue(event.target.value)),
                  })
                }
              />
            </label>
          </div>
          <label>
            <span>{messages["calculator.relaxHeading"]}</span>
            <select
              value={scenario.relaxMode}
              onChange={(event) =>
                updateScenario(scenario.id, {
                  relaxMode: event.target.value as
                    "none" | "tickets" | "duration",
                })
              }
            >
              <option value="none">{messages["calculator.relaxNone"]}</option>
              <option value="tickets">
                {messages["calculator.relaxTickets"]}
              </option>
              <option value="duration">
                {messages["calculator.relaxDuration"]}
              </option>
            </select>
          </label>
          {scenario.relaxMode === "tickets" && (
            <label>
              <span>{messages["calculator.ticketCount"]}</span>
              <input
                type="number"
                min="0"
                value={scenario.ticketCount}
                onChange={(event) =>
                  updateScenario(scenario.id, {
                    ticketCount: numericValue(event.target.value),
                  })
                }
              />
            </label>
          )}
          {scenario.relaxMode === "duration" && (
            <label>
              <span>{messages["scenario.relaxDurationMinutes"]}</span>
              <input
                type="number"
                min="0"
                value={scenario.relaxDurationMinutes}
                onChange={(event) =>
                  updateScenario(scenario.id, {
                    relaxDurationMinutes: numericValue(event.target.value),
                  })
                }
              />
            </label>
          )}
          <div className="scenario-actions">
            <button
              type="button"
              onClick={() => duplicateScenario(scenario.id)}
            >
              {messages["scenario.duplicate"]}
            </button>
            <button
              type="button"
              className="danger-button"
              onClick={() => removeScenario(scenario.id)}
            >
              {messages["scenario.delete"]}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
