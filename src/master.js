import { supabase } from './supabase.js'
import { initBusinessTypeSelector, getCurrentBusinessTypeId } from './businessType.js'

// ============================================
// DOM要素の取得
// ============================================
// ジャンル
const genreList = document.getElementById('genreList')
const addGenreBtn = document.getElementById('addGenreBtn')
const genreModal = document.getElementById('genreModal')
const genreModalTitle = document.getElementById('genreModalTitle')
const closeGenreModalBtn = document.getElementById('closeGenreModal')
const cancelGenreBtn = document.getElementById('cancelGenre')
const submitGenreBtn = document.getElementById('submitGenre')
const genreId = document.getElementById('genreId')
const genreName = document.getElementById('genreName')
const genreSortOrder = document.getElementById('genreSortOrder')

// 仕込み品セクション
const prepSectionList = document.getElementById('prepSectionList')
const addPrepSectionBtn = document.getElementById('addPrepSectionBtn')
const prepSectionModal = document.getElementById('prepSectionModal')
const prepSectionModalTitle = document.getElementById('prepSectionModalTitle')
const closePrepSectionModalBtn = document.getElementById('closePrepSectionModal')
const cancelPrepSectionBtn = document.getElementById('cancelPrepSection')
const submitPrepSectionBtn = document.getElementById('submitPrepSection')
const prepSectionId = document.getElementById('prepSectionId')
const prepSectionName = document.getElementById('prepSectionName')
const prepSectionSortOrder = document.getElementById('prepSectionSortOrder')

// 商品セクション
const dishSectionList = document.getElementById('dishSectionList')
const addDishSectionBtn = document.getElementById('addDishSectionBtn')
const dishSectionModal = document.getElementById('dishSectionModal')
const dishSectionModalTitle = document.getElementById('dishSectionModalTitle')
const closeDishSectionModalBtn = document.getElementById('closeDishSectionModal')
const cancelDishSectionBtn = document.getElementById('cancelDishSection')
const submitDishSectionBtn = document.getElementById('submitDishSection')
const dishSectionId = document.getElementById('dishSectionId')
const dishSectionName = document.getElementById('dishSectionName')
const dishSectionSortOrder = document.getElementById('dishSectionSortOrder')

// 業態
const businessTypeList = document.getElementById('businessTypeList')
const addBusinessTypeBtn = document.getElementById('addBusinessTypeBtn')
const businessTypeModal = document.getElementById('businessTypeModal')
const businessTypeModalTitle = document.getElementById('businessTypeModalTitle')
const closeBusinessTypeModalBtn = document.getElementById('closeBusinessTypeModal')
const cancelBusinessTypeBtn = document.getElementById('cancelBusinessType')
const submitBusinessTypeBtn = document.getElementById('submitBusinessType')
const businessTypeId = document.getElementById('businessTypeId')
const businessTypeName = document.getElementById('businessTypeName')
const businessTypeSortOrder = document.getElementById('businessTypeSortOrder')

// ============================================
// 状態管理
// ============================================
let allGenres = []
let allPrepSections = []
let allDishSections = []
let allBusinessTypes = []
let currentTaxRate = 10

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
    // ジャンル追加ボタン
    addGenreBtn.addEventListener('click', () => {
        openGenreModal()
    })

    // ジャンルモーダル閉じる
    closeGenreModalBtn.addEventListener('click', () => {
        genreModal.classList.add('hidden')
    })

    cancelGenreBtn.addEventListener('click', () => {
        genreModal.classList.add('hidden')
    })

    // ジャンル保存
    submitGenreBtn.addEventListener('click', saveGenre)

    // 仕込み品セクション追加ボタン
    addPrepSectionBtn.addEventListener('click', () => {
        openPrepSectionModal()
    })

    // 仕込み品セクションモーダル閉じる
    closePrepSectionModalBtn.addEventListener('click', () => {
        prepSectionModal.classList.add('hidden')
    })

    cancelPrepSectionBtn.addEventListener('click', () => {
        prepSectionModal.classList.add('hidden')
    })

    // 仕込み品セクション保存
    submitPrepSectionBtn.addEventListener('click', savePrepSection)

    // 商品セクション追加ボタン
    addDishSectionBtn.addEventListener('click', () => {
        openDishSectionModal()
    })

    // 商品セクションモーダル閉じる
    closeDishSectionModalBtn.addEventListener('click', () => {
        dishSectionModal.classList.add('hidden')
    })

    cancelDishSectionBtn.addEventListener('click', () => {
        dishSectionModal.classList.add('hidden')
    })

    // 商品セクション保存
    submitDishSectionBtn.addEventListener('click', saveDishSection)

    // 業態追加ボタン
    addBusinessTypeBtn.addEventListener('click', () => {
        openBusinessTypeModal()
    })

    // 業態モーダル閉じる
    closeBusinessTypeModalBtn.addEventListener('click', () => {
        businessTypeModal.classList.add('hidden')
    })

    cancelBusinessTypeBtn.addEventListener('click', () => {
        businessTypeModal.classList.add('hidden')
    })

    // 業態保存
    submitBusinessTypeBtn.addEventListener('click', saveBusinessType)

    // 税率保存ボタン
    document.getElementById('saveTaxRateBtn').addEventListener('click', saveTaxRate)
}

// ============================================
// データ読み込み
// ============================================
async function loadData() {
    const businessTypeIdValue = getCurrentBusinessTypeId()

    genreList.innerHTML = '<p class="text-center text-gray-500 py-4">読み込み中...</p>'
    prepSectionList.innerHTML = '<p class="text-center text-gray-500 py-4">読み込み中...</p>'
    dishSectionList.innerHTML = '<p class="text-center text-gray-500 py-4">読み込み中...</p>'
    businessTypeList.innerHTML = '<p class="text-center text-gray-500 py-4">読み込み中...</p>'

    // ジャンル取得（業態でフィルタ）
    let genresQuery = supabase
        .from('item_genres')
        .select('*')
        .order('sort_order', { ascending: true })

    if (businessTypeIdValue) {
        genresQuery = genresQuery.eq('business_type_id', businessTypeIdValue)
    }

    const { data: genres, error: genresError } = await genresQuery

    if (genresError) {
        console.error('ジャンル取得エラー:', genresError)
        genreList.innerHTML = '<p class="text-center text-red-500 py-4">取得に失敗しました</p>'
    } else {
        allGenres = genres || []
        renderGenreList()
    }

    // 仕込み品セクション取得（業態でフィルタ）
    let prepSectionsQuery = supabase
        .from('preparation_sections')
        .select('*')
        .order('sort_order', { ascending: true })

    if (businessTypeIdValue) {
        prepSectionsQuery = prepSectionsQuery.eq('business_type_id', businessTypeIdValue)
    }

    const { data: prepSections, error: prepSectionsError } = await prepSectionsQuery

    if (prepSectionsError) {
        console.error('仕込み品セクション取得エラー:', prepSectionsError)
        prepSectionList.innerHTML = '<p class="text-center text-red-500 py-4">取得に失敗しました</p>'
    } else {
        allPrepSections = prepSections || []
        renderPrepSectionList()
    }

    // 商品セクション取得（業態でフィルタ）
    let dishSectionsQuery = supabase
        .from('dish_sections')
        .select('*')
        .order('sort_order', { ascending: true })

    if (businessTypeIdValue) {
        dishSectionsQuery = dishSectionsQuery.eq('business_type_id', businessTypeIdValue)
    }

    const { data: dishSections, error: dishSectionsError } = await dishSectionsQuery

    if (dishSectionsError) {
        console.error('商品セクション取得エラー:', dishSectionsError)
        dishSectionList.innerHTML = '<p class="text-center text-red-500 py-4">取得に失敗しました</p>'
    } else {
        allDishSections = dishSections || []
        renderDishSectionList()
    }

    // 業態取得（フィルタなし、全業態表示）
    const { data: businessTypes, error: businessTypesError } = await supabase
        .from('business_types')
        .select('*')
        .order('sort_order', { ascending: true })

    if (businessTypesError) {
        console.error('業態取得エラー:', businessTypesError)
        businessTypeList.innerHTML = '<p class="text-center text-red-500 py-4">取得に失敗しました</p>'
    } else {
        allBusinessTypes = businessTypes || []
        renderBusinessTypeList()
    }

    // 税率を取得
    await loadTaxRate()
}

// ============================================
// ジャンル一覧表示
// ============================================
function renderGenreList() {
    if (allGenres.length === 0) {
        genreList.innerHTML = '<p class="text-center text-gray-500 py-4">ジャンルがありません</p>'
        return
    }

    genreList.innerHTML = allGenres.map(genre => `
        <div class="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
            <div class="flex items-center gap-3">
                <span class="text-sm text-gray-400 w-8">${genre.sort_order}</span>
                <span class="font-medium text-gray-800">${genre.genre_name}</span>
            </div>
            <div class="flex gap-2">
                <button class="edit-genre-btn text-blue-600 hover:text-blue-800 px-3 py-1 rounded hover:bg-blue-50"
                    data-id="${genre.genre_id}">
                    編集
                </button>
                <button class="delete-genre-btn text-red-600 hover:text-red-800 px-3 py-1 rounded hover:bg-red-50"
                    data-id="${genre.genre_id}"
                    data-name="${genre.genre_name}">
                    削除
                </button>
            </div>
        </div>
    `).join('')

    // 編集ボタンイベント
    document.querySelectorAll('.edit-genre-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id)
            openGenreModal(id)
        })
    })

    // 削除ボタンイベント
    document.querySelectorAll('.delete-genre-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id)
            const name = btn.dataset.name
            deleteGenre(id, name)
        })
    })
}

// ============================================
// 仕込み品セクション一覧表示
// ============================================
function renderPrepSectionList() {
    if (allPrepSections.length === 0) {
        prepSectionList.innerHTML = '<p class="text-center text-gray-500 py-4">セクションがありません</p>'
        return
    }

    prepSectionList.innerHTML = allPrepSections.map(section => `
        <div class="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
            <div class="flex items-center gap-3">
                <span class="text-sm text-gray-400 w-8">${section.sort_order}</span>
                <span class="font-medium text-gray-800">${section.section_name}</span>
            </div>
            <div class="flex gap-2">
                <button class="edit-prep-section-btn text-blue-600 hover:text-blue-800 px-3 py-1 rounded hover:bg-blue-50"
                    data-id="${section.section_id}">
                    編集
                </button>
                <button class="delete-prep-section-btn text-red-600 hover:text-red-800 px-3 py-1 rounded hover:bg-red-50"
                    data-id="${section.section_id}"
                    data-name="${section.section_name}">
                    削除
                </button>
            </div>
        </div>
    `).join('')

    // 編集ボタンイベント
    document.querySelectorAll('.edit-prep-section-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id)
            openPrepSectionModal(id)
        })
    })

    // 削除ボタンイベント
    document.querySelectorAll('.delete-prep-section-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id)
            const name = btn.dataset.name
            deletePrepSection(id, name)
        })
    })
}

// ============================================
// 商品セクション一覧表示
// ============================================
function renderDishSectionList() {
    if (allDishSections.length === 0) {
        dishSectionList.innerHTML = '<p class="text-center text-gray-500 py-4">セクションがありません</p>'
        return
    }

    dishSectionList.innerHTML = allDishSections.map(section => `
        <div class="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
            <div class="flex items-center gap-3">
                <span class="text-sm text-gray-400 w-8">${section.sort_order}</span>
                <span class="font-medium text-gray-800">${section.section_name}</span>
            </div>
            <div class="flex gap-2">
                <button class="edit-dish-section-btn text-blue-600 hover:text-blue-800 px-3 py-1 rounded hover:bg-blue-50"
                    data-id="${section.section_id}">
                    編集
                </button>
                <button class="delete-dish-section-btn text-red-600 hover:text-red-800 px-3 py-1 rounded hover:bg-red-50"
                    data-id="${section.section_id}"
                    data-name="${section.section_name}">
                    削除
                </button>
            </div>
        </div>
    `).join('')

    // 編集ボタンイベント
    document.querySelectorAll('.edit-dish-section-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id)
            openDishSectionModal(id)
        })
    })

    // 削除ボタンイベント
    document.querySelectorAll('.delete-dish-section-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id)
            const name = btn.dataset.name
            deleteDishSection(id, name)
        })
    })
}

// ============================================
// 業態一覧表示
// ============================================
function renderBusinessTypeList() {
    if (allBusinessTypes.length === 0) {
        businessTypeList.innerHTML = '<p class="text-center text-gray-500 py-4">業態がありません</p>'
        return
    }

    businessTypeList.innerHTML = allBusinessTypes.map(bt => `
        <div class="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
            <div class="flex items-center gap-3">
                <span class="text-sm text-gray-400 w-8">${bt.sort_order}</span>
                <span class="font-medium text-gray-800">${bt.business_type_name}</span>
            </div>
            <div class="flex gap-2">
                <button class="edit-business-type-btn text-blue-600 hover:text-blue-800 px-3 py-1 rounded hover:bg-blue-50"
                    data-id="${bt.business_type_id}">
                    編集
                </button>
                <button class="delete-business-type-btn text-red-600 hover:text-red-800 px-3 py-1 rounded hover:bg-red-50"
                    data-id="${bt.business_type_id}"
                    data-name="${bt.business_type_name}">
                    削除
                </button>
            </div>
        </div>
    `).join('')

    // 編集ボタンイベント
    document.querySelectorAll('.edit-business-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id)
            openBusinessTypeModal(id)
        })
    })

    // 削除ボタンイベント
    document.querySelectorAll('.delete-business-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id)
            const name = btn.dataset.name
            deleteBusinessType(id, name)
        })
    })
}

// ============================================
// ジャンルモーダルを開く
// ============================================
function openGenreModal(editId = null) {
    if (editId) {
        const genre = allGenres.find(g => g.genre_id === editId)
        if (!genre) return

        genreModalTitle.textContent = '🧩 ジャンル編集'
        genreId.value = genre.genre_id
        genreName.value = genre.genre_name
        genreSortOrder.value = genre.sort_order
    } else {
        genreModalTitle.textContent = '🧩 ジャンル追加'
        genreId.value = ''
        genreName.value = ''
        const maxOrder = allGenres.length > 0 ? Math.max(...allGenres.map(g => g.sort_order)) : 0
        genreSortOrder.value = maxOrder + 1
    }

    genreModal.classList.remove('hidden')
}

// ============================================
// 仕込み品セクションモーダルを開く
// ============================================
function openPrepSectionModal(editId = null) {
    if (editId) {
        const section = allPrepSections.find(s => s.section_id === editId)
        if (!section) return

        prepSectionModalTitle.textContent = '🍳 セクション編集'
        prepSectionId.value = section.section_id
        prepSectionName.value = section.section_name
        prepSectionSortOrder.value = section.sort_order
    } else {
        prepSectionModalTitle.textContent = '🍳 セクション追加'
        prepSectionId.value = ''
        prepSectionName.value = ''
        const maxOrder = allPrepSections.length > 0 ? Math.max(...allPrepSections.map(s => s.sort_order)) : 0
        prepSectionSortOrder.value = maxOrder + 1
    }

    prepSectionModal.classList.remove('hidden')
}

// ============================================
// 商品セクションモーダルを開く
// ============================================
function openDishSectionModal(editId = null) {
    if (editId) {
        const section = allDishSections.find(s => s.section_id === editId)
        if (!section) return

        dishSectionModalTitle.textContent = '🍽️ セクション編集'
        dishSectionId.value = section.section_id
        dishSectionName.value = section.section_name
        dishSectionSortOrder.value = section.sort_order
    } else {
        dishSectionModalTitle.textContent = '🍽️ セクション追加'
        dishSectionId.value = ''
        dishSectionName.value = ''
        const maxOrder = allDishSections.length > 0 ? Math.max(...allDishSections.map(s => s.sort_order)) : 0
        dishSectionSortOrder.value = maxOrder + 1
    }

    dishSectionModal.classList.remove('hidden')
}

// ============================================
// 業態モーダルを開く
// ============================================
function openBusinessTypeModal(editId = null) {
    if (editId) {
        const bt = allBusinessTypes.find(b => b.business_type_id === editId)
        if (!bt) return

        businessTypeModalTitle.textContent = '🏪 業態編集'
        businessTypeId.value = bt.business_type_id
        businessTypeName.value = bt.business_type_name
        businessTypeSortOrder.value = bt.sort_order
    } else {
        businessTypeModalTitle.textContent = '🏪 業態追加'
        businessTypeId.value = ''
        businessTypeName.value = ''
        const maxOrder = allBusinessTypes.length > 0 ? Math.max(...allBusinessTypes.map(b => b.sort_order)) : 0
        businessTypeSortOrder.value = maxOrder + 1
    }

    businessTypeModal.classList.remove('hidden')
}

// ============================================
// ジャンル保存
// ============================================
async function saveGenre() {
    const id = genreId.value
    const name = genreName.value.trim()
    const sortOrder = parseInt(genreSortOrder.value) || 0
    const businessTypeIdValue = getCurrentBusinessTypeId()

    if (!name) {
        alert('ジャンル名を入力してください')
        return
    }

    if (!businessTypeIdValue) {
        alert('業態を選択してください')
        return
    }

    submitGenreBtn.disabled = true
    submitGenreBtn.textContent = '保存中...'

    if (id) {
        // 編集時はbusiness_type_idは変更しない
        const { error } = await supabase
            .from('item_genres')
            .update({
                genre_name: name,
                sort_order: sortOrder
            })
            .eq('genre_id', id)

        if (error) {
            console.error('ジャンル更新エラー:', error)
            alert('更新に失敗しました: ' + error.message)
            submitGenreBtn.disabled = false
            submitGenreBtn.textContent = '保存'
            return
        }
    } else {
        // 新規作成時はbusiness_type_idをセット
        const { error } = await supabase
            .from('item_genres')
            .insert({
                genre_name: name,
                sort_order: sortOrder,
                business_type_id: businessTypeIdValue
            })

        if (error) {
            console.error('ジャンル作成エラー:', error)
            alert('作成に失敗しました: ' + error.message)
            submitGenreBtn.disabled = false
            submitGenreBtn.textContent = '保存'
            return
        }
    }

    submitGenreBtn.disabled = false
    submitGenreBtn.textContent = '保存'
    genreModal.classList.add('hidden')
    await loadData()
}

// ============================================
// 仕込み品セクション保存
// ============================================
async function savePrepSection() {
    const id = prepSectionId.value
    const name = prepSectionName.value.trim()
    const sortOrder = parseInt(prepSectionSortOrder.value) || 0
    const businessTypeIdValue = getCurrentBusinessTypeId()

    if (!name) {
        alert('セクション名を入力してください')
        return
    }

    if (!businessTypeIdValue) {
        alert('業態を選択してください')
        return
    }

    submitPrepSectionBtn.disabled = true
    submitPrepSectionBtn.textContent = '保存中...'

    if (id) {
        // 編集時はbusiness_type_idは変更しない
        const { error } = await supabase
            .from('preparation_sections')
            .update({
                section_name: name,
                sort_order: sortOrder
            })
            .eq('section_id', id)

        if (error) {
            console.error('セクション更新エラー:', error)
            alert('更新に失敗しました: ' + error.message)
            submitPrepSectionBtn.disabled = false
            submitPrepSectionBtn.textContent = '保存'
            return
        }
    } else {
        // 新規作成時はbusiness_type_idをセット
        const { error } = await supabase
            .from('preparation_sections')
            .insert({
                section_name: name,
                sort_order: sortOrder,
                business_type_id: businessTypeIdValue
            })

        if (error) {
            console.error('セクション作成エラー:', error)
            alert('作成に失敗しました: ' + error.message)
            submitPrepSectionBtn.disabled = false
            submitPrepSectionBtn.textContent = '保存'
            return
        }
    }

    submitPrepSectionBtn.disabled = false
    submitPrepSectionBtn.textContent = '保存'
    prepSectionModal.classList.add('hidden')
    await loadData()
}

// ============================================
// 商品セクション保存
// ============================================
async function saveDishSection() {
    const id = dishSectionId.value
    const name = dishSectionName.value.trim()
    const sortOrder = parseInt(dishSectionSortOrder.value) || 0
    const businessTypeIdValue = getCurrentBusinessTypeId()

    if (!name) {
        alert('セクション名を入力してください')
        return
    }

    if (!businessTypeIdValue) {
        alert('業態を選択してください')
        return
    }

    submitDishSectionBtn.disabled = true
    submitDishSectionBtn.textContent = '保存中...'

    if (id) {
        // 編集時はbusiness_type_idは変更しない
        const { error } = await supabase
            .from('dish_sections')
            .update({
                section_name: name,
                sort_order: sortOrder
            })
            .eq('section_id', id)

        if (error) {
            console.error('セクション更新エラー:', error)
            alert('更新に失敗しました: ' + error.message)
            submitDishSectionBtn.disabled = false
            submitDishSectionBtn.textContent = '保存'
            return
        }
    } else {
        // 新規作成時はbusiness_type_idをセット
        const { error } = await supabase
            .from('dish_sections')
            .insert({
                section_name: name,
                sort_order: sortOrder,
                business_type_id: businessTypeIdValue
            })

        if (error) {
            console.error('セクション作成エラー:', error)
            alert('作成に失敗しました: ' + error.message)
            submitDishSectionBtn.disabled = false
            submitDishSectionBtn.textContent = '保存'
            return
        }
    }

    submitDishSectionBtn.disabled = false
    submitDishSectionBtn.textContent = '保存'
    dishSectionModal.classList.add('hidden')
    await loadData()
}

// ============================================
// 業態保存
// ============================================
async function saveBusinessType() {
    const id = businessTypeId.value
    const name = businessTypeName.value.trim()
    const sortOrder = parseInt(businessTypeSortOrder.value) || 0

    if (!name) {
        alert('業態名を入力してください')
        return
    }

    submitBusinessTypeBtn.disabled = true
    submitBusinessTypeBtn.textContent = '保存中...'

    if (id) {
        // 編集
        const { error } = await supabase
            .from('business_types')
            .update({
                business_type_name: name,
                sort_order: sortOrder
            })
            .eq('business_type_id', id)

        if (error) {
            console.error('業態更新エラー:', error)
            alert('更新に失敗しました: ' + error.message)
            submitBusinessTypeBtn.disabled = false
            submitBusinessTypeBtn.textContent = '保存'
            return
        }
    } else {
        // 新規作成
        const { data: newBusinessType, error } = await supabase
            .from('business_types')
            .insert({
                business_type_name: name,
                sort_order: sortOrder
            })
            .select()
            .single()

        if (error) {
            console.error('業態作成エラー:', error)
            alert('作成に失敗しました: ' + error.message)
            submitBusinessTypeBtn.disabled = false
            submitBusinessTypeBtn.textContent = '保存'
            return
        }

        // ========================================
        // 新規業態用の中間テーブルレコードを作成
        // ========================================
        const newBusinessTypeId = newBusinessType.business_type_id

        // 全商品を取得
        const { data: allProducts, error: productsError } = await supabase
            .from('products')
            .select('product_code')

        if (productsError) {
            console.error('商品取得エラー:', productsError)
        } else if (allProducts && allProducts.length > 0) {
            // 商品 × 新業態 の中間テーブルレコードを作成
            const productBusinessTypes = allProducts.map(p => ({
                product_code: p.product_code,
                business_type_id: newBusinessTypeId,
                is_active: false
            }))

            const { error: pbtError } = await supabase
                .from('product_business_types')
                .insert(productBusinessTypes)

            if (pbtError) {
                console.error('商品×業態の中間テーブル登録エラー:', pbtError)
            }
        }

        // 全業者を取得
        const { data: allSuppliers, error: suppliersError } = await supabase
            .from('suppliers')
            .select('supplier_name')

        if (suppliersError) {
            console.error('業者取得エラー:', suppliersError)
        } else if (allSuppliers && allSuppliers.length > 0) {
            // 業者 × 新業態 の中間テーブルレコードを作成
            const supplierBusinessTypes = allSuppliers.map(s => ({
                supplier_name: s.supplier_name,
                business_type_id: newBusinessTypeId,
                is_hidden: false
            }))

            const { error: sbtError } = await supabase
                .from('supplier_business_types')
                .insert(supplierBusinessTypes)

            if (sbtError) {
                console.error('業者×業態の中間テーブル登録エラー:', sbtError)
            }
        }
    }

    submitBusinessTypeBtn.disabled = false
    submitBusinessTypeBtn.textContent = '保存'
    businessTypeModal.classList.add('hidden')

    // 業態キャッシュをクリアして再読み込み
    const { clearBusinessTypesCache } = await import('./businessType.js')
    clearBusinessTypesCache()

    await loadData()

    // 業態セレクタを再初期化（新しい業態を反映）
    await initBusinessTypeSelector(onBusinessTypeChange)
}

// ============================================
// ジャンル削除
// ============================================
async function deleteGenre(id, name) {
    if (!confirm(`ジャンル「${name}」を削除しますか？\n\n※このジャンルが設定されているアイテムは「未分類」になります`)) {
        return
    }

    const { error } = await supabase
        .from('item_genres')
        .delete()
        .eq('genre_id', id)

    if (error) {
        console.error('ジャンル削除エラー:', error)
        alert('削除に失敗しました: ' + error.message)
        return
    }

    await loadData()
}

// ============================================
// 仕込み品セクション削除
// ============================================
async function deletePrepSection(id, name) {
    if (!confirm(`セクション「${name}」を削除しますか？\n\n※このセクションが設定されている仕込み品は「未分類」になります`)) {
        return
    }

    const { error } = await supabase
        .from('preparation_sections')
        .delete()
        .eq('section_id', id)

    if (error) {
        console.error('セクション削除エラー:', error)
        alert('削除に失敗しました: ' + error.message)
        return
    }

    await loadData()
}

// ============================================
// 商品セクション削除
// ============================================
async function deleteDishSection(id, name) {
    if (!confirm(`セクション「${name}」を削除しますか？\n\n※このセクションが設定されている商品は「未分類」になります`)) {
        return
    }

    const { error } = await supabase
        .from('dish_sections')
        .delete()
        .eq('section_id', id)

    if (error) {
        console.error('セクション削除エラー:', error)
        alert('削除に失敗しました: ' + error.message)
        return
    }

    await loadData()
}

// ============================================
// 業態削除
// ============================================
async function deleteBusinessType(id, name) {
    if (!confirm(`業態「${name}」を削除しますか？\n\n※この業態に紐づくアイテム・仕込み品・商品などは「未分類」になります`)) {
        return
    }

    const { error } = await supabase
        .from('business_types')
        .delete()
        .eq('business_type_id', id)

    if (error) {
        console.error('業態削除エラー:', error)
        alert('削除に失敗しました: ' + error.message)
        return
    }

    // 業態キャッシュをクリア
    const { clearBusinessTypesCache } = await import('./businessType.js')
    clearBusinessTypesCache()

    await loadData()

    // 業態セレクタを再初期化
    await initBusinessTypeSelector(onBusinessTypeChange)
}

// ============================================
// 税率を取得
// ============================================
async function loadTaxRate() {
    const { data, error } = await supabase
        .from('settings')
        .select('setting_value')
        .eq('setting_key', 'tax_rate')
        .single()

    if (error) {
        console.error('税率取得エラー:', error)
        return
    }

    if (data) {
        currentTaxRate = parseFloat(data.setting_value) || 10
        document.getElementById('taxRateInput').value = currentTaxRate
    }
}

// ============================================
// 税率を保存
// ============================================
async function saveTaxRate() {
    const newRate = parseFloat(document.getElementById('taxRateInput').value)

    if (isNaN(newRate) || newRate < 0 || newRate > 100) {
        alert('税率は0〜100の範囲で入力してください')
        return
    }

    // 全業態共通の確認メッセージ
    if (!confirm(`税率を ${newRate}% に変更します。\n\n⚠️ この変更は全業態に反映されます。\n\nよろしいですか？`)) {
        return
    }

    const btn = document.getElementById('saveTaxRateBtn')
    btn.disabled = true
    btn.textContent = '保存中...'

    const { error } = await supabase
        .from('settings')
        .update({
            setting_value: newRate.toString(),
            updated_at: new Date().toISOString()
        })
        .eq('setting_key', 'tax_rate')

    if (error) {
        console.error('税率保存エラー:', error)
        alert('保存に失敗しました: ' + error.message)
        btn.disabled = false
        btn.textContent = '保存'
        return
    }

    currentTaxRate = newRate
    btn.disabled = false
    btn.textContent = '保存'
    alert('✅ 税率を保存しました（全業態に反映）')
}