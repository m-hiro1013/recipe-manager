import { supabase } from './supabase.js'
import { calculateItemUnitCost, calculatePreparationCost, calculateDishCost, getIngredientUnitCost } from './costCalculator.js'
import { initBusinessTypeSelector, getCurrentBusinessTypeId } from './businessType.js'
import { toHalfWidthKatakana, sanitizeToFullWidthKatakana, normalizeForSearch, getIngredientName, getIngredientUnit, dishHasNeedsReviewIngredient, getNeedsReviewIngredientList, loadTaxRate, fetchAllWithPaging, withBusinessTypeFilter, renderIngredientList } from './utils.js'
import { IngredientModalManager, QuickItemModalManager } from './modalManagers.js'
// ============================================
// DOM要素の取得
// ============================================
// メイン画面
const dishList = document.getElementById('dishList')
const emptyState = document.getElementById('emptyState')
const searchInput = document.getElementById('searchInput')
const dishCount = document.getElementById('dishCount')
const ingredientCount = document.getElementById('ingredientCount')

// 作成モーダル
const createModal = document.getElementById('createModal')
const openCreateModalBtn = document.getElementById('openCreateModal')
const closeCreateModalBtn = document.getElementById('closeCreateModal')
const cancelCreateBtn = document.getElementById('cancelCreate')
const submitCreateBtn = document.getElementById('submitCreate')
const dishSection = document.getElementById('dishSection')
const dishName = document.getElementById('dishName')
const dishKana = document.getElementById('dishKana')
const ingredientList = document.getElementById('ingredientList')
const noIngredientText = document.getElementById('noIngredientText')
const openIngredientModalBtn = document.getElementById('openIngredientModal')
const totalCostPreview = document.getElementById('totalCostPreview')

// 編集モーダル
const editModal = document.getElementById('editModal')
const closeEditModalBtn = document.getElementById('closeEditModal')
const cancelEditBtn = document.getElementById('cancelEdit')
const submitEditBtn = document.getElementById('submitEdit')
const deleteDishBtn = document.getElementById('deleteDish')
const editDishId = document.getElementById('editDishId')
const editDishSection = document.getElementById('editDishSection')
const editDishName = document.getElementById('editDishName')
const editDishKana = document.getElementById('editDishKana')
const editIngredientList = document.getElementById('editIngredientList')
const editNoIngredientText = document.getElementById('editNoIngredientText')
const openEditIngredientModalBtn = document.getElementById('openEditIngredientModal')
const editTotalCostPreview = document.getElementById('editTotalCostPreview')

// ============================================
// 状態管理
// ============================================
let allDishes = []
let allItems = []
let allPreparations = []
let allProducts = []
let allSuppliers = []
let allSections = []
let allGenres = []
let taxRate = 10 // デフォルト値
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
        // 親モーダル（初期値は作成モーダル）
        parentModal: createModal,

        // データ参照
        getAllItems: () => allItems,
        getAllPreparations: () => allPreparations,
        getAllProducts: () => allProducts,
        getAllSuppliers: () => allSuppliers,
        getIngredientUnitCost: (type, id) => getIngredientUnitCostLocal(type, id),

        // 除外ID（dishesでは不要）
        getExcludePrepId: () => null,

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
        },
        onQuickItemManualCreate: () => {
            quickItemModalManager.openManualMode()
        }
    })

    // モーダルHTMLを生成（setupEventListenersはcreateModal内で自動的に呼ばれる）
    ingredientModalManager.createModal()
}

// ============================================
// クイックアイテム作成モーダルマネージャー初期化
// ============================================
function initQuickItemModalManager() {
    quickItemModalManager = new QuickItemModalManager({
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

    // モーダルHTMLを生成
    quickItemModalManager.createModal()
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

    // 売価入力時の原価率プレビュー更新（作成モーダル）
    document.getElementById('dishSellingPrice').addEventListener('input', updateCreateCostPreview)

    // 売価入力時の原価率プレビュー更新（編集モーダル）
    document.getElementById('editDishSellingPrice').addEventListener('input', updateEditCostPreview)

    // 検索
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value
        renderDishes()
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

    // ※ closeIngredientModalBtn のイベントリスナーは削除（IngredientModalManager内で管理）

    // 読み仮名の変換（商品作成・フォーカスが外れたとき）
    dishKana.addEventListener('blur', (e) => {
        e.target.value = sanitizeToFullWidthKatakana(e.target.value)
    })

    // 読み仮名の変換（商品編集・フォーカスが外れたとき）
    editDishKana.addEventListener('blur', (e) => {
        e.target.value = sanitizeToFullWidthKatakana(e.target.value)
    })

    // 作成実行
    submitCreateBtn.addEventListener('click', createDish)

    // 編集モーダル
    closeEditModalBtn.addEventListener('click', () => {
        editModal.classList.add('hidden')
    })

    cancelEditBtn.addEventListener('click', () => {
        editModal.classList.add('hidden')
    })

    // 更新実行
    submitEditBtn.addEventListener('click', updateDish)

    // 削除実行
    deleteDishBtn.addEventListener('click', deleteDish)

    // 要確認フィルター
    document.querySelectorAll('.review-filter-radio').forEach(radio => {
        radio.addEventListener('change', (e) => {
            reviewFilterMode = e.target.value
            renderDishes()
        })
    })
}

// ============================================
// データ読み込み
// ============================================
async function loadData() {
    dishList.innerHTML = '<p class="text-center text-gray-500 py-8">読み込み中...</p>'

    // 税率を取得
    taxRate = await loadTaxRate()

    const businessTypeId = getCurrentBusinessTypeId()

    // セクション一覧を取得（業態でフィルタ）
    const { data: sections, error: sectionsError } = await withBusinessTypeFilter(
        supabase.from('dish_sections').select('*').order('sort_order', { ascending: true }),
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

    // 商品一覧を取得（業態でフィルタ）
    const { data: dishes, error: dishError } = await withBusinessTypeFilter(
        supabase.from('dishes').select(`
            *,
            dish_ingredients (
                id,
                ingredient_type,
                ingredient_id,
                quantity
            ),
            dish_sections (
                section_id,
                section_name,
                sort_order
            )
        `).order('dish_kana', { ascending: true }),
        businessTypeId
    )

    if (dishError) {
        console.error('商品取得エラー:', dishError)
        dishList.innerHTML = '<p class="text-center text-red-500 py-8">データの取得に失敗しました</p>'
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

    // 仕込み品一覧を取得（業態でフィルタ）
    const { data: preparations, error: prepError } = await withBusinessTypeFilter(
        supabase.from('preparations').select(`
            *,
            preparation_ingredients (
                id,
                ingredient_type,
                ingredient_id,
                quantity
            )
        `).order('preparation_kana', { ascending: true }),
        businessTypeId
    )

    if (prepError) {
        console.error('仕込み品取得エラー:', prepError)
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
    allDishes = dishes || []
    allItems = items || []
    allPreparations = preparations || []
    allProducts = productsData
    allSuppliers = suppliers || []


    updateStats()
    renderDishes()
}

// ============================================
// セクションセレクト生成
// ============================================
function renderSectionSelect() {
    const options = '<option value="">選択してください</option>' +
        allSections.map(s => `<option value="${s.section_id}">${s.section_name}</option>`).join('')

    dishSection.innerHTML = options
    editDishSection.innerHTML = options
}

// ============================================
// クイックアイテム用ジャンルセレクト生成
// ============================================
function renderQuickItemGenreSelect() {
    if (quickItemModalManager && quickItemModalManager.isModalCreated) {
        quickItemModalManager.renderGenreSelect()
    }
}

// ============================================
// 統計情報更新
// ============================================
function updateStats() {
    dishCount.textContent = `${allDishes.length} 件`
    const totalIngredients = allItems.length + allPreparations.length
    ingredientCount.textContent = `${totalIngredients} 件`
}

// ============================================
// 商品の原価を計算（ラッパー関数）
// ============================================
function getDishCost(dishId) {
    return calculateDishCost(dishId, allItems, allPreparations, allDishes)
}


// ============================================
// 材料の単位原価を取得（ラッパー関数）
// ============================================
function getIngredientUnitCostLocal(type, id) {
    return getIngredientUnitCost(type, id, allItems, allPreparations)
}



// ============================================
// 商品一覧表示
// ============================================
function renderDishes() {
    let filtered = allDishes

    // 要確認フィルター
    if (reviewFilterMode === 'has_review_ingredient') {
        filtered = filtered.filter(dish => dishHasNeedsReviewIngredient(dish, allItems, allPreparations))
    }

    // 検索フィルタ
    if (searchQuery) {
        const searchKana = toHalfWidthKatakana(searchQuery)
        filtered = filtered.filter(dish =>
            dish.dish_name.includes(searchQuery) ||
            (dish.dish_kana && dish.dish_kana.includes(searchKana))
        )
    }

    if (filtered.length === 0) {
        dishList.innerHTML = ''
        emptyState.classList.remove('hidden')
        return
    }

    emptyState.classList.add('hidden')

    // セクションごとにグループ化
    const grouped = {}

    allSections.forEach(s => {
        grouped[s.section_id] = {
            section: s,
            dishes: []
        }
    })

    grouped['none'] = {
        section: { section_id: null, section_name: '未分類', sort_order: 9999 },
        dishes: []
    }

    filtered.forEach(dish => {
        const sectionId = dish.section_id || 'none'
        if (grouped[sectionId]) {
            grouped[sectionId].dishes.push(dish)
        } else {
            grouped['none'].dishes.push(dish)
        }
    })

    const sortedGroups = Object.values(grouped)
        .filter(g => g.dishes.length > 0)
        .sort((a, b) => a.section.sort_order - b.section.sort_order)

    let html = ''

    sortedGroups.forEach(group => {
        const sortedDishes = group.dishes.sort((a, b) => {
            const kanaA = a.dish_kana || ''
            const kanaB = b.dish_kana || ''
            return kanaA.localeCompare(kanaB, 'ja')
        })

        html += `
            <div class="mb-6">
                <h3 class="text-lg font-bold text-gray-700 mb-3 pb-2 border-b-2 border-purple-200">
                    ${group.section.section_name}
                    <span class="text-sm font-normal text-gray-400">(${sortedDishes.length}件)</span>
                </h3>
                <div class="space-y-2">
        `

        sortedDishes.forEach(dish => {
            const cost = getDishCost(dish.dish_id)
            const sellingPrice = dish.selling_price || 0
            const taxIncludedPrice = sellingPrice > 0 ? Math.round(sellingPrice * (1 + taxRate / 100)) : 0
            const costRate = sellingPrice > 0 ? (cost / sellingPrice * 100) : 0

            const hasIngredientReview = dishHasNeedsReviewIngredient(dish, allItems, allPreparations)
            const reviewList = hasIngredientReview ? getNeedsReviewIngredientList(dish.dish_ingredients, allItems, allPreparations) : []
            const reviewTooltip = reviewList.length > 0 ? `要確認:\n${reviewList.join('\n')}` : ''
            const borderClass = hasIngredientReview ? 'border-orange-300 bg-orange-50' : ''
            const ingredientReviewBadge = hasIngredientReview ? `<span class="text-xs px-2 py-0.5 bg-orange-100 text-orange-600 rounded font-bold ml-2 cursor-help" title="${reviewTooltip}">⚠️ 材料に要確認</span>` : ''

            html += `
                <div class="flex items-center p-3 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer dish-row ${borderClass}" data-dish-id="${dish.dish_id}">
                    <div class="w-48 flex-shrink-0">
                        <div class="flex items-center flex-wrap">
                            <span class="font-bold text-gray-800 truncate">${dish.dish_name}</span>
                            ${ingredientReviewBadge}
                        </div>
                        ${dish.dish_kana ? `<div class="text-xs text-gray-400">${dish.dish_kana}</div>` : ''}
                    </div>
                    <div class="flex items-center gap-6">
                        <div class="w-24 text-right">
                            <span class="text-xs text-gray-400">原価</span>
                            <span class="ml-1 font-bold text-blue-600">¥${cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                        <div class="w-48 text-right">
                            ${sellingPrice > 0 ? `
                                <span class="text-xs text-gray-400">売価</span>
                                <span class="ml-1 font-bold text-gray-800">¥${sellingPrice.toLocaleString()}</span>
                                <br><span class="text-xs text-gray-400">(税込¥${taxIncludedPrice.toLocaleString()})</span>
                            ` : `
                                <span class="text-xs text-gray-400">売価 未設定</span>
                            `}
                        </div>
                        <div class="w-36 text-right">
                            ${sellingPrice > 0 ? `
                                <span class="text-xs text-gray-400">原価率</span>
                                <span class="font-bold ${costRate > 35 ? 'text-red-600' : costRate > 30 ? 'text-orange-500' : 'text-green-600'}">${costRate.toFixed(1)}%</span>
                            ` : `
                                <span class="text-xs text-gray-400">原価率</span>
                                <span class="text-gray-300">--%</span>
                            `}
                        </div>
                    </div>
                </div>
            `
        })

        html += '</div></div>'
    })

    dishList.innerHTML = html

    // 行クリックで編集モーダル
    document.querySelectorAll('.dish-row').forEach(row => {
        row.addEventListener('click', () => {
            const dishId = parseInt(row.dataset.dishId)
            openEditModal(dishId)
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

    totalCostPreview.textContent = `¥${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`

    // 原価率プレビュー
    const sellingPrice = parseFloat(document.getElementById('dishSellingPrice').value) || 0
    const costRatePreview = document.getElementById('costRatePreview')
    const taxIncludedPreview = document.getElementById('taxIncludedPreview')

    if (sellingPrice > 0) {
        const costRate = (totalCost / sellingPrice * 100)
        const taxIncluded = Math.round(sellingPrice * (1 + taxRate / 100))
        costRatePreview.textContent = `原価率: ${costRate.toFixed(1)}%`
        costRatePreview.className = `text-sm font-bold ${costRate > 35 ? 'text-red-600' : costRate > 30 ? 'text-orange-500' : 'text-green-600'}`
        taxIncludedPreview.textContent = `税込 ¥${taxIncluded.toLocaleString()}`
    } else {
        costRatePreview.textContent = ''
        taxIncludedPreview.textContent = ''
    }
}

// ============================================
// 編集フォーム：原価プレビュー更新
// ============================================
function updateEditCostPreview() {
    const totalCost = currentIngredients.reduce((sum, ing) => {
        return sum + (ing.unitCost * (ing.quantity || 0))
    }, 0)

    editTotalCostPreview.textContent = `¥${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`

    // 原価率プレビュー
    const sellingPrice = parseFloat(document.getElementById('editDishSellingPrice').value) || 0
    const editCostRatePreview = document.getElementById('editCostRatePreview')
    const editTaxIncludedPreview = document.getElementById('editTaxIncludedPreview')

    if (sellingPrice > 0) {
        const costRate = (totalCost / sellingPrice * 100)
        const taxIncluded = Math.round(sellingPrice * (1 + taxRate / 100))
        editCostRatePreview.textContent = `原価率: ${costRate.toFixed(1)}%`
        editCostRatePreview.className = `text-sm font-bold ${costRate > 35 ? 'text-red-600' : costRate > 30 ? 'text-orange-500' : 'text-green-600'}`
        editTaxIncludedPreview.textContent = `税込 ¥${taxIncluded.toLocaleString()}`
    } else {
        editCostRatePreview.textContent = ''
        editTaxIncludedPreview.textContent = ''
    }
}

// ============================================
// 作成フォームリセット
// ============================================
function resetCreateForm() {
    dishSection.value = ''
    dishName.value = ''
    dishKana.value = ''
    document.getElementById('dishSellingPrice').value = ''
    currentIngredients = []
    renderCreateIngredientList()
    updateCreateCostPreview()
    submitCreateBtn.disabled = false
    submitCreateBtn.textContent = '作成する'
}

// ============================================
// 編集モーダルを開く
// ============================================
function openEditModal(dishId) {
    const dish = allDishes.find(d => d.dish_id === dishId)
    if (!dish) return

    editDishId.value = dish.dish_id
    editDishSection.value = dish.section_id || ''
    editDishName.value = dish.dish_name
    editDishKana.value = dish.dish_kana || ''
    document.getElementById('editDishSellingPrice').value = dish.selling_price || ''

    currentIngredients = (dish.dish_ingredients || []).map(ing => {
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
    updateEditCostPreview()

    isEditMode = true
    editModal.classList.remove('hidden')
}

// ============================================
// 商品作成
// ============================================
async function createDish() {
    const sectionIdValue = dishSection.value
    const name = dishName.value.trim()
    const kana = toHalfWidthKatakana(dishKana.value.trim())
    const sellingPriceValue = document.getElementById('dishSellingPrice').value
    const businessTypeId = getCurrentBusinessTypeId()

    if (!sectionIdValue) {
        alert('セクションを選択してください')
        return
    }
    if (!name) {
        alert('商品名を入力してください')
        return
    }
    if (!kana) {
        alert('読み仮名を入力してください')
        return
    }
    if (currentIngredients.length === 0) {
        alert('材料を1つ以上追加してください')
        return
    }

    submitCreateBtn.disabled = true
    submitCreateBtn.textContent = '作成中...'

    // business_type_idを追加
    const insertData = {
        dish_name: name,
        dish_kana: kana,
        section_id: parseInt(sectionIdValue),
        business_type_id: businessTypeId
    }

    // 売価が入力されていれば追加
    if (sellingPriceValue && parseFloat(sellingPriceValue) > 0) {
        insertData.selling_price = parseFloat(sellingPriceValue)
    }

    const { data: newDish, error: dishError } = await supabase
        .from('dishes')
        .insert(insertData)
        .select()
        .single()

    if (dishError) {
        console.error('商品作成エラー:', dishError)
        alert('作成に失敗しました: ' + dishError.message)
        submitCreateBtn.disabled = false
        submitCreateBtn.textContent = '作成する'
        return
    }

    const ingredientsToInsert = currentIngredients.map(ing => ({
        dish_id: newDish.dish_id,
        ingredient_type: ing.type,
        ingredient_id: ing.id,
        quantity: ing.quantity
    }))

    const { error: ingError } = await supabase
        .from('dish_ingredients')
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
// 商品更新
// ============================================
async function updateDish() {
    const dishId = parseInt(editDishId.value)
    const sectionIdValue = editDishSection.value
    const name = editDishName.value.trim()
    const kana = toHalfWidthKatakana(editDishKana.value.trim())
    const sellingPriceValue = document.getElementById('editDishSellingPrice').value

    if (!sectionIdValue) {
        alert('セクションを選択してください')
        return
    }
    if (!name) {
        alert('商品名を入力してください')
        return
    }
    if (!kana) {
        alert('読み仮名を入力してください')
        return
    }
    if (currentIngredients.length === 0) {
        alert('材料を1つ以上追加してください')
        return
    }

    submitEditBtn.disabled = true
    submitEditBtn.textContent = '更新中...'

    const updateData = {
        dish_name: name,
        dish_kana: kana,
        section_id: parseInt(sectionIdValue)
    }

    // 売価を設定（空欄ならnull）
    if (sellingPriceValue && parseFloat(sellingPriceValue) > 0) {
        updateData.selling_price = parseFloat(sellingPriceValue)
    } else {
        updateData.selling_price = null
    }

    const { error: dishError } = await supabase
        .from('dishes')
        .update(updateData)
        .eq('dish_id', dishId)

    if (dishError) {
        console.error('商品更新エラー:', dishError)
        alert('更新に失敗しました: ' + dishError.message)
        submitEditBtn.disabled = false
        submitEditBtn.textContent = '更新する'
        return
    }

    const { error: deleteError } = await supabase
        .from('dish_ingredients')
        .delete()
        .eq('dish_id', dishId)

    if (deleteError) {
        console.error('材料削除エラー:', deleteError)
    }

    const ingredientsToInsert = currentIngredients.map(ing => ({
        dish_id: dishId,
        ingredient_type: ing.type,
        ingredient_id: ing.id,
        quantity: ing.quantity
    }))

    const { error: ingError } = await supabase
        .from('dish_ingredients')
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
// 商品削除
// ============================================
async function deleteDish() {
    const dishId = parseInt(editDishId.value)

    // コースで使われているかチェック
    const { data: courseUsage, error: courseError } = await supabase
        .from('course_items')
        .select(`
            course_id,
            courses (course_name)
        `)
        .eq('dish_id', dishId)

    if (courseError) {
        console.error('参照チェックエラー:', courseError)
        alert('削除チェックに失敗しました')
        return
    }

    // 参照先リストを作成
    const usedIn = []

    if (courseUsage) {
        courseUsage.forEach(c => {
            if (c.courses) {
                usedIn.push(`コース / ${c.courses.course_name}`)
            }
        })
    }

    // 参照があれば削除禁止
    if (usedIn.length > 0) {
        alert(`削除できません。以下で使用されています：\n\n${usedIn.join('\n')}`)
        return
    }

    if (!confirm('この商品を削除しますか？')) {
        return
    }

    const { error } = await supabase
        .from('dishes')
        .delete()
        .eq('dish_id', dishId)

    if (error) {
        console.error('商品削除エラー:', error)
        alert('削除に失敗しました: ' + error.message)
        return
    }

    editModal.classList.add('hidden')
    await loadData()
}