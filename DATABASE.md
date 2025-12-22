# 📄 データベース設計ドキュメント

## テーブル一覧

| テーブル名 | 説明 |
|-----------|------|
| products | 仕入れ商品（インフォマートCSV） |
| items | アイテム（部品化した商品） |
| preparations | 仕込み品 |
| preparation_ingredients | 仕込み品の材料 |
| dishes | 商品（最終メニュー） |
| dish_ingredients | 商品の材料 |

---

## ① products（仕入れ商品）

| カラム名 | 型 | 説明 |
|---------|-----|------|
| product_code | TEXT | 主キー（商品システムコード） |
| product_name | TEXT | 商品名 |
| specification | TEXT | 規格 |
| unit_price | NUMERIC | 単価 |
| supplier_name | TEXT | 取引先名 |
| is_active | BOOLEAN | 使用フラグ |
| created_at | TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | 更新日時 |

---

## ② items（アイテム）

| カラム名 | 型 | 説明 |
|---------|-----|------|
| item_id | SERIAL | 主キー（自動採番） |
| item_name | TEXT | アイテム名 |
| product_code | TEXT | 仕入れ商品への参照（FK） |
| unit | TEXT | 使用単位 |
| yield_quantity | NUMERIC | 取れる数 |
| unit_cost | NUMERIC | 単位原価（自動計算） |
| created_at | TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | 更新日時 |

---

## ③ preparations（仕込み品）

| カラム名 | 型 | 説明 |
|---------|-----|------|
| preparation_id | SERIAL | 主キー（自動採番） |
| preparation_name | TEXT | 仕込み品名 |
| yield_quantity | NUMERIC | 仕上がり量 |
| yield_unit | TEXT | 仕上がり単位 |
| cost | NUMERIC | 原価（自動計算） |
| created_at | TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | 更新日時 |

---

## ④ preparation_ingredients（仕込み品_材料）

| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | SERIAL | 主キー |
| preparation_id | INTEGER | 仕込み品ID（FK） |
| ingredient_type | TEXT | 材料種別（'item' or 'preparation'） |
| ingredient_id | INTEGER | 材料ID |
| quantity | NUMERIC | 使用量 |
| created_at | TIMESTAMP | 作成日時 |

---

## ⑤ dishes（商品）

| カラム名 | 型 | 説明 |
|---------|-----|------|
| dish_id | SERIAL | 主キー（自動採番） |
| dish_name | TEXT | 商品名 |
| cost | NUMERIC | 原価（自動計算） |
| created_at | TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | 更新日時 |

---

## ⑥ dish_ingredients（商品_材料）

| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | SERIAL | 主キー |
| dish_id | INTEGER | 商品ID（FK） |
| ingredient_type | TEXT | 材料種別（'item' or 'preparation'） |
| ingredient_id | INTEGER | 材料ID |
| quantity | NUMERIC | 使用量 |
| created_at | TIMESTAMP | 作成日時 |

---

## リレーション図

