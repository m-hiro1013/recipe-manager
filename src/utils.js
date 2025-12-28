/**
 * 共通ユーティリティ関数
 * 
 * 【含まれる関数】
 * - カタカナ変換系: toHalfWidthKatakana, toFullWidthKatakana, sanitizeToFullWidthKatakana, normalizeForSearch
 * - 材料関連: getIngredientName, getIngredientUnit, hasNeedsReviewIngredient, getNeedsReviewIngredientList
 * - 税率取得: loadTaxRate
 * - CSV関連: readFileAsShiftJIS, parseCSV, findColumnIndex
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
// 材料選択モーダル共通モジュール
// ============================================

/**
 * 材料選択モーダルの状態管理クラス
 */
export class IngredientModalManager {
    constructor(options) {
        // DOM要素
        this.ingredientModal = options.ingredientModal
        this.parentModal = options.parentModal // 作成 or 編集モーダル
        this.tabItems = options.tabItems
        this.tabPreparations = options.tabPreparations
        this.tabProducts = options.tabProducts
        this.tabContentItems = options.tabContentItems
        this.tabContentPreparations = options.tabContentPreparations
        this.tabContentProducts = options.tabContentProducts
        this.itemSearchInput = options.itemSearchInput
        this.prepSearchInput = options.prepSearchInput
        this.productSearchInput = options.productSearchInput
        this.supplierSelect = options.supplierSelect
        this.itemSelectList = options.itemSelectList
        this.prepSelectList = options.prepSelectList
        this.productSelectList = options.productSelectList
        this.selectedCount = options.selectedCount
        this.addSelectedIngredientsBtn = options.addSelectedIngredientsBtn

        // データ参照（外部から渡される）
        this.getAllItems = options.getAllItems
        this.getAllPreparations = options.getAllPreparations
        this.getAllProducts = options.getAllProducts
        this.getAllSuppliers = options.getAllSuppliers
        this.getIngredientUnitCost = options.getIngredientUnitCost

        // コールバック
        this.onIngredientsAdded = options.onIngredientsAdded
        this.onQuickItemCreate = options.onQuickItemCreate

        // 除外ID（編集中の仕込み品を除外する用）
        this.getExcludePrepId = options.getExcludePrepId || (() => null)

        // 状態
        this.currentTab = 'items'
        this.itemSearchQuery = ''
        this.prepSearchQuery = ''
        this.productSearchQuery = ''
        this.productSupplierFilter = ''
        this.productActiveFilter = 'on'
        this.selectedIngredients = []
        this.expandedProductSupplier = null
    }

    /**
     * モーダルを開く
     */
    open() {
        this.selectedIngredients = []
        this.itemSearchQuery = ''
        this.prepSearchQuery = ''
        this.productSearchQuery = ''
        this.productSupplierFilter = ''
        this.productActiveFilter = 'on'
        this.expandedProductSupplier = null

        this.itemSearchInput.value = ''
        this.prepSearchInput.value = ''
        this.productSearchInput.value = ''
        this.supplierSelect.value = ''

        const activeFilterRadio = document.querySelector('input[name="productActiveFilter"][value="on"]')
        if (activeFilterRadio) activeFilterRadio.checked = true

        this.switchTab('items')
        this.updateSelectedCount()

        this.parentModal.classList.add('hidden')
        this.ingredientModal.classList.remove('hidden')
    }

    /**
     * モーダルを閉じる
     */
    close() {
        this.ingredientModal.classList.add('hidden')
        this.parentModal.classList.remove('hidden')
    }

    /**
     * 親モーダルを設定（作成/編集の切り替え用）
     */
    setParentModal(modal) {
        this.parentModal = modal
    }

    /**
     * タブ切り替え
     */
    switchTab(tab) {
        this.currentTab = tab

        const tabs = [this.tabItems, this.tabPreparations, this.tabProducts]
        const contents = [this.tabContentItems, this.tabContentPreparations, this.tabContentProducts]
        const tabNames = ['items', 'preparations', 'products']

        tabs.forEach((tabEl, index) => {
            if (tabNames[index] === tab) {
                tabEl.classList.add('border-blue-600', 'text-blue-600')
                tabEl.classList.remove('border-transparent', 'text-gray-500')
                contents[index].classList.remove('hidden')
            } else {
                tabEl.classList.remove('border-blue-600', 'text-blue-600')
                tabEl.classList.add('border-transparent', 'text-gray-500')
                contents[index].classList.add('hidden')
            }
        })

        if (tab === 'items') {
            this.renderItemSelectList()
        } else if (tab === 'preparations') {
            this.renderPrepSelectList()
        } else if (tab === 'products') {
            this.renderProductSelectList()
        }
    }

    /**
     * アイテム選択リスト表示
     */
    renderItemSelectList() {
        const allItems = this.getAllItems()
        let filtered = allItems

        if (this.itemSearchQuery) {
            const searchKana = toHalfWidthKatakana(this.itemSearchQuery)
            filtered = allItems.filter(item =>
                item.item_name.includes(this.itemSearchQuery) ||
                (item.item_kana && item.item_kana.includes(searchKana))
            )
        }

        if (filtered.length === 0) {
            this.itemSelectList.innerHTML = '<p class="text-center text-gray-500 py-8">該当するアイテムがありません</p>'
            return
        }

        this.itemSelectList.innerHTML = filtered.map(item => {
            const isSelected = this.selectedIngredients.some(s => s.type === 'item' && s.id === item.item_id)
            const unitCost = this.getIngredientUnitCost('item', item.item_id)
            return `
                <label class="flex items-center gap-4 p-3 rounded-lg hover:bg-blue-50 cursor-pointer border-b border-gray-100 ${isSelected ? 'bg-blue-50' : ''}">
                    <input type="checkbox" 
                        class="item-checkbox w-5 h-5 text-blue-600 rounded"
                        data-type="item"
                        data-id="${item.item_id}"
                        data-name="${item.item_name}"
                        data-unit="${item.unit}"
                        data-unit-cost="${unitCost}"
                        ${isSelected ? 'checked' : ''}
                    />
                    <div class="flex-1 min-w-0">
                        <div class="font-medium text-gray-800 truncate">${item.item_name}</div>
                        <div class="text-xs text-gray-400">${item.item_kana || ''}</div>
                    </div>
                    <div class="text-right flex-shrink-0">
                        <div class="font-bold text-gray-700">¥${unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                        <div class="text-xs text-gray-400">/ ${item.unit}</div>
                    </div>
                </label>
            `
        }).join('')

        this.itemSelectList.querySelectorAll('.item-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => this.handleIngredientCheckbox(e))
        })
    }

    /**
     * 仕込み品選択リスト表示
     */
    renderPrepSelectList() {
        const allPreparations = this.getAllPreparations()
        let filtered = allPreparations

        // 編集中の仕込み品を除外
        const excludeId = this.getExcludePrepId()
        if (excludeId) {
            filtered = filtered.filter(p => p.preparation_id !== excludeId)
        }

        if (this.prepSearchQuery) {
            const searchKana = toHalfWidthKatakana(this.prepSearchQuery)
            filtered = filtered.filter(prep =>
                prep.preparation_name.includes(this.prepSearchQuery) ||
                (prep.preparation_kana && prep.preparation_kana.includes(searchKana))
            )
        }

        if (filtered.length === 0) {
            this.prepSelectList.innerHTML = '<p class="text-center text-gray-500 py-8">該当する仕込み品がありません</p>'
            return
        }

        this.prepSelectList.innerHTML = filtered.map(prep => {
            const isSelected = this.selectedIngredients.some(s => s.type === 'preparation' && s.id === prep.preparation_id)
            const unitCost = this.getIngredientUnitCost('preparation', prep.preparation_id)
            return `
                <label class="flex items-center gap-4 p-3 rounded-lg hover:bg-blue-50 cursor-pointer border-b border-gray-100 ${isSelected ? 'bg-blue-50' : ''}">
                    <input type="checkbox" 
                        class="prep-checkbox w-5 h-5 text-blue-600 rounded"
                        data-type="preparation"
                        data-id="${prep.preparation_id}"
                        data-name="${prep.preparation_name}"
                        data-unit="${prep.yield_unit}"
                        data-unit-cost="${unitCost}"
                        ${isSelected ? 'checked' : ''}
                    />
                    <div class="flex-1 min-w-0">
                        <div class="font-medium text-gray-800 truncate">${prep.preparation_name}</div>
                        <div class="text-xs text-gray-400">${prep.preparation_kana || ''}</div>
                    </div>
                    <div class="text-right flex-shrink-0">
                        <div class="font-bold text-gray-700">¥${unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                        <div class="text-xs text-gray-400">/ ${prep.yield_unit}</div>
                    </div>
                </label>
            `
        }).join('')

        this.prepSelectList.querySelectorAll('.prep-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => this.handleIngredientCheckbox(e))
        })
    }

    /**
     * 仕入れ商品選択リスト表示
     */
    renderProductSelectList() {
        const allProducts = this.getAllProducts()
        const allSuppliers = this.getAllSuppliers()

        // 非表示の業者を除外
        const visibleSupplierNames = new Set(allSuppliers.map(s => s.supplier_name))
        let filtered = allProducts.filter(p => visibleSupplierNames.has(p.supplier_name))

        if (this.productSupplierFilter) {
            filtered = filtered.filter(p => p.supplier_name === this.productSupplierFilter)
        }

        if (this.productActiveFilter === 'on') {
            filtered = filtered.filter(p => p.is_active)
        } else if (this.productActiveFilter === 'off') {
            filtered = filtered.filter(p => !p.is_active)
        }

        if (this.productSearchQuery) {
            const normalizedQuery = normalizeForSearch(this.productSearchQuery)
            filtered = filtered.filter(p => {
                const normalizedName = normalizeForSearch(p.product_name)
                return normalizedName.includes(normalizedQuery) || p.product_name.includes(this.productSearchQuery)
            })
        }

        if (filtered.length === 0) {
            this.productSelectList.innerHTML = '<p class="text-center text-gray-500 py-8">該当する商品がありません</p>'
            return
        }

        const grouped = {}
        for (const p of filtered) {
            if (!grouped[p.supplier_name]) {
                grouped[p.supplier_name] = []
            }
            grouped[p.supplier_name].push(p)
        }

        const sortedSuppliers = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'ja'))

        let html = ''
        for (const supplier of sortedSuppliers) {
            const products = grouped[supplier]
            const isExpanded = this.expandedProductSupplier === supplier

            html += `
                <div class="border-b border-gray-200">
                    <div class="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 product-supplier-row" data-supplier="${supplier}">
                        <div class="flex items-center gap-2">
                            <span class="text-gray-400">${isExpanded ? '▼' : '▶'}</span>
                            <span class="font-bold text-gray-700">${supplier}</span>
                            <span class="text-sm text-gray-400">(${products.length}件)</span>
                        </div>
                    </div>
            `

            if (isExpanded) {
                html += '<div class="bg-gray-50 pb-2">'
                for (const product of products) {
                    html += `
                        <div class="flex items-center gap-4 px-6 py-3 hover:bg-blue-50 cursor-pointer product-row border-b border-gray-100 last:border-b-0"
                            data-code="${product.product_code}"
                            data-name="${product.product_name}"
                            data-spec="${product.specification || ''}"
                            data-price="${product.unit_price || 0}"
                            data-supplier="${product.supplier_name}"
                            data-active="${product.is_active}">
                            <div class="flex-1 min-w-0">
                                <div class="font-medium text-gray-800 truncate">${product.product_name}</div>
                                <div class="text-xs text-gray-400">${product.specification || '-'}</div>
                            </div>
                            <div class="text-right flex-shrink-0">
                                <div class="font-bold text-gray-700">¥${(product.unit_price || 0).toLocaleString()}</div>
                                ${!product.is_active ? '<div class="text-xs text-orange-500">使用OFF</div>' : ''}
                            </div>
                            <div class="flex-shrink-0 text-blue-600 font-bold">→</div>
                        </div>
                    `
                }
                html += '</div>'
            }

            html += '</div>'
        }

        this.productSelectList.innerHTML = html

        this.productSelectList.querySelectorAll('.product-supplier-row').forEach(row => {
            row.addEventListener('click', () => {
                const supplier = row.dataset.supplier
                this.expandedProductSupplier = this.expandedProductSupplier === supplier ? null : supplier
                this.renderProductSelectList()
            })
        })

        this.productSelectList.querySelectorAll('.product-row').forEach(row => {
            row.addEventListener('click', () => {
                if (this.onQuickItemCreate) {
                    this.onQuickItemCreate(row)
                }
            })
        })
    }

    /**
     * チェックボックス変更ハンドラ
     */
    handleIngredientCheckbox(e) {
        const checkbox = e.target
        const type = checkbox.dataset.type
        const id = parseInt(checkbox.dataset.id)
        const name = checkbox.dataset.name
        const unit = checkbox.dataset.unit
        const unitCost = parseFloat(checkbox.dataset.unitCost) || 0

        if (checkbox.checked) {
            if (!this.selectedIngredients.some(s => s.type === type && s.id === id)) {
                this.selectedIngredients.push({ type, id, name, unit, unitCost })
            }
        } else {
            this.selectedIngredients = this.selectedIngredients.filter(s => !(s.type === type && s.id === id))
        }

        this.updateSelectedCount()
    }

    /**
     * 選択数更新
     */
    updateSelectedCount() {
        const count = this.selectedIngredients.length
        this.selectedCount.textContent = `選択中: ${count}件`
        this.addSelectedIngredientsBtn.disabled = count === 0
    }

    /**
     * 選択した材料を追加
     */
    addSelectedIngredients() {
        if (this.onIngredientsAdded) {
            this.onIngredientsAdded(this.selectedIngredients)
        }
        this.close()
    }

    /**
     * 選択済みに追加（クイックアイテム作成後用）
     */
    addToSelected(ingredient) {
        this.selectedIngredients.push(ingredient)
        this.updateSelectedCount()
    }

    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        // タブ切り替え
        this.tabItems.addEventListener('click', () => this.switchTab('items'))
        this.tabPreparations.addEventListener('click', () => this.switchTab('preparations'))
        this.tabProducts.addEventListener('click', () => this.switchTab('products'))

        // 検索
        this.itemSearchInput.addEventListener('input', (e) => {
            this.itemSearchQuery = e.target.value
            this.renderItemSelectList()
        })

        this.prepSearchInput.addEventListener('input', (e) => {
            this.prepSearchQuery = e.target.value
            this.renderPrepSelectList()
        })

        this.productSearchInput.addEventListener('input', (e) => {
            this.productSearchQuery = e.target.value
            this.renderProductSelectList()
        })

        // 業者フィルター
        this.supplierSelect.addEventListener('change', (e) => {
            this.productSupplierFilter = e.target.value
            this.renderProductSelectList()
        })

        // 使用フラグフィルター
        document.querySelectorAll('.product-active-filter').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.productActiveFilter = e.target.value
                this.renderProductSelectList()
            })
        })

        // 選択した材料を追加
        this.addSelectedIngredientsBtn.addEventListener('click', () => this.addSelectedIngredients())
    }
}

/**
 * クイックアイテム作成モーダルの共通処理
 */
export class QuickItemModalManager {
    constructor(options) {
        // DOM要素
        this.quickItemModal = options.quickItemModal
        this.closeQuickItemModalBtn = options.closeQuickItemModalBtn
        this.cancelQuickItemBtn = options.cancelQuickItemBtn
        this.submitQuickItemBtn = options.submitQuickItemBtn
        this.quickProductCode = options.quickProductCode
        this.quickProductPrice = options.quickProductPrice
        this.quickProductInfo = options.quickProductInfo
        this.quickItemName = options.quickItemName
        this.quickItemKana = options.quickItemKana
        this.quickItemUnit = options.quickItemUnit
        this.quickYieldQuantity = options.quickYieldQuantity
        this.quickUnitCostPreview = options.quickUnitCostPreview
        this.quickItemGenre = options.quickItemGenre
        this.quickItemNeedsReview = options.quickItemNeedsReview

        // データ参照
        this.getAllProducts = options.getAllProducts
        this.getAllGenres = options.getAllGenres
        this.getBusinessTypeId = options.getBusinessTypeId
        this.supabase = options.supabase

        // コールバック
        this.onItemCreated = options.onItemCreated
    }

    /**
     * モーダルを開く
     */
    open(row) {
        const code = row.dataset.code
        const name = row.dataset.name
        const spec = row.dataset.spec
        const price = parseFloat(row.dataset.price) || 0
        const supplier = row.dataset.supplier

        this.quickProductCode.value = code
        this.quickProductPrice.value = price
        this.quickProductInfo.textContent = `${supplier} / ${name}（${spec || '-'}）- ¥${price.toLocaleString()}`
        this.quickItemName.value = ''
        this.quickItemKana.value = ''
        this.quickItemUnit.value = ''
        this.quickYieldQuantity.value = ''
        this.quickUnitCostPreview.textContent = '---'
        if (this.quickItemGenre) this.quickItemGenre.value = ''
        if (this.quickItemNeedsReview) this.quickItemNeedsReview.checked = false

        this.quickItemModal.classList.remove('hidden')
    }

    /**
     * モーダルを閉じる
     */
    close() {
        this.quickItemModal.classList.add('hidden')
    }

    /**
     * 単位原価プレビュー更新
     */
    updateUnitCostPreview() {
        const price = parseFloat(this.quickProductPrice.value) || 0
        const qty = parseFloat(this.quickYieldQuantity.value) || 0

        if (price > 0 && qty > 0) {
            const unitCost = price / qty
            this.quickUnitCostPreview.textContent = `¥${unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
        } else {
            this.quickUnitCostPreview.textContent = '---'
        }
    }

    /**
     * ジャンルセレクト生成
     */
    renderGenreSelect() {
        if (!this.quickItemGenre) return

        const genres = this.getAllGenres()
        const options = '<option value="">選択してください</option>' +
            genres.map(g => `<option value="${g.genre_id}">${g.genre_name}</option>`).join('')

        this.quickItemGenre.innerHTML = options
    }

    /**
     * アイテム作成
     */
    async createItem() {
        const code = this.quickProductCode.value
        const name = this.quickItemName.value.trim()
        const kana = toHalfWidthKatakana(this.quickItemKana.value.trim())
        const unit = this.quickItemUnit.value.trim()
        const qty = parseFloat(this.quickYieldQuantity.value)
        const price = parseFloat(this.quickProductPrice.value) || 0
        const genreIdValue = this.quickItemGenre ? this.quickItemGenre.value : ''
        const businessTypeId = this.getBusinessTypeId()
        const needsReview = this.quickItemNeedsReview ? this.quickItemNeedsReview.checked : false

        if (!name) {
            alert('アイテム名を入力してください')
            return null
        }
        if (!kana) {
            alert('読み仮名を入力してください')
            return null
        }
        if (!unit) {
            alert('使用単位を入力してください')
            return null
        }
        if (!qty || qty <= 0) {
            alert('取れる数を正しく入力してください')
            return null
        }

        this.submitQuickItemBtn.disabled = true
        this.submitQuickItemBtn.textContent = '作成中...'

        // 商品の使用フラグを更新
        const allProducts = this.getAllProducts()
        const product = allProducts.find(p => p.product_code === code)
        if (product && !product.is_active) {
            const { error: updateError } = await this.supabase
                .from('products')
                .update({ is_active: true })
                .eq('product_code', code)

            if (updateError) {
                console.error('商品フラグ更新エラー:', updateError)
            } else {
                product.is_active = true
            }
        }

        // アイテム作成
        const insertData = {
            item_name: name,
            item_kana: kana,
            product_code: code,
            unit: unit,
            yield_quantity: qty,
            business_type_id: businessTypeId,
            needs_review: needsReview
        }

        if (genreIdValue) {
            insertData.genre_id = parseInt(genreIdValue)
        }

        const { data: newItem, error } = await this.supabase
            .from('items')
            .insert(insertData)
            .select()
            .single()

        if (error) {
            console.error('アイテム作成エラー:', error)
            alert('作成に失敗しました: ' + error.message)
            this.submitQuickItemBtn.disabled = false
            this.submitQuickItemBtn.textContent = '作成して追加'
            return null
        }

        this.submitQuickItemBtn.disabled = false
        this.submitQuickItemBtn.textContent = '作成して追加'

        alert(`✅ アイテム「${name}」を作成しました！\n\n選択リストに追加されています。`)

        this.close()

        // コールバック
        if (this.onItemCreated) {
            const unitCost = price / qty
            this.onItemCreated(newItem, product, { type: 'item', id: newItem.item_id, name, unit, unitCost })
        }

        return newItem
    }

    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        this.closeQuickItemModalBtn.addEventListener('click', () => this.close())
        this.cancelQuickItemBtn.addEventListener('click', () => this.close())
        this.quickYieldQuantity.addEventListener('input', () => this.updateUnitCostPreview())
        this.submitQuickItemBtn.addEventListener('click', () => this.createItem())

        // 読み仮名の変換
        this.quickItemKana.addEventListener('blur', (e) => {
            e.target.value = sanitizeToFullWidthKatakana(e.target.value)
        })
    }
}

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
            const uniqueId = `ing - prep - ${prep.preparation_id} -${depth} -${index} -${Date.now()} `
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