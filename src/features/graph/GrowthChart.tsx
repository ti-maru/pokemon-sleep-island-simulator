import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { buildGrowthSeries } from "../../application/graph/buildGrowthSeries";
import type { CalculationViewModel } from "../calculator/calculatorTypes";

const ranges = [
  ["7日", 7],
  ["14日", 14],
  ["30日", 30],
  ["90日", 90],
  ["1年", 365],
] as const;

export function GrowthChart({
  model,
}: {
  readonly model: CalculationViewModel;
}) {
  const automaticDays = Math.max(
    7,
    Math.ceil(
      Math.min(
        365 * 24 * 60,
        Math.max(
          model.stayMinutes,
          ...model.scenarios.map(({ stayMinutes }) => stayMinutes),
        ),
      ) /
        (24 * 60),
    ),
  );
  const [days, setDays] = useState(automaticDays);
  const points = useMemo(
    () => buildGrowthSeries(model, days * 24 * 60),
    [days, model],
  );
  const milestones = points.filter(({ important }) => important);
  const last = points.at(-1);
  const summary = `${days}日間で${last?.exp.toLocaleString("ja-JP") ?? 0} EXP${last?.level === null ? "" : `、Lv.${last?.level}へ到達する予測です。`}`;

  return (
    <section
      className="growth-chart-section"
      aria-labelledby="growth-chart-heading"
    >
      <div className="scenario-header">
        <div>
          <p className="eyebrow">GROWTH CURVE</p>
          <h2 id="growth-chart-heading">成長推移</h2>
          <p>{summary}</p>
        </div>
        <label>
          表示範囲
          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
          >
            <option value={automaticDays}>自動（{automaticDays}日）</option>
            {ranges.map(([label, value]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <figure className="growth-chart" role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart
            data={[...points]}
            margin={{ top: 20, right: 20, bottom: 8, left: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#d7e7e4" />
            <XAxis
              dataKey="day"
              type="number"
              domain={[0, days]}
              tickFormatter={(value: number) => `${Math.round(value)}日`}
            />
            <YAxis
              yAxisId="exp"
              tickFormatter={(value: number) => value.toLocaleString("ja-JP")}
            />
            <YAxis
              yAxisId="level"
              orientation="right"
              domain={[1, model.levelCap]}
              hide={model.levelState === null}
            />
            <Tooltip
              formatter={(value, name) => [
                Number(value).toLocaleString("ja-JP"),
                name === "exp" ? "累積EXP" : "レベル",
              ]}
              labelFormatter={(value) => `${Number(value).toFixed(1)}日`}
            />
            <Legend />
            <ReferenceLine
              x={7}
              stroke="#e18943"
              strokeDasharray="5 4"
              label="7日"
            />
            <Line
              yAxisId="exp"
              name="累積EXP"
              type="monotone"
              dataKey="exp"
              stroke="#147d78"
              strokeWidth={3}
              dot={false}
              isAnimationActive={false}
            />
            {model.levelState !== null && (
              <Line
                yAxisId="level"
                name="到達レベル"
                type="stepAfter"
                dataKey="level"
                stroke="#5c9ed8"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </figure>
      <details className="milestone-table">
        <summary>グラフの主要地点を表で確認</summary>
        <div
          className="table-scroll"
          role="region"
          aria-label="成長推移の主要地点表"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th>地点</th>
                <th>経過</th>
                <th>累積EXP</th>
                <th>到達レベル</th>
              </tr>
            </thead>
            <tbody>
              {milestones.map((point) => (
                <tr key={`${point.minute}-${point.label}`}>
                  <th>{point.label}</th>
                  <td>{point.day.toFixed(2)}日</td>
                  <td>{point.exp.toLocaleString("ja-JP")}</td>
                  <td>{point.level === null ? "—" : `Lv.${point.level}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

export default GrowthChart;
