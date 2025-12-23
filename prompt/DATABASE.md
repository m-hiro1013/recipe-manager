# 📄 データベース設計ドキュメント DATABASE.md

> ⚠️ このファイルはプロジェクトのデータベース設計の「正」です
> テーブル変更時は必ずここを更新してください

---

## 📋 基本情報

| 項目 | 値 |
|------|-----|
| データベース | Supabase (PostgreSQL) |
| 最終更新日 | 2025-01-23 |
| 更新者 | ひろきくん |

---

## 📊 テーブル一覧

| テーブル名 | 説明 | RLS |
|-----------|------|-----|
| products | 仕入れ商品（インフォマートCSV） | ❌ |
| suppliers | 取引先 | ❌ |
| items | アイテム（部品化した商品） | ❌ |
| preparations | 仕込み品 | ❌ |
| preparation_ingredients | 仕込み品の材料 | ❌ |
| dishes | 商品（最終メニュー） | ❌ |
| dish_ingredients | 商品の材料 | ❌ |

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
| product_code | TEXT | FK → products(product_code) | 仕入れ商品への参照 |
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

---

### ④ preparations（仕込み品）

**概要**: アイテムや他の仕込み品を組み合わせて作る中間成果物

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| preparation_id | SERIAL | PK | 主キー（自動採番） |
| preparation_name | TEXT | NOT NULL | 仕込み品名 |
| yield_quantity | NUMERIC | NOT NULL | 仕上がり量 |
| yield_unit | TEXT | NOT NULL | 仕上がり単位 |
| cost | NUMERIC | | 原価（自動計算） |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 更新日時 |

**RLSポリシー**: なし（フェーズ1は認証なし）

**インデックス**: なし

**備考**:
- 仕込み品は他の仕込み品を材料にできる（再帰的構造）

---

### ⑤ preparation_ingredients（仕込み品の材料）

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

### ⑥ dishes（商品）

**概要**: 最終メニュー（販売商品）

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| dish_id | SERIAL | PK | 主キー（自動採番） |
| dish_name | TEXT | NOT NULL | 商品名 |
| cost | NUMERIC | | 原価（自動計算） |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 更新日時 |

**RLSポリシー**: なし（フェーズ1は認証なし）

**インデックス**: なし

**備考**:
- 仕上がりは常に1単位

---

### ⑦ dish_ingredients（商品の材料）

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

## 🔗 リレーション

### 外部キー一覧

| FROM テーブル | FROM カラム | TO テーブル | TO カラム | ON DELETE |
|--------------|-------------|-------------|-----------|-----------|
| items | product_code | products | product_code | RESTRICT |
| preparation_ingredients | preparation_id | preparations | preparation_id | CASCADE |
| dish_ingredients | dish_id | dishes | dish_id | CASCADE |

### リレーション図

suppliers (取引先) │ │ supplier_name ▼ products (仕入れ商品) │ │ product_code ▼ items (アイテム) │ ├─────────────────┐ │ │ ▼ ▼ preparations dishes (仕込み品) (商品) │ │ ▼ ▼ preparation_ dish_ ingredients ingredients


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

---

## 💡 補足・注意事項

- フェーズ1は認証なしのため、RLSは無効
- フェーズ2で複数ユーザー対応時にRLS有効化予定
- テーブルにuser_id列は用意済み想定で拡張しやすく設計
- CSVインポート時、同じ商品コードが複数ある場合は更新日が新しい方を採用