import { supabase } from './supabase.js'
import { calculateDishCost, getIngredientUnitCost } from './costCalculator.js'
import { initBusinessTypeSelector, getCurrentBusinessTypeId } from './businessType.js'
import { toHalfWidthKatakana, sanitizeToFullWidthKatakana, dishHasNeedsReviewIngredient, getNeedsReviewIngredientList, loadTaxRate, withBusinessTypeFilter } from './utils.js'

// ============================================
// DOM要素の取得
// ============================================
// メイン画面
const courseList = document.getElementById('courseList')
const emptyState = document.getElementById('emptyState')
const searchInput = document.getElementById('searchInput')
const courseCount = document.getElementById('courseCount')
const dishCountEl = document.getElementById('dishCount')

// 作成モーダル
const createModal = document.getElementById('createModal')
const openCreateModalBtn = document.getElementById('openCreateModal')
const closeCreateModalBtn = document.getElementById('closeCreateModal')
const cancelCreateBtn = document.getElementById('cancelCreate')
const submitCreateBtn = document.getElementById('submitCreate')
const courseName = document.getElementById('courseName')
const courseKana = document.getElementById('courseKana')
const courseSellingPrice = document.getElementById('courseSellingPrice')
const courseItemList = document.getElementById('courseItemList')
const noItemText = document.getElementById('noItemText')
const openDishModalBtn = document.getElementById('openDishModal')
const totalCostPreview = document.getElementById('totalCostPreview')
const costRatePreview = document.getElementById('costRatePreview')
const taxExcludedPreview = document.getElementById('taxExcludedPreview')
const courseIsActive = document.getElementById('courseIsActive')

// 商品選択モーダル
const dishModal = document.getElementById('dishModal')
const closeDishModalBtn = document.getElementById('closeDishModal')
const dishSearchInput = document.getElementById('dishSearchInput')
const dishSelectList = document.getElementById('dishSelectList')
const selectedDishCount = document.getElementById('selectedDishCount')
const addSelectedDishesBtn = document.getElementById('addSelectedDishes')

// 編集モーダル
const editModal = document.getElementById('editModal')
const closeEditModalBtn = document.getElementById('closeEditModal')
const cancelEditBtn = document.getElementById('cancelEdit')
const submitEditBtn = document.getElementById('submitEdit')
const deleteCourseBtn = document.getElementById('deleteCourse')
const editCourseId = document.getElementById('editCourseId')
const editCourseName = document.getElementById('editCourseName')
const editCourseKana = document.getElementById('editCourseKana')
const editCourseSellingPrice = document.getElementById('editCourseSellingPrice')
const editCourseItemList = document.getElementById('editCourseItemList')
const editNoItemText = document.getElementById('editNoItemText')
const openEditDishModalBtn = document.getElementById('openEditDishModal')
const editTotalCostPreview = document.getElementById('editTotalCostPreview')
const editCostRatePreview = document.getElementById('editCostRatePreview')
const editTaxExcludedPreview = document.getElementById('editTaxExcludedPreview')
const editCourseIsActive = document.getElementById('editCourseIsActive')

// ============================================
// 状態管理
// ============================================
let allCourses = []
let allDishes = []
let allItems = []
let allPreparations = []
let taxRate = 10
let searchQuery = ''

// 商品選択モーダル用
let dishSearchQuery = ''
let selectedDishes = []

// 作成/編集フォーム用
let currentCourseItems = [] // { dish_id, dish_name, portion, cost, sort_order }
let isEditMode = false
let movingItemIndex = null // 移動モード中のアイテムindex
let reviewFilterMode = 'all'

// ============================================
// 初期化
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
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
        renderCourses()
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

    // 売価入力時のプレビュー更新
    courseSellingPrice.addEventListener('input', updateCreateCostPreview)
    editCourseSellingPrice.addEventListener('input', updateEditCostPreview)

    // 商品選択モーダル（作成用）
    openDishModalBtn.addEventListener('click', () => {
        isEditMode = false
        openDishModal()
    })

    // 商品選択モーダル（編集用）
    openEditDishModalBtn.addEventListener('click', () => {
        isEditMode = true
        openDishModal()
    })

    closeDishModalBtn.addEventListener('click', () => {
        closeDishModal()
    })

    // 商品検索
    dishSearchInput.addEventListener('input', (e) => {
        dishSearchQuery = e.target.value
        renderDishSelectList()
    })

    // 選択した商品を追加
    addSelectedDishesBtn.addEventListener('click', addSelectedDishes)

    // 読み仮名の変換
    courseKana.addEventListener('blur', (e) => {
        e.target.value = sanitizeToFullWidthKatakana(e.target.value)
    })

    editCourseKana.addEventListener('blur', (e) => {
        e.target.value = sanitizeToFullWidthKatakana(e.target.value)
    })

    // 作成実行
    submitCreateBtn.addEventListener('click', createCourse)

    // 編集モーダル
    closeEditModalBtn.addEventListener('click', () => {
        editModal.classList.add('hidden')
    })

    cancelEditBtn.addEventListener('click', () => {
        editModal.classList.add('hidden')
    })

    // 更新実行
    submitEditBtn.addEventListener('click', updateCourse)

    // 削除実行
    deleteCourseBtn.addEventListener('click', deleteCourse)

    // 要確認フィルター
    document.querySelectorAll('.review-filter-radio').forEach(radio => {
        radio.addEventListener('change', (e) => {
            reviewFilterMode = e.target.value
            renderCourses()
        })
    })
}
// ============================================
// コースに要確認商品が含まれるかチェック
// ============================================
function courseHasNeedsReviewDish(course) {
    if (!course.course_items) return false

    for (const item of course.course_items) {
        const dish = allDishes.find(d => d.dish_id === item.dish_id)
        if (dishHasNeedsReviewIngredient(dish, allItems, allPreparations)) return true
    }
    return false
}

// ============================================
// 要確認の材料リストを取得（コース用）
// ============================================
function getNeedsReviewListForCourse(course) {
    const reviewList = []
    if (!course.course_items) return reviewList

    for (const item of course.course_items) {
        const dish = allDishes.find(d => d.dish_id === item.dish_id)
        if (dish?.dish_ingredients) {
            const dishReviewList = getNeedsReviewIngredientList(dish.dish_ingredients, allItems, allPreparations)
            for (const r of dishReviewList) {
                if (!reviewList.includes(r)) {
                    reviewList.push(r)
                }
            }
        }
    }
    return reviewList
}
// ============================================
// データ読み込み
// ============================================
async function loadData() {
    courseList.innerHTML = '<p class="text-center text-gray-500 py-8">読み込み中...</p>'

    taxRate = await loadTaxRate()

    const businessTypeId = getCurrentBusinessTypeId()

    // コース一覧を取得
    const { data: courses, error: courseError } = await withBusinessTypeFilter(
        supabase.from('courses').select(`
            *,
            course_items (
                id,
                dish_id,
                portion,
                sort_order
            )
        `).order('sort_order', { ascending: true }),
        businessTypeId
    )

    if (courseError) {
        console.error('コース取得エラー:', courseError)
        courseList.innerHTML = '<p class="text-center text-red-500 py-8">データの取得に失敗しました</p>'
        return
    }

    // 商品一覧を取得
    const { data: dishes, error: dishError } = await withBusinessTypeFilter(
        supabase.from('dishes').select(`
            *,
            dish_ingredients (
                id,
                ingredient_type,
                ingredient_id,
                quantity
            )
        `).order('dish_kana', { ascending: true }),
        businessTypeId
    )

    if (dishError) {
        console.error('商品取得エラー:', dishError)
        return
    }

    // アイテム一覧を取得
    const { data: items, error: itemsError } = await withBusinessTypeFilter(
        supabase.from('items').select(`
            *,
            products (
                product_name,
                supplier_name,
                unit_price
            )
        `),
        businessTypeId
    )

    if (itemsError) {
        console.error('アイテム取得エラー:', itemsError)
        return
    }

    // 仕込み品一覧を取得
    const { data: preparations, error: prepError } = await withBusinessTypeFilter(
        supabase.from('preparations').select(`
            *,
            preparation_ingredients (
                id,
                ingredient_type,
                ingredient_id,
                quantity
            )
        `),
        businessTypeId
    )

    if (prepError) {
        console.error('仕込み品取得エラー:', prepError)
        return
    }

    allCourses = courses || []
    allDishes = dishes || []
    allItems = items || []
    allPreparations = preparations || []

    updateStats()
    renderCourses()
}

// ============================================
// 統計情報更新
// ============================================
function updateStats() {
    courseCount.textContent = `${allCourses.length} 件`
    dishCountEl.textContent = `${allDishes.length} 件`
}



// ============================================
// 商品の原価を取得
// ============================================
function getDishCost(dishId) {
    return calculateDishCost(dishId, allItems, allPreparations, allDishes)
}

// ============================================
// コースの原価を計算
// ============================================
function calculateCourseCost(courseItems) {
    let total = 0
    for (const item of courseItems) {
        const dishCost = getDishCost(item.dish_id)
        total += dishCost * (item.portion || 1)
    }
    return total
}

// ============================================
// コース一覧表示
// ============================================
function renderCourses() {
    let filtered = allCourses

    // 要確認フィルター
    if (reviewFilterMode === 'has_review_dish') {
        filtered = filtered.filter(course => courseHasNeedsReviewDish(course))
    }

    // 検索フィルタ
    if (searchQuery) {
        const searchKana = toHalfWidthKatakana(searchQuery)
        filtered = filtered.filter(course =>
            course.course_name.includes(searchQuery) ||
            (course.course_kana && course.course_kana.includes(searchKana))
        )
    }

    if (filtered.length === 0) {
        courseList.innerHTML = ''
        emptyState.classList.remove('hidden')
        return
    }

    emptyState.classList.add('hidden')

    // 実施中 / 未実施 に分ける
    const activeCourses = filtered.filter(c => c.is_active !== false)
    const inactiveCourses = filtered.filter(c => c.is_active === false)

    // 金額順にソート
    activeCourses.sort((a, b) => (a.selling_price || 0) - (b.selling_price || 0))
    inactiveCourses.sort((a, b) => (a.selling_price || 0) - (b.selling_price || 0))

    let html = ''

    // 実施中コース
    if (activeCourses.length > 0) {
        html += `
            <div class="mb-6">
                <h3 class="text-lg font-bold text-gray-700 mb-3 pb-2 border-b-2 border-green-200 flex items-center gap-2">
                    <span class="text-green-600">●</span> 実施中コース
                    <span class="text-sm font-normal text-gray-400">(${activeCourses.length}件)</span>
                </h3>
                <div class="space-y-2">
        `
        activeCourses.forEach(course => {
            html += renderCourseRow(course)
        })
        html += '</div></div>'
    }

    // 未実施コース
    if (inactiveCourses.length > 0) {
        html += `
            <div class="mb-6">
                <h3 class="text-lg font-bold text-gray-700 mb-3 pb-2 border-b-2 border-gray-300 flex items-center gap-2">
                    <span class="text-gray-400">○</span> 未実施コース
                    <span class="text-sm font-normal text-gray-400">(${inactiveCourses.length}件)</span>
                </h3>
                <div class="space-y-2">
        `
        inactiveCourses.forEach(course => {
            html += renderCourseRow(course, true)
        })
        html += '</div></div>'
    }

    courseList.innerHTML = html

    // ヘッダークリックでアコーディオン展開
    document.querySelectorAll('.course-header').forEach(header => {
        header.addEventListener('click', () => {
            const courseId = parseInt(header.dataset.courseId)
            toggleCourseAccordion(courseId)
        })
    })
}

// ============================================
// コース行を描画
// ============================================
function renderCourseRow(course, isInactive = false) {
    const cost = calculateCourseCost(course.course_items || [])
    const sellingPrice = course.selling_price || 0
    const taxExcludedPrice = sellingPrice > 0 ? Math.round(sellingPrice / (1 + taxRate / 100)) : 0
    const costRate = taxExcludedPrice > 0 ? (cost / taxExcludedPrice * 100) : 0
    const itemCount = (course.course_items || []).length

    const hasReviewDish = courseHasNeedsReviewDish(course)
    const reviewList = hasReviewDish ? getNeedsReviewListForCourse(course) : []
    const reviewTooltip = reviewList.length > 0 ? `要確認:\n${reviewList.join('\n')}` : ''
    const reviewBadge = hasReviewDish ? `<span class="text-xs px-2 py-0.5 bg-orange-100 text-orange-600 rounded font-bold ml-2 cursor-help" title="${reviewTooltip}">⚠️ 商品に要確認</span>` : ''
    const borderClass = hasReviewDish ? 'border-orange-300 bg-orange-50' : ''

    return `
        <div class="course-card ${borderClass}" data-course-id="${course.course_id}">
            <div class="flex items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer course-header" data-course-id="${course.course_id}">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-3 flex-wrap">
                        <span class="font-bold text-gray-800 text-lg">${course.course_name}</span>
                        ${reviewBadge}
                        <span class="text-sm text-gray-400">${itemCount}品</span>
                    </div>
                    ${course.course_kana ? `<div class="text-xs text-gray-400 mt-1">${course.course_kana}</div>` : ''}
                </div>
                <div class="flex items-center gap-6">
                    <div class="text-right">
                        <div class="font-bold text-xl text-gray-800">¥${sellingPrice.toLocaleString()}</div>
                        <div class="text-xs text-gray-400">(税込)</div>
                    </div>
                    <div class="text-right w-20">
                        <div class="font-bold text-blue-600">¥${cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        <div class="text-xs text-gray-400">原価</div>
                    </div>
                    <div class="text-right w-20">
                        ${taxExcludedPrice > 0 ? `
                            <div class="font-bold ${costRate > 35 ? 'text-red-600' : costRate > 30 ? 'text-orange-500' : 'text-green-600'}">${costRate.toFixed(1)}%</div>
                            <div class="text-xs text-gray-400">原価率</div>
                        ` : `
                            <div class="text-gray-300">--%</div>
                        `}
                    </div>
                </div>
            </div>
            <div class="course-detail hidden" data-course-id="${course.course_id}">
                <!-- 展開時にJSで中身を入れる -->
            </div>
        </div>
    `
}
// ============================================
// コースアコーディオン開閉
// ============================================
function toggleCourseAccordion(courseId) {
    const detailEl = document.querySelector(`.course-detail[data-course-id="${courseId}"]`)
    if (!detailEl) return

    const isOpen = !detailEl.classList.contains('hidden')

    if (isOpen) {
        // 閉じる
        detailEl.style.maxHeight = detailEl.scrollHeight + 'px'
        detailEl.offsetHeight // reflow
        detailEl.style.maxHeight = '0'
        detailEl.style.overflow = 'hidden'
        setTimeout(() => {
            detailEl.classList.add('hidden')
            detailEl.style.maxHeight = ''
            detailEl.style.overflow = ''
        }, 300)
    } else {
        // 開く
        const course = allCourses.find(c => c.course_id === courseId)
        if (!course) return

        detailEl.innerHTML = renderCourseDetail(course)
        detailEl.classList.remove('hidden')
        detailEl.style.maxHeight = '0'
        detailEl.style.overflow = 'hidden'
        detailEl.offsetHeight // reflow
        detailEl.style.transition = 'max-height 0.3s ease-out'
        detailEl.style.maxHeight = detailEl.scrollHeight + 'px'

        setTimeout(() => {
            detailEl.style.maxHeight = 'none'
            detailEl.style.overflow = ''
            detailEl.style.transition = ''
        }, 300)

        // イベントリスナー設定
        setupCourseDetailListeners(courseId)
    }
}

// ============================================
// コース詳細（展開時の中身）を描画
// ============================================
function renderCourseDetail(course) {
    const items = course.course_items || []
    const sorted = [...items].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

    let html = `
        <div class="border border-t-0 rounded-b-lg bg-gray-50 p-4">
            <!-- 見出し -->
            <div class="flex items-center text-sm text-gray-500 font-bold mb-2 px-2">
                <div class="flex-1">商品名</div>
                <div class="w-20 text-center">分量</div>
                <div class="w-24 text-right">原価</div>
            </div>
            <div class="border-t border-gray-200 mb-2"></div>
            <!-- 商品リスト -->
    `

    for (const item of sorted) {
        const dish = allDishes.find(d => d.dish_id === item.dish_id)
        const dishName = dish ? dish.dish_name : '（不明な商品）'
        const dishCost = dish ? getDishCost(dish.dish_id) : 0
        const portionCost = dishCost * (item.portion || 1)
        const portionDisplay = item.portion === 1 ? '×1' : `×${item.portion}`

        html += `
            <div class="flex items-center py-2 px-2 hover:bg-gray-100 rounded">
                <div class="flex-1 font-medium text-gray-800">${dishName}</div>
                <div class="w-20 text-center text-gray-600">${portionDisplay}</div>
                <div class="w-24 text-right font-bold text-blue-600">¥${portionCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            </div>
        `
    }

    html += `
            <div class="border-t border-gray-200 mt-2 mb-3"></div>
            <!-- ボタン -->
            <div class="flex justify-center gap-4">
                <button type="button" class="close-detail-btn px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors">
                    閉じる
                </button>
                <button type="button" class="edit-course-btn px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors" data-course-id="${course.course_id}">
                    編集
                </button>
            </div>
        </div>
    `

    return html
}

// ============================================
// コース詳細のイベントリスナー設定
// ============================================
function setupCourseDetailListeners(courseId) {
    const detailEl = document.querySelector(`.course-detail[data-course-id="${courseId}"]`)
    if (!detailEl) return

    // 閉じるボタン
    detailEl.querySelector('.close-detail-btn')?.addEventListener('click', () => {
        toggleCourseAccordion(courseId)
    })

    // 編集ボタン
    detailEl.querySelector('.edit-course-btn')?.addEventListener('click', () => {
        openEditModal(courseId)
    })
}

// ============================================
// 商品選択モーダルを開く
// ============================================
function openDishModal() {
    selectedDishes = []
    dishSearchQuery = ''
    dishSearchInput.value = ''

    renderDishSelectList()
    updateSelectedDishCount()

    if (isEditMode) {
        editModal.classList.add('hidden')
    } else {
        createModal.classList.add('hidden')
    }

    dishModal.classList.remove('hidden')
}

// ============================================
// 商品選択モーダルを閉じる
// ============================================
function closeDishModal() {
    dishModal.classList.add('hidden')

    if (isEditMode) {
        editModal.classList.remove('hidden')
    } else {
        createModal.classList.remove('hidden')
    }
}

// ============================================
// 商品選択リスト表示
// ============================================
function renderDishSelectList() {
    let filtered = allDishes

    if (dishSearchQuery) {
        const searchKana = toHalfWidthKatakana(dishSearchQuery)
        filtered = allDishes.filter(dish =>
            dish.dish_name.includes(dishSearchQuery) ||
            (dish.dish_kana && dish.dish_kana.includes(searchKana))
        )
    }

    if (filtered.length === 0) {
        dishSelectList.innerHTML = '<p class="text-center text-gray-500 py-8">該当する商品がありません</p>'
        return
    }

    dishSelectList.innerHTML = filtered.map(dish => {
        const isSelected = selectedDishes.some(s => s.dish_id === dish.dish_id)
        const cost = getDishCost(dish.dish_id)
        return `
            <label class="flex items-center gap-4 p-3 rounded-lg hover:bg-blue-50 cursor-pointer border-b border-gray-100 ${isSelected ? 'bg-blue-50' : ''}">
                <input type="checkbox" 
                    class="dish-checkbox w-5 h-5 text-blue-600 rounded"
                    data-dish-id="${dish.dish_id}"
                    data-dish-name="${dish.dish_name}"
                    data-cost="${cost}"
                    ${isSelected ? 'checked' : ''}
                />
                <div class="flex-1 min-w-0">
                    <div class="font-medium text-gray-800 truncate">${dish.dish_name}</div>
                    <div class="text-xs text-gray-400">${dish.dish_kana || ''}</div>
                </div>
                <div class="text-right flex-shrink-0">
                    <div class="font-bold text-gray-700">¥${cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    <div class="text-xs text-gray-400">原価</div>
                </div>
            </label>
        `
    }).join('')

    document.querySelectorAll('.dish-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleDishCheckbox)
    })
}

// ============================================
// 商品チェックボックス変更ハンドラ
// ============================================
function handleDishCheckbox(e) {
    const checkbox = e.target
    const dishId = parseInt(checkbox.dataset.dishId)
    const dishName = checkbox.dataset.dishName
    const cost = parseFloat(checkbox.dataset.cost) || 0

    if (checkbox.checked) {
        if (!selectedDishes.some(s => s.dish_id === dishId)) {
            selectedDishes.push({ dish_id: dishId, dish_name: dishName, cost })
        }
    } else {
        selectedDishes = selectedDishes.filter(s => s.dish_id !== dishId)
    }

    updateSelectedDishCount()
}

// ============================================
// 選択数更新
// ============================================
function updateSelectedDishCount() {
    const count = selectedDishes.length
    selectedDishCount.textContent = `選択中: ${count}件`
    addSelectedDishesBtn.disabled = count === 0
}

// ============================================
// 選択した商品を追加
// ============================================
function addSelectedDishes() {
    for (const dish of selectedDishes) {
        const exists = currentCourseItems.some(c => c.dish_id === dish.dish_id)
        if (!exists) {
            currentCourseItems.push({
                dish_id: dish.dish_id,
                dish_name: dish.dish_name,
                portion: 1,
                cost: dish.cost,
                sort_order: currentCourseItems.length
            })
        }
    }

    closeDishModal()

    if (isEditMode) {
        renderEditCourseItemList()
        updateEditCostPreview()
    } else {
        renderCreateCourseItemList()
        updateCreateCostPreview()
    }
}

// ============================================
// 作成フォーム：商品リスト表示
// ============================================
function renderCreateCourseItemList() {
    if (currentCourseItems.length === 0) {
        courseItemList.innerHTML = '<p id="noItemText" class="text-gray-400 text-center py-4">商品がまだ追加されていません</p>'
        return
    }

    // sort_order順にソート
    const sorted = [...currentCourseItems].sort((a, b) => a.sort_order - b.sort_order)

    // 移動モード中
    if (movingItemIndex !== null) {
        const movingItem = currentCourseItems[movingItemIndex]
        const movingItemSortedIndex = sorted.findIndex(item =>
            item.dish_id === movingItem.dish_id && item.sort_order === movingItem.sort_order
        )

        courseItemList.innerHTML = `
            <div class="mb-3 p-3 bg-yellow-50 border-2 border-yellow-400 rounded-lg">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="text-yellow-600 font-bold">📍</span>
                        <span class="font-medium text-gray-800">「${movingItem.dish_name}」を移動中</span>
                    </div>
                    <button type="button" class="cancel-move-btn text-sm text-gray-500 hover:text-gray-700 px-3 py-1 border rounded">
                        キャンセル
                    </button>
                </div>
            </div>
            ${renderMoveTargets(sorted, movingItemSortedIndex)}
        `

        setupMoveTargetListeners('create', sorted, movingItemSortedIndex)
        return
    }

    // 通常表示
    courseItemList.innerHTML = sorted.map((item) => {
        const cost = getDishCost(item.dish_id)
        const portionCost = cost * (item.portion || 1)
        const actualIndex = currentCourseItems.findIndex(c => c.dish_id === item.dish_id && c.sort_order === item.sort_order)

        return `
            <div class="p-3 bg-gray-50 rounded-lg mb-2">
                <div class="flex items-center gap-3">
                    <button type="button" class="move-btn text-gray-400 hover:text-blue-600 cursor-pointer" data-index="${actualIndex}" title="移動">
                        ↕️
                    </button>
                    <div class="flex-1 min-w-0">
                        <div class="font-medium text-gray-800 truncate">${item.dish_name}</div>
                        <div class="text-xs text-gray-400">単価 ¥${cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                        <span class="text-sm text-gray-500">×</span>
                        <input type="number" 
                            class="portion-input w-20 p-2 border rounded text-center"
                            data-index="${actualIndex}"
                            value="${item.portion}"
                            step="0.25"
                            min="0.25"
                        />
                    </div>
                    <div class="w-24 text-right">
                        <div class="font-bold text-blue-600">¥${portionCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    </div>
                    <button type="button" class="remove-item-btn text-red-500 hover:text-red-700 p-1" data-index="${actualIndex}">✕</button>
                </div>
            </div>
        `
    }).join('')

    setupCourseItemListeners('create')
}
// ============================================
// 編集フォーム：商品リスト表示
// ============================================
function renderEditCourseItemList() {
    if (currentCourseItems.length === 0) {
        editCourseItemList.innerHTML = '<p id="editNoItemText" class="text-gray-400 text-center py-4">商品がまだ追加されていません</p>'
        return
    }

    // sort_order順にソート
    const sorted = [...currentCourseItems].sort((a, b) => a.sort_order - b.sort_order)

    // 移動モード中
    if (movingItemIndex !== null) {
        const movingItem = currentCourseItems[movingItemIndex]
        const movingItemSortedIndex = sorted.findIndex(item =>
            item.dish_id === movingItem.dish_id && item.sort_order === movingItem.sort_order
        )

        editCourseItemList.innerHTML = `
            <div class="mb-3 p-3 bg-yellow-50 border-2 border-yellow-400 rounded-lg">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="text-yellow-600 font-bold">📍</span>
                        <span class="font-medium text-gray-800">「${movingItem.dish_name}」を移動中</span>
                    </div>
                    <button type="button" class="cancel-move-btn text-sm text-gray-500 hover:text-gray-700 px-3 py-1 border rounded">
                        キャンセル
                    </button>
                </div>
            </div>
            ${renderMoveTargets(sorted, movingItemSortedIndex)}
        `

        setupMoveTargetListeners('edit', sorted, movingItemSortedIndex)
        return
    }

    // 通常表示
    editCourseItemList.innerHTML = sorted.map((item) => {
        const cost = getDishCost(item.dish_id)
        const portionCost = cost * (item.portion || 1)
        const actualIndex = currentCourseItems.findIndex(c => c.dish_id === item.dish_id && c.sort_order === item.sort_order)

        return `
            <div class="p-3 bg-gray-50 rounded-lg mb-2">
                <div class="flex items-center gap-3">
                    <button type="button" class="move-btn text-gray-400 hover:text-blue-600 cursor-pointer" data-index="${actualIndex}" title="移動">
                        ↕️
                    </button>
                    <div class="flex-1 min-w-0">
                        <div class="font-medium text-gray-800 truncate">${item.dish_name}</div>
                        <div class="text-xs text-gray-400">単価 ¥${cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                        <span class="text-sm text-gray-500">×</span>
                        <input type="number" 
                            class="portion-input w-20 p-2 border rounded text-center"
                            data-index="${actualIndex}"
                            value="${item.portion}"
                            step="0.25"
                            min="0.25"
                        />
                    </div>
                    <div class="w-24 text-right">
                        <div class="font-bold text-blue-600">¥${portionCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    </div>
                    <button type="button" class="remove-item-btn text-red-500 hover:text-red-700 p-1" data-index="${actualIndex}">✕</button>
                </div>
            </div>
        `
    }).join('')

    setupCourseItemListeners('edit')
}
// ============================================
// 移動先ターゲットを描画
// ============================================
function renderMoveTargets(sorted, movingIndex) {
    const movingItem = sorted[movingIndex]

    let html = ''

    // 一番上の挿入ポイント（移動元が一番上じゃない場合のみ）
    if (movingIndex !== 0) {
        html += `
            <div class="move-target flex items-center gap-2 py-2 cursor-pointer group" data-target-position="0">
                <span class="text-blue-500 group-hover:text-blue-700">→</span>
                <div class="flex-1 border-t-2 border-dashed border-blue-400 group-hover:border-blue-600"></div>
                <span class="text-xs text-blue-500 group-hover:text-blue-700">ここに移動</span>
            </div>
        `
    }

    // 各商品と挿入ポイント
    sorted.forEach((item, index) => {
        const cost = getDishCost(item.dish_id)
        const portionCost = cost * (item.portion || 1)
        const isMovingItem = index === movingIndex

        // 商品表示
        if (isMovingItem) {
            // 移動中のアイテム（黄色ハイライト）
            html += `
                <div class="p-3 bg-yellow-100 border-2 border-yellow-400 rounded-lg">
                    <div class="flex items-center gap-3">
                        <span class="text-yellow-600">📍</span>
                        <div class="flex-1 min-w-0">
                            <div class="font-medium text-gray-800 truncate">${item.dish_name}</div>
                            <div class="text-xs text-yellow-600">この商品を移動中...</div>
                        </div>
                        <div class="w-24 text-right">
                            <div class="font-bold text-yellow-600">¥${portionCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        </div>
                    </div>
                </div>
            `
        } else {
            // 他の商品（グレー表示）
            html += `
                <div class="p-3 bg-gray-100 rounded-lg">
                    <div class="flex items-center gap-3">
                        <div class="w-6"></div>
                        <div class="flex-1 min-w-0">
                            <div class="font-medium text-gray-600 truncate">${item.dish_name}</div>
                        </div>
                        <div class="w-24 text-right">
                            <div class="font-bold text-gray-400">¥${portionCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        </div>
                    </div>
                </div>
            `
        }

        // 挿入ポイント（移動元の直後と、移動元自身の位置には表示しない）
        const isNextToMoving = index === movingIndex || index === movingIndex - 1
        if (!isNextToMoving && index < sorted.length - 1) {
            html += `
                <div class="move-target flex items-center gap-2 py-2 cursor-pointer group" data-target-position="${index + 1}">
                    <span class="text-blue-500 group-hover:text-blue-700">→</span>
                    <div class="flex-1 border-t-2 border-dashed border-blue-400 group-hover:border-blue-600"></div>
                    <span class="text-xs text-blue-500 group-hover:text-blue-700">ここに移動</span>
                </div>
            `
        }

        // 一番下の挿入ポイント（移動元が一番下じゃない場合のみ）
        if (index === sorted.length - 1 && movingIndex !== sorted.length - 1) {
            html += `
                <div class="move-target flex items-center gap-2 py-2 cursor-pointer group" data-target-position="${sorted.length}">
                    <span class="text-blue-500 group-hover:text-blue-700">→</span>
                    <div class="flex-1 border-t-2 border-dashed border-blue-400 group-hover:border-blue-600"></div>
                    <span class="text-xs text-blue-500 group-hover:text-blue-700">ここに移動</span>
                </div>
            `
        }
    })

    return html
}
// ============================================
// 移動先のイベントリスナー設定
// ============================================
function setupMoveTargetListeners(mode, sorted, movingItemSortedIndex) {
    const container = mode === 'create' ? courseItemList : editCourseItemList

    // キャンセルボタン
    container.querySelectorAll('.cancel-move-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            movingItemIndex = null
            if (mode === 'create') {
                renderCreateCourseItemList()
            } else {
                renderEditCourseItemList()
            }
        })
    })

    // 移動先クリック
    container.querySelectorAll('.move-target').forEach(target => {
        target.addEventListener('click', () => {
            const targetPosition = parseInt(target.dataset.targetPosition)

            // 移動中のアイテムを取り出す
            const movingItem = currentCourseItems[movingItemIndex]

            // 移動中アイテムを除いた配列（ソート済み）
            const filteredSorted = sorted.filter((_, index) => index !== movingItemSortedIndex)

            // 新しい順序で配列を再構築
            const newOrder = []
            filteredSorted.forEach((item, index) => {
                if (index === targetPosition) {
                    newOrder.push(movingItem)
                }
                newOrder.push(item)
            })
            // 一番最後に挿入する場合
            if (targetPosition >= filteredSorted.length) {
                newOrder.push(movingItem)
            }

            // sort_orderを振り直し
            newOrder.forEach((item, i) => {
                item.sort_order = i
            })

            // currentCourseItemsを更新
            currentCourseItems = newOrder

            movingItemIndex = null

            if (mode === 'create') {
                renderCreateCourseItemList()
            } else {
                renderEditCourseItemList()
            }
        })
    })
}
// ============================================
// 商品リストのイベントリスナー設定（通常モード）
// ============================================
function setupCourseItemListeners(mode) {
    const container = mode === 'create' ? courseItemList : editCourseItemList

    // ポーション入力
    container.querySelectorAll('.portion-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index)
            currentCourseItems[index].portion = parseFloat(e.target.value) || 1
            if (mode === 'create') {
                updateCreateCostPreview()
            } else {
                updateEditCostPreview()
            }
        })
    })

    // 削除ボタン
    container.querySelectorAll('.remove-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index)
            currentCourseItems.splice(index, 1)
            // sort_orderを振り直し
            const sorted = [...currentCourseItems].sort((a, b) => a.sort_order - b.sort_order)
            sorted.forEach((item, i) => {
                item.sort_order = i
            })
            currentCourseItems = sorted

            if (mode === 'create') {
                renderCreateCourseItemList()
                updateCreateCostPreview()
            } else {
                renderEditCourseItemList()
                updateEditCostPreview()
            }
        })
    })

    // 移動ボタン
    container.querySelectorAll('.move-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            movingItemIndex = parseInt(e.target.dataset.index)
            if (mode === 'create') {
                renderCreateCourseItemList()
            } else {
                renderEditCourseItemList()
            }
        })
    })
}

// ============================================
// 作成フォーム：プレビュー更新
// ============================================
function updateCreateCostPreview() {
    const totalCost = calculateCourseCost(currentCourseItems)
    totalCostPreview.textContent = `¥${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`

    const sellingPrice = parseFloat(courseSellingPrice.value) || 0
    const taxExcludedPrice = sellingPrice > 0 ? Math.round(sellingPrice / (1 + taxRate / 100)) : 0

    if (sellingPrice > 0) {
        taxExcludedPreview.textContent = `税抜 ¥${taxExcludedPrice.toLocaleString()}`
        const costRate = taxExcludedPrice > 0 ? (totalCost / taxExcludedPrice * 100) : 0
        costRatePreview.textContent = `原価率: ${costRate.toFixed(1)}%`
        costRatePreview.className = `text-lg font-bold ${costRate > 35 ? 'text-red-600' : costRate > 30 ? 'text-orange-500' : 'text-green-600'}`
    } else {
        taxExcludedPreview.textContent = ''
        costRatePreview.textContent = '原価率: --%'
        costRatePreview.className = 'text-lg font-bold text-gray-600'
    }
}

// ============================================
// 編集フォーム：プレビュー更新
// ============================================
function updateEditCostPreview() {
    const totalCost = calculateCourseCost(currentCourseItems)
    editTotalCostPreview.textContent = `¥${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`

    const sellingPrice = parseFloat(editCourseSellingPrice.value) || 0
    const taxExcludedPrice = sellingPrice > 0 ? Math.round(sellingPrice / (1 + taxRate / 100)) : 0

    if (sellingPrice > 0) {
        editTaxExcludedPreview.textContent = `税抜 ¥${taxExcludedPrice.toLocaleString()}`
        const costRate = taxExcludedPrice > 0 ? (totalCost / taxExcludedPrice * 100) : 0
        editCostRatePreview.textContent = `原価率: ${costRate.toFixed(1)}%`
        editCostRatePreview.className = `text-lg font-bold ${costRate > 35 ? 'text-red-600' : costRate > 30 ? 'text-orange-500' : 'text-green-600'}`
    } else {
        editTaxExcludedPreview.textContent = ''
        editCostRatePreview.textContent = '原価率: --%'
        editCostRatePreview.className = 'text-lg font-bold text-gray-600'
    }
}

// ============================================
// 作成フォームリセット
// ============================================
function resetCreateForm() {
    courseName.value = ''
    courseKana.value = ''
    courseSellingPrice.value = ''
    courseIsActive.checked = true
    currentCourseItems = []
    movingItemIndex = null
    renderCreateCourseItemList()
    updateCreateCostPreview()
    submitCreateBtn.disabled = false
    submitCreateBtn.textContent = '作成する'
}
// ============================================
// 編集モーダルを開く
// ============================================
function openEditModal(courseId) {
    const course = allCourses.find(c => c.course_id === courseId)
    if (!course) return

    editCourseId.value = course.course_id
    editCourseName.value = course.course_name
    editCourseKana.value = course.course_kana || ''
    editCourseSellingPrice.value = course.selling_price || ''
    editCourseIsActive.checked = course.is_active !== false

    // 商品リストを復元
    currentCourseItems = (course.course_items || []).map(item => {
        const dish = allDishes.find(d => d.dish_id === item.dish_id)
        return {
            dish_id: item.dish_id,
            dish_name: dish ? dish.dish_name : '（不明）',
            portion: item.portion || 1,
            cost: dish ? getDishCost(dish.dish_id) : 0,
            sort_order: item.sort_order || 0
        }
    })

    movingItemIndex = null
    renderEditCourseItemList()
    updateEditCostPreview()

    isEditMode = true
    editModal.classList.remove('hidden')
}

// ============================================
// コース作成
// ============================================
async function createCourse() {
    const name = courseName.value.trim()
    const kana = sanitizeToFullWidthKatakana(courseKana.value.trim())
    const sellingPrice = parseFloat(courseSellingPrice.value) || 0
    const businessTypeId = getCurrentBusinessTypeId()

    if (!name) {
        alert('コース名を入力してください')
        return
    }
    if (!kana) {
        alert('読み仮名を入力してください')
        return
    }
    if (!sellingPrice || sellingPrice <= 0) {
        alert('売価を入力してください')
        return
    }
    if (currentCourseItems.length === 0) {
        alert('商品を1つ以上追加してください')
        return
    }

    submitCreateBtn.disabled = true
    submitCreateBtn.textContent = '作成中...'

    // 既存コースの最大sort_orderを取得
    const maxSortOrder = allCourses.length > 0
        ? Math.max(...allCourses.map(c => c.sort_order || 0))
        : -1

    const { data: newCourse, error: courseError } = await supabase
        .from('courses')
        .insert({
            course_name: name,
            course_kana: kana,
            selling_price: sellingPrice,
            is_active: courseIsActive.checked,
            sort_order: maxSortOrder + 1,
            business_type_id: businessTypeId
        })
        .select()
        .single()

    if (courseError) {
        console.error('コース作成エラー:', courseError)
        alert('作成に失敗しました: ' + courseError.message)
        submitCreateBtn.disabled = false
        submitCreateBtn.textContent = '作成する'
        return
    }

    // 商品を登録
    const itemsToInsert = currentCourseItems.map(item => ({
        course_id: newCourse.course_id,
        dish_id: item.dish_id,
        portion: item.portion,
        sort_order: item.sort_order
    }))

    const { error: itemsError } = await supabase
        .from('course_items')
        .insert(itemsToInsert)

    if (itemsError) {
        console.error('コース商品登録エラー:', itemsError)
        alert('商品の登録に失敗しました: ' + itemsError.message)
    }

    createModal.classList.add('hidden')
    resetCreateForm()
    await loadData()
}

// ============================================
// コース更新
// ============================================
async function updateCourse() {
    const courseId = parseInt(editCourseId.value)
    const name = editCourseName.value.trim()
    const kana = sanitizeToFullWidthKatakana(editCourseKana.value.trim())
    const sellingPrice = parseFloat(editCourseSellingPrice.value) || 0

    if (!name) {
        alert('コース名を入力してください')
        return
    }
    if (!kana) {
        alert('読み仮名を入力してください')
        return
    }
    if (!sellingPrice || sellingPrice <= 0) {
        alert('売価を入力してください')
        return
    }
    if (currentCourseItems.length === 0) {
        alert('商品を1つ以上追加してください')
        return
    }

    submitEditBtn.disabled = true
    submitEditBtn.textContent = '更新中...'

    const { error: courseError } = await supabase
        .from('courses')
        .update({
            course_name: name,
            course_kana: kana,
            selling_price: sellingPrice,
            is_active: editCourseIsActive.checked
        })
        .eq('course_id', courseId)

    if (courseError) {
        console.error('コース更新エラー:', courseError)
        alert('更新に失敗しました: ' + courseError.message)
        submitEditBtn.disabled = false
        submitEditBtn.textContent = '更新する'
        return
    }

    // 既存の商品を削除
    const { error: deleteError } = await supabase
        .from('course_items')
        .delete()
        .eq('course_id', courseId)

    if (deleteError) {
        console.error('コース商品削除エラー:', deleteError)
    }

    // 商品を再登録
    const itemsToInsert = currentCourseItems.map(item => ({
        course_id: courseId,
        dish_id: item.dish_id,
        portion: item.portion,
        sort_order: item.sort_order
    }))

    const { error: itemsError } = await supabase
        .from('course_items')
        .insert(itemsToInsert)

    if (itemsError) {
        console.error('コース商品登録エラー:', itemsError)
        alert('商品の登録に失敗しました: ' + itemsError.message)
    }

    editModal.classList.add('hidden')
    submitEditBtn.disabled = false
    submitEditBtn.textContent = '更新する'
    await loadData()
}

// ============================================
// コース削除
// ============================================
async function deleteCourse() {
    const courseId = parseInt(editCourseId.value)

    if (!confirm('このコースを削除しますか？')) {
        return
    }

    const { error } = await supabase
        .from('courses')
        .delete()
        .eq('course_id', courseId)

    if (error) {
        console.error('コース削除エラー:', error)
        alert('削除に失敗しました: ' + error.message)
        return
    }

    editModal.classList.add('hidden')
    await loadData()
}