/**
 * 共通ユーティリティ関数
 * 
 * 【含まれる関数】
 * - カタカナ変換系: toHalfWidthKatakana, toFullWidthKatakana, sanitizeToFullWidthKatakana, normalizeForSearch
 * - 材料関連: getIngredientName, getIngredientUnit, hasNeedsReviewIngredient, getNeedsReviewIngredientList
 * - 税率取得: loadTaxRate
 * - CSV関連: readFileAsShiftJIS, parseCSV, findColumnIndex
 * - データ取得: fetchAllWithPaging, withBusinessTypeFilter
 * - 材料リスト表示: renderIngredientList
 * - 材料ツリー表示: renderIngredientTree
 * 
 * 【モーダル系は modalManagers.js に移動】
 * - IngredientModalManager
 * - QuickItemModalManager
 */

import { supabase } from './supabase.js'

// ============================================
// カタカナ変換系
// ============================================

/**
 * 全角カタカナ → 半角カタカナ変換
 * ひらがなも全角カタカナ経由で半角に変換
 */
export function toHalfWidthKatakana(str) {
    // ひらがな → 全角カタカナ
    let result = str.replace(/[\u3041-\u3096]/g, (match) => {
        return String.fromCharCode(match.charCodeAt(0) + 0x60)
    })

    // 全角カタカナ → 半角カタカナ
    const kanaMap = {
        'ア': 'ｱ', 'イ': 'ｲ', 'ウ': 'ｳ', 'エ': 'ｴ', 'オ': 'ｵ',
        'カ': 'ｶ', 'キ': 'ｷ', 'ク': 'ｸ', 'ケ': 'ｹ', 'コ': 'ｺ',
        'サ': 'ｻ', 'シ': 'ｼ', 'ス': 'ｽ', 'セ': 'ｾ', 'ソ': 'ｿ',
        'タ': 'ﾀ', 'チ': 'ﾁ', 'ツ': 'ﾂ', 'テ': 'ﾃ', 'ト': 'ﾄ',
        'ナ': 'ﾅ', 'ニ': 'ﾆ', 'ヌ': 'ﾇ', 'ネ': 'ﾈ', 'ノ': 'ﾉ',
        'ハ': 'ﾊ', 'ヒ': 'ﾋ', 'フ': 'ﾌ', 'ヘ': 'ﾍ', 'ホ': 'ﾎ',
        'マ': 'ﾏ', 'ミ': 'ﾐ', 'ム': 'ﾑ', 'メ': 'ﾒ', 'モ': 'ﾓ',
        'ヤ': 'ﾔ', 'ユ': 'ﾕ', 'ヨ': 'ﾖ',
        'ラ': 'ﾗ', 'リ': 'ﾘ', 'ル': 'ﾙ', 'レ': 'ﾚ', 'ロ': 'ﾛ',
        'ワ': 'ﾜ', 'ヲ': 'ｦ', 'ン': 'ﾝ',
        'ァ': 'ｧ', 'ィ': 'ｨ', 'ゥ': 'ｩ', 'ェ': 'ｪ', 'ォ': 'ｫ',
        'ッ': 'ｯ', 'ャ': 'ｬ', 'ュ': 'ｭ', 'ョ': 'ｮ',
        'ガ': 'ｶﾞ', 'ギ': 'ｷﾞ', 'グ': 'ｸﾞ', 'ゲ': 'ｹﾞ', 'ゴ': 'ｺﾞ',
        'ザ': 'ｻﾞ', 'ジ': 'ｼﾞ', 'ズ': 'ｽﾞ', 'ゼ': 'ｾﾞ', 'ゾ': 'ｿﾞ',
        'ダ': 'ﾀﾞ', 'ヂ': 'ﾁﾞ', 'ヅ': 'ﾂﾞ', 'デ': 'ﾃﾞ', 'ド': 'ﾄﾞ',
        'バ': 'ﾊﾞ', 'ビ': 'ﾋﾞ', 'ブ': 'ﾌﾞ', 'ベ': 'ﾍﾞ', 'ボ': 'ﾎﾞ',
        'パ': 'ﾊﾟ', 'ピ': 'ﾋﾟ', 'プ': 'ﾌﾟ', 'ペ': 'ﾍﾟ', 'ポ': 'ﾎﾟ',
        'ヴ': 'ｳﾞ', 'ー': 'ｰ'
    }

    result = result.split('').map(char => kanaMap[char] || char).join('')
    return result
}

/**
 * 半角カタカナ → 全角カタカナ変換
 * 濁点・半濁点の結合も処理
 */
export function toFullWidthKatakana(str) {
    const kanaMap = {
        'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
        'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
        'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
        'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
        'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
        'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
        'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
        'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
        'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
        'ﾜ': 'ワ', 'ｦ': 'ヲ', 'ﾝ': 'ン',
        'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ',
        'ｯ': 'ッ', 'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ',
        'ｰ': 'ー'
    }

    const dakutenMap = {
        'ｶﾞ': 'ガ', 'ｷﾞ': 'ギ', 'ｸﾞ': 'グ', 'ｹﾞ': 'ゲ', 'ｺﾞ': 'ゴ',
        'ｻﾞ': 'ザ', 'ｼﾞ': 'ジ', 'ｽﾞ': 'ズ', 'ｾﾞ': 'ゼ', 'ｿﾞ': 'ゾ',
        'ﾀﾞ': 'ダ', 'ﾁﾞ': 'ヂ', 'ﾂﾞ': 'ヅ', 'ﾃﾞ': 'デ', 'ﾄﾞ': 'ド',
        'ﾊﾞ': 'バ', 'ﾋﾞ': 'ビ', 'ﾌﾞ': 'ブ', 'ﾍﾞ': 'ベ', 'ﾎﾞ': 'ボ',
        'ﾊﾟ': 'パ', 'ﾋﾟ': 'ピ', 'ﾌﾟ': 'プ', 'ﾍﾟ': 'ペ', 'ﾎﾟ': 'ポ',
        'ｳﾞ': 'ヴ'
    }

    let result = str
    // 濁点・半濁点の結合を先に処理
    for (const [half, full] of Object.entries(dakutenMap)) {
        result = result.split(half).join(full)
    }
    result = result.split('').map(char => kanaMap[char] || char).join('')
    return result
}

/**
 * 全角カタカナのみに制限（入力サニタイズ用）
 * ひらがなは全角カタカナに変換、それ以外は除去
 */
export function sanitizeToFullWidthKatakana(str) {
    // ひらがな → 全角カタカナ
    let result = str.replace(/[\u3041-\u3096]/g, (match) => {
        return String.fromCharCode(match.charCodeAt(0) + 0x60)
    })
    // 全角カタカナとー（長音）のみ残す
    result = result.replace(/[^ァ-ヶー]/g, '')
    return result
}

/**
 * 検索用の正規化（全角・半角両対応）
 * 半角カタカナ→全角、ひらがな→全角カタカナ
 */
export function normalizeForSearch(str) {
    let result = toFullWidthKatakana(str)
    // ひらがな → 全角カタカナ
    result = result.replace(/[\u3041-\u3096]/g, (match) => {
        return String.fromCharCode(match.charCodeAt(0) + 0x60)
    })
    return result
}

// ============================================
// 材料関連
// ============================================

/**
 * 材料の名前を取得
 * @param {string} type - 'item' または 'preparation'
 * @param {number} id - 材料ID
 * @param {Array} allItems - 全アイテム配列
 * @param {Array} allPreparations - 全仕込み品配列
 */
export function getIngredientName(type, id, allItems, allPreparations) {
    if (type === 'item') {
        const item = allItems.find(i => i.item_id === id)
        return item?.item_name || '（不明）'
    } else if (type === 'preparation') {
        const prep = allPreparations.find(p => p.preparation_id === id)
        return prep?.preparation_name || '（不明）'
    }
    return '（不明）'
}

/**
 * 材料の単位を取得
 * @param {string} type - 'item' または 'preparation'
 * @param {number} id - 材料ID
 * @param {Array} allItems - 全アイテム配列
 * @param {Array} allPreparations - 全仕込み品配列
 */
export function getIngredientUnit(type, id, allItems, allPreparations) {
    if (type === 'item') {
        const item = allItems.find(i => i.item_id === id)
        return item?.unit || ''
    } else if (type === 'preparation') {
        const prep = allPreparations.find(p => p.preparation_id === id)
        return prep?.yield_unit || ''
    }
    return ''
}

/**
 * 仕込み品の材料に要確認があるかチェック（再帰）
 * @param {Object} prep - 仕込み品オブジェクト（preparation_ingredients含む）
 * @param {Array} allItems - 全アイテム配列
 * @param {Array} allPreparations - 全仕込み品配列
 */
export function prepHasNeedsReviewIngredient(prep, allItems, allPreparations) {
    if (!prep?.preparation_ingredients) return false

    for (const ing of prep.preparation_ingredients) {
        if (ing.ingredient_type === 'item') {
            const item = allItems.find(i => i.item_id === ing.ingredient_id)
            if (item?.needs_review) return true
        } else if (ing.ingredient_type === 'preparation') {
            const subPrep = allPreparations.find(p => p.preparation_id === ing.ingredient_id)
            if (subPrep?.needs_review) return true
            if (prepHasNeedsReviewIngredient(subPrep, allItems, allPreparations)) return true
        }
    }
    return false
}

/**
 * 商品の材料に要確認があるかチェック
 * @param {Object} dish - 商品オブジェクト（dish_ingredients含む）
 * @param {Array} allItems - 全アイテム配列
 * @param {Array} allPreparations - 全仕込み品配列
 */
export function dishHasNeedsReviewIngredient(dish, allItems, allPreparations) {
    if (!dish?.dish_ingredients) return false

    for (const ing of dish.dish_ingredients) {
        if (ing.ingredient_type === 'item') {
            const item = allItems.find(i => i.item_id === ing.ingredient_id)
            if (item?.needs_review) return true
        } else if (ing.ingredient_type === 'preparation') {
            const prep = allPreparations.find(p => p.preparation_id === ing.ingredient_id)
            if (prep?.needs_review) return true
            if (prepHasNeedsReviewIngredient(prep, allItems, allPreparations)) return true
        }
    }
    return false
}

/**
 * 要確認の材料リストを取得（ツールチップ用）
 * @param {Array} ingredients - 材料配列（preparation_ingredients または dish_ingredients）
 * @param {Array} allItems - 全アイテム配列
 * @param {Array} allPreparations - 全仕込み品配列
 * @returns {Array} 要確認の材料名リスト
 */
export function getNeedsReviewIngredientList(ingredients, allItems, allPreparations) {
    const reviewList = []
    if (!ingredients) return reviewList

    const visited = new Set()

    const collectNeedsReview = (ings) => {
        for (const ing of ings) {
            if (ing.ingredient_type === 'item') {
                const item = allItems.find(i => i.item_id === ing.ingredient_id)
                if (item?.needs_review) {
                    const key = `item-${item.item_id}`
                    if (!visited.has(key)) {
                        visited.add(key)
                        reviewList.push(`アイテム / ${item.item_name}`)
                    }
                }
            } else if (ing.ingredient_type === 'preparation') {
                const prep = allPreparations.find(p => p.preparation_id === ing.ingredient_id)
                if (prep?.needs_review) {
                    const key = `prep-${prep.preparation_id}`
                    if (!visited.has(key)) {
                        visited.add(key)
                        reviewList.push(`仕込み品 / ${prep.preparation_name}`)
                    }
                }
                // 仕込み品の材料も再帰的にチェック
                if (prep?.preparation_ingredients) {
                    collectNeedsReview(prep.preparation_ingredients)
                }
            }
        }
    }

    collectNeedsReview(ingredients)
    return reviewList
}

// ============================================
// 税率取得
// ============================================

/**
 * settingsテーブルから税率を取得
 * @returns {Promise<number>} 税率（デフォルト10）
 */
export async function loadTaxRate() {
    const { data, error } = await supabase
        .from('settings')
        .select('setting_value')
        .eq('setting_key', 'tax_rate')
        .single()

    if (error) {
        console.error('税率取得エラー:', error)
        return 10
    }

    return parseFloat(data?.setting_value) || 10
}

// ============================================
// CSV関連
// ============================================

/**
 * ファイルをShift-JISとして読み込み
 * @param {File} file - 読み込むファイル
 * @returns {Promise<string>} ファイル内容
 */
export function readFileAsShiftJIS(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target.result)
        reader.onerror = (e) => reject(e)
        reader.readAsText(file, 'Shift_JIS')
    })
}

/**
 * CSV文字列をパース（ダブルクォート対応）
 * @param {string} text - CSV文字列
 * @returns {Array<Array<string>>} 2次元配列
 */
export function parseCSV(text) {
    const rows = []
    let currentRow = []
    let currentField = ''
    let inQuotes = false

    for (let i = 0; i < text.length; i++) {
        const char = text[i]
        const nextChar = text[i + 1]

        if (inQuotes) {
            if (char === '"' && nextChar === '"') {
                currentField += '"'
                i++
            } else if (char === '"') {
                inQuotes = false
            } else {
                currentField += char
            }
        } else {
            if (char === '"') {
                inQuotes = true
            } else if (char === ',') {
                currentRow.push(currentField.trim())
                currentField = ''
            } else if (char === '\r' && nextChar === '\n') {
                currentRow.push(currentField.trim())
                rows.push(currentRow)
                currentRow = []
                currentField = ''
                i++
            } else if (char === '\n') {
                currentRow.push(currentField.trim())
                rows.push(currentRow)
                currentRow = []
                currentField = ''
            } else {
                currentField += char
            }
        }
    }

    if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim())
        rows.push(currentRow)
    }

    return rows
}

/**
 * ヘッダー行から列インデックスを検索
 * @param {Array<string>} headerRow - ヘッダー行
 * @param {string} columnName - 列名
 * @returns {number} インデックス（見つからない場合は-1）
 */
export function findColumnIndex(headerRow, columnName) {
    return headerRow.findIndex(cell => {
        const cleaned = cell.replace(/^\[/, '').replace(/\]$/, '')
        return cleaned === columnName
    })
}

// ============================================
// データ取得（ページング対応）
// ============================================

/**
 * ページング対応でテーブルの全データを取得
 * @param {string} table - テーブル名
 * @param {string} select - 取得するカラム（デフォルト '*'）
 * @param {Object} options - オプション
 * @param {string} options.orderColumn - ソートするカラム
 * @param {boolean} options.ascending - 昇順かどうか（デフォルト true）
 * @param {number} options.batchSize - 1回の取得件数（デフォルト 1000）
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export async function fetchAllWithPaging(table, select = '*', options = {}) {
    const { orderColumn, ascending = true, batchSize = 1000 } = options

    let allData = []
    let from = 0

    while (true) {
        let query = supabase
            .from(table)
            .select(select)
            .range(from, from + batchSize - 1)

        if (orderColumn) {
            query = query.order(orderColumn, { ascending })
        }

        const { data: batch, error } = await query

        if (error) {
            console.error(`${table}取得エラー:`, error)
            return { data: null, error }
        }

        allData = allData.concat(batch)

        if (batch.length < batchSize) break
        from += batchSize
    }

    return { data: allData, error: null }
}

/**
 * クエリに業態フィルタを追加
 * @param {Object} query - Supabaseクエリオブジェクト
 * @param {number|null} businessTypeId - 業態ID（nullの場合はフィルタなし）
 * @returns {Object} フィルタ適用後のクエリ
 */
export function withBusinessTypeFilter(query, businessTypeId) {
    return businessTypeId ? query.eq('business_type_id', businessTypeId) : query
}

// ============================================
// 材料リスト表示の共通関数
// ============================================

/**
 * 材料リスト表示の共通関数
 */
export function renderIngredientList(options) {
    const {
        container,
        ingredients,
        onQuantityChange,
        onRemove,
        inputClass = 'ingredient-quantity',
        removeClass = 'remove-ingredient'
    } = options

    if (ingredients.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-center py-4">材料がまだ追加されていません</p>'
        return
    }

    container.innerHTML = ingredients.map((ing, index) => `
        <div class="flex items-center gap-3 p-2 bg-gray-50 rounded-lg mb-2">
            <span class="text-sm ${ing.type === 'item' ? 'text-blue-600' : 'text-orange-600'}">${ing.type === 'item' ? '🧩' : '🍳'}</span>
            <div class="flex-1 min-w-0">
                <div class="font-medium text-gray-800 truncate">${ing.name}</div>
                <div class="text-xs text-gray-400">¥${ing.unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })} / ${ing.unit}</div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
                <input type="number" 
                    class="${inputClass} w-20 p-2 border rounded text-center"
                    data-index="${index}"
                    value="${ing.quantity}"
                    step="0.01"
                    min="0.01"
                />
                <span class="text-sm text-gray-500">${ing.unit}</span>
                <button type="button" class="${removeClass} text-red-500 hover:text-red-700 p-1" data-index="${index}">✕</button>
            </div>
        </div>
    `).join('')

    // 数量変更イベント
    container.querySelectorAll(`.${inputClass}`).forEach(input => {
        input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index)
            if (onQuantityChange) onQuantityChange(index, parseFloat(e.target.value) || 0)
        })
    })

    // 削除イベント
    container.querySelectorAll(`.${removeClass}`).forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index)
            if (onRemove) onRemove(index)
        })
    })
}

// ============================================
// 材料ツリー表示（メニューブック/レシピブック用）
// ============================================

/**
 * 材料ツリーをレンダリング（アコーディオン形式）
 * @param {Object} options - オプション
 * @param {HTMLElement} options.container - 描画先のコンテナ
 * @param {Array} options.ingredients - 材料配列（preparation_ingredients または dish_ingredients）
 * @param {Array} options.allItems - 全アイテム配列
 * @param {Array} options.allPreparations - 全仕込み品配列
 * @param {number} options.depth - 現在の深さ（インデント用）
 */
export function renderIngredientTree(options) {
    const { container, ingredients, allItems, allPreparations, depth = 0 } = options

    // costCalculator.jsから関数をインポートできないので、ローカルで計算
    const getUnitCost = (type, id) => {
        if (type === 'item') {
            const item = allItems.find(i => i.item_id === id)
            if (!item) return 0
            // 手動単価の場合
            if (item.manual_price && item.manual_unit_cost !== null) {
                return item.manual_unit_cost
            }
            const productPrice = item.products?.unit_price || 0
            return item.yield_quantity > 0 ? productPrice / item.yield_quantity : 0
        } else if (type === 'preparation') {
            const prep = allPreparations.find(p => p.preparation_id === id)
            if (!prep) return 0
            const calcPrepCost = (prepId, visited = new Set()) => {
                if (visited.has(prepId)) return 0
                visited.add(prepId)
                const p = allPreparations.find(pr => pr.preparation_id === prepId)
                if (!p || !p.preparation_ingredients) return 0
                let total = 0
                for (const ing of p.preparation_ingredients) {
                    const uc = ing.ingredient_type === 'item'
                        ? getUnitCost('item', ing.ingredient_id)
                        : (() => {
                            const subPrep = allPreparations.find(sp => sp.preparation_id === ing.ingredient_id)
                            if (!subPrep) return 0
                            const subCost = calcPrepCost(ing.ingredient_id, new Set(visited))
                            return subPrep.yield_quantity > 0 ? subCost / subPrep.yield_quantity : 0
                        })()
                    total += uc * (ing.quantity || 0)
                }
                return total
            }
            const totalCost = calcPrepCost(id)
            return prep.yield_quantity > 0 ? totalCost / prep.yield_quantity : 0
        }
        return 0
    }

    if (!ingredients || ingredients.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-sm py-2 pl-4">材料なし</p>'
        return
    }

    const indent = depth * 24

    let html = ''

    ingredients.forEach((ing, index) => {
        const isLast = index === ingredients.length - 1
        const lineChar = isLast ? '└─' : '├─'

        if (ing.ingredient_type === 'item') {
            const item = allItems.find(i => i.item_id === ing.ingredient_id)
            if (!item) return

            const unitCost = getUnitCost('item', ing.ingredient_id)
            const totalCost = unitCost * (ing.quantity || 0)

            html += `
    <div class="ingredient-row flex items-center py-2 hover:bg-gray-50 border-b border-gray-300" style="padding-left: ${indent + 16}px;">
        <span class="text-gray-400 mr-2 font-mono text-sm">${lineChar}</span>
        <span class="text-blue-600 mr-2">🧩</span>
        <span class="text-gray-700" style="width: 40%; min-width: 40%;">${item.item_name}</span>
        <span class="w-28 text-left font-bold text-gray-800">${ing.quantity} <span class="font-normal text-gray-500">${item.unit}</span></span>
        <span class="w-20 text-left text-gray-600">¥${Math.round(totalCost).toLocaleString()}</span>
    </div>
`
        } else if (ing.ingredient_type === 'preparation') {
            const prep = allPreparations.find(p => p.preparation_id === ing.ingredient_id)
            if (!prep) return

            const unitCost = getUnitCost('preparation', ing.ingredient_id)
            const totalCost = unitCost * (ing.quantity || 0)
            const uniqueId = `ing-prep-${prep.preparation_id}-${depth}-${index}-${Date.now()}`
            const ingredientCount = prep.preparation_ingredients?.length || 0

            html += `
    <div class="ingredient-prep-row">
        <div class="flex items-center py-2 hover:bg-orange-50 cursor-pointer ing-prep-toggle border-b border-gray-300" 
             style="padding-left: ${indent + 16}px;"
             data-target="${uniqueId}"
             data-prep-id="${prep.preparation_id}">
            <span class="text-gray-400 mr-2 font-mono text-sm">${lineChar}</span>
            <span class="ing-prep-arrow text-gray-400 mr-1 transition-transform duration-200">▶</span>
            <span class="text-orange-600 mr-2">🍳</span>
            <span class="text-gray-700" style="width: 40%; min-width: 40%;">${prep.preparation_name} <span class="text-gray-400 text-xs">（材料${ingredientCount}種）</span></span>
            <span class="w-28 text-left font-bold text-gray-800">${ing.quantity} <span class="font-normal text-gray-500">${prep.yield_unit}</span></span>
            <span class="w-20 text-left text-gray-600">¥${Math.round(totalCost).toLocaleString()}</span>
        </div>
        <div id="${uniqueId}" class="ing-prep-children hidden overflow-hidden transition-all duration-300" style="max-height: 0;">
        </div>
        <div class="ing-prep-close-btn hidden flex items-center justify-end py-1 hover:bg-orange-50 cursor-pointer"
             style="padding-left: ${indent + 16}px; padding-right: 16px;"
             data-target="${uniqueId}">
            <span class="text-xs text-orange-600">▲ 閉じる</span>
        </div>
    </div>
`
        }
    })

    container.innerHTML = html

    // 仕込み品の展開イベント
    container.querySelectorAll(':scope > .ingredient-prep-row > .ing-prep-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation()
            const targetId = toggle.dataset.target
            const prepId = parseInt(toggle.dataset.prepId)
            const childContainer = document.getElementById(targetId)
            const arrow = toggle.querySelector('.ing-prep-arrow')
            const closeBtn = toggle.closest('.ingredient-prep-row').querySelector('.ing-prep-close-btn')
            const isOpening = childContainer.classList.contains('hidden')

            // 同階層の他の開いてるものを閉じる
            container.querySelectorAll(':scope > .ingredient-prep-row').forEach(row => {
                const otherToggle = row.querySelector('.ing-prep-toggle')
                const otherTargetId = otherToggle.dataset.target
                if (otherTargetId === targetId) return

                const otherChild = document.getElementById(otherTargetId)
                const otherArrow = otherToggle.querySelector('.ing-prep-arrow')
                const otherCloseBtn = row.querySelector('.ing-prep-close-btn')

                if (otherChild && !otherChild.classList.contains('hidden')) {
                    // 子孫も全部リセット
                    resetChildrenState(otherChild)

                    otherChild.style.maxHeight = otherChild.scrollHeight + 'px'
                    otherChild.offsetHeight
                    otherChild.style.maxHeight = '0px'

                    setTimeout(() => {
                        otherChild.classList.add('hidden')
                        otherArrow.style.transform = 'rotate(0deg)'
                        otherCloseBtn.classList.add('hidden')
                    }, 300)
                }
            })

            if (isOpening) {
                // 開く
                childContainer.classList.remove('hidden')
                arrow.style.transform = 'rotate(90deg)'
                closeBtn.classList.remove('hidden')

                if (childContainer.children.length === 0) {
                    const prep = allPreparations.find(p => p.preparation_id === prepId)
                    if (prep && prep.preparation_ingredients) {
                        renderIngredientTree({
                            container: childContainer,
                            ingredients: prep.preparation_ingredients,
                            allItems,
                            allPreparations,
                            depth: depth + 1
                        })
                    }
                }

                const height = childContainer.scrollHeight
                childContainer.style.maxHeight = '0px'
                childContainer.offsetHeight
                childContainer.style.maxHeight = height + 'px'

                setTimeout(() => {
                    childContainer.style.maxHeight = 'none'
                }, 300)
            } else {
                // 閉じる（子孫もリセット）
                resetChildrenState(childContainer)

                childContainer.style.maxHeight = childContainer.scrollHeight + 'px'
                childContainer.offsetHeight
                childContainer.style.maxHeight = '0px'

                setTimeout(() => {
                    childContainer.classList.add('hidden')
                    arrow.style.transform = 'rotate(0deg)'
                    closeBtn.classList.add('hidden')
                }, 300)
            }
        })
    })

    // 下部の閉じるボタン
    container.querySelectorAll(':scope > .ingredient-prep-row > .ing-prep-close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation()
            const targetId = btn.dataset.target
            const childContainer = document.getElementById(targetId)
            const prepRow = btn.closest('.ingredient-prep-row')
            const arrow = prepRow.querySelector('.ing-prep-arrow')

            // 子孫もリセット
            resetChildrenState(childContainer)

            childContainer.style.maxHeight = childContainer.scrollHeight + 'px'
            childContainer.offsetHeight
            childContainer.style.maxHeight = '0px'

            setTimeout(() => {
                childContainer.classList.add('hidden')
                arrow.style.transform = 'rotate(0deg)'
                btn.classList.add('hidden')
            }, 300)
        })
    })
}

/**
 * 子孫要素の状態をリセット（閉じた状態に）
 */
function resetChildrenState(container) {
    container.querySelectorAll('.ing-prep-children').forEach(child => {
        child.classList.add('hidden')
        child.style.maxHeight = '0px'
    })
    container.querySelectorAll('.ing-prep-arrow').forEach(arrow => {
        arrow.style.transform = 'rotate(0deg)'
    })
    container.querySelectorAll('.ing-prep-close-btn').forEach(btn => {
        btn.classList.add('hidden')
    })
}

