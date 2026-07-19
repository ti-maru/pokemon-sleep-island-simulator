// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useCalculatorScenarioStore } from "../../app/stores/calculatorScenarioStore";
import { CalculatorPage } from "../../features/calculator/CalculatorPage";

beforeEach(() => {
  localStorage.clear();
  useCalculatorScenarioStore.getState().resetScenarios();
});

afterEach(() => cleanup());

describe("CalculatorPage", () => {
  it("shows the default seven-day EXP result", () => {
    render(<CalculatorPage />);

    expect(screen.getByTestId("gained-exp")).toHaveTextContent("1,050");
    expect(
      screen.getByText("7日以上の滞在条件です。7日未満補正はありません。"),
    ).toBeVisible();
  });

  it("recalculates when a duration preset and relax ticket are selected", async () => {
    const user = userEvent.setup();
    render(<CalculatorPage />);

    await user.click(screen.getByRole("button", { name: "3日" }));
    await waitFor(() =>
      expect(screen.getByTestId("gained-exp")).toHaveTextContent("225"),
    );

    await user.click(screen.getByRole("radio", { name: "枚数で指定" }));
    await waitFor(() =>
      expect(screen.getByTestId("gained-exp")).toHaveTextContent("900"),
    );
  });

  it("adds level information only after the level toggle is enabled", async () => {
    const user = userEvent.setup();
    render(<CalculatorPage />);

    expect(screen.queryByText("Lv.1 → Lv.8")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("checkbox", { name: "レベル計算を利用する" }),
    );

    await waitFor(() => expect(screen.getByText("Lv.1 → Lv.8")).toBeVisible());
  });

  it("switches to datetime inputs", async () => {
    const user = userEvent.setup();
    render(<CalculatorPage />);

    await user.click(screen.getByRole("tab", { name: "日時指定" }));

    expect(screen.getByLabelText("預け入れ開始日時")).toBeVisible();
    expect(screen.getByRole("radio", { name: "現在時刻" })).toBeChecked();
  });

  it("uses the selected Pokémon EXP type unless manually overridden", async () => {
    const user = userEvent.setup();
    render(<CalculatorPage />);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "ポケモン" }),
      "mew",
    );

    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "経験値タイプ" }),
      ).toHaveValue("1320"),
    );
    expect(
      screen.getByRole("combobox", { name: "経験値タイプ" }),
    ).toBeDisabled();
  });

  it("offers the full Pokémon roster and a direct EXP correction choice", async () => {
    const user = userEvent.setup();
    render(<CalculatorPage />);

    const pokemon = screen.getByRole("combobox", { name: "ポケモン" });
    expect(pokemon.querySelectorAll("option")).toHaveLength(242);
    await user.click(screen.getByRole("radio", { name: "EXP下降" }));

    expect(screen.getByRole("radio", { name: "EXP下降" })).toBeChecked();
    expect(
      screen.queryByRole("combobox", { name: "性格" }),
    ).not.toBeInTheDocument();
  });

  it("shows a nearby validation error for an out-of-range duration", async () => {
    const user = userEvent.setup();
    render(<CalculatorPage />);
    const hours = screen.getByRole("spinbutton", { name: "時間" });

    await user.clear(hours);
    await user.type(hours, "24");

    expect(await screen.findByText("23以下で入力してください。")).toBeVisible();
    expect(
      screen.getByText("入力内容を確認すると計算結果が表示されます。"),
    ).toBeVisible();
  });

  it("adds, duplicates, and removes a custom scenario", async () => {
    const user = userEvent.setup();
    render(<CalculatorPage />);

    await user.click(
      screen.getByRole("button", { name: "任意シナリオを追加" }),
    );
    expect(screen.getByDisplayValue("任意シナリオ 1")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "複製" }));
    expect(screen.getByDisplayValue("任意シナリオ 1 のコピー")).toBeVisible();

    const deleteButtons = screen.getAllByRole("button", { name: "削除" });
    expect(deleteButtons).toHaveLength(2);
    await user.click(deleteButtons[0]!);
    expect(screen.getAllByRole("button", { name: "削除" })).toHaveLength(1);
  });
});
