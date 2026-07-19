export function GuidePage() {
  return (
    <main className="management-page guide-page">
      <header className="page-heading-block">
        <p className="eyebrow">GUIDE</p>
        <h1>ガイド</h1>
        <p>基本的な使い方と、このアプリの変更内容を確認できます。</p>
      </header>

      <div className="settings-grid">
        <section className="settings-card help-card">
          <h2>簡易ヘルプ</h2>
          <ol>
            <li>計算で滞在条件と育成状態を入力します。</li>
            <li>結果から個体保存、預け入れ、履歴保存ができます。</li>
            <li>個体画面では3種類の長期計画を比較できます。</li>
            <li>
              引き取り時に実績を入力すると、予測との差を履歴で確認できます。
            </li>
          </ol>
        </section>

        <section className="settings-card">
          <h2>更新履歴</h2>
          <p>
            <strong>0.3.0</strong> —
            ライト・ダーク配色、図鑑番号表示、計算画面03の配置を調整し、タイムゾーンをUTCオフセット順に並べました。
          </p>
          <p>
            <strong>0.2.0</strong> —
            ダークモードの入力欄、ナビゲーション、ポケモン一覧、EXP補正入力、タイムゾーン選択を改善しました。
          </p>
          <p>
            <strong>0.1.0</strong> —
            計算、個体、預け入れ、履歴、共有、育成計画、グラフ、オフライン対応を初期実装。計算ルールIDは各履歴に保持します。
          </p>
        </section>

        <section className="settings-card">
          <h2>GitHubリポジトリ</h2>
          <p>ソースコードと更新内容をGitHubで確認できます。</p>
          <a
            className="repository-link"
            href="https://github.com/ti-maru/pokemon-sleep-island-simulator"
            target="_blank"
            rel="noreferrer"
          >
            github.com/ti-maru/pokemon-sleep-island-simulator
          </a>
        </section>
      </div>
    </main>
  );
}
