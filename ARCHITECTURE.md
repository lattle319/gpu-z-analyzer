# アーキテクチャ設計 (ARCHITECTURE.md)

本ドキュメントでは、GPU-Z Log Visualizerのモジュール構造、データフロー、および主要な設計決定について説明します。

## モジュール構造

アプリケーションは単一のHTMLファイル内で動作するVanilla TypeScriptベースのアーキテクチャを採用しています。外部UIフレームワーク（ReactやVueなど）は使用していません。

```text
src/
├── main.ts              # アプリケーションのエントリーポイント、各モジュールの初期化と結合
├── layout.ts            # VS Code風の4ペインレイアウト（リサイズ可能な区切り線）の構築と管理
├── fileDrop.ts          # グローバルなドラッグ＆ドロップ領域とファイル読み込みの制御
├── logger.ts            # 下部パネルでの実行ログの表示と管理
├── parser.ts            # Shift-JISデコード、CSVパース、ヘッダー分割などのコアロジック
├── sidebarLeft.ts       # 左サイドバーのUI管理（データセット選択、カラム選択のリアクティブ更新）
├── chartManager.ts      # メインエリアのChart.js管理（グラフ描画、複数Y軸、Undo/Redo、パン・ズーム）
└── statistics.ts        # 右サイドバーの統計情報表示（最大、最小、平均、中央値の計算とUI更新）
```

## データフロー

アプリケーション内のデータは、`fileDrop`から入力され、`parser`で構造化された後、各UIマネージャーに分配されます。
グラフの操作（パン・ズーム）はコールバックを通じて`statistics`モジュールへ通知され、統計情報が再計算されます。

```text
[ユーザー] --(D&D)--> [fileDrop]
                         |
                   (ArrayBuffer)
                         v
[logger] <---- [main.ts (Orchestrator)] <--- [parser] (Shift-JIS Decode & CSV Parse)
                         |
                         | (AppData オブジェクト)
                         |
     +-------------------+-------------------+
     |                   |                   |
     v                   v                   v
[sidebarLeft]     [chartManager]     [statistics]
     |                   |                   ^
     | (状態変更)        |                   | (表示範囲の変更: minX, maxX)
     +------------------>+-------------------+
```

### 主要な設計決定

1. **状態管理 (State Management)**:
   - UIの複雑な状態管理フレームワークは避け、`main.ts` をオーケストレーターとして使用し、各マネージャークラスが自身の状態とDOMを持つシンプルな構造としました。
   - `sidebarLeft`はデータセットやカラムの有効・無効状態（`SidebarState`）を管理し、変更時にコールバックを発火してグラフや統計情報を更新します。

2. **Chart.jsとZoomプラグインの採用**:
   - 複数Y軸の独立した描画、およびマウスホイールでの直感的なズーム・パン操作を容易に実現するため、Canvasベースの`Chart.js`と`chartjs-plugin-zoom`を採用しました。
   - データポイントが多い場合でもCanvasベースであるため比較的軽量に動作します。

3. **リアルタイム統計の連動**:
   - グラフ側（`chartManager`）でのパン・ズーム完了時（`onPanComplete`, `onZoomComplete`）に、表示されているX軸の最小値・最大値をフック関数経由で`statistics`モジュールへ渡します。
   - `statistics`モジュールは受け取った範囲(`minX`, `maxX`)内に含まれるデータポイントのみをフィルタリングし、計算関数（`calcMax`等）に渡してリアルタイムに右サイドバーの表を再構築します。

4. **ビルドアーティファクトの単一ファイル化**:
   - オフライン環境や配布の容易さを考慮し、`vite-plugin-singlefile`を利用してCSS、JavaScriptをすべてインライン化した単一の `index.html` を出力するようにViteを設定しています。これによりWebサーバーなしでブラウザにファイルをドラッグするだけで動作します。
