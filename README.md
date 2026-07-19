# おひるね島 育成シミュレーター

『Pokémon Sleep』の「おひるね島」に預けたポケモンについて、獲得 EXP、到達レベル、引き取り時期、長期育成計画を端末内で計算・管理する非公式 Web アプリです。

公開予定 URL: <https://ti-maru.github.io/pokemon-sleep-island-simulator/>

## 主な機能

- 経過時間または日時による EXP 計算
- 性格補正、経験値タイプ、Lv.70 までのレベル計算
- リラックスセットの「なし／枚数／適用時間」指定
- 自動・任意シナリオ比較とアクセシブルな成長グラフ
- 保存個体、アクティブな預け入れ、引き取り実績、Undo
- 自動履歴、名前付きスナップショット、匿名検証データ出力
- 共有範囲を選べるハッシュ URL、JSON バックアップ・復元
- 最短到達、セット節約、7日単位の育成計画
- IndexedDB と localStorage フォールバック、PWA オフライン利用

計算ルールは初回公開時点では暫定です。履歴には使用したルールセット ID とデータ版を保持し、ルール更新後も当時の予測を確認できます。ルールの参照元は[公式告知](https://www.pokemonsleep.net/news/343231333934393334303235363832393531/)です。

## 開発

Node.js 22 と pnpm 10.13.1 を使用します。

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

E2E を初めて実行する環境ではブラウザを導入します。

```sh
pnpm exec playwright install --with-deps chromium firefox webkit
pnpm test:e2e
```

`main` への push は GitHub Actions でフォーマット、Lint、型、単体・コンポーネント・axe・5ブラウザ構成 E2E、PWA、ライセンスを検査し、すべて成功した場合だけ GitHub Pages へ公開します。

## プライバシー

個体、履歴、計画、設定はブラウザ内だけに保存します。アクセス解析、広告、外部ゲームデータ API、入力内容の送信はありません。共有 URL は利用者が明示操作した場合だけ生成され、データは URL のハッシュに格納されます。バックアップは暗号化されないため、公開ストレージへ置かないでください。

## 権利・ライセンス

本ツールは非公式のファンメイドツールであり、公式・権利者とは関係ありません。名称・商標の権利は各権利者に帰属します。公式画像、ロゴ、ゲーム画面、複製 UI 素材は含みません。

ソースコードは [MIT License](./LICENSE) です。ただし、ゲーム由来名称・マスターデータ、参照資料、`public/island-mark.svg` を含むデザイン素材は MIT License の対象外です。第三者依存は [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) を参照してください。

設計と実装の補助に生成 AI を使用し、計算基準ケース、型検査、静的解析、自動テストで検証しています。
