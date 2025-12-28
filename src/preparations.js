import { supabase } from './supabase.js'
import { calculateItemUnitCost, calculatePreparationCost, getIngredientUnitCost } from './costCalculator.js'
import { initBusinessTypeSelector, getCurrentBusinessTypeId } from './businessType.js'
import { toHalfWidthKatakana, sanitizeToFullWidthKatakana, normalizeForSearch, getIngredientName, getIngredientUnit, prepHasNeedsReviewIngredient, getNeedsReviewIngredientList, fetchAllWithPaging, withBusinessTypeFilter, IngredientModalManager, QuickItemModalManager, renderIngredientList } from './utils.js'
// ============================================
// DOM要素の取得
// ============================================
// メイン画面
const preparationList = document.getElementById('preparationList')
const emptyState = document.getElementById('emptyState')
const searchInput = document.getElementById('searchInput')
const preparationCount = document.getElementById('preparationCount')
const itemCount = document.getElementById('itemCount')

// 作成モーダル
const createModal = document.getElementById('createModal')
const openCreateModalBtn = document.getElementById('openCreateModal')
const closeCreateModalBtn = document.getElementById('closeCreateModal')
const cancelCreateBtn = document.getElementById('cancelCreate')
const submitCreateBtn = document.getElementById('submitCreate')
const preparationName = document.getElementById('preparationName')
const preparationKana = document.getElementById('preparationKana')
const yieldQuantity = document.getElementById('yieldQuantity')
const yieldUnit = document.getElementById('yieldUnit')
const ingredientList = document.getElementById('ingredientList')
const noIngredientText = document.getElementById('noIngredientText')
const openIngredientModalBtn = document.getElementById('openIngredientModal')
const totalCostPreview = document.getElementById('totalCostPreview')
const unitCostPreview = document.getElementById('unitCostPreview')
const preparationSection = document.getElementById('preparationSection')
const preparationNeedsReview = document.getElementById('preparationNeedsReview')

// 材料選択モーダル
const ingredientModal = document.getElementById('ingredientModal')
const closeIngredientModalBtn = document.getElementById('closeIngredientModal')
const tabItems = document.getElementById('tabItems')
const tabPreparations = document.getElementById('tabPreparations')
const tabProducts = document.getElementById('tabProducts')
const tabContentItems = document.getElementById('tabContentItems')
const tabContentPreparations = document.getElementById('tabContentPreparations')
const tabContentProducts = document.getElementById('tabContentProducts')
const itemSearchInput = document.getElementById('itemSearchInput')
const prepSearchInput = document.getElementById('prepSearchInput')
const productSearchInput = document.getElementById('productSearchInput')
const supplierSelect = document.getElementById('supplierSelect')
const itemSelectList = document.getElementById('itemSelectList')
const prepSelectList = document.getElementById('prepSelectList')
const productSelectList = document.getElementById('productSelectList')
const selectedCount = document.getElementById('selectedCount')
const addSelectedIngredientsBtn = document.getElementById('addSelectedIngredients')

// クイックアイテム作成モーダル
const quickItemModal = document.getElementById('quickItemModal')
const closeQuickItemModalBtn = document.getElementById('closeQuickItemModal')
const cancelQuickItemBtn = document.getElementById('cancelQuickItem')
const submitQuickItemBtn = document.getElementById('submitQuickItem')
const quickProductCode = document.getElementById('quickProductCode')
const quickProductPrice = document.getElementById('quickProductPrice')
const quickProductInfo = document.getElementById('quickProductInfo')
const quickItemName = document.getElementById('quickItemName')
const quickItemKana = document.getElementById('quickItemKana')
const quickItemUnit = document.getElementById('quickItemUnit')
const quickYieldQuantity = document.getElementById('quickYieldQuantity')
const quickUnitCostPreview = document.getElementById('quickUnitCostPreview')
const quickItemGenre = document.getElementById('quickItemGenre')
const quickItemNeedsReview = document.getElementById('quickItemNeedsReview')

// 編集モーダル
const editModal = document.getElementById('editModal')
const closeEditModalBtn = document.getElementById('closeEditModal')
const cancelEditBtn = document.getElementById('cancelEdit')
const submitEditBtn = document.getElementById('submitEdit')
const deletePreparationBtn = document.getElementById('deletePreparation')
const editPreparationId = document.getElementById('editPreparationId')
const editPreparationName = document.getElementById('editPreparationName')
const editPreparationKana = document.getElementById('editPreparationKana')
const editYieldQuantity = document.getElementById('editYieldQuantity')
const editYieldUnit = document.getElementById('editYieldUnit')
const editIngredientList = document.getElementById('editIngredientList')
const editNoIngredientText = document.getElementById('editNoIngredientText')
const openEditIngredientModalBtn = document.getElementById('openEditIngredientModal')
const editTotalCostPreview = document.getElementById('editTotalCostPreview')
const editUnitCostPreview = document.getElementById('editUnitCostPreview')
const editPreparationSection = document.getElementById('editPreparationSection')
const editPreparationNeedsReview = document.getElementById('editPreparationNeedsReview')

// ============================================
// 状態管理
// ============================================
let allPreparations = []
let allItems = []
let allProducts = []
let allSuppliers = []
let allSections = []
let allGenres = []
let searchQuery = ''

// 作成/編集フォーム用
let currentIngredients = []
let isEditMode = false
let reviewFilterMode = 'all'

// 共通モジュールのインスタンス
let ingredientModalManager = null
let quickItemModalManager = null

// ============================================
// 初期化
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    // 業態セレクタを初期化（変更時にデータ再読み込み）
    await initBusinessTypeSelector(onBusinessTypeChange)

    // 共通モジュールを初期化
    initIngredientModalManager()
    initQuickItemModalManager()

    await loadData()
    setupEventListeners()
})

// ============================================
// 材料選択モーダルマネージャー初期化
// ============================================
function initIngredientModalManager() {
    ingredientModalManager = new IngredientModalManager({
        // DOM要素
        ingredientModal: document.getElementById('ingredientModal'),
        parentModal: createModal, // 初期値は作成モーダル
        tabItems: document.getElementById('tabItems'),
        tabPreparations: document.getElementById('tabPreparations'),
        tabProducts: document.getElementById('tabProducts'),
        tabContentItems: document.getElementById('tabContentItems'),
        tabContentPreparations: document.getElementById('tabContentPreparations'),
        tabContentProducts: document.getElementById('tabContentProducts'),
        itemSearchInput: document.getElementById('itemSearchInput'),
        prepSearchInput: document.getElementById('prepSearchInput'),
        productSearchInput: document.getElementById('productSearchInput'),
        supplierSelect: document.getElementById('supplierSelect'),
        itemSelectList: document.getElementById('itemSelectList'),
        prepSelectList: document.getElementById('prepSelectList'),
        productSelectList: document.getElementById('productSelectList'),
        selectedCount: document.getElementById('selectedCount'),
        addSelectedIngredientsBtn: document.getElementById('addSelectedIngredients'),

        // データ参照
        getAllItems: () => allItems,
        getAllPreparations: () => allPreparations,
        getAllProducts: () => allProducts,
        getAllSuppliers: () => allSuppliers,
        getIngredientUnitCost: (type, id) => getIngredientUnitCostLocal(type, id),

        // 除外ID（編集中の仕込み品を除外）
        getExcludePrepId: () => isEditMode ? parseInt(editPreparationId.value) : null,

        // コールバック
        onIngredientsAdded: (selectedIngredients) => {
            for (const ing of selectedIngredients) {
                const exists = currentIngredients.some(c => c.type === ing.type && c.id === ing.id)
                if (!exists) {
                    currentIngredients.push({
                        type: ing.type,
                        id: ing.id,
                        name: ing.name,
                        unit: ing.unit,
                        unitCost: ing.unitCost,
                        quantity: 1
                    })
                }
            }

            if (isEditMode) {
                renderEditIngredientList()
                updateEditCostPreview()
            } else {
                renderCreateIngredientList()
                updateCreateCostPreview()
            }
        },
        onQuickItemCreate: (row) => {
            quickItemModalManager.open(row)
        }
    })

    ingredientModalManager.setupEventListeners()
}

// ============================================
// クイックアイテム作成モーダルマネージャー初期化
// ============================================
function initQuickItemModalManager() {
    quickItemModalManager = new QuickItemModalManager({
        // DOM要素
        quickItemModal: document.getElementById('quickItemModal'),
        closeQuickItemModalBtn: document.getElementById('closeQuickItemModal'),
        cancelQuickItemBtn: document.getElementById('cancelQuickItem'),
        submitQuickItemBtn: document.getElementById('submitQuickItem'),
        quickProductCode: document.getElementById('quickProductCode'),
        quickProductPrice: document.getElementById('quickProductPrice'),
        quickProductInfo: document.getElementById('quickProductInfo'),
        quickItemName: document.getElementById('quickItemName'),
        quickItemKana: document.getElementById('quickItemKana'),
        quickItemUnit: document.getElementById('quickItemUnit'),
        quickYieldQuantity: document.getElementById('quickYieldQuantity'),
        quickUnitCostPreview: document.getElementById('quickUnitCostPreview'),
        quickItemGenre: document.getElementById('quickItemGenre'),
        quickItemNeedsReview: document.getElementById('quickItemNeedsReview'),

        // データ参照
        getAllProducts: () => allProducts,
        getAllGenres: () => allGenres,
        getBusinessTypeId: () => getCurrentBusinessTypeId(),
        supabase: supabase,

        // コールバック
        onItemCreated: (newItem, product, ingredientData) => {
            // allItemsに追加
            allItems.push({
                ...newItem,
                products: product
            })

            // 選択済みに追加
            ingredientModalManager.addToSelected(ingredientData)
            ingredientModalManager.switchTab('items')
            updateStats()
        }
    })

    quickItemModalManager.setupEventListeners()
}

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
        renderPreparations()
    })

    // 作成モーダル
    openCreateModalBtn.addEventListener('click', () => {
        resetCreateForm()
        isEditMode = false
        createModal.classList.remove('hidden')
    })

    closeCreateModalBtn.addEventListener('click', () => {
        createModal.classList.add('hidden')
    })

    cancelCreateBtn.addEventListener('click', () => {
        createModal.classList.add('hidden')
    })

    // 材料選択モーダル（作成用）
    openIngredientModalBtn.addEventListener('click', () => {
        isEditMode = false
        ingredientModalManager.setParentModal(createModal)
        ingredientModalManager.open()
    })

    // 材料選択モーダル（編集用）
    openEditIngredientModalBtn.addEventListener('click', () => {
        isEditMode = true
        ingredientModalManager.setParentModal(editModal)
        ingredientModalManager.open()
    })

    closeIngredientModalBtn.addEventListener('click', () => {
        ingredientModalManager.close()
    })

    // 読み仮名の変換（仕込み品作成・フォーカスが外れたとき)
    preparationKana.addEventListener('blur', (e) => {
        e.target.value = sanitizeToFullWidthKatakana(e.target.value)
    })

    // 読み仮名の変換（仕込み品編集・フォーカスが外れたとき）
    editPreparationKana.addEventListener('blur', (e) => {
        e.target.value = sanitizeToFullWidthKatakana(e.target.value)
    })

    // 原価プレビュー更新
    yieldQuantity.addEventListener('input', updateCreateCostPreview)
    editYieldQuantity.addEventListener('input', updateEditCostPreview)

    // 作成実行
    submitCreateBtn.addEventListener('click', createPreparation)

    // 編集モーダル
    closeEditModalBtn.addEventListener('click', () => {
        editModal.classList.add('hidden')
    })

    cancelEditBtn.addEventListener('click', () => {
        editModal.classList.add('hidden')
    })

    // 更新実行
    submitEditBtn.addEventListener('click', updatePreparation)

    // 削除実行
    deletePreparationBtn.addEventListener('click', deletePreparation)

    // 要確認フィルター
    document.querySelectorAll('.review-filter-radio').forEach(radio => {
        radio.addEventListener('change', (e) => {
            reviewFilterMode = e.target.value
            renderPreparations()
        })
    })
}

// ============================================
// データ読み込み
// ============================================
async function loadData() {
    preparationList.innerHTML = '<p class="text-center text-gray-500 py-8">読み込み中...</p>'

    const businessTypeId = getCurrentBusinessTypeId()

    // セクション一覧を取得（業態でフィルタ）
    const { data: sections, error: sectionsError } = await withBusinessTypeFilter(
        supabase.from('preparation_sections').select('*').order('sort_order', { ascending: true }),
        businessTypeId
    )

    if (sectionsError) {
        console.error('セクション取得エラー:', sectionsError)
    } else {
        allSections = sections || []
        renderSectionSelect()
    }

    // ジャンル一覧を取得（業態でフィルタ）※クイックアイテム用
    const { data: genres, error: genresError } = await withBusinessTypeFilter(
        supabase.from('item_genres').select('*').order('sort_order', { ascending: true }),
        businessTypeId
    )

    if (genresError) {
        console.error('ジャンル取得エラー:', genresError)
    } else {
        allGenres = genres || []
        renderQuickItemGenreSelect()
    }

    // 仕込み品一覧を取得（業態でフィルタ）
    const { data: preparations, error: prepError } = await withBusinessTypeFilter(
        supabase.from('preparations').select(`
            *,
            preparation_ingredients (
                id,
                ingredient_type,
                ingredient_id,
                quantity
            ),
            preparation_sections (
                section_id,
                section_name,
                sort_order
            )
        `).order('preparation_kana', { ascending: true }),
        businessTypeId
    )

    if (prepError) {
        console.error('仕込み品取得エラー:', prepError)
        preparationList.innerHTML = '<p class="text-center text-red-500 py-8">データの取得に失敗しました</p>'
        return
    }

    // アイテム一覧を取得（業態でフィルタ）
    const { data: items, error: itemsError } = await withBusinessTypeFilter(
        supabase.from('items').select(`
            *,
            products (
                product_name,
                supplier_name,
                unit_price
            )
        `).order('item_kana', { ascending: true }),
        businessTypeId
    )

    if (itemsError) {
        console.error('アイテム取得エラー:', itemsError)
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

    // 取引先一覧を取得（業態ごとの非表示設定をJOIN）
    const { data: suppliers, error: suppliersError } = await supabase
        .from('suppliers')
        .select('*, supplier_business_types!inner(is_hidden)')
        .eq('supplier_business_types.business_type_id', businessTypeId)
        .eq('supplier_business_types.is_hidden', false)
        .order('supplier_name', { ascending: true })

    if (suppliersError) {
        console.error('取引先取得エラー:', suppliersError)
    }

    // 業者プルダウンを生成
    renderSupplierSelect()

    updateStats()
    renderPreparations()
}

// ============================================
// 材料の単位原価を取得（ラッパー関数）
// ============================================
function getIngredientUnitCostLocal(type, id) {
    return getIngredientUnitCost(type, id, allItems, allPreparations)
}

// ============================================
// セクションセレクト生成
// ============================================
function renderSectionSelect() {
    const options = '<option value="">選択してください</option>' +
        allSections.map(s => `<option value="${s.section_id}">${s.section_name}</option>`).join('')

    preparationSection.innerHTML = options
    editPreparationSection.innerHTML = options
}

// ============================================
// クイックアイテム用ジャンルセレクト生成
// ============================================
function renderQuickItemGenreSelect() {
    if (quickItemModalManager) {
        quickItemModalManager.renderGenreSelect()
    }
}

// ============================================
// 統計情報更新
// ============================================
function updateStats() {
    preparationCount.textContent = `${allPreparations.length} 件`
    itemCount.textContent = `${allItems.length} 件`
}

// ============================================
// 業者プルダウン生成
// ============================================
function renderSupplierSelect() {
    supplierSelect.innerHTML = '<option value="">全て</option>'
    allSuppliers.forEach(supplier => {
        supplierSelect.innerHTML += `<option value="${supplier.supplier_name}">${supplier.supplier_name}</option>`
    })
}


// ============================================
// 仕込み品の原価を計算（ラッパー関数）
// ============================================
function getPreparationCost(preparationId) {
    return calculatePreparationCost(preparationId, allItems, allPreparations)
}

// ============================================
// 仕込み品一覧表示
// ============================================
function renderPreparations() {
    let filtered = allPreparations

    // 要確認フィルター
    if (reviewFilterMode === 'needs_review') {
        filtered = filtered.filter(prep => prep.needs_review)
    } else if (reviewFilterMode === 'has_review_ingredient') {
        filtered = filtered.filter(prep => prepHasNeedsReviewIngredient(prep, allItems, allPreparations))
    }

    // 検索フィルタ
    if (searchQuery) {
        const searchKana = toHalfWidthKatakana(searchQuery)
        filtered = filtered.filter(prep =>
            prep.preparation_name.includes(searchQuery) ||
            (prep.preparation_kana && prep.preparation_kana.includes(searchKana))
        )
    }

    if (filtered.length === 0) {
        preparationList.innerHTML = ''
        emptyState.classList.remove('hidden')
        return
    }

    emptyState.classList.add('hidden')

    // セクションごとにグループ化
    const grouped = {}

    allSections.forEach(s => {
        grouped[s.section_id] = {
            section: s,
            preparations: []
        }
    })

    grouped['none'] = {
        section: { section_id: null, section_name: '未分類', sort_order: 9999 },
        preparations: []
    }

    filtered.forEach(prep => {
        const sectionId = prep.section_id || 'none'
        if (grouped[sectionId]) {
            grouped[sectionId].preparations.push(prep)
        } else {
            grouped['none'].preparations.push(prep)
        }
    })

    const sortedGroups = Object.values(grouped)
        .filter(g => g.preparations.length > 0)
        .sort((a, b) => a.section.sort_order - b.section.sort_order)

    let html = ''

    sortedGroups.forEach(group => {
        const sortedPreps = group.preparations.sort((a, b) => {
            const kanaA = a.preparation_kana || ''
            const kanaB = b.preparation_kana || ''
            return kanaA.localeCompare(kanaB, 'ja')
        })

        html += `
            <div class="mb-6">
                <h3 class="text-lg font-bold text-gray-700 mb-3 pb-2 border-b-2 border-orange-200">
                    ${group.section.section_name}
                    <span class="text-sm font-normal text-gray-400">(${sortedPreps.length}件)</span>
                </h3>
                <div class="space-y-2">
        `

        sortedPreps.forEach(prep => {
            const ingredientCnt = prep.preparation_ingredients?.length || 0
            const cost = getPreparationCost(prep.preparation_id)
            const unitCost = prep.yield_quantity > 0 ? cost / prep.yield_quantity : 0

            const needsReviewClass = prep.needs_review ? 'text-red-600' : 'text-gray-800'
            const needsReviewBadge = prep.needs_review ? '<span class="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded font-bold ml-2">要確認</span>' : ''
            const hasIngredientReview = prepHasNeedsReviewIngredient(prep, allItems, allPreparations)
            const reviewList = hasIngredientReview ? getNeedsReviewIngredientList(prep.preparation_ingredients, allItems, allPreparations) : []
            const reviewTooltip = reviewList.length > 0 ? `要確認:\n${reviewList.join('\n')}` : ''
            const ingredientReviewBadge = hasIngredientReview && !prep.needs_review ? `<span class="text-xs px-2 py-0.5 bg-orange-100 text-orange-600 rounded font-bold ml-2 cursor-help" title="${reviewTooltip}">⚠️ 材料に要確認</span>` : ''
            const borderClass = prep.needs_review ? 'border-red-300 bg-red-50' : (hasIngredientReview ? 'border-orange-300 bg-orange-50' : '')

            html += `
                <div class="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer preparation-row ${borderClass}" data-preparation-id="${prep.preparation_id}">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-3 mb-1 flex-wrap">
                            <span class="font-bold ${needsReviewClass} truncate">${prep.preparation_name}</span>
                            ${needsReviewBadge}
                            ${ingredientReviewBadge}
                            <span class="text-sm px-2 py-0.5 bg-orange-100 text-orange-700 rounded flex-shrink-0">${prep.yield_unit}</span>
                        </div>
                        ${prep.preparation_kana ? `<div class="text-xs text-gray-400 mb-1">${prep.preparation_kana}</div>` : ''}
                        <div class="text-sm text-gray-500">
                            材料: ${ingredientCnt}種類 / 仕上がり: ${prep.yield_quantity}${prep.yield_unit}
                        </div>
                    </div>
                    <div class="text-right flex-shrink-0 ml-4">
                        <div class="text-lg font-bold ${prep.needs_review ? 'text-red-600' : 'text-blue-600'}">¥${cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                        <div class="text-xs text-gray-400">¥${unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })} / ${prep.yield_unit}</div>
                    </div>
                </div>
            `
        })

        html += '</div></div>'
    })

    preparationList.innerHTML = html

    document.querySelectorAll('.preparation-row').forEach(row => {
        row.addEventListener('click', () => {
            const prepId = parseInt(row.dataset.preparationId)
            openEditModal(prepId)
        })
    })
}

// ============================================
// 作成フォーム：材料リスト表示
// ============================================
function renderCreateIngredientList() {
    renderIngredientList({
        container: ingredientList,
        ingredients: currentIngredients,
        inputClass: 'ingredient-quantity',
        removeClass: 'remove-ingredient',
        onQuantityChange: (index, value) => {
            currentIngredients[index].quantity = value
            updateCreateCostPreview()
        },
        onRemove: (index) => {
            currentIngredients.splice(index, 1)
            renderCreateIngredientList()
            updateCreateCostPreview()
        }
    })
}

// ============================================
// 編集フォーム：材料リスト表示
// ============================================
function renderEditIngredientList() {
    renderIngredientList({
        container: editIngredientList,
        ingredients: currentIngredients,
        inputClass: 'edit-ingredient-quantity',
        removeClass: 'edit-remove-ingredient',
        onQuantityChange: (index, value) => {
            currentIngredients[index].quantity = value
            updateEditCostPreview()
        },
        onRemove: (index) => {
            currentIngredients.splice(index, 1)
            renderEditIngredientList()
            updateEditCostPreview()
        }
    })
}
// ============================================
// 作成フォーム：原価プレビュー更新
// ============================================
function updateCreateCostPreview() {
    const totalCost = currentIngredients.reduce((sum, ing) => {
        return sum + (ing.unitCost * (ing.quantity || 0))
    }, 0)

    const yieldQty = parseFloat(yieldQuantity.value) || 0
    const unit = yieldUnit.value || ''

    totalCostPreview.textContent = `¥${totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`

    if (yieldQty > 0) {
        const unitCost = totalCost / yieldQty
        unitCostPreview.textContent = `1${unit}あたり: ¥${unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    } else {
        unitCostPreview.textContent = ''
    }
}

// ============================================
// 編集フォーム：原価プレビュー更新
// ============================================
function updateEditCostPreview() {
    const totalCost = currentIngredients.reduce((sum, ing) => {
        return sum + (ing.unitCost * (ing.quantity || 0))
    }, 0)

    const yieldQty = parseFloat(editYieldQuantity.value) || 0
    const unit = editYieldUnit.value || ''

    editTotalCostPreview.textContent = `¥${totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`

    if (yieldQty > 0) {
        const unitCost = totalCost / yieldQty
        editUnitCostPreview.textContent = `1${unit}あたり: ¥${unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    } else {
        editUnitCostPreview.textContent = ''
    }
}

// ============================================
// 作成フォームリセット
// ============================================
function resetCreateForm() {
    preparationSection.value = ''
    preparationName.value = ''
    preparationKana.value = ''
    yieldQuantity.value = ''
    yieldUnit.value = ''
    currentIngredients = []
    renderCreateIngredientList()
    updateCreateCostPreview()
    preparationNeedsReview.checked = false
    submitCreateBtn.disabled = false
    submitCreateBtn.textContent = '作成する'
}

// ============================================
// 編集モーダルを開く
// ============================================
function openEditModal(prepId) {
    const prep = allPreparations.find(p => p.preparation_id === prepId)
    if (!prep) return

    editPreparationId.value = prep.preparation_id
    editPreparationSection.value = prep.section_id || ''
    editPreparationName.value = prep.preparation_name
    editPreparationKana.value = prep.preparation_kana || ''
    editYieldQuantity.value = prep.yield_quantity
    editYieldUnit.value = prep.yield_unit

    currentIngredients = (prep.preparation_ingredients || []).map(ing => {
        return {
            type: ing.ingredient_type,
            id: ing.ingredient_id,
            name: getIngredientName(ing.ingredient_type, ing.ingredient_id, allItems, allPreparations),
            unit: getIngredientUnit(ing.ingredient_type, ing.ingredient_id, allItems, allPreparations),
            unitCost: getIngredientUnitCostLocal(ing.ingredient_type, ing.ingredient_id),
            quantity: ing.quantity
        }
    })

    renderEditIngredientList()
    editPreparationNeedsReview.checked = prep.needs_review || false
    updateEditCostPreview()

    isEditMode = true
    editModal.classList.remove('hidden')
}

// ============================================
// 仕込み品作成
// ============================================
async function createPreparation() {
    const sectionIdValue = preparationSection.value
    const name = preparationName.value.trim()
    const kana = toHalfWidthKatakana(preparationKana.value.trim())
    const yieldQty = parseFloat(yieldQuantity.value)
    const unit = yieldUnit.value.trim()
    const businessTypeId = getCurrentBusinessTypeId()
    const needsReview = preparationNeedsReview.checked

    if (!sectionIdValue) {
        alert('セクションを選択してください')
        return
    }
    if (!name) {
        alert('仕込み品名を入力してください')
        return
    }
    if (!kana) {
        alert('読み仮名を入力してください')
        return
    }
    if (!yieldQty || yieldQty <= 0) {
        alert('仕上がり量を正しく入力してください')
        return
    }
    if (!unit) {
        alert('仕上がり単位を入力してください')
        return
    }
    if (currentIngredients.length === 0) {
        alert('材料を1つ以上追加してください')
        return
    }

    submitCreateBtn.disabled = true
    submitCreateBtn.textContent = '作成中...'

    // business_type_idを追加
    const { data: newPrep, error: prepError } = await supabase
        .from('preparations')
        .insert({
            preparation_name: name,
            preparation_kana: kana,
            section_id: parseInt(sectionIdValue),
            yield_quantity: yieldQty,
            yield_unit: unit,
            business_type_id: businessTypeId,
            needs_review: needsReview
        })
        .select()
        .single()

    if (prepError) {
        console.error('仕込み品作成エラー:', prepError)
        alert('作成に失敗しました: ' + prepError.message)
        submitCreateBtn.disabled = false
        submitCreateBtn.textContent = '作成する'
        return
    }

    const ingredientsToInsert = currentIngredients.map(ing => ({
        preparation_id: newPrep.preparation_id,
        ingredient_type: ing.type,
        ingredient_id: ing.id,
        quantity: ing.quantity
    }))

    const { error: ingError } = await supabase
        .from('preparation_ingredients')
        .insert(ingredientsToInsert)

    if (ingError) {
        console.error('材料登録エラー:', ingError)
        alert('材料の登録に失敗しました: ' + ingError.message)
    }

    createModal.classList.add('hidden')
    resetCreateForm()
    await loadData()
}

// ============================================
// 仕込み品更新
// ============================================
async function updatePreparation() {
    const prepId = parseInt(editPreparationId.value)
    const sectionIdValue = editPreparationSection.value
    const name = editPreparationName.value.trim()
    const kana = toHalfWidthKatakana(editPreparationKana.value.trim())
    const yieldQty = parseFloat(editYieldQuantity.value)
    const unit = editYieldUnit.value.trim()
    const needsReview = editPreparationNeedsReview.checked

    if (!sectionIdValue) {
        alert('セクションを選択してください')
        return
    }
    if (!name) {
        alert('仕込み品名を入力してください')
        return
    }
    if (!kana) {
        alert('読み仮名を入力してください')
        return
    }
    if (!yieldQty || yieldQty <= 0) {
        alert('仕上がり量を正しく入力してください')
        return
    }
    if (!unit) {
        alert('仕上がり単位を入力してください')
        return
    }
    if (currentIngredients.length === 0) {
        alert('材料を1つ以上追加してください')
        return
    }

    submitEditBtn.disabled = true
    submitEditBtn.textContent = '更新中...'

    const { error: prepError } = await supabase
        .from('preparations')
        .update({
            preparation_name: name,
            preparation_kana: kana,
            section_id: parseInt(sectionIdValue),
            yield_quantity: yieldQty,
            yield_unit: unit,
            needs_review: needsReview
        })
        .eq('preparation_id', prepId)

    if (prepError) {
        console.error('仕込み品更新エラー:', prepError)
        alert('更新に失敗しました: ' + prepError.message)
        submitEditBtn.disabled = false
        submitEditBtn.textContent = '更新する'
        return
    }

    const { error: deleteError } = await supabase
        .from('preparation_ingredients')
        .delete()
        .eq('preparation_id', prepId)

    if (deleteError) {
        console.error('材料削除エラー:', deleteError)
    }

    const ingredientsToInsert = currentIngredients.map(ing => ({
        preparation_id: prepId,
        ingredient_type: ing.type,
        ingredient_id: ing.id,
        quantity: ing.quantity
    }))

    const { error: ingError } = await supabase
        .from('preparation_ingredients')
        .insert(ingredientsToInsert)

    if (ingError) {
        console.error('材料登録エラー:', ingError)
        alert('材料の登録に失敗しました: ' + ingError.message)
    }

    editModal.classList.add('hidden')
    submitEditBtn.disabled = false
    submitEditBtn.textContent = '更新する'
    await loadData()
}

// ============================================
// 仕込み品削除
// ============================================
async function deletePreparation() {
    const prepId = parseInt(editPreparationId.value)

    // 他の仕込み品で使われているかチェック
    const { data: prepUsage, error: prepError } = await supabase
        .from('preparation_ingredients')
        .select(`
            preparation_id,
            preparations (preparation_name)
        `)
        .eq('ingredient_type', 'preparation')
        .eq('ingredient_id', prepId)

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
        .eq('ingredient_type', 'preparation')
        .eq('ingredient_id', prepId)

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

    if (!confirm('この仕込み品を削除しますか？')) {
        return
    }

    const { error } = await supabase
        .from('preparations')
        .delete()
        .eq('preparation_id', prepId)

    if (error) {
        console.error('仕込み品削除エラー:', error)
        alert('削除に失敗しました: ' + error.message)
        return
    }

    editModal.classList.add('hidden')
    await loadData()
}