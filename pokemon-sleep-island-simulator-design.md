# おひるね島 育成シミュレーター 設計書

| 項目 | 内容 |
|---|---|
| プロジェクト名 | おひるね島 育成シミュレーター |
| リポジトリ名 | `pokemon-sleep-island-simulator` |
| 公開予定URL | `https://ti-maru.github.io/pokemon-sleep-island-simulator/` |
| 文書種別 | プロダクト・機能・技術 統合設計書 |
| 対象リリース | 初回公開版（暫定計算ルールを含む） |
| 作成日 | 2026-07-19 |
| 最終更新日 | 2026-07-19 |
| 文書版 | 1.2 |
| 初期表示言語 | 日本語 |
| ライセンス方針 | ソースコードのみ MIT License |

---

## 1. 文書の目的

本書は、『Pokémon Sleep』の新機能「ゴンベのおひるね島」に預けたポケモンについて、獲得EXP、到達レベル、引き取りタイミング、長期育成計画を計算・管理するWebアプリケーションの設計を定義する。

単発の計算機に限定せず、次の用途を一体化した完成度の高い育成管理ツールとして設計する。

- 滞在時間から獲得EXPを計算する
- 現在レベルから引き取り後レベルを計算する
- 現在、7日到達時、指定日時など複数条件を比較する
- 実際の預け入れ状態を記録し、経過をリアルタイム表示する
- 保存個体、履歴、スナップショットを端末内で管理する
- 育成計画を明示的に開いた場合に、到達レベルと任意期限から複数回の計画を作成する
- 予測とゲーム内実績を照合し、計算ルールの検証に利用する
- 将来、ほかの『Pokémon Sleep』育成機能を追加できる内部構造を持つ

初回公開時の画面は「おひるね島 育成シミュレーター」に集中し、未実装機能や総合ツール用の空メニューは表示しない。

---

## 2. 根拠情報と採用方針

### 2.1 公式情報

おひるね島に関する計算ルールの一次情報は、以下の公式告知を正本とする。

- [【祝！3周年記念新機能】ゴンベのおひるね島](https://www.pokemonsleep.net/news/343231333934393334303235363832393531/)
- [Ver.3.6.0 アップデート内容について](https://www.pokemonsleep.net/news/343133383535303339383636353335393337/)

公式告知から確認できる主要ルールは次のとおり。

1. おひるね島へ預けられるおてつだいポケモンは同時に1匹のみ。
2. 預けたポケモンには1分ごとにEXPが蓄積し、通常分は1日合計150EXP。
3. 滞在時間が7日未満で引き取ると、獲得EXPは半分。
4. 7日経過後も預け続けることができ、EXPは蓄積し続ける。
5. リラックスセットは1枚につき7日間で、預けている間だけ残り期間が進む。
6. リラックスセット中は1日あたり450EXPが通常分とは別に追加される。
7. リラックスセット追加分も、滞在時間が7日未満なら半分。
8. 性格による獲得EXP補正は反映される。
9. イベント、せいちょうのおこう、睡眠EXPボーナス等は反映されない。
10. EXP蓄積には1年の上限がある。
11. 引き取り時にレベル上限へ達した場合、あふれたEXPはゲーム内のEXPボーナスゲージへ加算される。
12. 2026-06-25時点の全体レベル上限はLv.70。

本アプリでは、上記のうち次を意図的に簡略化または対象外とする。

- リサーチランクによるゲーム内レベル上限制約は考慮しない。
- EXPボーナスゲージの現在値・加算・報酬は計算しない。
- リラックスセットの残り時間、セッション間の持ち越し、使用履歴、所持数は管理しない。
- レベル上限はシミュレーション用の設定値とし、初期値をLv.70とする。

### 2.2 非公式・有志検証データ

公式情報だけでは、全ポケモンの経験値タイプ、各レベルの必要EXP、性格補正の具体的倍率、端数処理順を完全には確定できない。これらは有志検証データを利用できるが、次の方針を厳守する。

- 公式情報を常に優先する。
- 有志データはリポジトリ内の固定JSONへ転記する前に人間が確認する。
- データごとに出典URL、確認日、検証状態、データバージョンを保持する。
- 本番アプリは外部サイトへ実行時アクセスせず、リポジトリ内データだけを読む。
- 更新支援スクリプトが生成したデータを自動公開しない。
- 転載条件やライセンスが不明な大量データは、再構成・検証可能な数値データとして扱い、文章・画像・表現を複製しない。

経験値タイプの初期分類は、コミュニティで一般的に使われる次の4区分を扱う。

- 600タイプ
- 900タイプ
- 1080タイプ
- 1320タイプ

参考情報：

- [ポケモンスリープ攻略・検証 Wiki「育成/経験値タイプ」](https://wikiwiki.jp/poke_sleep/%E8%82%B2%E6%88%90/%E7%B5%8C%E9%A8%93%E5%80%A4%E3%82%BF%E3%82%A4%E3%83%97)

### 2.3 データ確度の表示方針

利用者向けUIには「暫定」「一部暫定」「データ確度」等の表示を出さない。初回説明や結果付近にも表示しない。

ただし、内部データ・履歴・検証記録には次を保持する。

- 計算ルールバージョン
- マスターデータバージョン
- 出典
- 検証状態
- 当時の計算結果
- 最新ルールによる再計算結果

計算ルール変更はアプリ内更新履歴へ記載する。

---

## 3. プロダクト方針

### 3.1 プロダクト名

**おひるね島 育成シミュレーター**

検索・PWAメタ情報では補助説明を付ける。

> おひるね島 育成シミュレーター — EXP・レベル計算ツール

### 3.2 位置付け

- 現在はおひるね島専用アプリとして公開する。
- 内部ドメイン設計は、将来の『Pokémon Sleep』総合育成ツール化を前提に汎用化する。
- 2つ目の育成モジュールが追加されるまで、総合トップページや共通機能一覧は表示しない。
- 既存プロジェクト `pokemon-sleep-recipes` とはリンクせず、独立して運用する。

### 3.3 対象利用環境

- iPhone Safari
- Android Chrome
- デスクトップ版 Chrome
- Firefox
- Edge
- Safari

スマートフォンとPCを同等の対応対象とし、機能を画面幅によって省略しない。

### 3.4 非対象

初回公開版では次を扱わない。

- げんき回復量の計算
- ゴンベのものひろい箱の予測・記録
- 複数ポケモンの同時預け入れ計算
- リサーチランクの入力・推定・レベル上限連動
- EXPボーナスゲージの現在値、加算、報酬計算
- リラックスセット残時間の持ち越し管理
- リラックスセットの使用履歴・所持数管理
- リラックスセットの任意開始区間・中断区間のタイムライン管理
- サーバー側データ保存
- アカウント登録・ログイン
- クラウド同期
- プッシュ通知・端末通知
- アクセス解析サービス
- Cookieを用いた追跡
- 公式キャラクター画像・公式ロゴ・ゲーム画面画像の収録
- GitHub Issues・Discussions等への問い合わせ導線

## 4. UX原則

1. **入力途中から価値を返す**  
   滞在条件だけ入力した段階でEXPを表示し、レベル情報を追加すると到達レベルまで結果を拡張する。

2. **基本操作を簡潔に保つ**  
   基本項目を常時表示し、高度な設定は展開式とする。

3. **ゲームらしいが過剰に装飾しない**  
   丸み、やわらかな配色、小さなオリジナルイラストで雰囲気を作り、情報の可読性を優先する。

4. **重要操作は明示的に確定する**  
   フォーム入力は自動保存するが、個体データの書き換えは「保存」または「引き取り結果を反映」の明示操作でのみ行う。

5. **誤操作から回復できる**  
   削除・反映・復元・預け入れ解除等は確認し、実行後に「元に戻す」を提供する。

6. **外部送信を行わない**  
   個体、履歴、計画、実績は端末内だけに保存する。共有URLは利用者が明示的に作成した場合だけ生成する。

7. **利用者の判断材料を示す**  
   「おすすめ」と断定せず、待ち時間とEXP差、到達レベル差を提示する。

---

## 5. 情報設計・ナビゲーション

### 5.1 メインナビゲーション

| 項目 | 役割 |
|---|---|
| 計算 | EXP計算、レベル計算、シナリオ比較、グラフ |
| 預け入れ | 現在預け入れ中の1匹、経過表示、引き取り処理 |
| 個体 | 保存個体の作成・編集・検索・育成計画 |
| 履歴 | 自動履歴、スナップショット、実績比較、検証データ出力 |
| ガイド | 簡易ヘルプ、更新履歴 |
| 設定 | テーマ、履歴件数、データ管理、検証モード、PWA案内等 |

表示方式：

- スマートフォン：固定下部ナビゲーション
- PC：左サイドナビゲーション
- 初回起動：計算画面
- 保存個体がある場合：最後に開いていた個体と計算状態を復元

育成計画は独立ナビゲーションにせず、個体詳細および計算結果から開く。

### 5.2 ガイド画面と補助ページ

- 簡易ヘルプと更新履歴は、設定画面へ含めず独立した「ガイド」タブにまとめる
- データのバックアップ・復元
- 共有データ確認
- 利用規約相当の注意事項・権利表記（フッター）

---

## 6. 画面一覧

### 6.1 計算画面

主要要素：

1. 入力方式タブ
   - 経過時間
   - 日時指定
2. 滞在条件
3. リラックスセット
4. EXP補正
5. ポケモン・経験値タイプ
6. 現在レベル・次レベルまでの残りEXP
7. 計算結果
8. 自動提案シナリオ
9. 任意シナリオ
10. 成長推移グラフ
11. 保存・共有・スナップショット操作

初回は「経過時間」タブを表示し、以後は最後に使った入力方式を保存する。

### 6.2 預け入れ画面

預け入れ中のポケモンがいる場合：

- 管理名・ポケモン名
- 預け入れ開始日時
- 経過日数・時間・分
- 現時点の予測EXP
- 現時点の予測レベル
- 7日到達までの残り時間
- 次のレベルまでの残り時間
- 設定したリラックスセット適用時間の終了までの残り時間
- 「引き取り完了」操作
- 計画との差分

日時指定で「現在時刻」を選んだ場合、表示は1分ごとに更新する。タブが非表示の間は不要なタイマー処理を抑制し、復帰時に現在時刻から再計算する。

預け入れ中の個体がない場合は、小さなオリジナルイラストと開始導線を表示する。

### 6.3 個体一覧画面

- 管理名・ポケモン名検索
- 預け入れ中、計画あり等の絞り込み
- 更新日、レベル、作成日で並び替え
- 最後に使った検索・絞り込み・並び順を保存
- 新規作成
- 複製
- JSONで個体単位書き出し
- 共有URL作成
- 削除

### 6.4 個体詳細画面

- 管理名
- ポケモン
- EXP補正（上昇／無補正／下降）
- 経験値タイプ
- 現在レベル
- 次のレベルまでの残りEXP
- シミュレーション上のレベル上限
- 育成計画
- 関連履歴
- 現在の預け入れ状態

管理名の初期値はポケモン名とし、利用者が任意変更できる。

### 6.5 履歴画面

- 自動計算履歴
- 引き取り履歴
- 名前付きスナップショット
- 育成計画実績
- 予測と実績の差
- 当時の予測値
- 最新ルールでの再計算値
- JSON／CSV検証データ出力

保存件数設定：25件、50件、100件、無制限。初期値は50件。名前付きスナップショットは自動削除対象外。

### 6.6 設定画面

- テーマ：システム／ライト／ダーク
- 入力方式の初期設定
- 履歴保存件数
- タイムゾーン（IANAタイムゾーン一覧から選択）
- 検証モード
- PWAインストール案内の再表示
- バックアップ・復元
- 保存容量表示・履歴整理

---

## 7. 入力仕様

### 7.1 滞在時間

#### 経過時間方式

- 日：0以上
- 時：0〜23
- 分：0〜59
- 上限は計算ルールの最大蓄積期間
- プリセット：1日、3日、7日、14日、30日

#### 日時指定方式

- 預け入れ開始日時
- 引き取り日時
  - 現在時刻
  - 指定日時
- タイムゾーン
- IANAタイムゾーンIDを選択肢として表示し、任意文字列の自由入力にはしない
- 保存時はUTC時刻とIANAタイムゾーンIDの両方を保持
- 終了日時が開始日時より前の場合はエラー

### 7.2 リラックスセット

入力は次の3状態とする。

- 使用なし
- 使用あり：枚数で指定
- 使用あり：適用時間で指定

#### 枚数指定

- 1枚を7日分として換算する。
- 複数枚は預け入れ開始時から連続して適用されたものとして扱う。
- 計算対象となる適用時間は、滞在時間と `枚数 × 7日` の短い方とする。

#### 適用時間指定

- 日・時間・分で入力する。
- 預け入れ開始時から入力時間だけ連続して適用されたものとして扱う。
- 入力時間が滞在時間を超える場合は、滞在時間を上限として計算する。

#### 簡略化方針

- 実際の使用開始日時は指定しない。
- 複数の適用区間、途中中断、セッション間の残時間持ち越しは扱わない。
- リラックスセットの所持数・使用履歴は管理しない。
- 枚数入力と時間入力は同一計算へ正規化し、内部では適用分数として扱う。

### 7.3 EXP補正

「EXP上昇・無補正・EXP下降」の3択をラジオボタンで直接選択する。性格名の選択欄は設けない。倍率はマスターデータから取得し、UIコードへ直書きしない。

### 7.4 ポケモン・経験値タイプ

- ポケモン名から経験値タイプを自動選択
- 実装済みポケモンをフォーム違いを含めて一覧へ収録し、図鑑番号順に表示
- 経験値タイプを600／900／1080／1320から手動上書き可能
- 上書き中はポケモンマスター更新の影響を受けない
- 新規ポケモンが未登録でも、手動タイプ選択で計算可能

### 7.5 現在の育成状況

レベル計算を利用する場合の入力：

- 現在レベル
- 次のレベルまでの残りEXP

「そのレベルで獲得済みのEXP」方式は提供しない。

滞在条件だけ入力した場合はEXPだけ計算する。レベル情報を追加した時点で到達レベル表示を追加する。

### 7.6 レベル上限

- 初期値はLv.70とする。
- 詳細設定で一時的に変更可能とする。
- リサーチランクによるゲーム内の育成可能レベルは考慮しない。
- 個体データへ固定保存する値ではなく、計算シナリオの上限として扱う。
- 計算結果はゲーム内で実際にレベルアップ可能であることを保証しない。

### 7.7 EXPボーナスゲージ

EXPボーナスゲージは機能対象外とする。

- 現在ゲージ量を入力・保存しない。
- レベル上限到達後のEXPをゲージへ加算しない。
- ゲージ報酬を計算しない。
- レベル計算では、設定した上限到達後のEXPをレベルへ反映しない。

## 8. 計算結果仕様

### 8.1 主結果

結果カードの最上部に次を表示する。

- 獲得EXP
- 現在レベル → 引き取り後レベル
- 上昇レベル数
- 次のレベルまでの残りEXP

レベル情報が未入力の場合は獲得EXPだけ表示する。設定したレベル上限へ到達した後のEXPはレベル計算へ反映せず、EXPボーナスゲージへの変換も行わない。

### 8.2 内訳

展開式で次を表示する。

- 滞在時間
- 通常EXP
- リラックスセット追加EXP
- リラックスセット入力方式と換算後の適用時間
- 7日未満補正
- 性格補正
- 最終獲得EXP
- 適用レベル上限

UIにデータ確度・暫定表示は出さない。

### 8.3 シナリオ比較

状況に応じて意味のあるシナリオを自動生成する。

- 今引き取る
- 7日到達時
- 設定したリラックスセット適用終了時
- 次のレベル到達時
- 最大蓄積期間

利用者は任意シナリオを追加・複製・削除できる。

比較項目：

- 引き取り日時
- 待ち時間
- 獲得EXP
- 現在との差分EXP
- 到達レベル
- 現在との差分レベル
- リラックスセット設定（なし／枚数／時間）

### 8.4 判断支援

「おすすめ」と断定せず、次の形式で提示する。

- あと何時間待つと7日へ到達するか
- 待った場合にEXPがいくつ増えるか
- 次レベルへ到達する最短時刻
- 設定したリラックスセット適用終了まで待つ効果
- 最大預け入れ期間内の到達可能レベル

---

## 9. 計算ロジック

### 9.1 定数

ルール値はJSONまたはTypeScriptの読み取り専用マスターとして管理する。

```ts
interface NapIslandRuleSet {
  id: string;
  effectiveFrom: string;
  baseExpPerDay: number;
  relaxExpPerDay: number;
  fullRewardThresholdMinutes: number;
  earlyWithdrawalMultiplier: number;
  maxAccumulation: MaxAccumulationRule;
  rounding: RoundingRule;
  natureApplication: NatureApplicationRule;
  sourceRefs: string[];
}
```

初期公式値：

```ts
baseExpPerDay = 150;
relaxExpPerDay = 450;
fullRewardThresholdMinutes = 7 * 24 * 60;
earlyWithdrawalMultiplier = 0.5;
```

### 9.2 滞在時間

日時差は実時間で計算し、完了した分数へ変換する。

```ts
const stayMinutes = Math.max(
  0,
  Math.floor((endEpochMs - startEpochMs) / 60_000),
);
```

タイムゾーンは表示・入力解釈に使用し、経過時間はUTCエポック差で計算する。夏時間を含む地域でも、実際の経過時間がずれないことを優先する。

### 9.3 最大蓄積期間

公式告知は「預けたまま1年経つと上限」としている。365日固定か翌年同日時かはルールデータで切り替え可能にする。

```ts
type MaxAccumulationRule =
  | { kind: "fixed-days"; days: number }
  | { kind: "calendar-year" };
```

確定までは採用ルールを内部ルールセットへ固定し、将来の検証で差し替える。

### 9.4 リラックスセット有効時間

リラックスセット入力を適用分数へ正規化する。

```ts
type RelaxSetting =
  | { mode: "none" }
  | { mode: "tickets"; ticketCount: number }
  | { mode: "duration"; durationMinutes: number };
```

```ts
function resolveRelaxMinutes(
  stayMinutes: number,
  setting: RelaxSetting,
): number {
  if (setting.mode === "none") return 0;

  const requestedMinutes =
    setting.mode === "tickets"
      ? setting.ticketCount * 7 * 24 * 60
      : setting.durationMinutes;

  return Math.min(stayMinutes, Math.max(0, requestedMinutes));
}
```

適用は預け入れ開始時から連続しているものとみなす。任意の開始時刻、複数区間、途中中断、残時間持ち越しは計算しない。

### 9.5 基本EXP

理論値：

```ts
baseRawExp = stayMinutes * baseExpPerDay / 1440;
relaxRawExp = relaxMinutes * relaxExpPerDay / 1440;
grossRawExp = baseRawExp + relaxRawExp;
```

### 9.6 7日未満補正

滞在時間が閾値未満の場合、通常分とリラックス追加分を含む獲得EXPへ半減補正を適用する。

```ts
withdrawalAdjustedExp =
  stayMinutes < fullRewardThresholdMinutes
    ? grossRawExp * earlyWithdrawalMultiplier
    : grossRawExp;
```

### 9.7 性格補正と端数処理

具体的な端数処理順はルールセットで管理する。通常利用では変更できず、設定画面で検証モードを有効化した場合だけ候補ルールを比較できる。

```ts
type RoundingStage =
  | "per-minute"
  | "per-source"
  | "after-combine"
  | "after-early-withdrawal"
  | "after-nature";

type RoundingMode = "floor" | "round" | "ceil" | "truncate";

interface RoundingRule {
  stage: RoundingStage;
  mode: RoundingMode;
}
```

標準ルールは次の流れを初期候補とする。

```text
滞在分数を算出
→ 通常EXPと追加EXPを小数で算出
→ 合算
→ 7日未満補正
→ 性格補正
→ 最終段階で整数化
```

アプリ内更新時にルールが変更されても、履歴には当時のルールIDを残す。

### 9.8 レベル計算

各経験値タイプのレベル到達累積EXPテーブルを正本として保持する。差分の必要EXPは累積値の差から算出し、経験値タイプ倍率を実行時に毎回適用しない。

```ts
type ExpType = 600 | 900 | 1080 | 1320;

interface ExpCurve {
  id: string;
  expType: ExpType;
  maxDefinedLevel: number;
  cumulativeExpToReachLevel: Record<number, number>;
  dataVersion: string;
}
```

処理：

1. 現在レベルと「次のレベルまでの残りEXP」から現在の累積EXP位置を求める。
2. 獲得EXPを加算する。
3. 設定したレベル上限までの累積EXPテーブルから到達レベルを求める。
4. 上限到達後のEXPはレベル計算へ反映しない。
5. EXPボーナスゲージへの変換は行わない。

```ts
interface LevelResult {
  beforeLevel: number;
  afterLevel: number;
  gainedLevels: number;
  remainingExpToNextLevel: number | null;
  appliedExp: number;
  ignoredExpAfterLevelCap: number;
}
```

`ignoredExpAfterLevelCap` は計算の整合確認用に内部保持してよいが、ゲーム内ゲージ値として扱わない。

### 9.9 次レベル・指定レベル到達時刻

EXPの累積関数を用いて、目標EXPへ到達する最初の分を二分探索する。

- 探索範囲：現在時刻〜最大蓄積期間
- 重要境界：7日、設定したリラックスセット適用終了、最大期間
- 到達不能の場合は不足EXPと到達可能最大レベルを返す

### 9.10 複数回の預け入れ計画

各回は独立した7日未満判定を持つ。引き取りごとに滞在時間がリセットされるため、複数回計画では各セグメントを個別計算する。

```ts
interface PlanSegment {
  id: string;
  startAt: string;
  endAt: string;
  timezone: string;
  relaxSetting: RelaxSetting;
  expectedExp: number;
  expectedEndState: LevelState;
  status: "planned" | "active" | "completed" | "skipped";
}
```

自動生成する3案：

1. **最短到達**  
   必要なリラックスセット枚数を制限せず、目標到達日時を最小化する。

2. **セット節約**  
   目標日を満たす範囲で、使用するリラックスセット枚数を最小化する。

3. **7日単位**  
   原則7日以上のセグメントで構成し、半減を避けつつ管理の簡潔さを優先する。EXP効率が特別に上昇する方式ではない。

自動生成後、各回の期間、空白期間、リラックスセット設定（なし／枚数／時間）を手動編集できる。アプリ全体の所持数や計画間の在庫競合は管理しない。

### 9.11 計画不達時の代替案

- 不足EXP
- 不足時間
- 目標日延長候補
- 追加リラックスセット使用時の必要枚数
- 条件内の最大到達レベル
- 複数回に分けた場合の計画

を返す。

---

## 10. 預け入れ管理

### 10.1 制約

アプリ全体でアクティブな預け入れは最大1件。

別個体の預け入れ開始時、既存セッションがある場合は次を選択する。

- 現在時刻で引き取り結果を記録して切り替える
- 記録せず預け入れ状態だけ解除する
- キャンセル

### 10.2 開始

開始方法：

- 計算条件から開始
- 保存個体から開始
- 育成計画の予定回から開始

計画から開始した場合は予定条件を引き継ぎ、実際の開始日時へ更新する。

### 10.3 引き取り完了

手順：

1. 最終予測を計算
2. ゲーム内実績を任意入力
3. 予測と実績の整合性を検証
4. 個体へ反映する値を確認
5. 履歴・スナップショットへ保存
6. 育成計画の残りを再計算
7. 預け入れ状態を終了

実績入力項目：

- 実際の獲得EXP
- 実際の引き取り後レベル
- 実際の「次のレベルまでの残りEXP」
- 実際のリラックスセット設定（なし／枚数／適用時間）
- 任意メモ

### 10.4 実績の優先順位

- 実際のレベル・残りEXPが入力済み：それを正本候補とする
- 実績EXPだけ入力済み：実績EXPから到達状態を計算する
- 実績未入力：予測値を使用する

実績EXPと実際のレベル状態が矛盾する場合は自動決定せず、どちらを個体へ反映するか選択させる。入力値は両方とも履歴へ保存する。

### 10.5 計画への反映

引き取り後、次から選択する。

- 元の予定日を維持して数値だけ再計算
- 以降の予定を実績終了日時から連続配置
- 目標条件から計画全体を再生成
- 今回は計画を更新しない

---

## 11. 成長推移グラフ

### 11.1 表示内容

- 累積EXP
- 到達レベル
- 7日到達地点
- リラックスセット適用期間
- シナリオの引き取り地点
- レベルアップ地点

### 11.2 表示範囲

- 自動範囲
- 7日
- 14日
- 30日
- 90日
- 1年

ズームと横スクロールへ対応する。

### 11.3 データ生成

1分ごとの全点は生成しない。次の重要地点を正確に保持する。

- 開始・終了
- 7日到達
- リラックスセット適用終了
- 各レベルアップ
- 比較シナリオ
- 最大蓄積期間

その間は画面幅に合わせて適応的にサンプリングする。

### 11.4 アクセシブルな代替

- グラフ内容の文章要約
- 主要地点のデータ表
- キーボードで展開・折りたたみ可能

グラフライブラリはRechartsを使用する。

---

## 12. 保存・履歴・共有

### 12.1 自動保存

- 計算フォームの一時入力：自動保存
- 最後に使用した入力方式：自動保存
- 最後に開いた個体：自動保存
- テーマ、検索条件等：自動保存
- 個体の現在レベル等：明示操作時のみ保存

「新規計算」へ切り替える際に未確定入力がある場合は、破棄確認を行う。

### 12.2 履歴

自動履歴には次を保存する。

- 入力条件
- 計算結果
- ルールセットID
- マスターデータバージョン
- 計算日時
- 関連個体ID
- 関連計画ID

大量データ時は、古い自動履歴だけを整理候補として提示する。個体、計画、名前付きスナップショットは自動削除しない。

### 12.3 スナップショット

任意の計算結果へ名前を付けて保存する。

- 自動履歴件数制限の対象外
- 複製・比較・共有可能
- 元個体が削除されてもスナップショット自体は保持可能

### 12.4 共有URL

データはURLのハッシュ部分へ格納する。

```text
https://ti-maru.github.io/pokemon-sleep-island-simulator/#share=<versioned-payload>
```

共有範囲：

- 計算条件のみ
- 育成状況を含む
- 個体名を含むすべて

共有前に含まれる項目を確認する。受信時はZodで検証し、開いただけでは端末内へ保存しない。

- 一時利用
- 保存
- キャンセル

から選択する。

URL長が実用上限を超える場合はJSON書き出しへ案内する。

### 12.5 JSONバックアップ

暗号化しない人間可読JSONとする。

バックアップ対象：

- 個体
- 預け入れ状態
- 計画
- 履歴
- スナップショット
- 実績
- 設定
- マスターデータ参照バージョン

復元方法：

- すべて置き換える
- 既存データへ統合する
- 内容を確認して個別選択する

復元前に自動バックアップを作成する。重複候補はID、内容ハッシュ、作成日時等から判定し、利用者へ提示する。

### 12.6 検証データ出力

引き取り実績をJSON／CSVで書き出せる。

含める項目：

- 匿名の記録ID
- 滞在開始・終了
- タイムゾーン
- 完了分数
- リラックスセット設定（なし／枚数／適用時間）
- 性格補正区分
- 経験値タイプ
- 予測EXP
- 実績EXP
- 予測レベル状態
- 実績レベル状態
- 差分
- ルールセットID
- データバージョン

個体管理名は既定で除外し、明示選択した場合だけ含める。

---

## 13. データモデル

### 13.1 共通型

```ts
type EntityId = string;
type ISODateTime = string;
type IanaTimeZone = string;

type DataConfidence =
  | "official"
  | "multi-source-verified"
  | "single-source"
  | "provisional"
  | "needs-review";

interface AuditMeta {
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  dataVersion: string;
  sourceRefs: string[];
  confidence: DataConfidence;
}
```

`DataConfidence` はUI表示には使用しないが、データ更新・履歴・検証で保持する。

### 13.2 ポケモンマスター

```ts
interface PokemonMaster {
  id: string;
  dexNo: string;
  nameJa: string;
  expType: ExpType;
  available: boolean;
  audit: AuditMeta;
}
```

### 13.3 性格マスター

```ts
interface NatureMaster {
  id: string;
  nameJa: string;
  expEffect: "up" | "neutral" | "down";
  multiplier: number;
  audit: AuditMeta;
}
```

### 13.4 保存個体

```ts
interface PokemonIndividual {
  id: EntityId;
  pokemonId: string | null;
  displayName: string;
  natureId: string | null;
  expEffectOverride: "up" | "neutral" | "down" | null;
  expTypeOverride: ExpType | null;
  currentLevel: number;
  remainingExpToNextLevel: number | null;
  targetLevel: number | null;
  targetDate: ISODateTime | null;
  targetTimezone: IanaTimeZone | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
```

`natureId`、`targetLevel`、`targetDate`、`targetTimezone` は既存バックアップとの互換性維持用フィールドとする。新規・更新UIでは性格名および個体共通の目標を入力せず、`natureId` と目標関連フィールドは `null`、EXP補正は `expEffectOverride` へ3区分で保存する。到達レベルと期限は育成計画を開いた画面内だけで指定し、個体の基本情報へは保存しない。

### 13.5 リラックスセット設定

```ts
type RelaxSetting =
  | { mode: "none" }
  | { mode: "tickets"; ticketCount: number }
  | { mode: "duration"; durationMinutes: number };
```

`RelaxSetting` はリラックスセットを簡易指定するための値オブジェクトであり、残時間、所持数、使用履歴、複数区間は保持しない。

### 13.6 預け入れセッション

```ts
interface DepositSession {
  id: EntityId;
  individualId: EntityId | null;
  startedAt: ISODateTime;
  timezone: IanaTimeZone;
  plannedEndAt: ISODateTime | null;
  relaxSetting: RelaxSetting;
  sourcePlanId: EntityId | null;
  sourcePlanSegmentId: EntityId | null;
  status: "active" | "completed" | "cancelled";
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
```

アクティブ状態はアプリ全体で最大1件。

### 13.7 計算入力

```ts
interface CalculationInput {
  mode: "duration" | "datetime";
  durationMinutes?: number;
  startAt?: ISODateTime;
  endMode?: "now" | "specified";
  endAt?: ISODateTime;
  timezone: IanaTimeZone;
  relaxSetting: RelaxSetting;
  expEffect: "up" | "neutral" | "down";
  expType?: ExpType;
  levelState?: LevelState;
  levelCap: number;
  targetLevel?: number;
  targetDate?: ISODateTime;
  ruleSetId: string;
}
```

### 13.8 計算結果

```ts
interface CalculationResult {
  stayMinutes: number;
  eligibleMinutes: number;
  relaxMinutes: number;
  baseRawExp: number;
  relaxRawExp: number;
  earlyWithdrawalApplied: boolean;
  natureMultiplier: number;
  finalExp: number;
  levelResult: LevelResult | null;
  milestones: Milestone[];
  ruleSetId: string;
  dataVersion: string;
}
```

### 13.9 履歴

```ts
interface CalculationHistoryRecord {
  id: EntityId;
  kind: "calculation" | "withdrawal" | "plan-comparison";
  individualId: EntityId | null;
  planId: EntityId | null;
  inputSnapshot: CalculationInput;
  originalResult: CalculationResult;
  latestRecalculatedResult: CalculationResult | null;
  actualResult: ActualWithdrawalResult | null;
  createdAt: ISODateTime;
}
```

### 13.10 育成計画

```ts
interface GrowthPlan {
  id: EntityId;
  individualId: EntityId;
  name: string;
  strategy: "fastest" | "ticket-saving" | "seven-day" | "custom";
  targetLevel: number | null;
  targetDate: ISODateTime | null;
  segments: PlanSegment[];
  status: "draft" | "active" | "completed" | "archived";
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
```

### 13.11 バックアップ

```ts
interface BackupEnvelope {
  format: "pokemon-sleep-island-simulator-backup";
  schemaVersion: number;
  appVersion: string;
  exportedAt: ISODateTime;
  payload: {
    individuals: PokemonIndividual[];
    sessions: DepositSession[];
    plans: GrowthPlan[];
    histories: CalculationHistoryRecord[];
    snapshots: NamedSnapshot[];
    settings: PersistedSettings;
  };
}
```

---

## 14. 永続化設計

### 14.1 正本

IndexedDBを正本とし、Dexie.jsで管理する。

想定テーブル：

```text
meta
individuals
depositSessions
growthPlans
histories
snapshots
verificationRecords
appSettings
migrationBackups
```

### 14.2 Dexieスキーマ例

```ts
class AppDatabase extends Dexie {
  individuals!: Table<PokemonIndividual, string>;
  depositSessions!: Table<DepositSession, string>;
  growthPlans!: Table<GrowthPlan, string>;
  histories!: Table<CalculationHistoryRecord, string>;
  snapshots!: Table<NamedSnapshot, string>;
  appSettings!: Table<PersistedSettings, string>;

  constructor() {
    super("pokemonSleepIslandSimulator");

    this.version(1).stores({
      individuals: "id, pokemonId, displayName, currentLevel, targetDate, updatedAt",
      depositSessions: "id, status, individualId, startedAt, updatedAt",
      growthPlans: "id, individualId, status, targetDate, updatedAt",
      histories: "id, kind, individualId, planId, createdAt",
      snapshots: "id, individualId, createdAt",
      appSettings: "id",
    });
  }
}
```

### 14.3 マイグレーション

- スキーマ更新前にローカルバックアップを生成
- Dexieのバージョンマイグレーションをトランザクションで実施
- 失敗時は旧データへ復元
- バックアップをJSONとして書き出し可能
- マイグレーション処理は冪等性を持たせる

### 14.4 localStorageフォールバック

IndexedDBが利用不可の場合は、リポジトリ層を通じてlocalStorageへ切り替える。

優先保存：

1. 設定
2. 保存個体
3. アクティブ預け入れ
4. 育成計画
5. 最近の履歴

容量不足時は履歴件数を制限し、UIで簡易保存モードを通知する。これはデータ確度表示とは別の動作環境通知である。

---

## 15. アプリケーションアーキテクチャ

### 15.1 技術スタック

| 領域 | 採用技術 |
|---|---|
| ビルド | Vite |
| UI | React + TypeScript |
| パッケージ管理 | pnpm |
| 状態管理 | Zustand |
| フォーム | React Hook Form |
| バリデーション | Zod |
| 永続化 | Dexie.js / IndexedDB |
| フォールバック | localStorage |
| グラフ | Recharts |
| スタイル | CSS Modules + CSS Custom Properties |
| PWA | Vite向けPWAプラグインまたは同等構成 |
| 単体テスト | Vitest |
| UIテスト | React Testing Library |
| E2E | Playwright |
| アクセシビリティ検査 | axe-core系連携 |
| CI/CD | GitHub Actions + GitHub Pages |

### 15.2 レイヤー

```text
UI / Pages / Components
        ↓
Application Services / Use Cases
        ↓
Domain Models / Calculation Engines
        ↓
Repository Interfaces
        ↓
Dexie Repository / localStorage Fallback
```

計算ロジックはReact、Zustand、Dexieへ依存しない純粋関数として実装する。

### 15.3 ディレクトリ案

```text
src/
├─ app/
│  ├─ App.tsx
│  ├─ routes.tsx
│  ├─ providers/
│  └─ stores/
├─ domain/
│  ├─ napIsland/
│  │  ├─ calculateNapIslandExp.ts
│  │  ├─ calculateMilestones.ts
│  │  ├─ calculateGrowthSeries.ts
│  │  └─ rules.ts
│  ├─ leveling/
│  │  ├─ applyExpToLevel.ts
│  │  ├─ findTargetLevelTime.ts
│  │  └─ expCurve.ts
│  ├─ planning/
│  │  ├─ generateFastestPlan.ts
│  │  ├─ generateTicketSavingPlan.ts
│  │  ├─ generateSevenDayPlan.ts
│  │  └─ recalculatePlan.ts
│  └─ shared/
├─ application/
│  ├─ calculate/
│  ├─ deposits/
│  ├─ individuals/
│  ├─ histories/
│  ├─ plans/
│  ├─ backup/
│  └─ sharing/
├─ infrastructure/
│  ├─ db/
│  ├─ repositories/
│  ├─ storageFallback/
│  ├─ pwa/
│  └─ export/
├─ data/
│  ├─ nap-island-rules.json
│  ├─ exp-curves.json
│  ├─ pokemon-exp-types.json
│  ├─ natures.json
│  └─ data-manifest.json
├─ features/
│  ├─ calculator/
│  ├─ activeDeposit/
│  ├─ individuals/
│  ├─ history/
│  ├─ plans/
│  ├─ settings/
│  ├─ help/
│  └─ changelog/
├─ components/
│  ├─ ui/
│  ├─ layout/
│  └─ illustrations/
├─ styles/
│  ├─ tokens.css
│  ├─ themes.css
│  └─ globals.css
├─ i18n/
│  ├─ ja.json
│  └─ index.ts
└─ tests/
```

### 15.4 状態管理

Zustandで扱うもの：

- 現在の計算フォーム
- 選択中個体
- アクティブ預け入れの表示状態
- シナリオ編集状態
- UIテーマ
- ナビゲーション状態
- 検索・絞り込み条件

IndexedDBへ保存する永続データは、ストアの永続化プラグインへ直接依存させず、アプリケーションサービス経由で保存する。

---

## 16. フォーム・バリデーション

### 16.1 基本方針

- React Hook Formでフォーム状態管理
- Zodを入力、共有URL、JSONバックアップ、マスターデータの共通検証に使用
- エラーは該当欄の近くへ表示
- 送信・確定時に最初のエラーへフォーカス移動
- 数値欄は全角数字の正規化を検討
- 空欄と0を区別する

### 16.2 主な検証

- 滞在時間は0以上
- 日時終了は開始以後
- 分・時の範囲
- リラックスセット枚数は0以上の整数
- リラックスセット適用時間は0以上
- 現在レベルは1以上、適用上限以下
- 残りEXPは0以上、当該レベルの必要EXP以下
- 育成計画の到達レベルは現在レベル以上
- 共有データはスキーマバージョンが対応範囲内
- バックアップは形式識別子とスキーマバージョンを必須とする

---

## 17. PWA・オフライン

### 17.1 機能

- ホーム画面へ追加可能
- 初回読み込み後はオフラインで計算・保存・履歴閲覧可能
- 対応環境でインストール案内を一度だけ控えめに表示
- 閉じた後は自動再表示しない
- 設定から案内を再表示可能

### 17.2 キャッシュ方針

事前キャッシュ：

- HTML
- JavaScript
- CSS
- マスターデータJSON
- SVG
- 主要WebP
- フォントサブセット

実行時キャッシュ：原則不要。外部APIを使用しない。

### 17.3 更新

新しいService Workerを検出した場合、利用者の入力を失わないよう一時フォームを保存してから更新案内を表示する。

- 今すぐ更新
- 後で更新

更新後はデータマイグレーションを実行する。

プッシュ通知、バックグラウンド通知、期限通知は実装しない。

---

## 18. デザインシステム

### 18.1 方向性

- シンプル
- ゲームらしい親しみやすさ
- 過剰な装飾を避ける
- 空・海・草木を基調
- 計算値の読みやすさを優先

### 18.2 色

ライトテーマ：

- 淡い空色
- 青緑
- 生成り
- 白に近いカード背景

ダークテーマ：

- 深い紺
- 落ち着いた青緑
- 暗い灰色
- 高コントラストの文字
- テキスト入力、数値入力、日時入力、セレクト、テキストエリアは暗い背景と明るい文字を組み合わせ、白背景の入力欄を残さない

意味色：

- 成長・完了：緑
- 注意：黄〜橙
- エラー：赤
- 情報：青

色だけに意味を依存させず、アイコン・文言を併用する。

### 18.3 テーマ

- 初期値はOS設定へ追従
- ライト／ダークを手動上書き可能
- 選択を端末内保存

### 18.4 タイポグラフィ

- 見出し：丸みのあるオープンライセンスフォント
- 本文・数値・入力欄：OS標準フォント
- 外部CDNを使わず必要サブセットを同梱
- フォントライセンスをリポジトリへ保存
- フォントファイルはMIT License対象外

### 18.5 イラスト・アイコン

- ポケモン画像、公式ロゴ、公式画面画像を使用しない
- UIアイコン・波・雲等：オリジナルSVG
- ヘッダー、空状態、預け入れ開始、引き取り完了：オリジナルWebP
- 生成AIを使用する場合、既存キャラクター・既存ロゴ・モンスターボール等を想起させる意匠を避ける
- 生成日、プロンプト概要、加工履歴、利用条件を管理
- 装飾画像は原則 `alt=""` とし、意味を持つ場合のみ代替テキストを付ける

### 18.6 ロゴ・PWAアイコン

- サイト上はテキストロゴ
- PWAには「小さな島・休息・成長」を抽象化した独自アイコン
- 小サイズで識別できる単純なシルエット
- 公式ロゴ風の文字組みは行わない

### 18.7 アニメーション

- 通常操作：短いトランジション
- 節目：預け入れ開始、7日到達、引き取り完了、レベルアップで軽い演出
- `prefers-reduced-motion` 有効時は省略または即時表示

---

## 19. アクセシビリティ

目標：WCAG 2.2 AA。

- キーボードのみで全操作可能
- 明確なフォーカス表示
- フォームラベルを省略しない
- ダイアログのフォーカストラップと復帰
- エラーを `aria-describedby` で関連付け
- 動的計算結果を適切なライブリージョンで通知。ただし入力ごとの過剰読み上げを避ける
- 色以外の警告表現
- 200%拡大で横スクロールを最小化
- 44px相当のタッチ対象を目標
- グラフの文章要約と表形式
- ライト・ダーク双方のコントラスト検証
- axeをコンポーネントテストとE2Eへ統合
- 重大な自動検査違反がある場合はデプロイしない

---

## 20. プライバシー・セキュリティ

### 20.1 外部通信

- アクセス解析なし
- 広告なし
- 入力内容の外部送信なし
- 外部データAPIなし
- WebフォントCDNなし

GitHub Pagesの配信およびGitHub側で提供される公開リポジトリ情報の範囲だけで運用する。

### 20.2 共有URL

ハッシュ部分を使用し、サーバーへ共有データを送信しない設計とする。ただし利用者が共有したURL自体を第三者が閲覧できる可能性は説明する。

### 20.3 バックアップ

暗号化しないため、書き出し画面で以下を明示する。

- ファイルを他者へ渡すと個体名や履歴を閲覧される可能性がある
- 公開ストレージへ置かない
- 不要になったファイルは利用者自身で削除する

### 20.4 入力データ

共有URL・バックアップ・マスターデータはすべてZodで検証し、プロトタイプ汚染や想定外キーを排除する。HTMLとして挿入せず、Reactの通常エスケープを使用する。

---

## 21. ライセンス・権利

### 21.1 コード

ソースコードにMIT Licenseを適用する。

### 21.2 MIT対象外

- ポケモン名等のゲーム由来名称
- マスターデータ
- 生成画像
- SVG・ロゴ・PWAアイコン等のデザイン素材
- フォントファイル
- 第三者ライブラリ
- 出典資料

READMEで適用範囲を明記する。

### 21.3 生成AIコード

- 出所不明のコード断片を貼り付けない
- 特定OSSの実装へ過度に類似しないようレビューする
- 生成コードも人間が設計・検証し、リポジトリのライセンス方針に適合することを確認する
- READMEへ生成AIを開発補助として利用した旨を記載する

### 21.4 依存ライセンス

- CIで依存ライセンスを検査
- `THIRD_PARTY_NOTICES.md` を管理
- コピーレフト等、配布条件へ影響する依存追加はレビュー必須
- フォントライセンス文書を保存

### 21.5 フッター

フッターに次を記載する。

- 非公式のファンメイドツールであること
- 公式・権利者との関係がないこと
- 名称・商標の権利は各権利者へ帰属すること
- 参照した公式情報へのリンク
- リポジトリへのリンク

暫定仕様・データ確度に関する文言は表示しない。

---

## 22. 国際化

初期版は日本語のみ。ただし、文言はコードへ直書きせず翻訳リソースへ分離する。

```json
{
  "app.title": "おひるね島 育成シミュレーター",
  "nav.calculator": "計算",
  "nav.deposit": "預け入れ",
  "result.gainedExp": "獲得EXP"
}
```

- 日時・数値書式はIntl APIを使用
- データの名前キーと表示名を分離
- 将来の英語追加時にデータ構造を変更しない

---

## 23. GitHub Pages・CI/CD

### 23.1 公開

- リポジトリ：`ti-maru/pokemon-sleep-island-simulator`
- URL：`https://ti-maru.github.io/pokemon-sleep-island-simulator/`
- `main` ブランチへの反映でGitHub Actionsを起動
- 全検査成功時だけGitHub Pagesへデプロイ

### 23.2 Vite設定

```ts
export default defineConfig({
  base: "/pokemon-sleep-island-simulator/",
});
```

ベースパスは環境変数または共通定数へ集約する。

### 23.3 ルーティング

GitHub Pagesでの404を避けるため、初期版は次のいずれかとする。

- Hash Routerを使用
- または単一HTMLの状態ベースナビゲーション

共有URLがハッシュを利用するため、ルーティング用ハッシュと共有データの衝突を避ける。推奨形式：

```text
#/calculator
#/individuals
#/share/<payload>
```

あるいは共有データを `#share=<payload>` とし、アプリ内ナビゲーションはHistory APIを使わず状態管理する。

### 23.4 CI必須検査

1. pnpm固定バージョンのセットアップ
2. lockfile固定インストール
3. フォーマット検査
4. ESLint
5. TypeScript型検査
6. 単体テスト
7. Reactコンポーネントテスト
8. axeアクセシビリティ検査
9. 本番ビルド
10. PWAマニフェスト・Service Worker検証
11. 依存ライセンス検査
12. Playwright E2E
13. GitHub Pagesデプロイ

いずれかが失敗した場合は公開しない。

---

## 24. テスト設計

### 24.1 単体テスト

対象：

- 経過分数計算
- 最大蓄積期間
- リラックスセット枚数・時間から適用分数への正規化
- 7日未満補正
- EXP補正
- 各端数ルール
- レベルアップ
- 上限超過
- 次レベル到達時刻
- 育成計画の到達レベル計算
- 計画生成3戦略
- 計画再計算
- バックアップ移行
- 共有ペイロード検証

基準ケース：

| 条件 | 無補正の理論値 |
|---|---:|
| 通常6日、7日未満補正 | 450 EXP |
| 通常7日 | 1,050 EXP |
| 通常14日 | 2,100 EXP |
| 7日すべてリラックスセット | 4,200 EXP |
| 14日のうち7日だけリラックスセット | 5,250 EXP |

端数ルールに依存しない整数日ケースは固定回帰テストとする。

### 24.2 コンポーネントテスト

- 入力方式切り替え
- 自動計算
- 詳細設定の展開
- エラー表示とフォーカス
- シナリオ追加・削除
- 引き取り確認ダイアログ
- 実績矛盾選択
- バックアップ復元方式選択
- テーマ切り替え
- グラフ代替表

### 24.3 E2E

対象ブラウザ：

- Chromium
- Firefox
- WebKit
- iPhone Safari相当
- Android Chrome相当

主要フロー：

1. EXPだけを計算
2. レベル情報を追加して結果を拡張
3. 保存個体を作成
4. 預け入れを開始
5. 現在予測を確認
6. 引き取り実績を入力
7. 個体へ反映
8. 元に戻す
9. 育成計画を3案生成
10. 計画から預け入れ開始
11. JSONバックアップ・復元
12. 共有URLの作成・読込
13. PWAオフライン起動
14. IndexedDB利用不可時のフォールバック
15. ライト・ダーク切り替え
16. キーボード操作

### 24.4 実機検証

公開後に確認すべきゲーム内ケース：

- 1分
- 10分
- 1時間
- 23時間59分
- 1日
- 6日23時間59分
- ちょうど7日
- EXP上昇性格
- EXP下降性格
- リラックスセットありの短時間
- 枚数指定と時間指定の一致ケース
- レベル上限直前
- 1年上限付近

実績記録から候補ルールごとの差分を比較できるようにする。

---

## 25. 性能設計

### 25.1 目標

- 通常の入力変更から主結果表示まで、利用者が遅延を感じにくいこと
- グラフ・長期計画等の重い処理はデバウンス
- 1年分の1分粒度配列を常駐させない
- 大量履歴はページングまたは仮想化
- WebPとフォントは必要サイズへ最適化

### 25.2 再計算

- EXP・レベル：即時
- グラフ：短いデバウンス
- 多数シナリオ：短いデバウンス
- 全履歴の最新ルール再計算：明示操作またはアイドル時間に分割実行

Web Workerは初期実装で必須としないが、長期計画最適化がUIをブロックする場合に導入できる境界を設ける。

---

## 26. エラー処理

### 26.1 利用者入力

欄近傍へ具体的な修正方法を表示する。

### 26.2 保存失敗

- 自動再試行は限定的に行う
- 入力中データをメモリと一時localStorageへ保持
- JSON書き出しを案内

### 26.3 マイグレーション失敗

- 更新前バックアップへ復元
- 失敗内容を利用者向けに簡潔表示
- 生のスタックトレースを表示しない

### 26.4 共有・バックアップ不正

- 一部だけ取り込まず、検証結果を一覧表示
- 対応外バージョンの場合は読込を中止
- 将来バージョンを古いアプリで無理に変換しない

### 26.5 エラーバウンダリ

主要画面単位でReact Error Boundaryを設置し、アプリ全体の操作不能を避ける。

---

## 27. 更新履歴・バージョニング

アプリ内の「ガイド」タブに更新履歴セクションを設ける。

記載内容：

- 機能追加・変更
- 不具合修正
- 計算ルール変更
- マスターデータ更新
- 過去結果への影響
- 再計算が必要な場合の案内

バージョンはSemantic Versioningを基本とする。

- MAJOR：保存形式・主要仕様の非互換変更
- MINOR：機能追加、ルール追加
- PATCH：不具合修正、データ修正

計算ルールセットとアプリバージョンは別管理とする。

---

## 28. 実装工程

「MVP」として機能を削るのではなく、完成版を段階的に実装・検証する。

### Phase 1：基盤・計算エンジン

- Vite / React / TypeScript / pnpm
- ドメイン型
- おひるね島EXP計算
- レベル計算
- ルールセット
- マスターデータ
- 単体テスト

### Phase 2：計算UI

- 経過時間・日時入力
- EXP補正・ポケモン・経験値タイプ
- リラックスセットのなし／枚数／時間入力
- 主結果・内訳
- シナリオ比較

### Phase 3：保存・個体・預け入れ

- Dexie
- localStorageフォールバック
- 個体管理
- アクティブ預け入れ
- 引き取り反映
- Undo

### Phase 4：履歴・実績・共有

- 自動履歴
- スナップショット
- 実績照合
- JSON／CSV
- ハッシュ共有URL
- バックアップ・復元

### Phase 5：育成計画

- 複数セグメント
- 3戦略生成
- リラックスセット使用枚数を考慮した計画生成
- 計画から預け入れ開始
- 実績後の再計算

### Phase 6：グラフ・PWA・デザイン

- Recharts
- 代替表
- PWA
- オフライン
- テーマ
- オリジナルイラスト
- フォント

### Phase 7：品質・公開

- Playwright全ブラウザ
- axe
- ライセンス検査
- マイグレーション検証
- GitHub Actions
- GitHub Pages
- README / CHANGELOG / THIRD_PARTY_NOTICES

初回公開は暫定計算ルールで行ってよい。機能完成度と品質検査を満たしたPhase単位で公開し、実機検証により判明した計算ルールは適宜更新する。

---

## 29. 完了条件

### 29.1 機能

- EXPだけの計算ができる
- レベル情報追加で到達レベルを計算できる
- 経過時間と日時指定の両方が使える
- リラックスセットを「なし／枚数／時間」で指定できる
- 自動・任意シナリオを比較できる
- 預け入れ状態を1件管理できる
- 引き取り実績を保存し個体へ反映できる
- 個体、履歴、スナップショット、計画を管理できる
- 3種類の育成計画案を生成できる
- JSONバックアップ、CSV検証出力、共有URLが動作する
- オフラインで主要機能が動作する

### 29.2 品質

- 計算基準ケースがすべて通る
- 対象5ブラウザ構成のE2Eが通る
- WCAG 2.2 AAを目標とした主要検査が通る
- 型エラー、Lintエラー、重大なaxe違反がない
- ライセンス検査が通る
- 保存データの更新前バックアップ・復元を確認済み

### 29.3 公開

- `main` へのマージ後、CI成功時のみ自動公開される
- PWAとしてインストールできる
- GitHub Pagesのサブパスで全アセットが正常に読み込まれる
- フッターの非公式表記・権利表記・参照元リンクが正しい

---

## 30. 残存する実装時確認事項

以下は初回公開を妨げる条件とはせず、公開後の実機検証・データ整備で適宜更新する。

1. 1分単位EXPの内部端数保持
2. 通常分と追加分の丸めタイミング
3. 7日未満補正時の丸め
4. 性格補正と半減補正の適用順
5. 最終整数化方式
6. 「1年」の厳密な定義
7. 全ポケモンの最新経験値タイプ
8. Lv.66以降を含む最新必要EXPテーブル

初期版では次の暫定ルールを採用する。

```text
滞在分数を算出
→ 通常EXPとリラックスセット追加EXPを小数で算出
→ 合算
→ 7日未満なら0.5倍
→ 性格補正
→ 最終段階で切り捨て
```

計算ルールはバージョン管理し、実機検証で差異が判明した場合は更新する。UIには暫定表示を出さないが、更新履歴へ変更内容を記録し、過去履歴には当時のルールIDを保持する。

## 31. 決定事項サマリー

| 分類 | 決定 |
|---|---|
| 入力 | 経過時間・日時指定の両対応。前回方式を保存 |
| 終了日時 | 現在時刻・指定日時を切り替え |
| リラックスセット | なし／枚数／適用時間。預け入れ開始時から連続適用として簡略計算 |
| EXP補正 | EXP上昇／無補正／EXP下降のラジオボタン |
| ポケモン | 実装済み全ポケモンの名前選択＋経験値タイプ手動上書き |
| 育成状態 | 現在レベル＋次レベルまでの残りEXP |
| レベル上限 | Lv.70を初期値、詳細設定で変更可能。リサーチランクは考慮しない |
| 結果 | 複数シナリオ比較、自動生成＋任意追加 |
| 保存 | 複数個体、IndexedDB正本、localStorageフォールバック |
| 共有 | 範囲選択、URLハッシュ、JSONバックアップ |
| 履歴 | 自動履歴＋名前付きスナップショット |
| 預け入れ | 1匹のみ、1分ごと更新、引き取り実績反映 |
| 目標 | 通常計算・個体フォームには設けない |
| 計画 | 計画画面内だけ到達レベル・任意期限を指定。複数回、3戦略自動生成、手動編集可能 |
| グラフ | Recharts、重要地点保持、要約・表を併設 |
| PWA | インストール・オフライン対応、通知なし |
| テーマ | OS追従＋手動ライト・ダーク |
| デザイン | 空・海・草木、シンプルなゲーム感、AI生成の独自装飾 |
| アクセシビリティ | WCAG 2.2 AA目標＋axe |
| 技術 | React / TypeScript / Vite / pnpm / Zustand / RHF / Zod / Dexie |
| テスト | Vitest / RTL / Playwright、主要ブラウザ＋モバイル |
| 公開 | `main` 反映でCI後GitHub Pagesへ自動公開 |
| URL | `https://ti-maru.github.io/pokemon-sleep-island-simulator/` |
| 解析 | 専用アクセス解析なし |
| 問い合わせ | Issues・Discussionsへの受付導線なし |
| ライセンス | コードのみMIT、素材・データ等は対象外 |
| 言語 | 初期版は日本語、i18n前提 |
| 確度表示 | UIへ表示しない。内部監査情報のみ保持 |

---

## 32. 改訂履歴

| 文書版 | 日付 | 変更内容 |
|---|---|---|
| 1.0 | 2026-07-19 | 初版作成 |
| 1.1 | 2026-07-19 | リサーチランクとEXPボーナスゲージを対象外化。リラックスセットを「なし／枚数／時間」の簡易モデルへ変更。暫定計算ルールでの初回公開を許容 |
| 1.2 | 2026-07-19 | EXP補正を3択へ統一。通常計算・個体フォームの目標入力を削除。実装済みポケモン一覧、IANAタイムゾーン選択、ガイドタブ、ダークテーマ入力欄の要件を追加 |

---

## 33. 参考リンク

- [『Pokémon Sleep』公式サイト：ゴンベのおひるね島](https://www.pokemonsleep.net/news/343231333934393334303235363832393531/)
- [『Pokémon Sleep』公式サイト：Ver.3.6.0 アップデート内容](https://www.pokemonsleep.net/news/343133383535303339383636353335393337/)
- [ポケモンスリープ攻略・検証 Wiki：育成/経験値タイプ](https://wikiwiki.jp/poke_sleep/%E8%82%B2%E6%88%90/%E7%B5%8C%E9%A8%93%E5%80%A4%E3%82%BF%E3%82%A4%E3%83%97)
- [ポケモンスリープ攻略・検証 Wiki：ポケモンの一覧](https://wikiwiki.jp/poke_sleep/%E3%83%9D%E3%82%B1%E3%83%A2%E3%83%B3%E3%81%AE%E4%B8%80%E8%A6%A7)
- [HULFT：タイムゾーン一覧](https://www.hulft.com/help/ja-jp/WebFT-V3/COM-ADM/Content/WEBFT_ADM_COM/TimeZone/timezonelist.htm)
