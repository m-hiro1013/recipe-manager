# =====================================
# 🗄️ DATABASE.md
# =====================================
#
# 【このファイルの役割】
# データベースの設計（テーブル定義・カラム・リレーション）を記録するドキュメント。
# プロジェクトの「データ構造がどうなっているか」の正（Single Source of Truth）。
# 実際のSupabaseのテーブルとこのファイルの内容は常に一致している必要がある。
#
# 【このファイルに書くこと】
# - 全テーブルの一覧と概要
# - 各テーブルのカラム定義（カラム名、型、制約、説明）
# - 外部キー（FK）の一覧と削除時の動作（CASCADE / RESTRICT / SET NULL）
# - テーブル間のリレーション図
# - RLSポリシーの設計方針
# - ストレージバケットの情報（使用している場合）
# - Functions / Triggers の情報（使用している場合）
# - 変更履歴（いつ何を変更したか）
# - 補足・注意事項（原価計算の方針、業態の分離方針など）
#
# 【このファイルに書かないこと】
# - 現在の進捗状況 → WORKFLOW.yaml
# - 機能一覧やステータス → WORKFLOW.yaml
# - 決定事項の記録 → WORKFLOW.yaml
# - AIの振る舞いやルール → SYSTEM_PROMPT.yaml
# - JavaScriptのコードや関数の説明 → 各.jsファイルまたはWORKFLOW.yaml
#
# 【このファイルを更新するタイミング】
# - 新しいテーブルを作成したとき
# - 既存テーブルにカラムを追加したとき
# - カラムの型や制約を変更したとき
# - カラムを削除したとき
# - 外部キーを追加・変更・削除したとき
# - RLSポリシーを追加・変更したとき
# - インデックスを追加したとき
# - Functions / Triggers を追加したとき
# ※ DBに変更を加えたら必ずこのファイルも更新する
#
# 【セクション構成】
# - 基本情報 - データベース種別、最終更新日、更新者
# - テーブル一覧 - 全テーブルの名前、説明、RLS有無
# - テーブル詳細 - 各テーブルのカラム定義、備考
# - リレーション - 外部キー一覧、リレーション図
# - ストレージバケット - 画像等のストレージ情報
# - RLSポリシー設計方針 - 認証・認可の方針
# - Functions / Triggers - DB側の関数・トリガー
# - 変更履歴 - いつ何を変更したかの記録
# - 補足・注意事項 - 設計上の重要なポイント
#
# 【重要】
# ⚠️ このファイルがDBの「正」。実際のDBと乖離させないこと
# ⚠️ ALTER TABLEを実行したら必ずこのファイルを更新すること
# ⚠️ 変更履歴セクションに日付・変更内容・理由を記録すること
#
# =====================================

> ⚠️ このファイルはプロジェクトのデータベース設計の「正」です
> テーブル変更時は必ずここを更新してください

---

## 📋 基本情報

| 項目 | 値 |
|------|-----|
| データベース | Supabase (PostgreSQL) |
| 最終更新日 | 2025-12-28 |
| 更新者 | ひろきくん |

---

## 📊 テーブル一覧

| テーブル名 | 説明 | RLS |
|-----------|------|-----|
| products | 仕入れ商品（インフォマートCSV） | ❌ |
| suppliers | 取引先 | ❌ |
| product_business_types | 仕入れ商品×業態（使用フラグ管理） | ❌ |
| supplier_business_types | 取引先×業態（非表示フラグ管理） | ❌ |
| items | アイテム（部品化した商品） | ❌ |
| item_genres | アイテムジャンル | ❌ |
| preparations | 仕込み品 | ❌ |
| preparation_ingredients | 仕込み品の材料 | ❌ |
| preparation_sections | 仕込み品セクション | ❌ |
| dishes | 商品（最終メニュー） | ❌ |
| dish_ingredients | 商品の材料 | ❌ |
| dish_sections | 商品セクション | ❌ |
| courses | コース | ❌ |
| course_items | コースの商品 | ❌ |
| business_types | 業態 | ❌ |
| settings | システム設定 | ❌ |

---

## 🗂️ テーブル詳細

### ① products（仕入れ商品）

**概要**: インフォマートCSVからインポートされる仕入れ商品のマスタ

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| product_code | TEXT | PK | 主キー（商品システムコード） |
| product_name | TEXT | NOT NULL | 商品名 |
| specification | TEXT | | 規格 |
| unit_price | NUMERIC | | 単価 |
| supplier_name | TEXT | | 取引先名 |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 更新日時 |

**RLSポリシー**: なし（フェーズ1は認証なし）

**インデックス**: なし

**備考**:
- CSVインポート時、既存の商品コードがあれば単価のみ更新
- 使用フラグ（is_active）は product_business_types テーブルで業態ごとに管理
- 全業態で共通（business_type_idなし）

---

### ② suppliers（取引先）

**概要**: 取引先（業者）の管理

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| supplier_name | TEXT | PK | 主キー（取引先名） |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 更新日時 |

**RLSポリシー**: なし（フェーズ1は認証なし）

**インデックス**: なし

**備考**:
- CSVインポート時に自動で登録される
- 非表示フラグ（is_hidden）は supplier_business_types テーブルで業態ごとに管理
- 全業態で共通（business_type_idなし）

---

### ③ product_business_types（仕入れ商品×業態）

**概要**: 仕入れ商品の使用フラグを業態ごとに管理する中間テーブル

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| product_code | TEXT | PK, FK → products(product_code) | 商品コード |
| business_type_id | INTEGER | PK, FK → business_types(business_type_id) | 業態ID |
| is_active | BOOLEAN | NOT NULL, DEFAULT false | 使用フラグ |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 更新日時 |

**RLSポリシー**: なし（フェーズ1は認証なし）

**インデックス**: なし

**備考**:
- 複合主キー（product_code, business_type_id）
- CSVインポート時に全業態分のレコードを自動作成（is_active = false）
- 業態追加時に全商品分のレコードを自動作成（is_active = false）

---

### ④ supplier_business_types（取引先×業態）

**概要**: 取引先の非表示フラグを業態ごとに管理する中間テーブル

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| supplier_name | TEXT | PK, FK → suppliers(supplier_name) | 取引先名 |
| business_type_id | INTEGER | PK, FK → business_types(business_type_id) | 業態ID |
| is_hidden | BOOLEAN | NOT NULL, DEFAULT false | 非表示フラグ |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 更新日時 |

**RLSポリシー**: なし（フェーズ1は認証なし）

**インデックス**: なし

**備考**:
- 複合主キー（supplier_name, business_type_id）
- CSVインポート時に全業態分のレコードを自動作成（is_hidden = false）
- 業態追加時に全業者分のレコードを自動作成（is_hidden = false）

---

### ⑤ items（アイテム）

**概要**: 仕入れ商品を部品化（抽象化）したもの

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| item_id | SERIAL | PK | 主キー（自動採番） |
| item_name | TEXT | NOT NULL | アイテム名 |
| item_kana | TEXT | | 読み仮名（半角カタカナ） |
| product_code | TEXT | FK → products(product_code) | 仕入れ商品への参照 |
| genre_id | INTEGER | FK → item_genres(genre_id) | ジャンルへの参照 |
| unit | TEXT | NOT NULL | 使用単位 |
| yield_quantity | NUMERIC | NOT NULL | 取れる数 |
| needs_review | BOOLEAN | NOT NULL, DEFAULT false | 要確認フラグ |
| business_type_id | INTEGER | FK → business_types(business_type_id) | 業態への参照 |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 更新日時 |

**RLSポリシー**: なし（フェーズ1は認証なし）

**インデックス**: なし

**備考**:
- 単位原価は表示時に計算（仕入れ単価 ÷ 取れる数）
- アイテム : 仕入れ商品 = 1 : 1 の関係
- genre_idはNULL許容（未分類の場合）
- business_type_idはNULL許容（未分類の場合）
- needs_review=true は「仮の数値で登録、後で確認が必要」を示す

---

### ⑥ item_genres（アイテムジャンル）

**概要**: アイテムのジャンル（カテゴリ）管理

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| genre_id | SERIAL | PK | 主キー（自動採番） |
| genre_name | TEXT | NOT NULL | ジャンル名 |
| sort_order | INTEGER | NOT NULL, DEFAULT 0 | 表示順 |
| business_type_id | INTEGER | FK → business_types(business_type_id) | 業態への参照 |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 更新日時 |

**RLSポリシー**: なし（フェーズ1は認証なし）

**インデックス**: なし

**備考**:
- マスタ管理画面から追加・編集・削除可能
- 初期データ：肉類、海鮮類、野菜・青果、調味料・香辛料、穀物・粉類、その他
- business_type_idはNULL許容（未分類の場合）

---

### ⑦ preparations（仕込み品）

**概要**: アイテムや他の仕込み品を組み合わせて作る中間成果物

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| preparation_id | SERIAL | PK | 主キー（自動採番） |
| preparation_name | TEXT | NOT NULL | 仕込み品名 |
| preparation_kana | TEXT | | 読み仮名（半角カタカナ） |
| section_id | INTEGER | FK → preparation_sections(section_id) | セクションへの参照 |
| yield_quantity | NUMERIC | NOT NULL | 仕上がり量 |
| yield_unit | TEXT | NOT NULL | 仕上がり単位 |
| needs_review | BOOLEAN | NOT NULL, DEFAULT false | 要確認フラグ |
| business_type_id | INTEGER | FK → business_types(business_type_id) | 業態への参照 |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 更新日時 |

**RLSポリシー**: なし（フェーズ1は認証なし）

**インデックス**: なし

**備考**:
- 原価は表示時に計算（材料の単位原価 × 使用量の合計）
- 仕込み品は他の仕込み品を材料にできる（再帰的構造）
- preparation_kanaは五十音ソート・検索用（半角カタカナで保存）
- section_idはNULL許容（未分類の場合）
- business_type_idはNULL許容（未分類の場合）
- needs_review=true は「仮の数値で登録、後で確認が必要」を示す

---

### ⑧ preparation_ingredients（仕込み品の材料）

**概要**: 仕込み品を構成する材料の中間テーブル

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | SERIAL | PK | 主キー |
| preparation_id | INTEGER | FK → preparations(preparation_id) ON DELETE CASCADE | 仕込み品ID |
| ingredient_type | TEXT | NOT NULL, CHECK ('item' or 'preparation') | 材料種別 |
| ingredient_id | INTEGER | NOT NULL | 材料ID（itemsまたはpreparationsのID） |
| quantity | NUMERIC | NOT NULL | 使用量 |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 作成日時 |

**RLSポリシー**: なし（フェーズ1は認証なし）

**インデックス**: なし

**備考**:
- ingredient_type='item' の場合、ingredient_id は items.item_id
- ingredient_type='preparation' の場合、ingredient_id は preparations.preparation_id

---

### ⑨ preparation_sections（仕込み品セクション）

**概要**: 仕込み品のセクション（担当ポジション）管理

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| section_id | SERIAL | PK | 主キー（自動採番） |
| section_name | TEXT | NOT NULL | セクション名 |
| sort_order | INTEGER | NOT NULL, DEFAULT 0 | 表示順 |
| business_type_id | INTEGER | FK → business_types(business_type_id) | 業態への参照 |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 更新日時 |

**RLSポリシー**: なし（フェーズ1は認証なし）

**インデックス**: なし

**備考**:
- マスタ管理画面から追加・編集・削除可能
- 初期データ：アペタイザー、ファイヤー、その他
- business_type_idはNULL許容（未分類の場合）

---

### ⑩ dishes（商品）

**概要**: 最終メニュー（販売商品）

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| dish_id | SERIAL | PK | 主キー（自動採番） |
| dish_name | TEXT | NOT NULL | 商品名 |
| dish_kana | TEXT | | 読み仮名（半角カタカナ） |
| section_id | INTEGER | FK → dish_sections(section_id) | セクションへの参照 |
| selling_price | NUMERIC | | 売価（税抜） |
| business_type_id | INTEGER | FK → business_types(business_type_id) | 業態への参照 |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 更新日時 |

**RLSポリシー**: なし（フェーズ1は認証なし）

**インデックス**: なし

**備考**:
- 原価は表示時に計算（材料の単位原価 × 使用量の合計）
- 原価率は表示時に計算（原価 ÷ 売価 × 100）
- 税込価格は表示時に計算（売価 × (1 + 税率/100)）、税率はsettingsテーブルから取得
- 仕上がりは常に1単位
- dish_kanaは五十音ソート・検索用（半角カタカナで保存）
- section_idはNULL許容（未分類の場合）
- business_type_idはNULL許容（未分類の場合）
- 商品自体にはneeds_reviewフラグなし（材料の状態で判断）

---

### ⑪ dish_ingredients（商品の材料）

**概要**: 商品を構成する材料の中間テーブル

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | SERIAL | PK | 主キー |
| dish_id | INTEGER | FK → dishes(dish_id) ON DELETE CASCADE | 商品ID |
| ingredient_type | TEXT | NOT NULL, CHECK ('item' or 'preparation') | 材料種別 |
| ingredient_id | INTEGER | NOT NULL | 材料ID |
| quantity | NUMERIC | NOT NULL | 使用量 |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 作成日時 |

**RLSポリシー**: なし（フェーズ1は認証なし）

**インデックス**: なし

**備考**:
- ingredient_type='item' の場合、ingredient_id は items.item_id
- ingredient_type='preparation' の場合、ingredient_id は preparations.preparation_id

---

### ⑫ dish_sections（商品セクション）

**概要**: 商品のセクション（メニューカテゴリ）管理

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| section_id | SERIAL | PK | 主キー（自動採番） |
| section_name | TEXT | NOT NULL | セクション名 |
| sort_order | INTEGER | NOT NULL, DEFAULT 0 | 表示順 |
| business_type_id | INTEGER | FK → business_types(business_type_id) | 業態への参照 |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 更新日時 |

**RLSポリシー**: なし（フェーズ1は認証なし）

**インデックス**: なし

**備考**:
- マスタ管理画面から追加・編集・削除可能
- 初期データ：前菜、メイン、サイド、デザート、ドリンク
- business_type_idはNULL許容（未分類の場合）

---

### ⑬ courses（コース）

**概要**: コース料理の管理

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| course_id | SERIAL | PK | 主キー（自動採番） |
| course_name | TEXT | NOT NULL | コース名 |
| course_kana | TEXT | | 読み仮名（全角カタカナ） |
| selling_price | NUMERIC | | 売価（税込） |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | 実施中フラグ |
| sort_order | INTEGER | NOT NULL, DEFAULT 0 | 表示順（未使用、金額順で表示） |
| business_type_id | INTEGER | FK → business_types(business_type_id) | 業態への参照 |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 更新日時 |

**RLSポリシー**: なし（フェーズ1は認証なし）

**インデックス**: なし

**備考**:
- 原価は表示時に計算（course_itemsの商品原価×ポーションの合計）
- 原価率は税抜換算して計算（税込売価 ÷ (1+税率) で税抜にしてから計算）
- 一覧は実施中/未実施で分けて、それぞれ金額順で表示
- business_type_idはNULL許容（未分類の場合）
- コース自体にはneeds_reviewフラグなし（含まれる商品の状態で判断）

---

### ⑭ course_items（コースの商品）

**概要**: コースを構成する商品の中間テーブル

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | SERIAL | PK | 主キー |
| course_id | INTEGER | FK → courses(course_id) ON DELETE CASCADE | コースID |
| dish_id | INTEGER | FK → dishes(dish_id) ON DELETE RESTRICT | 商品ID |
| portion | NUMERIC | NOT NULL, DEFAULT 1 | ポーション（0.25, 0.5, 1など） |
| sort_order | INTEGER | NOT NULL, DEFAULT 0 | 表示順 |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 作成日時 |

**RLSポリシー**: なし（フェーズ1は認証なし）

**インデックス**: なし

**備考**:
- portionは商品の何人前かを表す（例：0.5 = ハーフサイズ）
- 原価計算は「商品の原価 × portion」で算出
- コース削除時は商品リストも削除（CASCADE）
- 商品がコースで使われている場合は削除不可（RESTRICT）

---

### ⑮ business_types（業態）

**概要**: 業態（ブランド）の管理

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| business_type_id | SERIAL | PK | 主キー（自動採番） |
| business_type_name | TEXT | NOT NULL | 業態名 |
| sort_order | INTEGER | NOT NULL, DEFAULT 0 | 表示順 |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 更新日時 |

**RLSポリシー**: なし（フェーズ1は認証なし）

**インデックス**: なし

**備考**:
- マスタ管理画面から追加・編集・削除可能
- 初期データ：アジアン、イタリアン

---

### ⑯ settings（システム設定）

**概要**: システム全体の設定値を管理（キー・バリュー形式）

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| setting_key | TEXT | PK | 設定キー |
| setting_value | TEXT | NOT NULL | 設定値 |
| description | TEXT | | 説明（管理用） |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 更新日時 |

**RLSポリシー**: なし（フェーズ1は認証なし）

**インデックス**: なし

**備考**:
- キー・バリュー形式で汎用的に設定を保存
- 初期データ：tax_rate（消費税率 10%）
- 将来的に他の設定も追加可能

---

## 🔗 リレーション

### 外部キー一覧

| FROM テーブル | FROM カラム | TO テーブル | TO カラム | ON DELETE |
|--------------|-------------|-------------|-----------|-----------|
| product_business_types | product_code | products | product_code | CASCADE |
| product_business_types | business_type_id | business_types | business_type_id | CASCADE |
| supplier_business_types | supplier_name | suppliers | supplier_name | CASCADE |
| supplier_business_types | business_type_id | business_types | business_type_id | CASCADE |
| items | product_code | products | product_code | RESTRICT |
| items | genre_id | item_genres | genre_id | SET NULL |
| items | business_type_id | business_types | business_type_id | SET NULL |
| preparation_ingredients | preparation_id | preparations | preparation_id | CASCADE |
| preparations | section_id | preparation_sections | section_id | SET NULL |
| preparations | business_type_id | business_types | business_type_id | SET NULL |
| dish_ingredients | dish_id | dishes | dish_id | CASCADE |
| dishes | section_id | dish_sections | section_id | SET NULL |
| dishes | business_type_id | business_types | business_type_id | SET NULL |
| course_items | course_id | courses | course_id | CASCADE |
| course_items | dish_id | dishes | dish_id | RESTRICT |
| courses | business_type_id | business_types | business_type_id | SET NULL |
| item_genres | business_type_id | business_types | business_type_id | SET NULL |
| preparation_sections | business_type_id | business_types | business_type_id | SET NULL |
| dish_sections | business_type_id | business_types | business_type_id | SET NULL |

### リレーション図

business_types ─────────────────────────────────────────────────┐ (業態) │ │ │ │ business_type_id │ │ │ ├──────────────────┬──────────────────┬───────────────────┤ ▼ ▼ ▼ ▼ item_genres preparation_sections dish_sections courses (ジャンル) (仕込み品セクション) (商品セクション) (コース) │ │ │ │ │ genre_id │ section_id │ section_id │ course_id ▼ ▼ ▼ ▼ course_items (コース商品) ┌──────────────────────────────────────────────────────────┘ │ ▼ suppliers ──────────► supplier_business_types ◄──── business_types (取引先) (取引先×業態)

products ───────────► product_business_types ◄───── business_types (仕入れ商品) (商品×業態) │ │ product_code ▼ items ◄──────────────── preparations ──────► dishes (アイテム) (仕込み品) (商品) │ │ │ ▼ ▼ ▼ preparation_ dish_ ingredients ingredients (仕込み品材料) (商品材料)

settings (システム設定)


---

## 🗄️ ストレージバケット

なし（フェーズ1では画像等のストレージは使用しない）

---

## 🔑 RLSポリシー設計方針

### 基本ルール

- フェーズ1: RLSなし（管理者1人のため）
- フェーズ2: Supabase Authで認証追加、user_id列を追加してRLS有効化予定

### 例外

- なし

---

## 🛠️ Functions / Triggers

### Functions

なし（フェーズ1では使用しない）

### Triggers

なし（フェーズ1では使用しない）

---

## 📝 変更履歴

| 日付 | 変更内容 | 理由 |
|------|---------|------|
| 2025-01-22 | 初期6テーブル作成（products, items, preparations, preparation_ingredients, dishes, dish_ingredients） | 初期設計 |
| 2025-01-23 | suppliersテーブル追加 | 取引先の非表示機能用 |
| 2025-12-24 | preparationsテーブルにpreparation_kanaカラム追加 | 仕込み品の五十音ソート・検索用 |
| 2025-12-24 | item_genresテーブル追加 | アイテムのジャンル分類機能 |
| 2025-12-24 | preparation_sectionsテーブル追加 | 仕込み品のセクション分類機能 |
| 2025-12-24 | itemsテーブルにgenre_idカラム追加 | ジャンル機能対応 |
| 2025-12-24 | preparationsテーブルにsection_idカラム追加 | セクション機能対応 |
| 2025-12-25 | dish_sectionsテーブル追加 | 商品のセクション分類機能 |
| 2025-12-25 | dishesテーブルにsection_id, dish_kanaカラム追加 | セクション機能・五十音ソート対応 |
| 2025-12-25 | items.unit_cost, preparations.cost, dishes.cost列を削除 | 正規化対応（原価は表示時に計算） |
| 2025-12-25 | business_typesテーブル追加 | 業態展開対応 |
| 2025-12-25 | items, item_genres, preparations, preparation_sections, dishes, dish_sectionsにbusiness_type_id追加 | 業態展開対応 |
| 2025-12-26 | settingsテーブル追加 | 税率など共通設定の管理用 |
| 2025-12-26 | dishesテーブルにselling_price追加 | 売価・原価率機能対応 |
| 2025-12-27 | courses, course_itemsテーブル追加 | コース機能 |
| 2025-12-27 | coursesテーブルにis_active追加 | 実施中/未実施の切り替え機能 |
| 2025-12-27 | items, preparationsテーブルにneeds_review追加 | 要確認フラグ機能 |
| 2025-12-28 | product_business_typesテーブル追加 | 仕入れ商品の使用フラグを業態ごとに管理 |
| 2025-12-28 | supplier_business_typesテーブル追加 | 取引先の非表示フラグを業態ごとに管理 |
| 2025-12-28 | productsテーブルからis_active列を削除 | 中間テーブルに移行 |
| 2025-12-28 | suppliersテーブルからis_hidden列を削除 | 中間テーブルに移行 |

---

## 💡 補足・注意事項

- フェーズ1は認証なしのため、RLSは無効
- フェーズ2で複数ユーザー対応時にRLS有効化予定
- テーブルにuser_id列は用意済み想定で拡張しやすく設計
- CSVインポート時、同じ商品コードが複数ある場合は更新日が新しい方を採用
- **原価計算は正規化対応済み、costCalculator.jsの共通関数で表示時に計算**
- **仕入れ商品（products）と取引先（suppliers）は全業態で共通**
- **仕入れ商品の使用フラグ、取引先の非表示フラグは業態ごとに中間テーブルで管理**
- **CSVインポート時・業態追加時に中間テーブルのレコードを自動作成**
- **それ以外のテーブルはbusiness_type_idで業態ごとに分離**
- **税率はsettingsテーブルで管理、税込計算に使用**
- **コースの売価は税込、原価率計算時は税抜換算して計算**
- **needs_reviewフラグはitems, preparationsテーブルのみ（商品・コースは材料の状態から判断）**
- **⚠️マーク表示は編集ページのみ（閲覧専用ページには出さない予定）**