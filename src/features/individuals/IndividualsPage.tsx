import { useCallback, useMemo, useState } from "react";

import { useAppDataStore } from "../../app/stores/appDataStore";
import { snapshotIndividual } from "../../application/deposits/depositService";
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
  expEffect: ExpEffect;
  expTypeOverride: "" | `${ExpType}`;
  currentLevel: number;
  remainingExpToNextLevel: number;
}

const EMPTY_FORM: FormState = {
  displayName: "",
  pokemonId: "",
  expEffect: "neutral",
  expTypeOverride: "",
  currentLevel: 1,
  remainingExpToNextLevel: 54,
};

function resolveIndividualExpEffect(individual: PokemonIndividual): ExpEffect {
  if (individual.expEffectOverride !== null)
    return individual.expEffectOverride;
  return (
    natureMaster.natures.find(({ id }) => id === individual.natureId)
      ?.expEffect ?? "neutral"
  );
}

function toFormState(individual: PokemonIndividual): FormState {
  return {
    displayName: individual.displayName,
    pokemonId: individual.pokemonId ?? "",
    expEffect: resolveIndividualExpEffect(individual),
    expTypeOverride:
      individual.expTypeOverride === null
        ? ""
        : (String(individual.expTypeOverride) as `${ExpType}`),
    currentLevel: individual.currentLevel,
    remainingExpToNextLevel: individual.remainingExpToNextLevel ?? 0,
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

function toIndividualInput(form: FormState): IndividualInput {
  return {
    pokemonId: form.pokemonId || null,
    displayName: form.displayName.trim(),
    natureId: null,
    expEffectOverride: form.expEffect,
    expTypeOverride:
      form.expTypeOverride === ""
        ? null
        : (Number(form.expTypeOverride) as ExpType),
    currentLevel: form.currentLevel,
    remainingExpToNextLevel:
      form.currentLevel === 70 ? null : form.remainingExpToNextLevel,
    targetLevel: null,
    targetDate: null,
    targetTimezone: null,
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
    setForm(toFormState(individual));
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
      const input = toIndividualInput(form);
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
            <div>
              <span className="field-label">
                {messages["individuals.expEffect"]}
              </span>
              <fieldset className="segmented-choice">
                <legend className="sr-only">
                  {messages["individuals.expEffect"]}
                </legend>
                {(["up", "neutral", "down"] as const).map((effect) => (
                  <label key={effect}>
                    <input
                      type="radio"
                      name="individual-exp-effect"
                      value={effect}
                      checked={form.expEffect === effect}
                      onChange={() => setForm({ ...form, expEffect: effect })}
                    />
                    <span>
                      {effect === "up"
                        ? messages["calculator.expUp"]
                        : effect === "down"
                          ? messages["calculator.expDown"]
                          : messages["calculator.expNeutral"]}
                    </span>
                  </label>
                ))}
              </fieldset>
            </div>
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
                    <dt>EXP補正</dt>
                    <dd>
                      {resolveIndividualExpEffect(individual) === "up"
                        ? "上昇"
                        : resolveIndividualExpEffect(individual) === "down"
                          ? "下降"
                          : "無補正"}
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
