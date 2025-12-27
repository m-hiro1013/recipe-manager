# 📄 データベース設計ドキュメント DATABASE.md

> ⚠️ このファイルはプロジェクトのデータベース設計の「正」です
> テーブル変更時は必ずここを更新してください

---

## 📋 基本情報

| 項目 | 値 |
|------|-----|
| データベース | Supabase (PostgreSQL) |
| 最終更新日 | 2025-12-25 |
| 更新者 | ひろきくん |

---

## 📊 テーブル一覧

| テーブル名 | 説明 | RLS |
|-----------|------|-----|
| products | 仕入れ商品（インフォマートCSV） | ❌ |
| suppliers | 取引先 | ❌ |
| items | アイテム（部品化した商品） | ❌ |
| item_genres | アイテムジャンル | ❌ |
| preparations | 仕込み品 | ❌ |
| preparation_ingredients | 仕込み品の材料 | ❌ |
| preparation_sections | 仕込み品セクション | ❌ |
| dishes | 商品（最終メニュー） | ❌ |
| dish_ingredients | 商品の材料 | ❌ |
| dish_sections | 商品セクション | ❌ |

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
| is_active | BOOLEAN | DEFAULT false | 使用フラグ |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 更新日時 |

**RLSポリシー**: なし（フェーズ1は認証なし）

**インデックス**: なし

**備考**:
- CSVインポート時、既存の商品コードがあれば単価のみ更新
- is_active=true の商品がアイテム化の対象

---

### ② suppliers（取引先）

**概要**: 取引先（業者）の管理、非表示機能用

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| supplier_name | TEXT | PK | 主キー（取引先名） |
| is_hidden | BOOLEAN | DEFAULT false, NOT NULL | 非表示フラグ |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 更新日時 |

**RLSポリシー**: なし（フェーズ1は認証なし）

**インデックス**: なし

**備考**:
- CSVインポート時に自動で登録される
- is_hidden=true の業者は一覧画面に表示されない

---

### ③ items（アイテム）

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
| unit_cost | NUMERIC | | 単位原価（自動計算） |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 更新日時 |

**RLSポリシー**: なし（フェーズ1は認証なし）

**インデックス**: なし

**備考**:
- unit_cost = 仕入れ単価 ÷ 取れる数
- アイテム : 仕入れ商品 = 1 : 1 の関係
- genre_idはNULL許容（未分類の場合）

---

### ④ item_genres（アイテムジャンル）

**概要**: アイテムのジャンル（カテゴリ）管理

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| genre_id | SERIAL | PK | 主キー（自動採番） |
| genre_name | TEXT | NOT NULL | ジャンル名 |
| sort_order | INTEGER | NOT NULL, DEFAULT 0 | 表示順 |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 更新日時 |

**RLSポリシー**: なし（フェーズ1は認証なし）

**インデックス**: なし

**備考**:
- マスタ管理画面から追加・編集・削除可能
- 初期データ：肉類、海鮮類、野菜・青果、調味料・香辛料、穀物・粉類、その他

---

### ⑤ preparations（仕込み品）

**概要**: アイテムや他の仕込み品を組み合わせて作る中間成果物

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| preparation_id | SERIAL | PK | 主キー（自動採番） |
| preparation_name | TEXT | NOT NULL | 仕込み品名 |
| preparation_kana | TEXT | | 読み仮名（半角カタカナ） |
| section_id | INTEGER | FK → preparation_sections(section_id) | セクションへの参照 |
| yield_quantity | NUMERIC | NOT NULL | 仕上がり量 |
| yield_unit | TEXT | NOT NULL | 仕上がり単位 |
| cost | NUMERIC | | 原価（自動計算） |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 更新日時 |

**RLSポリシー**: なし（フェーズ1は認証なし）

**インデックス**: なし

**備考**:
- 仕込み品は他の仕込み品を材料にできる（再帰的構造）
- preparation_kanaは五十音ソート・検索用（半角カタカナで保存）
- section_idはNULL許容（未分類の場合）

---

### ⑥ preparation_ingredients（仕込み品の材料）

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

### ⑦ preparation_sections（仕込み品セクション）

**概要**: 仕込み品のセクション（担当ポジション）管理

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| section_id | SERIAL | PK | 主キー（自動採番） |
| section_name | TEXT | NOT NULL | セクション名 |
| sort_order | INTEGER | NOT NULL, DEFAULT 0 | 表示順 |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 更新日時 |

**RLSポリシー**: なし（フェーズ1は認証なし）

**インデックス**: なし

**備考**:
- マスタ管理画面から追加・編集・削除可能
- 初期データ：アペタイザー、ファイヤー、その他

---

### ⑧ dishes（商品）

**概要**: 最終メニュー（販売商品）

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| dish_id | SERIAL | PK | 主キー（自動採番） |
| dish_name | TEXT | NOT NULL | 商品名 |
| dish_kana | TEXT | | 読み仮名（半角カタカナ） |
| section_id | INTEGER | FK → dish_sections(section_id) | セクションへの参照 |
| cost | NUMERIC | | 原価（自動計算） |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 更新日時 |

**RLSポリシー**: なし（フェーズ1は認証なし）

**インデックス**: なし

**備考**:
- 仕上がりは常に1単位
- dish_kanaは五十音ソート・検索用（半角カタカナで保存）
- section_idはNULL許容（未分類の場合）

---

### ⑨ dish_ingredients（商品の材料）

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

### ⑩ dish_sections（商品セクション）

**概要**: 商品のセクション（メニューカテゴリ）管理

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| section_id | SERIAL | PK | 主キー（自動採番） |
| section_name | TEXT | NOT NULL | セクション名 |
| sort_order | INTEGER | NOT NULL, DEFAULT 0 | 表示順 |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 更新日時 |

**RLSポリシー**: なし（フェーズ1は認証なし）

**インデックス**: なし

**備考**:
- マスタ管理画面から追加・編集・削除可能
- 初期データ：前菜、メイン、サイド、デザート、ドリンク

---

## 🔗 リレーション

### 外部キー一覧

| FROM テーブル | FROM カラム | TO テーブル | TO カラム | ON DELETE |
|--------------|-------------|-------------|-----------|-----------|
| items | product_code | products | product_code | RESTRICT |
| items | genre_id | item_genres | genre_id | SET NULL |
| preparation_ingredients | preparation_id | preparations | preparation_id | CASCADE |
| preparations | section_id | preparation_sections | section_id | SET NULL |
| dish_ingredients | dish_id | dishes | dish_id | CASCADE |
| dishes | section_id | dish_sections | section_id | SET NULL |

### リレーション図

item_genres preparation_sections dish_sections (ジャンル) (仕込み品セクション) (商品セクション) │ │ │ │ genre_id │ section_id │ section_id ▼ ▼ ▼ suppliers products ──────► items ◄──── preparations ──► dishes (取引先) (仕入れ商品) (アイテム) (仕込み品) (商品) │ │ │ │ │ │ supplier_name │ product_code │ │ │ ▼ ▼ ▼ ▼ ▼ preparation_ dish_ ingredients ingredients (仕込み品材料) (商品材料)


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

---

## 💡 補足・注意事項

- フェーズ1は認証なしのため、RLSは無効
- フェーズ2で複数ユーザー対応時にRLS有効化予定
- テーブルにuser_id列は用意済み想定で拡張しやすく設計
- CSVインポート時、同じ商品コードが複数ある場合は更新日が新しい方を採用