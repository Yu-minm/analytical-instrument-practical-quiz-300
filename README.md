# 分析装置・不良解析 実務クイズ300

プラスチック、ポリマー、フィルム製造の品質トラブルを題材に、分析装置の原理、条件設定、データ解釈、装置選定、原因究明を学ぶ静的Webアプリです。

以前の100問版で見つかった次の問題を全面的に見直しました。

- 正解だけ文章が長い
- 強い断定表現から誤答を推測できる
- 装置原理を知らなくても消去法で解ける
- 用語暗記が多く、実務判断が少ない
- 正解位置に偏りがある

## 収録内容

- 全300問
- 中級210問、上級90問
- 主形式：単一選択180問、ケーススタディ75問、装置比較45問
- ケース関連161問
- 装置比較関連90問
- 正解位置：A・B・C・D相当が各75問
- 選択肢は画面表示時にもランダム化

対象装置は、FTIR、Raman、UV-Vis、NIR、蛍光、EDX、XRF、ICP-OES、ICP-MS、AAS、光学顕微鏡、偏光顕微鏡、デジタルマイクロスコープ、SEM、FE-SEM、TEM、XPS、AES、TOF-SIMS、DSC、TG-DTA、TGA、DMA、TMA、GC、GC-MS、HPLC、LC-MS、GPC、粒度分布、ゼータ電位、カールフィッシャー、粘度、接触角、BET、引張試験です。

## 主な機能

- カテゴリ、難易度、問題形式による出題範囲指定
- ケース関連、装置比較関連の絞り込み
- ランダム、苦手優先、未回答優先、しおり問題モード
- 10、20、30、50、100、全問の出題数指定
- 選択肢のセッション内ランダム化
- 回答前の確信度記録
- 誤答、迷い、勘の再出題
- 問題検索、解説・参考資料閲覧
- 学習履歴、カテゴリ別正答率、苦手問題一覧
- 履歴JSONの書き出し・読み込み
- ライト、ダーク、端末設定自動追従
- スマートフォン・PC対応

学習履歴はブラウザの `localStorage` に保存されます。サーバーへ送信しません。

---

# GitHubだけで公開する方法

## 1. ZIPを展開する

配布ZIPをWindowsで右クリックし、`すべて展開` を選択します。

展開後、次のファイルが同じフォルダ内にあることを確認します。

```text
analytical-instrument-practical-quiz-300/
├── index.html
├── style.css
├── app.js
├── data.js
├── README.md
├── QUESTION_BANK.md
├── SOURCES.md
├── QA_REPORT.md
├── NOTICE.md
├── CHANGELOG.md
├── .nojekyll
└── .gitignore
```

## 2. GitHubで新しいリポジトリを作る

1. GitHubへサインインします。
2. 右上の `+` を押します。
3. `New repository` を選択します。
4. Repository nameへ次を入力します。

```text
analytical-instrument-practical-quiz-300
```

5. 公開する場合は `Public` を選択します。
6. `Add a README file` はオフにします。
7. `.gitignore` は `None` にします。
8. Licenseは `None` にします。
9. `Create repository` を押します。

## 3. ファイルをアップロードする

空のリポジトリに表示される `uploading an existing file` を押します。

表示されない場合は、`Add file` → `Upload files` を選びます。

展開したフォルダを開き、フォルダの中身をすべて選択します。

```text
Ctrl + A
```

選択したファイルをGitHubの `Drag files here to add them to your repository` へドラッグします。

親フォルダごとではなく、`index.html` がリポジトリ直下へ入るようにします。

Commit messageには次を入力できます。

```text
Initial commit: add practical analytical instrument quiz
```

`Commit changes` を押します。

## 4. GitHub Pagesを設定する

1. リポジトリ上部の `Settings` を押します。
2. 左側の `Pages` を押します。
3. `Build and deployment` のSourceを `Deploy from a branch` にします。
4. Branchを `main` にします。
5. Folderを `/(root)` にします。
6. `Save` を押します。

公開URLは通常、次の形式です。

```text
https://GitHubユーザー名.github.io/analytical-instrument-practical-quiz-300/
```

反映には数分かかる場合があります。古い表示が残る場合はWindowsで `Ctrl + Shift + R` を押します。

---

# ローカルで確認する方法

## Windows PowerShell

ZIPをダウンロードフォルダへ展開した場合は、PowerShellで次を実行します。

```powershell
cd "$HOME\Downloads\analytical-instrument-practical-quiz-300"
py -m http.server 8000
```

`py` が見つからない場合は次を試します。

```powershell
python -m http.server 8000
```

ブラウザで次を開きます。

```text
http://localhost:8000
```

終了時はPowerShellで `Ctrl + C` を押します。

## macOS / Linux

```bash
cd ~/Downloads/analytical-instrument-practical-quiz-300
python3 -m http.server 8000
```

ブラウザで次を開きます。

```text
http://localhost:8000
```

---

# ファイルの役割

| ファイル | 役割 |
|---|---|
| `index.html` | 画面構造 |
| `style.css` | レスポンシブ表示、ライト・ダーク配色 |
| `app.js` | 出題、採点、検索、しおり、履歴 |
| `data.js` | アプリが読み込む300問と参考資料 |
| `QUESTION_BANK.md` | 人が読みやすい300問一覧 |
| `SOURCES.md` | 問題作成時に確認した公式日本語資料 |
| `QA_REPORT.md` | 選択肢長、正解位置、禁止表現などの検査結果 |
| `NOTICE.md` | 利用上の注意 |
| `build_data.py` | 問題データを再生成する開発用スクリプト |

通常の利用では `build_data.py` を実行する必要はありません。

---

# 操作方法

## クイズ

1. 学習設定でカテゴリを選択します。
2. 難易度と問題形式を選択します。
3. ランダム、苦手優先、未回答優先、しおりからモードを選びます。
4. 問題数を選択し、`クイズを開始` を押します。
5. 回答前に確信度を記録できます。
6. 回答後は全選択肢の解説と参考資料を確認できます。

キーボード操作は次のとおりです。

```text
1〜4  選択肢を回答
U    「迷い」を選択
B    しおりを切り替え
N    次の問題へ進む
```

## 問題検索

問題文、選択肢、解説、タグを検索できます。問題を展開すると正解、誤答解説、参考資料を確認できます。

## 学習履歴

累計正答率、学習済み問題数、カテゴリ別習熟度、苦手問題、最近のセッションを確認できます。

端末を変更するときは、学習履歴画面からJSONを書き出し、別端末で読み込んでください。

---

# 問題を編集する方法

問題は `data.js` に入っています。GitHub上で `data.js` を開き、鉛筆アイコンから編集できます。

ただし、300問を安全にまとめて修正する場合は `build_data.py` 側を変更し、再生成する方法を推奨します。手作業で括弧やカンマを削除すると、アプリ全体が読み込めなくなる場合があります。

変更後はブラウザで `F12` → `Console` を開き、赤いJavaScriptエラーがないことを確認してください。

---

# 品質確認

`QA_REPORT.md` に検査結果を記載しています。主な確認項目は次のとおりです。

- 全300問
- 問題ID重複なし
- 各問4選択肢・4解説
- 正解位置の均等化
- 正解と誤答の平均文字数の均衡
- 問題内の選択肢長差
- 強い断定語の検出
- 参考資料IDの存在確認
- 難易度、主形式、ケース関連、比較関連の件数

## 利用上の注意

本アプリは教育用です。実際の試料採取、前処理、装置条件、定量、判定、原因断定には、各装置の取扱説明書、標準規格、社内手順、標準試料、ブランク、回収率、再現性を確認してください。
