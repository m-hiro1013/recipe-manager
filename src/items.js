import { supabase } from './supabase.js'
import { calculateItemUnitCost } from './costCalculator.js'
import { initBusinessTypeSelector, getCurrentBusinessTypeId } from './businessType.js'
import { toHalfWidthKatakana, sanitizeToFullWidthKatakana, normalizeForSearch, fetchAllWithPaging, withBusinessTypeFilter } from './utils.js'
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
const tabProductMode = document.getElementById('tabProductMode')
const tabManualMode = document.getElementById('tabManualMode')
const productModeSection = document.getElementById('productModeSection')
const manualModeSection = document.getElementById('manualModeSection')
const manualTotalQuantity = document.getElementById('manualTotalQuantity')
const manualTotalUnit = document.getElementById('manualTotalUnit')
const manualTotalPrice = document.getElementById('manualTotalPrice')
const manualUnitCostPreview = document.getElementById('manualUnitCostPreview')
const manualUnitCostFormula = document.getElementById('manualUnitCostFormula')

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
const openEditProductSelectModalBtn = document.getElementById('openEditProductSelectModal')
const editProductCode = document.getElementById('editProductCode')
const editManualPriceMode = document.getElementById('editManualPriceMode')
const editProductSelectSection = document.getElementById('editProductSelectSection')
const editManualPriceInfo = document.getElementById('editManualPriceInfo')
const editManualTotalQuantity = document.getElementById('editManualTotalQuantity')
const editManualTotalUnit = document.getElementById('editManualTotalUnit')
const editManualTotalPrice = document.getElementById('editManualTotalPrice')
const editManualUnitCostPreview = document.getElementById('editManualUnitCostPreview')
const editManualUnitCostFormula = document.getElementById('editManualUnitCostFormula')
const editManualPriceModeInput = document.getElementById('editManualPriceMode')
const editYieldQuantitySection = document.getElementById('editYieldQuantitySection')
const editUnitCostPreviewSection = document.getElementById('editUnitCostPreviewSection')

// ============================================
// 状態管理
// ============================================
let allItems = []
let allProducts = []
let allSuppliers = []
let allActiveProducts = []
let searchQuery = ''
let productSearchQuery = ''
let productFilterMode = 'unregistered'
let expandedSupplier = null
let allGenres = []
let reviewFilterMode = 'all'
let isEditProductMode = false // 編集モーダル用の商品選択かどうか
let currentCreateMode = 'product' // 'product' or 'manual'
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

    // タブ切り替え（仕入れ商品モード）
    tabProductMode.addEventListener('click', () => {
        switchCreateMode('product')
    })

    // タブ切り替え（手動入力モード）
    tabManualMode.addEventListener('click', () => {
        switchCreateMode('manual')
    })

    // 使用単位の入力で手動モードの単位も連動
    itemUnit.addEventListener('input', (e) => {
        manualTotalUnit.value = e.target.value
    })

    // 手動単価プレビュー更新（作成）
    manualTotalQuantity.addEventListener('input', updateManualUnitCostPreview)
    manualTotalPrice.addEventListener('input', updateManualUnitCostPreview)

    // 手動単価プレビュー更新（編集）
    editManualTotalQuantity.addEventListener('input', updateEditManualUnitCostPreview)
    editManualTotalPrice.addEventListener('input', updateEditManualUnitCostPreview)

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
        // 元のモーダルを再表示
        if (isEditProductMode) {
            editModal.classList.remove('hidden')
            isEditProductMode = false
        } else {
            createModal.classList.remove('hidden')
        }
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

    // 編集用：商品選択モーダルを開く
    openEditProductSelectModalBtn.addEventListener('click', () => {
        isEditProductMode = true
        productSearchQuery = ''
        productSearchInput.value = ''
        expandedSupplier = null
        // 編集時は全商品から選べるようにする
        productFilterMode = 'all'
        const radio = document.querySelector('input[name="productFilter"][value="all"]')
        if (radio) radio.checked = true
        renderProductSelectList()
        editModal.classList.add('hidden')
        productSelectModal.classList.remove('hidden')
    })

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
    const { data: genres, error: genresError } = await withBusinessTypeFilter(
        supabase.from('item_genres').select('*').order('sort_order', { ascending: true }),
        businessTypeId
    )

    if (genresError) {
        console.error('ジャンル取得エラー:', genresError)
    } else {
        allGenres = genres || []
        renderGenreSelect()
    }

    // アイテム一覧を取得（業態でフィルタ）
    const { data: items, error: itemsError } = await withBusinessTypeFilter(
        supabase.from('items').select(`
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
        `).order('item_kana', { ascending: true }),
        businessTypeId
    )

    if (itemsError) {
        console.error('アイテム取得エラー:', itemsError)
        itemList.innerHTML = '<p class="text-center text-red-500 py-8">データの取得に失敗しました</p>'
        return
    }

    // 全商品を取得（ページング対応）※商品は業態共通
    const { data: productsData, error: productsError } = await fetchAllWithPaging(
        'products',
        '*',
        { orderColumn: 'supplier_name', ascending: true }
    )

    if (productsError) {
        console.error('商品取得エラー:', productsError)
        return
    }

    allItems = items || []
    allProducts = productsData
    allActiveProducts = productsData.filter(p => p.is_active)
    // 取引先一覧を取得（業態ごとの非表示設定をJOIN）
    const { data: suppliers, error: suppliersError } = await supabase
        .from('suppliers')
        .select('*, supplier_business_types!inner(is_hidden)')
        .eq('supplier_business_types.business_type_id', businessTypeId)
        .eq('supplier_business_types.is_hidden', false)

    if (suppliersError) {
        console.error('取引先取得エラー:', suppliersError)
    }

    allSuppliers = (suppliers || []).map(s => ({
        ...s,
        is_hidden: s.supplier_business_types?.[0]?.is_hidden ?? false
    }))

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
// アイテムの単位原価を取得（計算）
// ============================================
function getItemUnitCost(item) {
    // 手動単価の場合
    if (item.manual_price && item.manual_unit_cost !== null && item.manual_unit_cost !== undefined) {
        return item.manual_unit_cost
    }

    // 通常の場合：仕入れ単価 ÷ 取れる数
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
            const manualPriceBadge = item.manual_price ? '<span class="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded font-bold ml-2">🔁 手動単価</span>' : ''

            html += `
                <div class="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer item-row ${item.needs_review ? 'border-red-300 bg-red-50' : ''}" data-item-id="${item.item_id}">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-3 mb-1">
                            <span class="font-bold ${needsReviewClass} truncate">${item.item_name}</span>
                            ${needsReviewBadge}
                            ${manualPriceBadge}
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
    // 非表示の業者を除外
    const visibleSupplierNames = new Set(allSuppliers.map(s => s.supplier_name))
    let products = []
    if (productFilterMode === 'unregistered') {
        products = allActiveProducts.filter(p => !itemizedCodes.has(p.product_code) && visibleSupplierNames.has(p.supplier_name))
    } else if (productFilterMode === 'registered') {
        products = allActiveProducts.filter(p => itemizedCodes.has(p.product_code) && visibleSupplierNames.has(p.supplier_name))
    } else {
        products = allProducts.filter(p => visibleSupplierNames.has(p.supplier_name))
    }

    // 検索フィルタ
    if (productSearchQuery) {
        const normalizedQuery = normalizeForSearch(productSearchQuery)
        products = products.filter(p => {
            const normalizedName = normalizeForSearch(p.product_name)
            return normalizedName.includes(normalizedQuery) || p.product_name.includes(productSearchQuery)
        })
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

    // 検索中は商品0件の業者を除外
    let sortedSuppliers = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'ja'))
    if (productSearchQuery) {
        sortedSuppliers = sortedSuppliers.filter(supplier => grouped[supplier].length > 0)
    }

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

            if (isEditProductMode) {
                // 編集モード：商品を変更
                editProductCode.value = code
                editProductPrice.value = price

                // 商品情報を更新
                const supplier = allProducts.find(p => p.product_code === code)?.supplier_name || ''
                editProductInfo.textContent = `${supplier} / ${name}（${spec || '-'}）- ¥${price.toLocaleString()}`

                updateEditUnitCostPreview()
                productSelectModal.classList.add('hidden')
                editModal.classList.remove('hidden')
                isEditProductMode = false
            } else {
                // 作成モード：既存の処理
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
                createModal.classList.remove('hidden')
            }
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
// 作成モード切り替え
// ============================================
function switchCreateMode(mode) {
    currentCreateMode = mode

    // タブのスタイル更新
    if (mode === 'product') {
        tabProductMode.classList.remove('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300')
        tabProductMode.classList.add('bg-blue-600', 'text-white')
        tabManualMode.classList.remove('bg-blue-600', 'text-white')
        tabManualMode.classList.add('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300')

        // セクション表示切り替え
        productModeSection.classList.remove('hidden')
        manualModeSection.classList.add('hidden')

        // 手動モードの入力をクリア（モード固有項目のみ）
        manualTotalQuantity.value = ''
        manualTotalPrice.value = ''
        manualUnitCostPreview.textContent = '---'
        manualUnitCostFormula.textContent = ''

    } else {
        tabManualMode.classList.remove('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300')
        tabManualMode.classList.add('bg-blue-600', 'text-white')
        tabProductMode.classList.remove('bg-blue-600', 'text-white')
        tabProductMode.classList.add('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300')

        // セクション表示切り替え
        productModeSection.classList.add('hidden')
        manualModeSection.classList.remove('hidden')

        // 使用単位を手動モードの単位にコピー
        manualTotalUnit.value = itemUnit.value

        // 仕入れ商品モードの入力をクリア（モード固有項目のみ）
        selectedProductCode.value = ''
        selectedProductPrice.value = ''
        selectedProductIsActive.value = ''
        selectedProductText.textContent = 'クリックして商品を選択...'
        selectedProductText.classList.add('text-gray-400')
        selectedProductText.classList.remove('text-gray-800')
        productInfo.textContent = ''
        yieldQuantity.value = ''
        unitCostPreview.textContent = '---'
        unitCostFormula.textContent = ''
    }
}

// ============================================
// 手動単価プレビュー更新（作成）
// ============================================
function updateManualUnitCostPreview() {
    const qty = parseFloat(manualTotalQuantity.value) || 0
    const price = parseFloat(manualTotalPrice.value) || 0

    if (qty > 0) {
        const unitCost = price / qty
        manualUnitCostPreview.textContent = `¥${unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
        manualUnitCostFormula.textContent = `¥${price.toLocaleString()} ÷ ${qty} = ¥${unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    } else {
        manualUnitCostPreview.textContent = '---'
        manualUnitCostFormula.textContent = ''
    }
}

// ============================================
// 手動単価プレビュー更新（編集）
// ============================================
function updateEditManualUnitCostPreview() {
    const qty = parseFloat(editManualTotalQuantity.value) || 0
    const price = parseFloat(editManualTotalPrice.value) || 0

    if (qty > 0) {
        const unitCost = price / qty
        editManualUnitCostPreview.textContent = `¥${unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
        editManualUnitCostFormula.textContent = `¥${price.toLocaleString()} ÷ ${qty} = ¥${unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    } else {
        editManualUnitCostPreview.textContent = '---'
        editManualUnitCostFormula.textContent = ''
    }
}

// ============================================
// 作成フォームリセット
// ============================================
function resetCreateForm() {
    // 共通項目クリア
    itemName.value = ''
    itemKana.value = ''
    itemGenre.value = ''
    itemUnit.value = ''
    itemNeedsReview.checked = false

    // 仕入れ商品モードの項目クリア
    selectedProductCode.value = ''
    selectedProductPrice.value = ''
    selectedProductIsActive.value = ''
    selectedProductText.textContent = 'クリックして商品を選択...'
    selectedProductText.classList.add('text-gray-400')
    selectedProductText.classList.remove('text-gray-800')
    productInfo.textContent = ''
    yieldQuantity.value = ''
    unitCostPreview.textContent = '---'
    unitCostFormula.textContent = ''

    // 手動入力モードの項目クリア
    manualTotalQuantity.value = ''
    manualTotalUnit.value = ''
    manualTotalPrice.value = ''
    manualUnitCostPreview.textContent = '---'
    manualUnitCostFormula.textContent = ''

    // ボタン状態リセット
    submitCreateBtn.disabled = false
    submitCreateBtn.textContent = '作成する'

    // フィルターリセット
    productFilterMode = 'unregistered'
    const radio = document.querySelector('input[name="productFilter"][value="unregistered"]')
    if (radio) radio.checked = true
    productSearchQuery = ''
    expandedSupplier = null

    // モードを仕入れ商品モードに戻す
    switchCreateMode('product')
}

// ============================================
// 編集モーダルを開く
// ============================================
function openEditModal(itemId) {
    const item = allItems.find(i => i.item_id === itemId)
    if (!item) return

    const product = item.products

    editItemId.value = item.item_id
    editProductCode.value = item.product_code || ''
    editManualPriceModeInput.value = item.manual_price ? 'true' : 'false'

    // 手動単価モードかどうかで表示を切り替え
    if (item.manual_price) {
        // 手動単価モード
        editManualPriceInfo.classList.remove('hidden')
        editProductSelectSection.classList.add('hidden')
        editYieldQuantitySection.classList.add('hidden')
        editUnitCostPreviewSection.classList.add('hidden')

        // 総量 = yield_quantity、単位 = unit、金額 = manual_unit_cost * yield_quantity
        editManualTotalQuantity.value = item.yield_quantity || ''
        editManualTotalUnit.value = item.unit || ''
        const totalPrice = (item.manual_unit_cost || 0) * (item.yield_quantity || 1)
        editManualTotalPrice.value = totalPrice || ''

        updateEditManualUnitCostPreview()
        editProductPrice.value = ''
    } else {
        // 通常モード
        editManualPriceInfo.classList.add('hidden')
        editProductSelectSection.classList.remove('hidden')
        editYieldQuantitySection.classList.remove('hidden')
        editUnitCostPreviewSection.classList.remove('hidden')

        editProductPrice.value = product?.unit_price || 0
        editProductInfo.textContent = product
            ? `${product.supplier_name} / ${product.product_name}（${product.specification || '-'}）- ¥${(product.unit_price || 0).toLocaleString()}`
            : '（商品情報なし）'

        editManualTotalQuantity.value = ''
        editManualTotalUnit.value = ''
        editManualTotalPrice.value = ''
    }

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
    const isManualPrice = currentCreateMode === 'manual'
    const name = itemName.value.trim()
    const kana = toHalfWidthKatakana(itemKana.value.trim())
    const genreIdValue = itemGenre.value
    const unit = itemUnit.value.trim()
    const businessTypeId = getCurrentBusinessTypeId()
    const needsReview = itemNeedsReview.checked

    // 共通バリデーション
    if (!name) {
        alert('アイテム名を入力してください')
        return
    }
    if (!kana) {
        alert('読み仮名を入力してください')
        return
    }
    if (!genreIdValue) {
        alert('ジャンルを選択してください')
        return
    }
    if (!unit) {
        alert('使用単位を入力してください')
        return
    }

    // モード別バリデーション
    if (isManualPrice) {
        const manualQty = parseFloat(manualTotalQuantity.value)
        if (!manualQty || manualQty <= 0) {
            alert('総量を入力してください')
            return
        }
    } else {
        const code = selectedProductCode.value
        const qty = parseFloat(yieldQuantity.value)
        if (!code) {
            alert('仕入れ商品を選択してください')
            return
        }
        if (!qty || qty <= 0) {
            alert('取れる数を正しく入力してください')
            return
        }
    }

    submitCreateBtn.disabled = true
    submitCreateBtn.textContent = '作成中...'

    try {
        // 登録データ作成
        const insertData = {
            item_name: name,
            item_kana: kana,
            genre_id: parseInt(genreIdValue),
            unit: unit,
            business_type_id: businessTypeId,
            needs_review: needsReview,
            manual_price: isManualPrice
        }

        if (isManualPrice) {
            // 手動入力モード
            const manualQty = parseFloat(manualTotalQuantity.value)
            const manualPrice = parseFloat(manualTotalPrice.value) || 0

            insertData.product_code = null
            insertData.yield_quantity = manualQty
            insertData.manual_unit_cost = manualPrice / manualQty
        } else {
            // 仕入れ商品モード
            const code = selectedProductCode.value
            const qty = parseFloat(yieldQuantity.value)
            const isActive = selectedProductIsActive.value === 'true'

            // 使用OFFの場合は自動でONにする
            if (!isActive) {
                const { error: updateError } = await supabase
                    .from('product_business_types')
                    .update({ is_active: true })
                    .eq('product_code', code)
                    .eq('business_type_id', businessTypeId)

                if (updateError) {
                    console.error('商品フラグ更新エラー:', updateError)
                }
            }

            insertData.product_code = code
            insertData.yield_quantity = qty
            insertData.manual_unit_cost = null
        }

        const { error } = await supabase
            .from('items')
            .insert(insertData)

        if (error) throw error

        createModal.classList.add('hidden')
        resetCreateForm()
        await loadData()

    } catch (error) {
        console.error('アイテム作成エラー:', error)
        alert('作成に失敗しました: ' + error.message)
    } finally {
        submitCreateBtn.disabled = false
        submitCreateBtn.textContent = '作成する'
    }
}

// ============================================
// アイテム更新
// ============================================
async function updateItem() {
    const itemId = parseInt(editItemId.value)
    const isManualPrice = editManualPriceModeInput.value === 'true'
    const genreIdValue = editItemGenre.value
    const name = editItemName.value.trim()
    const kana = toHalfWidthKatakana(editItemKana.value.trim())
    const unit = editItemUnit.value.trim()
    const qty = parseFloat(editYieldQuantity.value)
    const needsReview = editItemNeedsReview.checked

    // 手動単価モード用
    const manualQty = parseFloat(editManualTotalQuantity.value)
    const manualUnit = editManualTotalUnit.value.trim()
    const manualPrice = parseFloat(editManualTotalPrice.value) || 0

    // バリデーション
    if (isManualPrice && (!manualQty || manualQty <= 0)) {
        alert('総量を入力してください')
        return
    }
    if (isManualPrice && !manualUnit) {
        alert('単位を入力してください')
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
    if (!isManualPrice && !unit) {
        alert('使用単位を入力してください')
        return
    }
    if (!isManualPrice && (!qty || qty <= 0)) {
        alert('取れる数を正しく入力してください')
        return
    }

    submitEditBtn.disabled = true
    submitEditBtn.textContent = '更新中...'

    // 更新データ作成
    const updateData = {
        item_name: name,
        item_kana: kana,
        genre_id: parseInt(genreIdValue),
        unit: unit,
        needs_review: needsReview
    }

    if (isManualPrice) {
        // 手動単価モード
        updateData.unit = manualUnit
        updateData.yield_quantity = manualQty
        updateData.manual_unit_cost = manualPrice / manualQty
    } else {
        // 通常モード
        updateData.unit = unit
        updateData.yield_quantity = qty

        // 商品コードが変更されているか確認
        const newProductCode = editProductCode.value
        const newProduct = allProducts.find(p => p.product_code === newProductCode)

        // 使用OFFの商品なら自動でONにする
        if (newProduct && !newProduct.is_active) {
            const { error: updateError } = await supabase
                .from('products')
                .update({ is_active: true })
                .eq('product_code', newProductCode)

            if (updateError) {
                console.error('商品フラグ更新エラー:', updateError)
            }
        }

        updateData.product_code = newProductCode
    }

    const { error } = await supabase
        .from('items')
        .update(updateData)
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

    // 仕込み品で使われているかチェック
    const { data: prepUsage, error: prepError } = await supabase
        .from('preparation_ingredients')
        .select(`
            preparation_id,
            preparations (preparation_name)
        `)
        .eq('ingredient_type', 'item')
        .eq('ingredient_id', itemId)

    if (prepError) {
        console.error('参照チェックエラー:', prepError)
        alert('削除チェックに失敗しました')
        return
    }

    // 商品で使われているかチェック
    const { data: dishUsage, error: dishError } = await supabase
        .from('dish_ingredients')
        .select(`
            dish_id,
            dishes (dish_name)
        `)
        .eq('ingredient_type', 'item')
        .eq('ingredient_id', itemId)

    if (dishError) {
        console.error('参照チェックエラー:', dishError)
        alert('削除チェックに失敗しました')
        return
    }

    // 参照先リストを作成
    const usedIn = []

    if (prepUsage) {
        prepUsage.forEach(p => {
            if (p.preparations) {
                usedIn.push(`仕込み品 / ${p.preparations.preparation_name}`)
            }
        })
    }

    if (dishUsage) {
        dishUsage.forEach(d => {
            if (d.dishes) {
                usedIn.push(`商品 / ${d.dishes.dish_name}`)
            }
        })
    }

    // 参照があれば削除禁止
    if (usedIn.length > 0) {
        alert(`削除できません。以下で使用されています：\n\n${usedIn.join('\n')}`)
        return
    }

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