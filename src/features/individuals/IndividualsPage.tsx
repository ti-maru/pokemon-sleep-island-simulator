import { useCallback, useMemo, useState } from "react";

import { useAppDataStore } from "../../app/stores/appDataStore";
import { snapshotIndividual } from "../../application/deposits/depositService";
import {
  toDateTimeLocalValue,
  zonedDateTimeToEpochMs,
} from "../../application/calculate/dateTime";
import type { IndividualInput } from "../../application/individuals/individualService";
import { natureMaster, pokemonExpTypeMaster } from "../../data/masterData";
import type { PokemonIndividual } from "../../domain/individuals/types";
import { getExpCurve, getExpToNextLevel } from "../../domain/leveling/expCurve";
import type { ExpEffect, ExpType } from "../../domain/leveling/types";
import type { RelaxSetting } from "../../domain/napIsland/types";
import messages from "../../i18n/ja.json";
import { GrowthPlansPanel } from "../plans/GrowthPlansPanel";
import { useModalFocus } from "../../components/dialogs/useModalFocus";

interface FormState {
  displayName: string;
  pokemonId: string;
  natureId: string;
  expEffectOverride: "" | ExpEffect;
  expTypeOverride: "" | `${ExpType}`;
  currentLevel: number;
  remainingExpToNextLevel: number;
  targetLevel: string;
  targetDate: string;
}

const EMPTY_FORM: FormState = {
  displayName: "",
  pokemonId: "",
  natureId: "",
  expEffectOverride: "",
  expTypeOverride: "",
  currentLevel: 1,
  remainingExpToNextLevel: 54,
  targetLevel: "",
  targetDate: "",
};

function toFormState(
  individual: PokemonIndividual,
  timezone: string,
): FormState {
  return {
    displayName: individual.displayName,
    pokemonId: individual.pokemonId ?? "",
    natureId: individual.natureId ?? "",
    expEffectOverride: individual.expEffectOverride ?? "",
    expTypeOverride:
      individual.expTypeOverride === null
        ? ""
        : (String(individual.expTypeOverride) as `${ExpType}`),
    currentLevel: individual.currentLevel,
    remainingExpToNextLevel: individual.remainingExpToNextLevel ?? 0,
    targetLevel:
      individual.targetLevel === null ? "" : String(individual.targetLevel),
    targetDate:
      individual.targetDate === null
        ? ""
        : toDateTimeLocalValue(Date.parse(individual.targetDate), timezone),
  };
}

function resolveExpType(form: FormState): ExpType {
  if (form.expTypeOverride !== "")
    return Number(form.expTypeOverride) as ExpType;
  return (
    pokemonExpTypeMaster.pokemon.find(({ id }) => id === form.pokemonId)
      ?.expType ?? 600
  );
}

function toIndividualInput(form: FormState, timezone: string): IndividualInput {
  return {
    pokemonId: form.pokemonId || null,
    displayName: form.displayName.trim(),
    natureId: form.natureId || null,
    expEffectOverride: form.expEffectOverride || null,
    expTypeOverride:
      form.expTypeOverride === ""
        ? null
        : (Number(form.expTypeOverride) as ExpType),
    currentLevel: form.currentLevel,
    remainingExpToNextLevel:
      form.currentLevel === 70 ? null : form.remainingExpToNextLevel,
    targetLevel: form.targetLevel === "" ? null : Number(form.targetLevel),
    targetDate:
      form.targetDate === ""
        ? null
        : new Date(
            zonedDateTimeToEpochMs(form.targetDate, timezone),
          ).toISOString(),
    targetTimezone: form.targetDate === "" ? null : timezone,
  };
}

export function IndividualsPage() {
  const individuals = useAppDataStore((state) => state.individuals);
  const createIndividual = useAppDataStore((state) => state.createIndividual);
  const updateIndividual = useAppDataStore((state) => state.updateIndividual);
  const duplicateIndividual = useAppDataStore(
    (state) => state.duplicateIndividual,
  );
  const deleteIndividual = useAppDataStore((state) => state.deleteIndividual);
  const requestDeposit = useAppDataStore((state) => state.requestDeposit);
  const timezone = useAppDataStore((state) => state.settings.timezone);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);
  const [depositIndividual, setDepositIndividual] =
    useState<PokemonIndividual | null>(null);
  const [planIndividual, setPlanIndividual] =
    useState<PokemonIndividual | null>(null);
  const [relaxMode, setRelaxMode] = useState<RelaxSetting["mode"]>("none");
  const [relaxValue, setRelaxValue] = useState(1);
  const closeDepositDialog = useCallback(() => setDepositIndividual(null), []);
  const depositDialogRef = useModalFocus(
    depositIndividual !== null,
    closeDepositDialog,
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ja-JP");
    if (normalized.length === 0) return individuals;
    return individuals.filter((individual) => {
      const pokemonName = pokemonExpTypeMaster.pokemon.find(
        ({ id }) => id === individual.pokemonId,
      )?.nameJa;
      return `${individual.displayName} ${pokemonName ?? ""}`
        .toLocaleLowerCase("ja-JP")
        .includes(normalized);
    });
  }, [individuals, query]);

  const openNew = () => {
    setEditingId("new");
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const openEdit = (individual: PokemonIndividual) => {
    setEditingId(individual.id);
    setForm(toFormState(individual, timezone));
    setFormError(null);
  };

  const submit = async () => {
    try {
      if (form.displayName.trim().length === 0) {
        setFormError("管理名を入力してください。");
        return;
      }
      const expToNext = getExpToNextLevel(
        getExpCurve(resolveExpType(form)),
        form.currentLevel,
      );
      if (
        expToNext !== null &&
        (form.remainingExpToNextLevel < 0 ||
          form.remainingExpToNextLevel > expToNext)
      ) {
        setFormError(
          `残りEXPは0〜${expToNext.toLocaleString("ja-JP")}で入力してください。`,
        );
        return;
      }
      if (
        form.targetLevel !== "" &&
        Number(form.targetLevel) < form.currentLevel
      ) {
        setFormError("目標レベルは現在レベル以上にしてください。");
        return;
      }
      const input = toIndividualInput(form, timezone);
      if (editingId === "new") {
        await createIndividual(input);
      } else if (editingId !== null) {
        await updateIndividual(editingId, input);
      }
      setEditingId(null);
      setFormError(null);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "個体を保存できませんでした。",
      );
    }
  };

  const beginDeposit = async () => {
    if (depositIndividual === null) return;
    const relaxSetting: RelaxSetting =
      relaxMode === "none"
        ? { mode: "none" }
        : relaxMode === "tickets"
          ? {
              mode: "tickets",
              ticketCount: Math.max(0, Math.floor(relaxValue)),
            }
          : {
              mode: "duration",
              durationMinutes: Math.max(0, Math.floor(relaxValue)),
            };
    await requestDeposit({
      individualId: depositIndividual.id,
      startedAt: new Date().toISOString(),
      timezone,
      plannedEndAt: null,
      relaxSetting,
      calculationSnapshot: snapshotIndividual(depositIndividual),
    });
    setDepositIndividual(null);
  };

  return (
    <main className="management-page">
      <header className="page-heading-block">
        <p className="eyebrow">COLLECTION</p>
        <h1>{messages["individuals.heading"]}</h1>
        <p>{messages["individuals.description"]}</p>
      </header>

      {planIndividual !== null && (
        <GrowthPlansPanel
          individual={planIndividual}
          onClose={() => setPlanIndividual(null)}
        />
      )}

      <section className="management-toolbar">
        <label className="search-field">
          <span className="sr-only">{messages["individuals.search"]}</span>
          <input
            type="search"
            placeholder={messages["individuals.search"]}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button type="button" className="primary-button" onClick={openNew}>
          ＋ {messages["individuals.create"]}
        </button>
      </section>

      {editingId !== null && (
        <section
          className="entity-form-card"
          aria-labelledby="individual-form-heading"
        >
          <h2 id="individual-form-heading">
            {editingId === "new"
              ? messages["individuals.create"]
              : messages["individuals.edit"]}
          </h2>
          <div className="entity-form-grid">
            <label>
              <span>{messages["individuals.displayName"]}</span>
              <input
                value={form.displayName}
                onChange={(event) =>
                  setForm({ ...form, displayName: event.target.value })
                }
              />
            </label>
            <label>
              <span>{messages["individuals.pokemon"]}</span>
              <select
                value={form.pokemonId}
                onChange={(event) =>
                  setForm({ ...form, pokemonId: event.target.value })
                }
              >
                <option value="">未登録・手動タイプ</option>
                {pokemonExpTypeMaster.pokemon.map((pokemon) => (
                  <option key={pokemon.id} value={pokemon.id}>
                    {pokemon.nameJa}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{messages["individuals.nature"]}</span>
              <select
                value={form.natureId}
                onChange={(event) =>
                  setForm({ ...form, natureId: event.target.value })
                }
              >
                <option value="">未選択</option>
                {natureMaster.natures.map((nature) => (
                  <option key={nature.id} value={nature.id}>
                    {nature.nameJa}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{messages["individuals.expEffectOverride"]}</span>
              <select
                value={form.expEffectOverride}
                onChange={(event) =>
                  setForm({
                    ...form,
                    expEffectOverride: event.target
                      .value as FormState["expEffectOverride"],
                  })
                }
              >
                <option value="">性格から自動</option>
                <option value="up">EXP上昇</option>
                <option value="neutral">無補正</option>
                <option value="down">EXP下降</option>
              </select>
            </label>
            <label>
              <span>{messages["individuals.expTypeOverride"]}</span>
              <select
                value={form.expTypeOverride}
                onChange={(event) =>
                  setForm({
                    ...form,
                    expTypeOverride: event.target
                      .value as FormState["expTypeOverride"],
                  })
                }
              >
                <option value="">ポケモンから自動</option>
                {[600, 900, 1080, 1320].map((type) => (
                  <option key={type} value={type}>
                    {type}タイプ
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{messages["individuals.currentLevel"]}</span>
              <input
                type="number"
                min="1"
                max="70"
                value={form.currentLevel}
                onChange={(event) =>
                  setForm({ ...form, currentLevel: Number(event.target.value) })
                }
              />
            </label>
            <label>
              <span>{messages["individuals.remainingExp"]}</span>
              <input
                type="number"
                min="0"
                disabled={form.currentLevel === 70}
                value={form.remainingExpToNextLevel}
                onChange={(event) =>
                  setForm({
                    ...form,
                    remainingExpToNextLevel: Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              <span>{messages["individuals.targetLevel"]}</span>
              <input
                type="number"
                min={form.currentLevel}
                max="70"
                value={form.targetLevel}
                onChange={(event) =>
                  setForm({ ...form, targetLevel: event.target.value })
                }
              />
            </label>
            <label>
              <span>{messages["individuals.targetDate"]}</span>
              <input
                type="datetime-local"
                value={form.targetDate}
                onChange={(event) =>
                  setForm({ ...form, targetDate: event.target.value })
                }
              />
            </label>
          </div>
          {formError !== null && (
            <p className="form-alert" role="alert">
              {formError}
            </p>
          )}
          <div className="form-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => void submit()}
            >
              {messages["individuals.save"]}
            </button>
            <button type="button" onClick={() => setEditingId(null)}>
              {messages["individuals.cancelEdit"]}
            </button>
          </div>
        </section>
      )}

      {filtered.length === 0 ? (
        <section className="empty-state">
          <div aria-hidden="true">◇</div>
          <p>{messages["individuals.empty"]}</p>
        </section>
      ) : (
        <div className="entity-grid">
          {filtered.map((individual) => {
            const pokemon = pokemonExpTypeMaster.pokemon.find(
              ({ id }) => id === individual.pokemonId,
            );
            return (
              <article className="entity-card" key={individual.id}>
                <div className="entity-card-heading">
                  <div>
                    <span>{pokemon?.nameJa ?? "手動設定"}</span>
                    <h2>{individual.displayName}</h2>
                  </div>
                  <strong>Lv.{individual.currentLevel}</strong>
                </div>
                <dl>
                  <div>
                    <dt>次のレベルまで</dt>
                    <dd>
                      {individual.remainingExpToNextLevel?.toLocaleString(
                        "ja-JP",
                      ) ?? "—"}{" "}
                      EXP
                    </dd>
                  </div>
                  <div>
                    <dt>目標</dt>
                    <dd>
                      {individual.targetLevel === null
                        ? "未設定"
                        : `Lv.${individual.targetLevel}`}
                    </dd>
                  </div>
                </dl>
                <div className="entity-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setDepositIndividual(individual)}
                  >
                    {messages["individuals.startDeposit"]}
                  </button>
                  <button type="button" onClick={() => openEdit(individual)}>
                    {messages["individuals.edit"]}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlanIndividual(individual)}
                  >
                    育成計画
                  </button>
                  <button
                    type="button"
                    onClick={() => void duplicateIndividual(individual.id)}
                  >
                    {messages["individuals.duplicate"]}
                  </button>
                  {deletePendingId === individual.id ? (
                    <span className="inline-confirm">
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => {
                          void deleteIndividual(individual.id);
                          setDeletePendingId(null);
                        }}
                      >
                        {messages["individuals.delete"]}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletePendingId(null)}
                      >
                        やめる
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => setDeletePendingId(individual.id)}
                    >
                      {messages["individuals.delete"]}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {depositIndividual !== null && (
        <div className="modal-backdrop">
          <section
            ref={depositDialogRef}
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="start-deposit-heading"
          >
            <h2 id="start-deposit-heading">
              {depositIndividual.displayName}を預け入れる
            </h2>
            <label>
              <span>{messages["deposit.relaxMode"]}</span>
              <select
                value={relaxMode}
                onChange={(event) =>
                  setRelaxMode(event.target.value as RelaxSetting["mode"])
                }
              >
                <option value="none">使用なし</option>
                <option value="tickets">枚数で指定</option>
                <option value="duration">適用時間で指定</option>
              </select>
            </label>
            {relaxMode !== "none" && (
              <label>
                <span>
                  {relaxMode === "tickets"
                    ? messages["deposit.relaxTickets"]
                    : messages["deposit.relaxDuration"]}
                </span>
                <input
                  type="number"
                  min="0"
                  value={relaxValue}
                  onChange={(event) =>
                    setRelaxValue(Number(event.target.value))
                  }
                />
              </label>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => void beginDeposit()}
              >
                {messages["deposit.begin"]}
              </button>
              <button type="button" onClick={closeDepositDialog}>
                キャンセル
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
