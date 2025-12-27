import { supabase } from './supabase.js'
import { calculateItemUnitCost, calculatePreparationCost, getIngredientUnitCost } from './costCalculator.js'
import { initBusinessTypeSelector, getCurrentBusinessTypeId } from './businessType.js'

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

// 材料選択モーダル用
let currentTab = 'items'
let itemSearchQuery = ''
let prepSearchQuery = ''
let productSearchQuery = ''
let productSupplierFilter = ''
let productActiveFilter = 'on'
let selectedIngredients = []

// 作成/編集フォーム用
let currentIngredients = []
let isEditMode = false
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
        openIngredientModal()
    })

    // 材料選択モーダル（編集用）
    openEditIngredientModalBtn.addEventListener('click', () => {
        isEditMode = true
        openIngredientModal()
    })

    closeIngredientModalBtn.addEventListener('click', () => {
        closeIngredientModal()
    })

    // タブ切り替え
    tabItems.addEventListener('click', () => switchTab('items'))
    tabPreparations.addEventListener('click', () => switchTab('preparations'))
    tabProducts.addEventListener('click', () => switchTab('products'))

    // 材料選択モーダル内の検索
    itemSearchInput.addEventListener('input', (e) => {
        itemSearchQuery = e.target.value
        renderItemSelectList()
    })

    prepSearchInput.addEventListener('input', (e) => {
        prepSearchQuery = e.target.value
        renderPrepSelectList()
    })

    productSearchInput.addEventListener('input', (e) => {
        productSearchQuery = e.target.value
        renderProductSelectList()
    })

    // 業者フィルター
    supplierSelect.addEventListener('change', (e) => {
        productSupplierFilter = e.target.value
        renderProductSelectList()
    })

    // 使用フラグフィルター
    document.querySelectorAll('.product-active-filter').forEach(radio => {
        radio.addEventListener('change', (e) => {
            productActiveFilter = e.target.value
            renderProductSelectList()
        })
    })

    // 選択した材料を追加
    addSelectedIngredientsBtn.addEventListener('click', addSelectedIngredients)

    // クイックアイテム作成モーダル
    closeQuickItemModalBtn.addEventListener('click', () => {
        quickItemModal.classList.add('hidden')
    })

    cancelQuickItemBtn.addEventListener('click', () => {
        quickItemModal.classList.add('hidden')
    })

    quickYieldQuantity.addEventListener('input', updateQuickUnitCostPreview)

    submitQuickItemBtn.addEventListener('click', createQuickItem)

    // 読み仮名の変換（仕込み品作成・フォーカスが外れたとき)
    preparationKana.addEventListener('blur', (e) => {
        e.target.value = sanitizeToFullWidthKatakana(e.target.value)
    })

    // 読み仮名の変換（仕込み品編集・フォーカスが外れたとき）
    editPreparationKana.addEventListener('blur', (e) => {
        e.target.value = sanitizeToFullWidthKatakana(e.target.value)
    })

    // 読み仮名の変換（クイックアイテム作成・フォーカスが外れたとき）
    quickItemKana.addEventListener('blur', (e) => {
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
    let sectionsQuery = supabase
        .from('preparation_sections')
        .select('*')
        .order('sort_order', { ascending: true })

    if (businessTypeId) {
        sectionsQuery = sectionsQuery.eq('business_type_id', businessTypeId)
    }

    const { data: sections, error: sectionsError } = await sectionsQuery

    if (sectionsError) {
        console.error('セクション取得エラー:', sectionsError)
    } else {
        allSections = sections || []
        renderSectionSelect()
    }

    // ジャンル一覧を取得（業態でフィルタ）※クイックアイテム用
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
        renderQuickItemGenreSelect()
    }

    // 仕込み品一覧を取得（業態でフィルタ）
    let prepQuery = supabase
        .from('preparations')
        .select(`
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
        `)
        .order('preparation_kana', { ascending: true })

    if (businessTypeId) {
        prepQuery = prepQuery.eq('business_type_id', businessTypeId)
    }

    const { data: preparations, error: prepError } = await prepQuery

    if (prepError) {
        console.error('仕込み品取得エラー:', prepError)
        preparationList.innerHTML = '<p class="text-center text-red-500 py-8">データの取得に失敗しました</p>'
        return
    }

    // アイテム一覧を取得（業態でフィルタ）
    let itemsQuery = supabase
        .from('items')
        .select(`
            *,
            products (
                product_name,
                supplier_name,
                unit_price
            )
        `)
        .order('item_kana', { ascending: true })

    if (businessTypeId) {
        itemsQuery = itemsQuery.eq('business_type_id', businessTypeId)
    }

    const { data: items, error: itemsError } = await itemsQuery

    if (itemsError) {
        console.error('アイテム取得エラー:', itemsError)
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

    // 取引先一覧を取得（非表示でないもの）
    const { data: suppliers, error: suppliersError } = await supabase
        .from('suppliers')
        .select('*')
        .eq('is_hidden', false)
        .order('supplier_name', { ascending: true })

    if (suppliersError) {
        console.error('取引先取得エラー:', suppliersError)
    }

    allPreparations = preparations || []
    allItems = items || []
    allProducts = productsData
    allSuppliers = suppliers || []

    // 業者プルダウンを生成
    renderSupplierSelect()

    updateStats()
    renderPreparations()
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
    if (!quickItemGenre) return

    const options = '<option value="">選択してください</option>' +
        allGenres.map(g => `<option value="${g.genre_id}">${g.genre_name}</option>`).join('')

    quickItemGenre.innerHTML = options
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
// 半角カタカナ変換
// ============================================
function toHalfWidthKatakana(str) {
    let result = str.replace(/[\u3041-\u3096]/g, (match) => {
        return String.fromCharCode(match.charCodeAt(0) + 0x60)
    })

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
    let result = str.replace(/[\u3041-\u3096]/g, (match) => {
        return String.fromCharCode(match.charCodeAt(0) + 0x60)
    })
    result = result.replace(/[^ァ-ヶー]/g, '')
    return result
}

// ============================================
// 全角カタカナ変換（検索用）
// ============================================
function toFullWidthKatakana(str) {
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
    for (const [half, full] of Object.entries(dakutenMap)) {
        result = result.split(half).join(full)
    }
    result = result.split('').map(char => kanaMap[char] || char).join('')
    return result
}

// ============================================
// 検索用の正規化（全角・半角両対応）
// ============================================
function normalizeForSearch(str) {
    let result = toFullWidthKatakana(str)
    result = result.replace(/[\u3041-\u3096]/g, (match) => {
        return String.fromCharCode(match.charCodeAt(0) + 0x60)
    })
    return result
}

// ============================================
// 仕込み品の原価を計算（ラッパー関数）
// ============================================
function getPreparationCost(preparationId) {
    return calculatePreparationCost(preparationId, allItems, allPreparations)
}

// ============================================
// 材料の単位原価を取得（ラッパー関数）
// ============================================
function getIngredientUnitCostLocal(type, id) {
    return getIngredientUnitCost(type, id, allItems, allPreparations)
}

// ============================================
// 仕込み品の材料に要確認があるかチェック
// ============================================
function hasNeedsReviewIngredient(prep) {
    if (!prep.preparation_ingredients) return false

    for (const ing of prep.preparation_ingredients) {
        if (ing.ingredient_type === 'item') {
            const item = allItems.find(i => i.item_id === ing.ingredient_id)
            if (item?.needs_review) return true
        } else if (ing.ingredient_type === 'preparation') {
            const subPrep = allPreparations.find(p => p.preparation_id === ing.ingredient_id)
            if (subPrep?.needs_review) return true
            // 再帰的にチェック
            if (hasNeedsReviewIngredient(subPrep)) return true
        }
    }
    return false
}

// ============================================
// 材料の単位を取得
// ============================================
function getIngredientUnit(type, id) {
    if (type === 'item') {
        const item = allItems.find(i => i.item_id === id)
        return item?.unit || ''
    } else if (type === 'preparation') {
        const prep = allPreparations.find(p => p.preparation_id === id)
        return prep?.yield_unit || ''
    }
    return ''
}

// ============================================
// 材料の名前を取得
// ============================================
function getIngredientName(type, id) {
    if (type === 'item') {
        const item = allItems.find(i => i.item_id === id)
        return item?.item_name || '（不明）'
    } else if (type === 'preparation') {
        const prep = allPreparations.find(p => p.preparation_id === id)
        return prep?.preparation_name || '（不明）'
    }
    return '（不明）'
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
        filtered = filtered.filter(prep => hasNeedsReviewIngredient(prep))
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
            const hasIngredientReview = hasNeedsReviewIngredient(prep)
            const ingredientReviewBadge = hasIngredientReview && !prep.needs_review ? '<span class="text-xs px-2 py-0.5 bg-orange-100 text-orange-600 rounded font-bold ml-2">⚠️ 材料に要確認</span>' : ''
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
// 材料選択モーダルを開く
// ============================================
function openIngredientModal() {
    selectedIngredients = []
    itemSearchQuery = ''
    prepSearchQuery = ''
    productSearchQuery = ''
    productSupplierFilter = ''
    productActiveFilter = 'on'

    itemSearchInput.value = ''
    prepSearchInput.value = ''
    productSearchInput.value = ''
    supplierSelect.value = ''
    document.querySelector('input[name="productActiveFilter"][value="on"]').checked = true

    switchTab('items')
    updateSelectedCount()

    if (isEditMode) {
        editModal.classList.add('hidden')
    } else {
        createModal.classList.add('hidden')
    }

    ingredientModal.classList.remove('hidden')
}

// ============================================
// 材料選択モーダルを閉じる
// ============================================
function closeIngredientModal() {
    ingredientModal.classList.add('hidden')

    if (isEditMode) {
        editModal.classList.remove('hidden')
    } else {
        createModal.classList.remove('hidden')
    }
}

// ============================================
// タブ切り替え
// ============================================
function switchTab(tab) {
    currentTab = tab

    const tabs = [tabItems, tabPreparations, tabProducts]
    const contents = [tabContentItems, tabContentPreparations, tabContentProducts]
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
        renderItemSelectList()
    } else if (tab === 'preparations') {
        renderPrepSelectList()
    } else if (tab === 'products') {
        renderProductSelectList()
    }
}

// ============================================
// アイテム選択リスト表示
// ============================================
function renderItemSelectList() {
    let filtered = allItems

    if (itemSearchQuery) {
        const searchKana = toHalfWidthKatakana(itemSearchQuery)
        filtered = allItems.filter(item =>
            item.item_name.includes(itemSearchQuery) ||
            (item.item_kana && item.item_kana.includes(searchKana))
        )
    }

    if (filtered.length === 0) {
        itemSelectList.innerHTML = '<p class="text-center text-gray-500 py-8">該当するアイテムがありません</p>'
        return
    }

    itemSelectList.innerHTML = filtered.map(item => {
        const isSelected = selectedIngredients.some(s => s.type === 'item' && s.id === item.item_id)
        const unitCost = getIngredientUnitCostLocal('item', item.item_id)
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

    document.querySelectorAll('.item-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleIngredientCheckbox)
    })
}

// ============================================
// 仕込み品選択リスト表示
// ============================================
function renderPrepSelectList() {
    let filtered = allPreparations
    if (isEditMode) {
        const editingId = parseInt(editPreparationId.value)
        filtered = filtered.filter(p => p.preparation_id !== editingId)
    }

    if (prepSearchQuery) {
        const searchKana = toHalfWidthKatakana(prepSearchQuery)
        filtered = filtered.filter(prep =>
            prep.preparation_name.includes(prepSearchQuery) ||
            (prep.preparation_kana && prep.preparation_kana.includes(searchKana))
        )
    }

    if (filtered.length === 0) {
        prepSelectList.innerHTML = '<p class="text-center text-gray-500 py-8">該当する仕込み品がありません</p>'
        return
    }

    prepSelectList.innerHTML = filtered.map(prep => {
        const isSelected = selectedIngredients.some(s => s.type === 'preparation' && s.id === prep.preparation_id)
        const unitCost = getIngredientUnitCostLocal('preparation', prep.preparation_id)
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

    document.querySelectorAll('.prep-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleIngredientCheckbox)
    })
}

// ============================================
// 仕入れ商品選択リスト表示
// ============================================
let expandedProductSupplier = null

function renderProductSelectList() {
    let filtered = allProducts

    if (productSupplierFilter) {
        filtered = filtered.filter(p => p.supplier_name === productSupplierFilter)
    }

    if (productActiveFilter === 'on') {
        filtered = filtered.filter(p => p.is_active)
    } else if (productActiveFilter === 'off') {
        filtered = filtered.filter(p => !p.is_active)
    }

    if (productSearchQuery) {
        const normalizedQuery = normalizeForSearch(productSearchQuery)
        filtered = filtered.filter(p => {
            const normalizedName = normalizeForSearch(p.product_name)
            return normalizedName.includes(normalizedQuery) || p.product_name.includes(productSearchQuery)
        })
    }

    if (filtered.length === 0) {
        productSelectList.innerHTML = '<p class="text-center text-gray-500 py-8">該当する商品がありません</p>'
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
        const isExpanded = expandedProductSupplier === supplier

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

    productSelectList.innerHTML = html

    document.querySelectorAll('.product-supplier-row').forEach(row => {
        row.addEventListener('click', () => {
            const supplier = row.dataset.supplier
            expandedProductSupplier = expandedProductSupplier === supplier ? null : supplier
            renderProductSelectList()
        })
    })

    document.querySelectorAll('.product-row').forEach(row => {
        row.addEventListener('click', () => {
            openQuickItemModal(row)
        })
    })
}

// ============================================
// チェックボックス変更ハンドラ
// ============================================
function handleIngredientCheckbox(e) {
    const checkbox = e.target
    const type = checkbox.dataset.type
    const id = parseInt(checkbox.dataset.id)
    const name = checkbox.dataset.name
    const unit = checkbox.dataset.unit
    const unitCost = parseFloat(checkbox.dataset.unitCost) || 0

    if (checkbox.checked) {
        if (!selectedIngredients.some(s => s.type === type && s.id === id)) {
            selectedIngredients.push({ type, id, name, unit, unitCost })
        }
    } else {
        selectedIngredients = selectedIngredients.filter(s => !(s.type === type && s.id === id))
    }

    updateSelectedCount()
}

// ============================================
// 選択数更新
// ============================================
function updateSelectedCount() {
    const count = selectedIngredients.length
    selectedCount.textContent = `選択中: ${count}件`
    addSelectedIngredientsBtn.disabled = count === 0
}

// ============================================
// 選択した材料を追加
// ============================================
function addSelectedIngredients() {
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

    closeIngredientModal()

    if (isEditMode) {
        renderEditIngredientList()
        updateEditCostPreview()
    } else {
        renderCreateIngredientList()
        updateCreateCostPreview()
    }
}

// ============================================
// クイックアイテム作成モーダルを開く
// ============================================
function openQuickItemModal(row) {
    const code = row.dataset.code
    const name = row.dataset.name
    const spec = row.dataset.spec
    const price = parseFloat(row.dataset.price) || 0
    const supplier = row.dataset.supplier

    quickProductCode.value = code
    quickProductPrice.value = price
    quickProductInfo.textContent = `${supplier} / ${name}（${spec || '-'}）- ¥${price.toLocaleString()}`
    quickItemName.value = ''
    quickItemKana.value = ''
    quickItemUnit.value = ''
    quickYieldQuantity.value = ''
    quickUnitCostPreview.textContent = '---'
    if (quickItemGenre) quickItemGenre.value = ''
    if (quickItemNeedsReview) quickItemNeedsReview.checked = false

    quickItemModal.classList.remove('hidden')
}

// ============================================
// クイック単位原価プレビュー更新
// ============================================
function updateQuickUnitCostPreview() {
    const price = parseFloat(quickProductPrice.value) || 0
    const qty = parseFloat(quickYieldQuantity.value) || 0

    if (price > 0 && qty > 0) {
        const unitCost = calculateItemUnitCost(price, qty)
        quickUnitCostPreview.textContent = `¥${unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    } else {
        quickUnitCostPreview.textContent = '---'
    }
}

// ============================================
// クイックアイテム作成
// ============================================
async function createQuickItem() {
    const code = quickProductCode.value
    const name = quickItemName.value.trim()
    const kana = toHalfWidthKatakana(quickItemKana.value.trim())
    const unit = quickItemUnit.value.trim()
    const qty = parseFloat(quickYieldQuantity.value)
    const price = parseFloat(quickProductPrice.value) || 0
    const genreIdValue = quickItemGenre ? quickItemGenre.value : ''
    const businessTypeId = getCurrentBusinessTypeId()
    const needsReview = quickItemNeedsReview ? quickItemNeedsReview.checked : false

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

    submitQuickItemBtn.disabled = true
    submitQuickItemBtn.textContent = '作成中...'

    const product = allProducts.find(p => p.product_code === code)
    if (product && !product.is_active) {
        const { error: updateError } = await supabase
            .from('products')
            .update({ is_active: true })
            .eq('product_code', code)

        if (updateError) {
            console.error('商品フラグ更新エラー:', updateError)
        } else {
            product.is_active = true
        }
    }

    // business_type_idを追加
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

    const { data: newItem, error } = await supabase
        .from('items')
        .insert(insertData)
        .select()
        .single()

    if (error) {
        console.error('アイテム作成エラー:', error)
        alert('作成に失敗しました: ' + error.message)
        submitQuickItemBtn.disabled = false
        submitQuickItemBtn.textContent = '作成して追加'
        return
    }

    // allItemsに追加（productsも付与）
    allItems.push({
        ...newItem,
        products: product
    })

    submitQuickItemBtn.disabled = false
    submitQuickItemBtn.textContent = '作成して追加'

    alert(`✅ アイテム「${name}」を作成しました！\n\n選択リストに追加されています。`)

    quickItemModal.classList.add('hidden')

    const unitCost = calculateItemUnitCost(price, qty)
    selectedIngredients.push({
        type: 'item',
        id: newItem.item_id,
        name: name,
        unit: unit,
        unitCost: unitCost
    })

    switchTab('items')
    updateSelectedCount()
    updateStats()
}

// ============================================
// 作成フォーム：材料リスト表示
// ============================================
function renderCreateIngredientList() {
    if (currentIngredients.length === 0) {
        ingredientList.innerHTML = '<p id="noIngredientText" class="text-gray-400 text-center py-4">材料がまだ追加されていません</p>'
        return
    }

    ingredientList.innerHTML = currentIngredients.map((ing, index) => `
        <div class="flex items-center gap-3 p-2 bg-gray-50 rounded-lg mb-2">
            <span class="text-sm ${ing.type === 'item' ? 'text-blue-600' : 'text-orange-600'}">${ing.type === 'item' ? '🧩' : '🍳'}</span>
            <div class="flex-1 min-w-0">
                <div class="font-medium text-gray-800 truncate">${ing.name}</div>
                <div class="text-xs text-gray-400">¥${ing.unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })} / ${ing.unit}</div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
                <input type="number" 
                    class="ingredient-quantity w-20 p-2 border rounded text-center"
                    data-index="${index}"
                    value="${ing.quantity}"
                    step="0.01"
                    min="0.01"
                />
                <span class="text-sm text-gray-500">${ing.unit}</span>
                <button type="button" class="remove-ingredient text-red-500 hover:text-red-700 p-1" data-index="${index}">✕</button>
            </div>
        </div>
    `).join('')

    document.querySelectorAll('#ingredientList .ingredient-quantity').forEach(input => {
        input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index)
            currentIngredients[index].quantity = parseFloat(e.target.value) || 0
            updateCreateCostPreview()
        })
    })

    document.querySelectorAll('#ingredientList .remove-ingredient').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index)
            currentIngredients.splice(index, 1)
            renderCreateIngredientList()
            updateCreateCostPreview()
        })
    })
}

// ============================================
// 編集フォーム：材料リスト表示
// ============================================
function renderEditIngredientList() {
    if (currentIngredients.length === 0) {
        editIngredientList.innerHTML = '<p id="editNoIngredientText" class="text-gray-400 text-center py-4">材料がまだ追加されていません</p>'
        return
    }

    editIngredientList.innerHTML = currentIngredients.map((ing, index) => `
        <div class="flex items-center gap-3 p-2 bg-gray-50 rounded-lg mb-2">
            <span class="text-sm ${ing.type === 'item' ? 'text-blue-600' : 'text-orange-600'}">${ing.type === 'item' ? '🧩' : '🍳'}</span>
            <div class="flex-1 min-w-0">
                <div class="font-medium text-gray-800 truncate">${ing.name}</div>
                <div class="text-xs text-gray-400">¥${ing.unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })} / ${ing.unit}</div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
                <input type="number" 
                    class="edit-ingredient-quantity w-20 p-2 border rounded text-center"
                    data-index="${index}"
                    value="${ing.quantity}"
                    step="0.01"
                    min="0.01"
                />
                <span class="text-sm text-gray-500">${ing.unit}</span>
                <button type="button" class="edit-remove-ingredient text-red-500 hover:text-red-700 p-1" data-index="${index}">✕</button>
            </div>
        </div>
    `).join('')

    document.querySelectorAll('#editIngredientList .edit-ingredient-quantity').forEach(input => {
        input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index)
            currentIngredients[index].quantity = parseFloat(e.target.value) || 0
            updateEditCostPreview()
        })
    })

    document.querySelectorAll('#editIngredientList .edit-remove-ingredient').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index)
            currentIngredients.splice(index, 1)
            renderEditIngredientList()
            updateEditCostPreview()
        })
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
            name: getIngredientName(ing.ingredient_type, ing.ingredient_id),
            unit: getIngredientUnit(ing.ingredient_type, ing.ingredient_id),
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

    if (!confirm('この仕込み品を削除しますか？\n※この仕込み品を材料にしている他の仕込み品にも影響があります')) {
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