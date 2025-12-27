import { supabase } from './supabase.js'
import { calculateItemUnitCost } from './costCalculator.js'
import { initBusinessTypeSelector, getCurrentBusinessTypeId } from './businessType.js'

// ============================================
// DOM要素の取得
// ============================================
// メイン画面
const itemList = document.getElementById('itemList')
const emptyState = document.getElementById('emptyState')
const searchInput = document.getElementById('searchInput')
const itemCount = document.getElementById('itemCount')
const activeProductCount = document.getElementById('activeProductCount')
const pendingCount = document.getElementById('pendingCount')

// 作成モーダル
const createModal = document.getElementById('createModal')
const openCreateModalBtn = document.getElementById('openCreateModal')
const closeCreateModalBtn = document.getElementById('closeCreateModal')
const cancelCreateBtn = document.getElementById('cancelCreate')
const submitCreateBtn = document.getElementById('submitCreate')
const openProductSelectModalBtn = document.getElementById('openProductSelectModal')
const selectedProductText = document.getElementById('selectedProductText')
const selectedProductCode = document.getElementById('selectedProductCode')
const selectedProductPrice = document.getElementById('selectedProductPrice')
const selectedProductIsActive = document.getElementById('selectedProductIsActive')
const productInfo = document.getElementById('productInfo')
const itemName = document.getElementById('itemName')
const itemKana = document.getElementById('itemKana')
const itemUnit = document.getElementById('itemUnit')
const yieldQuantity = document.getElementById('yieldQuantity')
const unitCostPreview = document.getElementById('unitCostPreview')
const unitCostFormula = document.getElementById('unitCostFormula')
const itemGenre = document.getElementById('itemGenre')
const itemNeedsReview = document.getElementById('itemNeedsReview')

// 商品選択モーダル
const productSelectModal = document.getElementById('productSelectModal')
const closeProductSelectModalBtn = document.getElementById('closeProductSelectModal')
const productSelectList = document.getElementById('productSelectList')
const productSearchInput = document.getElementById('productSearchInput')

// 編集モーダル
const editModal = document.getElementById('editModal')
const closeEditModalBtn = document.getElementById('closeEditModal')
const cancelEditBtn = document.getElementById('cancelEdit')
const submitEditBtn = document.getElementById('submitEdit')
const deleteItemBtn = document.getElementById('deleteItem')
const editItemId = document.getElementById('editItemId')
const editProductPrice = document.getElementById('editProductPrice')
const editProductInfo = document.getElementById('editProductInfo')
const editItemName = document.getElementById('editItemName')
const editItemKana = document.getElementById('editItemKana')
const editItemUnit = document.getElementById('editItemUnit')
const editYieldQuantity = document.getElementById('editYieldQuantity')
const editUnitCostPreview = document.getElementById('editUnitCostPreview')
const editUnitCostFormula = document.getElementById('editUnitCostFormula')
const editItemGenre = document.getElementById('editItemGenre')
const editItemNeedsReview = document.getElementById('editItemNeedsReview')

// ============================================
// 状態管理
// ============================================
let allItems = []
let allProducts = []
let allActiveProducts = []
let searchQuery = ''
let productSearchQuery = ''
let productFilterMode = 'unregistered'
let expandedSupplier = null
let allGenres = []
let reviewFilterMode = 'all'

// ============================================
// 初期化
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    // 業態セレクタを初期化（変更時にデータ再読み込み）
    await initBusinessTypeSelector(onBusinessTypeChange)

    await loadData()
    setupEventListeners()
})

// ============================================
// 業態変更時のコールバック
// ============================================
async function onBusinessTypeChange(businessTypeId) {
    await loadData()
}

// ============================================
// イベントリスナー設定
// ============================================
function setupEventListeners() {
    // 検索
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value
        renderItems()
    })

    // 作成モーダル
    openCreateModalBtn.addEventListener('click', () => {
        resetCreateForm()
        createModal.classList.remove('hidden')
    })

    closeCreateModalBtn.addEventListener('click', () => {
        createModal.classList.add('hidden')
    })

    cancelCreateBtn.addEventListener('click', () => {
        createModal.classList.add('hidden')
    })



    // 商品選択モーダル
    openProductSelectModalBtn.addEventListener('click', () => {
        productSearchQuery = ''
        productSearchInput.value = ''
        expandedSupplier = null
        renderProductSelectList()
        // 作成モーダルを一時的に隠す
        createModal.classList.add('hidden')
        productSelectModal.classList.remove('hidden')
    })

    closeProductSelectModalBtn.addEventListener('click', () => {
        productSelectModal.classList.add('hidden')
        // 作成モーダルを再表示
        createModal.classList.remove('hidden')
    })



    productSearchInput.addEventListener('input', (e) => {
        productSearchQuery = e.target.value
        renderProductSelectList()
    })

    document.querySelectorAll('.product-filter-radio').forEach(radio => {
        radio.addEventListener('change', (e) => {
            productFilterMode = e.target.value
            expandedSupplier = null
            renderProductSelectList()
        })
    })

    // 読み仮名の変換（フォーカスが外れたとき）
    itemKana.addEventListener('blur', (e) => {
        e.target.value = sanitizeToFullWidthKatakana(e.target.value)
    })

    // 読み仮名の変換（編集・フォーカスが外れたとき）
    editItemKana.addEventListener('blur', (e) => {
        e.target.value = sanitizeToFullWidthKatakana(e.target.value)
    })

    // 単位原価プレビュー更新
    yieldQuantity.addEventListener('input', updateCreateUnitCostPreview)

    // 作成実行
    submitCreateBtn.addEventListener('click', createItem)

    // 編集モーダル
    closeEditModalBtn.addEventListener('click', () => {
        editModal.classList.add('hidden')
    })

    cancelEditBtn.addEventListener('click', () => {
        editModal.classList.add('hidden')
    })



    editYieldQuantity.addEventListener('input', updateEditUnitCostPreview)

    // 更新実行
    submitEditBtn.addEventListener('click', updateItem)

    // 削除実行
    deleteItemBtn.addEventListener('click', deleteItem)
    // 要確認フィルター
    document.querySelectorAll('.review-filter-radio').forEach(radio => {
        radio.addEventListener('change', (e) => {
            reviewFilterMode = e.target.value
            renderItems()
        })
    })
}

// ============================================
// データ読み込み
// ============================================
async function loadData() {
    itemList.innerHTML = '<p class="text-center text-gray-500 py-8">読み込み中...</p>'

    const businessTypeId = getCurrentBusinessTypeId()

    // ジャンル一覧を取得（業態でフィルタ）
    let genresQuery = supabase
        .from('item_genres')
        .select('*')
        .order('sort_order', { ascending: true })

    if (businessTypeId) {
        genresQuery = genresQuery.eq('business_type_id', businessTypeId)
    }

    const { data: genres, error: genresError } = await genresQuery

    if (genresError) {
        console.error('ジャンル取得エラー:', genresError)
    } else {
        allGenres = genres || []
        renderGenreSelect()
    }

    // アイテム一覧を取得（業態でフィルタ）
    let itemsQuery = supabase
        .from('items')
        .select(`
            *,
            products (
                product_name,
                specification,
                unit_price,
                supplier_name
            ),
            item_genres (
                genre_id,
                genre_name,
                sort_order
            )
        `)
        .order('item_kana', { ascending: true })

    if (businessTypeId) {
        itemsQuery = itemsQuery.eq('business_type_id', businessTypeId)
    }

    const { data: items, error: itemsError } = await itemsQuery

    if (itemsError) {
        console.error('アイテム取得エラー:', itemsError)
        itemList.innerHTML = '<p class="text-center text-red-500 py-8">データの取得に失敗しました</p>'
        return
    }

    // 全商品を取得（ページング対応）※商品は業態共通
    let productsData = []
    let from = 0
    const batchSize = 1000

    while (true) {
        const { data: batch, error: batchError } = await supabase
            .from('products')
            .select('*')
            .order('supplier_name', { ascending: true })
            .range(from, from + batchSize - 1)

        if (batchError) {
            console.error('商品取得エラー:', batchError)
            return
        }

        productsData = productsData.concat(batch)

        if (batch.length < batchSize) break
        from += batchSize
    }

    allItems = items || []
    allProducts = productsData
    allActiveProducts = productsData.filter(p => p.is_active)

    updateStats()
    renderItems()
}
// ============================================
// ジャンルセレクト生成
// ============================================
function renderGenreSelect() {
    const options = '<option value="">選択してください</option>' +
        allGenres.map(g => `<option value="${g.genre_id}">${g.genre_name}</option>`).join('')

    itemGenre.innerHTML = options
    editItemGenre.innerHTML = options
}

// ============================================
// 統計情報更新
// ============================================
function updateStats() {
    itemCount.textContent = `${allItems.length} 件`
    activeProductCount.textContent = `${allActiveProducts.length} 件`

    const itemizedCodes = new Set(allItems.map(item => item.product_code))
    const pendingProducts = allActiveProducts.filter(p => !itemizedCodes.has(p.product_code))
    pendingCount.textContent = `${pendingProducts.length} 件`
}

// ============================================
// 半角カタカナ変換
// ============================================
function toHalfWidthKatakana(str) {
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
// ============================================
// 全角カタカナのみに制限（入力用）
// ============================================
function sanitizeToFullWidthKatakana(str) {
    // ひらがな → 全角カタカナ
    let result = str.replace(/[\u3041-\u3096]/g, (match) => {
        return String.fromCharCode(match.charCodeAt(0) + 0x60)
    })

    // 全角カタカナとー（長音）のみ残す
    result = result.replace(/[^ァ-ヶー]/g, '')

    return result
}

// ============================================
// アイテムの単位原価を取得（計算）
// ============================================
function getItemUnitCost(item) {
    const productPrice = item.products?.unit_price || 0
    return calculateItemUnitCost(productPrice, item.yield_quantity)
}

// ============================================
// アイテム一覧表示
// ============================================
function renderItems() {
    let filtered = allItems

    // 要確認フィルター
    if (reviewFilterMode === 'needs_review') {
        filtered = filtered.filter(item => item.needs_review)
    }

    // 検索フィルタ
    if (searchQuery) {
        const searchKana = toHalfWidthKatakana(searchQuery)
        filtered = filtered.filter(item =>
            item.item_name.includes(searchQuery) ||
            (item.item_kana && item.item_kana.includes(searchKana)) ||
            (item.products?.product_name && item.products.product_name.includes(searchQuery))
        )
    }

    if (filtered.length === 0) {
        itemList.innerHTML = ''
        emptyState.classList.remove('hidden')
        return
    }

    emptyState.classList.add('hidden')

    // ジャンルごとにグループ化
    const grouped = {}

    // まず全ジャンルを初期化（空でも表示するため）
    allGenres.forEach(g => {
        grouped[g.genre_id] = {
            genre: g,
            items: []
        }
    })

    // 未分類用
    grouped['none'] = {
        genre: { genre_id: null, genre_name: '未分類', sort_order: 9999 },
        items: []
    }

    // アイテムを振り分け
    filtered.forEach(item => {
        const genreId = item.genre_id || 'none'
        if (grouped[genreId]) {
            grouped[genreId].items.push(item)
        } else {
            grouped['none'].items.push(item)
        }
    })

    // ソート順でグループをソート
    const sortedGroups = Object.values(grouped)
        .filter(g => g.items.length > 0) // アイテムがあるグループのみ
        .sort((a, b) => a.genre.sort_order - b.genre.sort_order)

    let html = ''

    sortedGroups.forEach(group => {
        // グループ内で五十音順ソート
        const sortedItems = group.items.sort((a, b) => {
            const kanaA = a.item_kana || ''
            const kanaB = b.item_kana || ''
            return kanaA.localeCompare(kanaB, 'ja')
        })

        html += `
            <div class="mb-6">
                <h3 class="text-lg font-bold text-gray-700 mb-3 pb-2 border-b-2 border-blue-200">
                    ${group.genre.genre_name}
                    <span class="text-sm font-normal text-gray-400">(${sortedItems.length}件)</span>
                </h3>
                <div class="space-y-2">
        `

        sortedItems.forEach(item => {
            const product = item.products
            const unitCost = getItemUnitCost(item)
            const needsReviewClass = item.needs_review ? 'text-red-600' : 'text-gray-800'
            const needsReviewBadge = item.needs_review ? '<span class="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded font-bold ml-2">要確認</span>' : ''

            html += `
                <div class="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer item-row ${item.needs_review ? 'border-red-300 bg-red-50' : ''}" data-item-id="${item.item_id}">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-3 mb-1">
                            <span class="font-bold ${needsReviewClass} truncate">${item.item_name}</span>
                            ${needsReviewBadge}
                            <span class="text-sm px-2 py-0.5 bg-blue-100 text-blue-700 rounded flex-shrink-0">${item.unit}</span>
                        </div>
                        ${item.item_kana ? `<div class="text-xs text-gray-400 mb-1">${item.item_kana}</div>` : ''}
                        <div class="text-sm text-gray-500 truncate">
                            ${product ? `${product.supplier_name} / ${product.product_name}` : '（商品情報なし）'}
                        </div>
                    </div>
                    <div class="text-right flex-shrink-0 ml-4">
                        <div class="text-lg font-bold ${item.needs_review ? 'text-red-600' : 'text-blue-600'}">¥${unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span class="text-sm font-normal text-gray-500">/ ${item.unit}</span></div>
                        <div class="text-xs text-gray-400">取れる数: ${item.yield_quantity}</div>
                    </div>
                </div>
            `
        })

        html += '</div></div>'
    })

    itemList.innerHTML = html

    // 行クリックで編集モーダル
    document.querySelectorAll('.item-row').forEach(row => {
        row.addEventListener('click', () => {
            const itemId = parseInt(row.dataset.itemId)
            openEditModal(itemId)
        })
    })
}

// ============================================
// 商品選択リスト表示
// ============================================
function renderProductSelectList() {
    const itemizedCodes = new Set(allItems.map(item => item.product_code))

    let products = []
    if (productFilterMode === 'unregistered') {
        products = allActiveProducts.filter(p => !itemizedCodes.has(p.product_code))
    } else if (productFilterMode === 'registered') {
        products = allActiveProducts.filter(p => itemizedCodes.has(p.product_code))
    } else {
        products = allProducts
    }

    // 検索フィルタ
    if (productSearchQuery) {
        products = products.filter(p => p.product_name.includes(productSearchQuery))
    }

    if (products.length === 0) {
        productSelectList.innerHTML = '<p class="text-center text-gray-500 py-8">該当する商品がありません</p>'
        return
    }

    // 業者ごとにグループ化
    const grouped = {}
    for (const p of products) {
        if (!grouped[p.supplier_name]) {
            grouped[p.supplier_name] = []
        }
        grouped[p.supplier_name].push(p)
    }

    const sortedSuppliers = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'ja'))

    let html = ''
    for (const supplier of sortedSuppliers) {
        const supplierProducts = grouped[supplier]
        const isExpanded = expandedSupplier === supplier

        html += `
      <div class="border-b border-gray-200">
        <div class="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 supplier-row" data-supplier="${supplier}">
          <div class="flex items-center gap-2">
            <span class="text-gray-400">${isExpanded ? '▼' : '▶'}</span>
            <span class="font-bold text-gray-700">${supplier}</span>
            <span class="text-sm text-gray-400">(${supplierProducts.length}件)</span>
          </div>
        </div>
    `

        if (isExpanded) {
            html += '<div class="bg-gray-50 pb-2">'
            for (const product of supplierProducts) {
                html += `
          <div class="flex items-center justify-between px-6 py-3 hover:bg-blue-50 cursor-pointer product-row border-b border-gray-100 last:border-b-0"
               data-code="${product.product_code}"
               data-name="${product.product_name}"
               data-spec="${product.specification || ''}"
               data-price="${product.unit_price || 0}"
               data-active="${product.is_active}">
            <div class="flex-1 min-w-0">
              <div class="text-gray-800 truncate">${product.product_name}</div>
              <div class="text-xs text-gray-400">${product.specification || '-'}</div>
            </div>
            <div class="text-right flex-shrink-0 ml-4">
              <div class="font-bold text-gray-700">¥${(product.unit_price || 0).toLocaleString()}</div>
              ${!product.is_active ? '<div class="text-xs text-orange-500">使用OFF</div>' : ''}
            </div>
          </div>
        `
            }
            html += '</div>'
        }

        html += '</div>'
    }

    productSelectList.innerHTML = html

    // 業者クリックで展開/閉じる
    document.querySelectorAll('.supplier-row').forEach(row => {
        row.addEventListener('click', () => {
            const supplier = row.dataset.supplier
            expandedSupplier = expandedSupplier === supplier ? null : supplier
            renderProductSelectList()
        })
    })

    // 商品クリックで選択
    document.querySelectorAll('.product-row').forEach(row => {
        row.addEventListener('click', () => {
            const code = row.dataset.code
            const name = row.dataset.name
            const spec = row.dataset.spec
            const price = parseFloat(row.dataset.price) || 0
            const isActive = row.dataset.active === 'true'

            selectedProductCode.value = code
            selectedProductPrice.value = price
            selectedProductIsActive.value = isActive
            selectedProductText.textContent = name
            selectedProductText.classList.remove('text-gray-400')
            selectedProductText.classList.add('text-gray-800')

            let infoText = `規格: ${spec || '-'} / 単価: ¥${price.toLocaleString()}`
            if (!isActive) {
                infoText += ' ⚠️ 使用OFF（作成時に自動でONになります）'
            }
            productInfo.textContent = infoText

            updateCreateUnitCostPreview()
            productSelectModal.classList.add('hidden')
            // 作成モーダルを再表示
            createModal.classList.remove('hidden')
        })
    })
}

// ============================================
// 作成フォーム：単位原価プレビュー更新
// ============================================
function updateCreateUnitCostPreview() {
    const price = parseFloat(selectedProductPrice.value) || 0
    const qty = parseFloat(yieldQuantity.value) || 0

    if (price > 0 && qty > 0) {
        const unitCost = calculateItemUnitCost(price, qty)
        unitCostPreview.textContent = `¥${unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
        unitCostFormula.textContent = `¥${price.toLocaleString()} ÷ ${qty} = ¥${unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    } else {
        unitCostPreview.textContent = '---'
        unitCostFormula.textContent = ''
    }
}

// ============================================
// 編集フォーム：単位原価プレビュー更新
// ============================================
function updateEditUnitCostPreview() {
    const price = parseFloat(editProductPrice.value) || 0
    const qty = parseFloat(editYieldQuantity.value) || 0

    if (price > 0 && qty > 0) {
        const unitCost = calculateItemUnitCost(price, qty)
        editUnitCostPreview.textContent = `¥${unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
        editUnitCostFormula.textContent = `¥${price.toLocaleString()} ÷ ${qty} = ¥${unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    } else {
        editUnitCostPreview.textContent = '---'
        editUnitCostFormula.textContent = ''
    }
}

// ============================================
// 作成フォームリセット
// ============================================
function resetCreateForm() {
    selectedProductCode.value = ''
    selectedProductPrice.value = ''
    selectedProductIsActive.value = ''
    selectedProductText.textContent = 'クリックして商品を選択...'
    selectedProductText.classList.add('text-gray-400')
    selectedProductText.classList.remove('text-gray-800')
    productInfo.textContent = ''
    itemGenre.value = ''
    itemName.value = ''
    itemKana.value = ''
    itemUnit.value = ''
    yieldQuantity.value = ''
    unitCostPreview.textContent = '---'
    unitCostFormula.textContent = ''
    submitCreateBtn.disabled = false
    submitCreateBtn.textContent = '作成する'

    // フィルターリセット
    productFilterMode = 'unregistered'
    const radio = document.querySelector('input[name="productFilter"][value="unregistered"]')
    if (radio) radio.checked = true
    productSearchQuery = ''
    itemNeedsReview.checked = false
    expandedSupplier = null
}

// ============================================
// 編集モーダルを開く
// ============================================
function openEditModal(itemId) {
    const item = allItems.find(i => i.item_id === itemId)
    if (!item) return

    const product = item.products

    editItemId.value = item.item_id
    editProductPrice.value = product?.unit_price || 0
    editProductInfo.textContent = product
        ? `${product.supplier_name} / ${product.product_name}（${product.specification || '-'}）- ¥${(product.unit_price || 0).toLocaleString()}`
        : '（商品情報なし）'
    editItemGenre.value = item.genre_id || ''
    editItemName.value = item.item_name
    editItemKana.value = item.item_kana || ''
    editItemUnit.value = item.unit
    editYieldQuantity.value = item.yield_quantity

    editItemNeedsReview.checked = item.needs_review || false
    updateEditUnitCostPreview()
    editModal.classList.remove('hidden')
}

// ============================================
// アイテム作成
// ============================================
async function createItem() {
    const code = selectedProductCode.value
    const genreIdValue = itemGenre.value
    const name = itemName.value.trim()
    const kana = toHalfWidthKatakana(itemKana.value.trim())
    const unit = itemUnit.value.trim()
    const qty = parseFloat(yieldQuantity.value)
    const isActive = selectedProductIsActive.value === 'true'
    const businessTypeId = getCurrentBusinessTypeId()
    const needsReview = itemNeedsReview.checked

    // バリデーション
    if (!code) {
        alert('仕入れ商品を選択してください')
        return
    }
    if (!genreIdValue) {
        alert('ジャンルを選択してください')
        return
    }
    if (!name) {
        alert('アイテム名を入力してください')
        return
    }
    if (!kana) {
        alert('読み仮名を入力してください')
        return
    }
    if (!unit) {
        alert('使用単位を入力してください')
        return
    }
    if (!qty || qty <= 0) {
        alert('取れる数を正しく入力してください')
        return
    }

    submitCreateBtn.disabled = true
    submitCreateBtn.textContent = '作成中...'

    // 使用OFFの場合は自動でONにする
    if (!isActive) {
        const { error: updateError } = await supabase
            .from('products')
            .update({ is_active: true })
            .eq('product_code', code)

        if (updateError) {
            console.error('商品フラグ更新エラー:', updateError)
        }
    }

    // business_type_idを追加
    const { error } = await supabase
        .from('items')
        .insert({
            item_name: name,
            item_kana: kana,
            product_code: code,
            genre_id: parseInt(genreIdValue),
            unit: unit,
            yield_quantity: qty,
            business_type_id: businessTypeId,
            needs_review: needsReview
        })

    if (error) {
        console.error('アイテム作成エラー:', error)
        alert('作成に失敗しました: ' + error.message)
        submitCreateBtn.disabled = false
        submitCreateBtn.textContent = '作成する'
        return
    }

    createModal.classList.add('hidden')
    resetCreateForm()
    await loadData()
}

// ============================================
// アイテム更新
// ============================================
async function updateItem() {
    const itemId = parseInt(editItemId.value)
    const genreIdValue = editItemGenre.value
    const name = editItemName.value.trim()
    const kana = toHalfWidthKatakana(editItemKana.value.trim())
    const unit = editItemUnit.value.trim()
    const qty = parseFloat(editYieldQuantity.value)
    const needsReview = editItemNeedsReview.checked

    // バリデーション
    if (!genreIdValue) {
        alert('ジャンルを選択してください')
        return
    }
    if (!name) {
        alert('アイテム名を入力してください')
        return
    }
    if (!kana) {
        alert('読み仮名を入力してください')
        return
    }
    if (!unit) {
        alert('使用単位を入力してください')
        return
    }
    if (!qty || qty <= 0) {
        alert('取れる数を正しく入力してください')
        return
    }

    submitEditBtn.disabled = true
    submitEditBtn.textContent = '更新中...'

    const { error } = await supabase
        .from('items')
        .update({
            item_name: name,
            item_kana: kana,
            genre_id: parseInt(genreIdValue),
            unit: unit,
            yield_quantity: qty,
            needs_review: needsReview
        })
        .eq('item_id', itemId)

    if (error) {
        console.error('アイテム更新エラー:', error)
        alert('更新に失敗しました: ' + error.message)
        submitEditBtn.disabled = false
        submitEditBtn.textContent = '更新する'
        return
    }

    editModal.classList.add('hidden')
    submitEditBtn.disabled = false
    submitEditBtn.textContent = '更新する'
    await loadData()
}

// ============================================
// アイテム削除
// ============================================
async function deleteItem() {
    const itemId = parseInt(editItemId.value)

    if (!confirm('このアイテムを削除しますか？')) {
        return
    }

    const { error } = await supabase
        .from('items')
        .delete()
        .eq('item_id', itemId)

    if (error) {
        console.error('アイテム削除エラー:', error)
        alert('削除に失敗しました: ' + error.message)
        return
    }

    editModal.classList.add('hidden')
    await loadData()
}