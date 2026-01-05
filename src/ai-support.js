// ===================================
// AIサポート画面のメインJS
// ===================================

import { supabase } from './supabase.js'
import { initBusinessTypeSelector, getCurrentBusinessTypeId } from './businessType.js'
import {
    fetchAllWithPaging,
    withBusinessTypeFilter,
    toHalfWidthKatakana,
    sanitizeToFullWidthKatakana,
    getIngredientName,
    getIngredientUnit,
    normalizeForSearch
} from './utils.js'
import { QuickItemModalManager } from './modalManagers.js'
import { getIngredientUnitCost, calculateItemUnitCost } from './costCalculator.js'

// ===================================
// グローバル変数
// ===================================

// 現在のステップ（1〜7）
let currentStep = 1

// アップロードされたファイル
let uploadedFile = null

// AIが読み取ったレシピ一覧
let extractedRecipes = []

// 選択されたレシピのインデックス
let selectedRecipeIndex = null

// 材料リスト（名前のみ、STEP4で編集）
let ingredientNames = []

// 紐付け済み材料リスト（STEP5で編集）
// { type, id, linkedName, quantity, unit }
let linkedIngredients = []

// 現在紐付け中の材料インデックス
let currentLinkingIndex = null

// マスタデータ（キャッシュ）
let allItems = []
let allPreparations = []
let allDishes = []
let allProducts = []
let allSuppliers = []
let prepSections = []
let dishSections = []
let allGenres = []

// 類似チェック結果（レシピインデックス → 候補配列）
let duplicateMap = {}

// 現在のセッションID（保存済みの場合）
let currentSessionId = null

// 元ファイル名（セッション保存用）
let originalFileName = ''

// AI検索で取得した読み仮名（クイックアイテム作成用）
let lastAIGeneratedKana = ''

// クイックアイテムモーダルマネージャー
let quickItemModalManager = null

// Edge Function URL
const EDGE_FUNCTION_URL = 'https://nutxwlrzghqwnttjakzg.supabase.co/functions/v1/ai-read-recipe'
const CHECK_DUPLICATES_URL = 'https://nutxwlrzghqwnttjakzg.supabase.co/functions/v1/ai-check-duplicates'
const SEARCH_KEYWORDS_URL = 'https://nutxwlrzghqwnttjakzg.supabase.co/functions/v1/ai-search-keywords'

// ===================================
// 初期化
// ===================================

document.addEventListener('DOMContentLoaded', async () => {
    // 業態セレクタ初期化（変更時にデータ再読み込み）
    await initBusinessTypeSelector(async () => {
        await loadMasterData()
        await loadSessionHistory()
        // 業態変更時にジャンルセレクトを更新
        if (quickItemModalManager) {
            renderQuickItemGenreSelect()
        }
    })

    // マスタデータ読み込み
    await loadMasterData()

    // クイックアイテムモーダル初期化
    initQuickItemModalManager()

    // イベントリスナー設定
    setupEventListeners()

    // セッション履歴を読み込み
    await loadSessionHistory()
})

// ===================================
// クイックアイテムモーダル初期化
// ===================================

function initQuickItemModalManager() {
    quickItemModalManager = new QuickItemModalManager({
        supabase,
        getBusinessTypeId: getCurrentBusinessTypeId,
        getAllProducts: () => allProducts,
        getAllGenres: () => allGenres,
        onItemCreated: async (newItem) => {
            // allItemsに追加
            allItems.push(newItem)

            // 紐付けを設定
            const unitCost = getIngredientUnitCost('item', newItem.item_id, allItems, allPreparations)
            linkedIngredients[currentLinkingIndex] = {
                type: 'item',
                id: newItem.item_id,
                linkedName: newItem.item_name,
                unit: newItem.unit,
                unitCost: unitCost
            }

            closeLinkModal()
            renderIngredientLinkList()
        }
    })

    // モーダルHTML生成
    quickItemModalManager.createModal()

    // ジャンルセレクト初期描画
    renderQuickItemGenreSelect()
}

// ジャンルセレクトを更新
function renderQuickItemGenreSelect() {
    if (!quickItemModalManager || !quickItemModalManager.isModalCreated) return
    quickItemModalManager.renderGenreSelect()
}

// ===================================
// マスタデータ読み込み
// ===================================

async function loadMasterData() {
    const businessTypeId = getCurrentBusinessTypeId()

    try {
        // 並列で取得
        const [itemsRes, prepsRes, dishesRes, productsRes, suppliersRes, prepSecRes, dishSecRes, genresRes] = await Promise.all([
            // アイテム(productsをJOIN)
            withBusinessTypeFilter(
                supabase
                    .from('items')
                    .select('*, products(product_name, supplier_name, unit_price)')
                    .order('item_kana'),
                businessTypeId
            ),
            // 仕込み品（preparation_ingredientsをJOIN）
            withBusinessTypeFilter(
                supabase
                    .from('preparations')
                    .select('*, preparation_ingredients(id, ingredient_type, ingredient_id, quantity)')
                    .order('preparation_kana'),
                businessTypeId
            ),
            // 商品（dish_ingredientsをJOIN）
            withBusinessTypeFilter(
                supabase
                    .from('dishes')
                    .select('*, dish_ingredients(id, ingredient_type, ingredient_id, quantity)')
                    .order('dish_kana'),
                businessTypeId
            ),
            // 仕入れ商品（全件、ページング対応）
            fetchAllWithPaging('products', '*', { orderColumn: 'product_name', ascending: true }),
            // 取引先（業態の非表示設定をJOIN）
            supabase
                .from('suppliers')
                .select('*, supplier_business_types!inner(is_hidden)')
                .eq('supplier_business_types.business_type_id', businessTypeId)
                .eq('supplier_business_types.is_hidden', false)
                .order('supplier_name'),
            // 仕込み品セクション
            withBusinessTypeFilter(
                supabase
                    .from('preparation_sections')
                    .select('*')
                    .order('sort_order'),
                businessTypeId
            ),
            // 商品セクション
            withBusinessTypeFilter(
                supabase
                    .from('dish_sections')
                    .select('*')
                    .order('sort_order'),
                businessTypeId
            ),
            // アイテムジャンル
            withBusinessTypeFilter(
                supabase
                    .from('item_genres')
                    .select('*')
                    .order('sort_order'),
                businessTypeId
            )
        ])

        allItems = itemsRes.data || []
        allPreparations = prepsRes.data || []
        allDishes = dishesRes.data || []
        allProducts = productsRes.data || []
        allSuppliers = suppliersRes.data || []
        prepSections = prepSecRes.data || []
        dishSections = dishSecRes.data || []
        allGenres = genresRes.data || []

        console.log('マスタデータ読み込み完了', {
            items: allItems.length,
            preparations: allPreparations.length,
            dishes: allDishes.length,
            products: allProducts.length,
            prepSections: prepSections.length,
            dishSections: dishSections.length,
            genres: allGenres.length
        })

    } catch (error) {
        console.error('マスタデータ読み込みエラー:', error)
    }
}

// ===================================
// イベントリスナー設定
// ===================================

function setupEventListeners() {
    // --- STEP1: ファイルアップロード ---
    const dropZone = document.getElementById('dropZone')
    const fileInput = document.getElementById('fileInput')
    const removeFileBtn = document.getElementById('removeFile')
    const analyzeBtn = document.getElementById('analyzeBtn')

    // ドラッグ&ドロップ
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault()
        dropZone.classList.add('border-blue-500', 'bg-blue-50')
    })

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault()
        dropZone.classList.remove('border-blue-500', 'bg-blue-50')
    })

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault()
        dropZone.classList.remove('border-blue-500', 'bg-blue-50')
        const files = e.dataTransfer.files
        if (files.length > 0) {
            handleFileSelect(files[0])
        }
    })

    // ファイル選択
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0])
        }
    })

    // ファイル削除
    removeFileBtn.addEventListener('click', () => {
        clearSelectedFile()
    })

    // AIで読み取る
    analyzeBtn.addEventListener('click', () => {
        analyzeFile()
    })

    // --- ステップ間の移動 ---
    document.getElementById('backToStep1').addEventListener('click', () => goToStep(1))
    document.getElementById('goToStep3').addEventListener('click', () => goToStep(3))
    document.getElementById('backToStep2').addEventListener('click', () => goToStep(2))
    document.getElementById('goToStep4').addEventListener('click', () => {
        // バリデーション
        const recipeType = document.querySelector('input[name="recipeType"]:checked')?.value
        const name = document.getElementById('recipeName').value.trim()
        const kana = document.getElementById('recipeKana').value.trim()
        const sectionId = document.getElementById('recipeSection').value

        if (!recipeType) {
            alert('種別を選択してください')
            return
        }
        if (!name) {
            alert('名前を入力してください')
            return
        }
        if (!kana) {
            alert('読み仮名を入力してください')
            return
        }
        if (!sectionId) {
            alert('セクションを選択してください')
            return
        }
        goToStep(4)
    })
    document.getElementById('backToStep3').addEventListener('click', () => goToStep(3))
    document.getElementById('goToStep5').addEventListener('click', () => goToStep(5))
    document.getElementById('backToStep4').addEventListener('click', () => goToStep(4))
    document.getElementById('goToStep6').addEventListener('click', () => goToStep(6))
    document.getElementById('backToStep5').addEventListener('click', () => goToStep(5))
    document.getElementById('goToStep7').addEventListener('click', () => registerRecipe())

    // --- STEP3: 種別選択 ---
    const recipeTypeRadios = document.querySelectorAll('input[name="recipeType"]')
    recipeTypeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            toggleRecipeTypeFields(e.target.value)
        })
    })

    // 読み仮名のサニタイズ（blurイベントで変換）
    document.getElementById('recipeKana').addEventListener('blur', (e) => {
        e.target.value = sanitizeToFullWidthKatakana(e.target.value)
    })

    // --- STEP4: 材料追加 ---
    document.getElementById('addIngredientName').addEventListener('click', () => {
        addIngredientNameRow()
    })

    // --- STEP7: 完了後 ---
    document.getElementById('registerAnother').addEventListener('click', () => {
        // 未登録レシピがあれば選択画面へ、なければ最初から
        if (extractedRecipes.length > 0) {
            goToStep(2)
        } else {
            resetAll()
            goToStep(1)
        }
    })

    document.getElementById('finishRegistration').addEventListener('click', () => {
        resetAll()
        goToStep(1)
    })

    // --- 紐付けモーダル ---
    document.getElementById('closeLinkModal').addEventListener('click', closeLinkModal)
    document.getElementById('cancelLink').addEventListener('click', closeLinkModal)
    document.getElementById('confirmLink').addEventListener('click', confirmLink)
    document.getElementById('aiSearchBtn').addEventListener('click', aiSearch)

    // タブ切り替え
    const linkTabs = document.querySelectorAll('.link-tab')
    linkTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            switchLinkTab(e.target.dataset.tab)
        })
    })

    // 検索
    document.getElementById('linkSearchInput').addEventListener('input', (e) => {
        filterLinkCandidates(e.target.value)
    })
}

// ===================================
// STEP1: ファイルアップロード
// ===================================

function handleFileSelect(file) {
    // 対応形式チェック（画像とPDFのみ）
    const allowedTypes = [
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/gif',
        'image/webp'
    ]

    const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp']
    const ext = '.' + file.name.split('.').pop().toLowerCase()

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
        showError('現在は画像（PNG, JPG, GIF, WebP）とPDFのみ対応しています。PPT/Excelは今後対応予定です。')
        return
    }

    uploadedFile = file

    // 表示更新
    document.getElementById('selectedFile').classList.remove('hidden')
    document.getElementById('fileName').textContent = file.name
    document.getElementById('fileSize').textContent = formatFileSize(file.size)
    document.getElementById('fileIcon').textContent = getFileIcon(ext)
    document.getElementById('analyzeBtn').disabled = false

    hideError()
}

function clearSelectedFile() {
    uploadedFile = null
    document.getElementById('selectedFile').classList.add('hidden')
    document.getElementById('fileInput').value = ''
    document.getElementById('analyzeBtn').disabled = true
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function getFileIcon(ext) {
    if (ext === '.pdf') return '📕'
    return '🖼️'
}

// ===================================
// STEP1: AI読み取り
// ===================================

async function analyzeFile() {
    if (!uploadedFile) return

    showLoading(true)
    hideError()

    try {
        // ファイルをBase64に変換
        const base64 = await fileToBase64(uploadedFile)

        // Edge Functionを呼び出し
        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                imageBase64: base64,
                mimeType: uploadedFile.type || 'image/png'
            })
        })

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'AI読み取りに失敗しました')
        }

        const result = await response.json()
        console.log('AI読み取り結果:', result)

        // レシピ一覧を保存
        extractedRecipes = result.recipes || []

        // ファイル名を保存（セッション用）
        originalFileName = uploadedFile.name
        // 新規セッションとしてリセット
        currentSessionId = null

        if (extractedRecipes.length === 0) {
            showError('レシピ情報を読み取れませんでした。別のファイルを試してください。')
            return
        }

        // 類似チェックを実行
        await checkDuplicatesWithAI()

        // STEP2へ
        renderRecipeList()
        goToStep(2)

    } catch (error) {
        console.error('AI読み取りエラー:', error)
        showError(error.message || 'AI読み取りに失敗しました')
    } finally {
        showLoading(false)
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
            // data:image/png;base64,xxxx の形式から base64部分のみ抽出
            const base64 = reader.result.split(',')[1]
            resolve(base64)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}

function showLoading(show) {
    document.getElementById('loadingIndicator').classList.toggle('hidden', !show)
    document.getElementById('analyzeBtn').disabled = show
}

function showError(message) {
    const el = document.getElementById('errorMessage')
    el.textContent = message
    el.classList.remove('hidden')
}

function hideError() {
    document.getElementById('errorMessage').classList.add('hidden')
}

// AI類似チェック
async function checkDuplicatesWithAI() {
    duplicateMap = {}

    // 既存データがなければスキップ
    if (allPreparations.length === 0 && allDishes.length === 0) {
        console.log('既存データなし、類似チェックスキップ')
        return
    }

    try {
        const response = await fetch(CHECK_DUPLICATES_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                recipes: extractedRecipes.map(r => ({ name: r.name })),
                preparations: allPreparations.map(p => ({
                    preparation_id: p.preparation_id,
                    preparation_name: p.preparation_name
                })),
                dishes: allDishes.map(d => ({
                    dish_id: d.dish_id,
                    dish_name: d.dish_name
                }))
            })
        })

        if (!response.ok) {
            console.warn('類似チェックAPI失敗、スキップ')
            return
        }

        const result = await response.json()
        console.log('類似チェック結果:', result)

        // duplicateMapに変換（レシピインデックス → 候補配列）
        if (result.duplicates && Array.isArray(result.duplicates)) {
            for (const dup of result.duplicates) {
                duplicateMap[dup.recipeIndex] = dup.candidates || []
            }
        }

    } catch (error) {
        console.warn('類似チェックエラー（続行）:', error)
    }
}

// ===================================
// STEP2: レシピ選択
// ===================================

function renderRecipeList() {
    const container = document.getElementById('recipeList')
    container.innerHTML = ''

    if (extractedRecipes.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">登録するレシピがありません</p>'
        return
    }

    extractedRecipes.forEach((recipe, index) => {
        const div = document.createElement('div')
        div.className = 'p-4 border-2 rounded-lg cursor-pointer hover:border-blue-500 transition-colors'
        div.dataset.index = index

        // AI類似チェック結果を取得
        const duplicates = duplicateMap[index] || []
        const hasDuplicate = duplicates.length > 0

        // ツールチップ用のテキスト
        let tooltipText = ''
        if (hasDuplicate) {
            tooltipText = duplicates.map(d => {
                const typeLabel = d.type === 'preparation' ? '仕込み品' : '商品'
                return `・${typeLabel}「${d.name}」`
            }).join('\n')
        }

        div.innerHTML = `
            <div class="flex items-center gap-3">
                <input type="radio" name="selectedRecipe" value="${index}" class="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div class="flex-1 min-w-0">
                    <p class="font-bold text-gray-800">
                        ${escapeHtml(recipe.name)}
                        ${hasDuplicate ? `
                            <span class="text-orange-500 cursor-help relative group ml-1">
                                ⚠️
                                <span class="absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg whitespace-pre-line opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 min-w-max">
                                    似た名前が登録済み:\n${escapeHtml(tooltipText)}
                                </span>
                            </span>
                        ` : ''}
                    </p>
                    <p class="text-sm text-gray-500">材料: ${recipe.ingredients?.length || 0}種類</p>
                </div>
                <button class="delete-recipe-btn text-gray-400 hover:text-red-500 text-xl p-1 flex-shrink-0" data-index="${index}" title="リストから削除">
                    🗑️
                </button>
            </div>
        `

        // レシピ選択（削除ボタン以外をクリック）
        div.addEventListener('click', (e) => {
            // 削除ボタンのクリックは除外
            if (e.target.closest('.delete-recipe-btn')) return

            const radio = div.querySelector('input[type="radio"]')
            radio.checked = true
            selectedRecipeIndex = index
            document.getElementById('goToStep3').disabled = false

            // 選択状態のスタイル
            container.querySelectorAll('div[data-index]').forEach(d => d.classList.remove('border-blue-500', 'bg-blue-50'))
            div.classList.add('border-blue-500', 'bg-blue-50')
        })

        container.appendChild(div)
    })

    // 削除ボタンのイベント
    container.querySelectorAll('.delete-recipe-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation()
            const index = parseInt(btn.dataset.index)
            deleteRecipeFromList(index)
        })
    })
}

// レシピをリストから削除
function deleteRecipeFromList(index) {
    if (!confirm(`「${extractedRecipes[index]?.name || ''}」をリストから削除しますか？`)) {
        return
    }

    // 配列から削除
    extractedRecipes.splice(index, 1)

    // duplicateMapのインデックスを更新
    const newDuplicateMap = {}
    for (const [key, value] of Object.entries(duplicateMap)) {
        const oldIndex = parseInt(key)
        if (oldIndex < index) {
            newDuplicateMap[oldIndex] = value
        } else if (oldIndex > index) {
            newDuplicateMap[oldIndex - 1] = value
        }
        // oldIndex === index は削除されるので含めない
    }
    duplicateMap = newDuplicateMap

    // 選択状態リセット
    selectedRecipeIndex = null
    document.getElementById('goToStep3').disabled = true

    // 再描画
    renderRecipeList()
}

// ===================================
// STEP3: 基本情報
// ===================================

function toggleRecipeTypeFields(type) {
    const dishFields = document.getElementById('dishFields')

    if (type === 'preparation') {
        dishFields.classList.add('hidden')
        // セクションを仕込み品用に更新
        updateSectionOptions(prepSections, 'section_id', 'section_name')
    } else {
        dishFields.classList.remove('hidden')
        // セクションを商品用に更新
        updateSectionOptions(dishSections, 'section_id', 'section_name')
    }
}

function updateSectionOptions(sections, idKey, nameKey) {
    const select = document.getElementById('recipeSection')
    select.innerHTML = '<option value="">選択してください</option>'

    sections.forEach(section => {
        const option = document.createElement('option')
        option.value = section[idKey]
        option.textContent = section[nameKey]
        select.appendChild(option)
    })
}

// ===================================
// STEP4: 材料リスト確認
// ===================================

function renderIngredientNameList() {
    const container = document.getElementById('ingredientNameList')
    container.innerHTML = ''

    ingredientNames.forEach((name, index) => {
        const div = document.createElement('div')
        div.className = 'flex items-center gap-3'
        div.innerHTML = `
            <input type="text" value="${escapeHtml(name)}" 
                class="flex-1 p-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 ingredient-name-input"
                data-index="${index}" />
            <button class="text-red-500 hover:text-red-700 text-xl delete-ingredient-name" data-index="${index}">&times;</button>
        `
        container.appendChild(div)
    })

    // 入力イベント
    container.querySelectorAll('.ingredient-name-input').forEach(input => {
        input.addEventListener('input', (e) => {
            ingredientNames[parseInt(e.target.dataset.index)] = e.target.value
        })
    })

    // 削除イベント
    container.querySelectorAll('.delete-ingredient-name').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index)
            ingredientNames.splice(index, 1)
            renderIngredientNameList()
        })
    })
}

function addIngredientNameRow() {
    ingredientNames.push('')
    renderIngredientNameList()

    // 新しい行にフォーカス
    const inputs = document.querySelectorAll('.ingredient-name-input')
    if (inputs.length > 0) {
        inputs[inputs.length - 1].focus()
    }
}

// ===================================
// STEP5: 材料の紐付け
// ===================================

function renderIngredientLinkList() {
    const container = document.getElementById('ingredientLinkList')
    container.innerHTML = ''

    ingredientNames.forEach((name, index) => {
        const linked = linkedIngredients[index]
        const isLinked = linked && linked.type && linked.id

        const div = document.createElement('div')
        div.className = 'p-4 border rounded-lg'
        div.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex-1">
                    <p class="font-medium text-gray-800">${escapeHtml(name)}</p>
                    ${isLinked
                ? `<p class="text-sm text-green-600">✅ ${escapeHtml(linked.linkedName)}（${linked.type === 'item' ? 'アイテム' : '仕込み品'}）</p>`
                : '<p class="text-sm text-gray-400">未紐付け</p>'
            }
                </div>
                <div class="flex gap-2">
                    <button class="ai-search-btn px-3 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm hover:bg-purple-200" data-index="${index}">
                        🤖 AIで探す
                    </button>
                    <button class="manual-search-btn px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200" data-index="${index}">
                        🔍 自分で探す
                    </button>
                </div>
            </div>
        `
        container.appendChild(div)
    })

    // AIで探すボタン
    container.querySelectorAll('.ai-search-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            openLinkModal(parseInt(e.target.dataset.index), true)
        })
    })

    // 自分で探すボタン
    container.querySelectorAll('.manual-search-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            openLinkModal(parseInt(e.target.dataset.index), false)
        })
    })

    // 全部紐付け済みか確認
    const allLinked = ingredientNames.every((_, i) =>
        linkedIngredients[i] && linkedIngredients[i].type && linkedIngredients[i].id
    )
    document.getElementById('goToStep6').disabled = !allLinked
}

// ===================================
// 紐付けモーダル
// ===================================

let currentLinkTab = 'item'
let selectedLinkCandidate = null

function openLinkModal(index, useAI = false) {
    currentLinkingIndex = index
    selectedLinkCandidate = null

    const ingredientName = ingredientNames[index]
    document.getElementById('linkTargetName').textContent = ingredientName
    document.getElementById('linkModal').classList.remove('hidden')
    document.getElementById('confirmLink').disabled = true

    // スクロール位置をリセット
    document.getElementById('linkCandidateList').scrollTop = 0

    // タブ初期化
    switchLinkTab('item')

    if (useAI) {
        // AIで探す
        document.getElementById('linkSearchInput').value = ''
        aiSearch()
    } else {
        // 自分で探す → 材料名をセットして自動検索
        document.getElementById('linkSearchInput').value = ingredientName
        renderLinkCandidates()
    }
}

function closeLinkModal() {
    document.getElementById('linkModal').classList.add('hidden')
    currentLinkingIndex = null
    selectedLinkCandidate = null
}

function switchLinkTab(tab) {
    currentLinkTab = tab

    // タブスタイル更新
    document.querySelectorAll('.link-tab').forEach(t => {
        if (t.dataset.tab === tab) {
            t.classList.add('border-b-2', 'border-blue-600', 'text-blue-600')
            t.classList.remove('text-gray-500')
        } else {
            t.classList.remove('border-b-2', 'border-blue-600', 'text-blue-600')
            t.classList.add('text-gray-500')
        }
    })

    renderLinkCandidates()
}

function renderLinkCandidates() {
    const container = document.getElementById('linkCandidateList')
    container.innerHTML = ''

    let candidates = []

    if (currentLinkTab === 'item') {
        candidates = allItems.map(item => ({
            type: 'item',
            id: item.item_id,
            name: item.item_name,
            sub: item.unit,
            unitCost: getIngredientUnitCost('item', item.item_id, allItems, allPreparations)
        }))

        // 検索フィルタ
        const searchValue = document.getElementById('linkSearchInput').value.toLowerCase()
        if (searchValue) {
            candidates = candidates.filter(c => c.name.toLowerCase().includes(searchValue))
        }

        if (candidates.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">該当する候補がありません</p>'
            return
        }

        candidates.forEach(candidate => {
            const div = document.createElement('div')
            div.className = 'p-3 border rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors'
            div.innerHTML = `
                <div class="flex items-center justify-between">
                    <div>
                        <p class="font-medium text-gray-800">${escapeHtml(candidate.name)}</p>
                        <p class="text-sm text-gray-500">${escapeHtml(candidate.sub || '')}</p>
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-blue-600">¥${candidate.unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                        <p class="text-xs text-gray-400">/ ${candidate.sub || '単位'}</p>
                    </div>
                </div>
            `

            div.addEventListener('click', () => {
                container.querySelectorAll('div').forEach(d => d.classList.remove('border-blue-500', 'bg-blue-50'))
                div.classList.add('border-blue-500', 'bg-blue-50')
                selectedLinkCandidate = candidate
                document.getElementById('confirmLink').disabled = false
            })

            container.appendChild(div)
        })

    } else if (currentLinkTab === 'preparation') {
        candidates = allPreparations.map(prep => ({
            type: 'preparation',
            id: prep.preparation_id,
            name: prep.preparation_name,
            sub: prep.yield_unit,
            unitCost: getIngredientUnitCost('preparation', prep.preparation_id, allItems, allPreparations)
        }))

        // 検索フィルタ
        const searchValue = document.getElementById('linkSearchInput').value.toLowerCase()
        if (searchValue) {
            candidates = candidates.filter(c => c.name.toLowerCase().includes(searchValue))
        }

        if (candidates.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">該当する候補がありません</p>'
            return
        }

        candidates.forEach(candidate => {
            const div = document.createElement('div')
            div.className = 'p-3 border rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors'
            div.innerHTML = `
                <div class="flex items-center justify-between">
                    <div>
                        <p class="font-medium text-gray-800">${escapeHtml(candidate.name)}</p>
                        <p class="text-sm text-gray-500">${escapeHtml(candidate.sub || '')}</p>
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-blue-600">¥${candidate.unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                        <p class="text-xs text-gray-400">/ ${candidate.sub || '単位'}</p>
                    </div>
                </div>
            `

            div.addEventListener('click', () => {
                container.querySelectorAll('div').forEach(d => d.classList.remove('border-blue-500', 'bg-blue-50'))
                div.classList.add('border-blue-500', 'bg-blue-50')
                selectedLinkCandidate = candidate
                document.getElementById('confirmLink').disabled = false
            })

            container.appendChild(div)
        })

    } else if (currentLinkTab === 'product') {
        // 仕入れ商品から作成
        renderProductList()
    }
}

function filterLinkCandidates(searchValue) {
    renderLinkCandidates()
}

async function aiSearch() {
    const name = ingredientNames[currentLinkingIndex]
    if (!name) return

    const aiBtn = document.getElementById('aiSearchBtn')
    aiBtn.disabled = true
    aiBtn.textContent = '🤖 検索中...'

    try {
        // AIにキーワード生成を依頼
        const response = await fetch(SEARCH_KEYWORDS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ingredientName: name })
        })

        let keywords = [name]

        if (response.ok) {
            const result = await response.json()
            console.log('AI検索キーワード:', result)
            if (result.keywords && result.keywords.length > 0) {
                keywords = result.keywords
            }
            // 読み仮名を保存（クイックアイテム作成用）
            if (result.kana) {
                lastAIGeneratedKana = result.kana
            }
        } else {
            console.warn('キーワード生成API失敗、材料名で検索')
        }

        // 各キーワードで検索して候補を収集
        const itemCandidates = new Map()
        const prepCandidates = new Map()
        const productCandidates = new Map()

        // 非表示の業者を除外するためのセット
        const visibleSupplierNames = new Set(allSuppliers.map(s => s.supplier_name))

        for (const keyword of keywords) {
            const lowerKeyword = keyword.toLowerCase()

            // アイテム検索
            for (const item of allItems) {
                if (item.item_name.toLowerCase().includes(lowerKeyword)) {
                    itemCandidates.set(item.item_id, item)
                }
            }

            // 仕込み品検索
            for (const prep of allPreparations) {
                if (prep.preparation_name.toLowerCase().includes(lowerKeyword)) {
                    prepCandidates.set(prep.preparation_id, prep)
                }
            }

            // 仕入れ商品検索（非表示業者を除外）
            for (const product of allProducts) {
                if (!visibleSupplierNames.has(product.supplier_name)) continue
                if (product.product_name.toLowerCase().includes(lowerKeyword)) {
                    productCandidates.set(product.product_code, product)
                }
            }
        }

        // 結果を表示
        renderAISearchResults(
            Array.from(itemCandidates.values()),
            Array.from(prepCandidates.values()),
            Array.from(productCandidates.values())
        )

    } catch (error) {
        console.error('AI検索エラー:', error)
        // エラー時は材料名で通常検索
        document.getElementById('linkSearchInput').value = name
        renderLinkCandidates()
    } finally {
        aiBtn.disabled = false
        aiBtn.textContent = '🤖 AIで探す'
    }
}

// AI検索結果を一括表示
function renderAISearchResults(items, preparations, products) {
    const container = document.getElementById('linkCandidateList')
    container.innerHTML = ''

    let html = ''

    // アイテムセクション（0件でも表示）
    html += `
        <div class="mb-4">
            <div class="bg-blue-500 text-white text-center py-2 rounded-lg font-bold mb-2">
                🧩 アイテム（${items.length}件）
            </div>
    `
    if (items.length > 0) {
        for (const item of items) {
            const unitCost = getIngredientUnitCost('item', item.item_id, allItems, allPreparations)
            html += `
                <div class="p-3 border rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors mb-2 ai-result-item"
                    data-type="item" data-id="${item.item_id}" data-name="${escapeHtml(item.item_name)}" data-unit="${escapeHtml(item.unit || '')}">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="font-medium text-gray-800">${escapeHtml(item.item_name)}</p>
                            <p class="text-sm text-gray-500">${escapeHtml(item.unit || '')}</p>
                        </div>
                        <div class="text-right">
                            <p class="font-bold text-blue-600">¥${unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                        </div>
                    </div>
                </div>
            `
        }
    } else {
        html += `<p class="text-gray-400 text-center py-2 text-sm">（該当なし）</p>`
    }
    html += '</div>'

    // 仕込み品セクション（0件でも表示）
    html += `
        <div class="mb-4">
            <div class="bg-orange-500 text-white text-center py-2 rounded-lg font-bold mb-2">
                🍳 仕込み品（${preparations.length}件）
            </div>
    `
    if (preparations.length > 0) {
        for (const prep of preparations) {
            const unitCost = getIngredientUnitCost('preparation', prep.preparation_id, allItems, allPreparations)
            html += `
                <div class="p-3 border rounded-lg cursor-pointer hover:border-orange-500 hover:bg-orange-50 transition-colors mb-2 ai-result-item"
                    data-type="preparation" data-id="${prep.preparation_id}" data-name="${escapeHtml(prep.preparation_name)}" data-unit="${escapeHtml(prep.yield_unit || '')}">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="font-medium text-gray-800">${escapeHtml(prep.preparation_name)}</p>
                            <p class="text-sm text-gray-500">${escapeHtml(prep.yield_unit || '')}</p>
                        </div>
                        <div class="text-right">
                            <p class="font-bold text-orange-600">¥${unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                        </div>
                    </div>
                </div>
            `
        }
    } else {
        html += `<p class="text-gray-400 text-center py-2 text-sm">（該当なし）</p>`
    }
    html += '</div>'

    // 仕入れ商品セクション（0件でも表示）
    html += `
        <div class="mb-4">
            <div class="bg-green-500 text-white text-center py-2 rounded-lg font-bold mb-2">
                📦 仕入れ商品 → 新規アイテム作成（${products.length}件）
            </div>
            <button class="w-full mb-3 px-4 py-3 bg-yellow-100 text-yellow-800 rounded-lg font-bold hover:bg-yellow-200 transition-colors border-2 border-yellow-300 manual-create-btn-ai">
                ✨ 仕入れ商品なしでアイテムを作成
            </button>
    `
    if (products.length > 0) {
        for (const product of products) {
            html += `
                <div class="p-3 border rounded-lg cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors mb-2 ai-result-product"
                    data-code="${escapeHtml(product.product_code)}"
                    data-name="${escapeHtml(product.product_name)}"
                    data-spec="${escapeHtml(product.specification || '')}"
                    data-price="${product.unit_price || 0}"
                    data-supplier="${escapeHtml(product.supplier_name)}">
                    <div class="flex items-center justify-between">
                        <div class="flex-1 min-w-0">
                            <p class="font-medium text-gray-800">${escapeHtml(product.product_name)}</p>
                            <p class="text-sm text-gray-500">${escapeHtml(product.supplier_name)} / ${escapeHtml(product.specification || '-')}</p>
                        </div>
                        <div class="text-right flex-shrink-0 ml-2">
                            <p class="font-bold text-gray-700">¥${(product.unit_price || 0).toLocaleString()}</p>
                            <p class="text-xs text-green-600">→ アイテム作成</p>
                        </div>
                    </div>
                </div>
            `
        }
    } else {
        html += `<p class="text-gray-400 text-center py-2 text-sm">（該当なし）</p>`
    }
    html += '</div>'

    container.innerHTML = html

    // アイテム・仕込み品のクリックイベント
    container.querySelectorAll('.ai-result-item').forEach(el => {
        el.addEventListener('click', () => {
            // 選択状態をリセット
            container.querySelectorAll('.ai-result-item, .ai-result-product').forEach(e => {
                e.classList.remove('border-blue-500', 'bg-blue-50', 'border-orange-500', 'bg-orange-50', 'border-green-500', 'bg-green-50')
            })

            const type = el.dataset.type
            if (type === 'item') {
                el.classList.add('border-blue-500', 'bg-blue-50')
            } else {
                el.classList.add('border-orange-500', 'bg-orange-50')
            }

            // 選択候補をセット
            const unitCost = getIngredientUnitCost(
                el.dataset.type,
                parseInt(el.dataset.id),
                allItems,
                allPreparations
            )
            selectedLinkCandidate = {
                type: el.dataset.type,
                id: parseInt(el.dataset.id),
                name: el.dataset.name,
                sub: el.dataset.unit,
                unitCost: unitCost
            }
            document.getElementById('confirmLink').disabled = false
        })
    })

    // 仕入れ商品のクリックイベント（クイックアイテム作成モーダルを開く）
    container.querySelectorAll('.ai-result-product').forEach(el => {
        el.addEventListener('click', () => {
            const ingredientName = ingredientNames[currentLinkingIndex] || ''
            quickItemModalManager.open({
                productCode: el.dataset.code,
                productName: el.dataset.name,
                specification: el.dataset.spec,
                unitPrice: parseFloat(el.dataset.price) || 0,
                supplierName: el.dataset.supplier,
                initialItemName: ingredientName,
                initialItemKana: lastAIGeneratedKana || ''
            })
        })
    })

    // 「仕入れ商品なしで作成」ボタン
    container.querySelector('.manual-create-btn-ai')?.addEventListener('click', () => {
        const ingredientName = ingredientNames[currentLinkingIndex] || ''
        quickItemModalManager.openManualMode({
            itemName: ingredientName,
            itemKana: lastAIGeneratedKana || ''
        })
    })
}

function confirmLink() {
    if (currentLinkingIndex === null || !selectedLinkCandidate) return

    linkedIngredients[currentLinkingIndex] = {
        type: selectedLinkCandidate.type,
        id: selectedLinkCandidate.id,
        linkedName: selectedLinkCandidate.name,
        unit: selectedLinkCandidate.sub,
        unitCost: selectedLinkCandidate.unitCost
    }

    closeLinkModal()
    renderIngredientLinkList()
}

// 仕入れ商品リスト表示（業者ごとにグループ化）
let expandedProductSupplier = null

function renderProductList() {
    const container = document.getElementById('linkCandidateList')
    const searchValue = document.getElementById('linkSearchInput').value

    // 非表示の業者を除外
    const visibleSupplierNames = new Set(allSuppliers.map(s => s.supplier_name))
    let filtered = allProducts.filter(p => visibleSupplierNames.has(p.supplier_name))

    // 検索フィルタ
    if (searchValue) {
        const normalizedQuery = normalizeForSearch(searchValue)
        filtered = filtered.filter(p => {
            const normalizedName = normalizeForSearch(p.product_name)
            return normalizedName.includes(normalizedQuery) || p.product_name.includes(searchValue)
        })
    }

    // 「仕入れ商品なしで作成」ボタン（常に表示）
    let html = `
        <button class="w-full mb-3 px-4 py-3 bg-yellow-100 text-yellow-800 rounded-lg font-bold hover:bg-yellow-200 transition-colors border-2 border-yellow-300 manual-create-btn-product">
            ✨ 仕入れ商品なしでアイテムを作成
        </button>
    `

    if (filtered.length === 0) {
        html += '<p class="text-gray-500 text-center py-4">該当する商品がありません</p>'
        container.innerHTML = html
        setupManualCreateButton()
        return
    }

    // 業者ごとにグループ化
    const grouped = {}
    for (const p of filtered) {
        if (!grouped[p.supplier_name]) {
            grouped[p.supplier_name] = []
        }
        grouped[p.supplier_name].push(p)
    }

    const sortedSuppliers = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'ja'))

    for (const supplier of sortedSuppliers) {
        const products = grouped[supplier]
        const isExpanded = expandedProductSupplier === supplier

        html += `
            <div class="border-b border-gray-200">
                <div class="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 product-supplier-row" data-supplier="${escapeHtml(supplier)}">
                    <div class="flex items-center gap-2">
                        <span class="text-gray-400">${isExpanded ? '▼' : '▶'}</span>
                        <span class="font-bold text-gray-700">${escapeHtml(supplier)}</span>
                        <span class="text-sm text-gray-400">(${products.length}件)</span>
                    </div>
                </div>
        `

        if (isExpanded) {
            html += '<div class="bg-gray-50 pb-2">'
            for (const product of products) {
                html += `
                    <div class="flex items-center gap-4 px-6 py-3 hover:bg-blue-50 cursor-pointer product-row border-b border-gray-100 last:border-b-0"
                        data-code="${escapeHtml(product.product_code)}"
                        data-name="${escapeHtml(product.product_name)}"
                        data-spec="${escapeHtml(product.specification || '')}"
                        data-price="${product.unit_price || 0}"
                        data-supplier="${escapeHtml(product.supplier_name)}">
                        <div class="flex-1 min-w-0">
                            <div class="font-medium text-gray-800 truncate">${escapeHtml(product.product_name)}</div>
                            <div class="text-xs text-gray-400">${escapeHtml(product.specification || '-')}</div>
                        </div>
                        <div class="text-right flex-shrink-0">
                            <div class="font-bold text-gray-700">¥${(product.unit_price || 0).toLocaleString()}</div>
                        </div>
                        <div class="flex-shrink-0 text-blue-600 font-bold">→</div>
                    </div>
                `
            }
            html += '</div>'
        }

        html += '</div>'
    }

    container.innerHTML = html

    // 「仕入れ商品なしで作成」ボタン
    setupManualCreateButton()

    // 業者クリックで展開/閉じる
    container.querySelectorAll('.product-supplier-row').forEach(row => {
        row.addEventListener('click', () => {
            const supplier = row.dataset.supplier
            expandedProductSupplier = expandedProductSupplier === supplier ? null : supplier
            renderProductList()
        })
    })

    // 商品クリックでクイックアイテム作成モーダル
    container.querySelectorAll('.product-row').forEach(row => {
        row.addEventListener('click', () => {
            const ingredientName = ingredientNames[currentLinkingIndex] || ''
            quickItemModalManager.open({
                productCode: row.dataset.code,
                productName: row.dataset.name,
                specification: row.dataset.spec,
                unitPrice: parseFloat(row.dataset.price) || 0,
                supplierName: row.dataset.supplier,
                initialItemName: ingredientName,
                initialItemKana: lastAIGeneratedKana || ''
            })
        })
    })
}

// 「仕入れ商品なしで作成」ボタンのイベント設定
function setupManualCreateButton() {
    const container = document.getElementById('linkCandidateList')
    container.querySelector('.manual-create-btn-product')?.addEventListener('click', () => {
        const ingredientName = ingredientNames[currentLinkingIndex] || ''
        quickItemModalManager.openManualMode({
            itemName: ingredientName,
            itemKana: lastAIGeneratedKana || ''
        })
    })
}

// ===================================
// STEP6: 分量確認
// ===================================

function renderQuantityTable() {
    const tbody = document.getElementById('quantityTableBody')
    tbody.innerHTML = ''

    ingredientNames.forEach((name, index) => {
        const linked = linkedIngredients[index]
        const recipe = extractedRecipes[selectedRecipeIndex]
        const ingredientData = recipe?.ingredients?.[index] || {}

        // 初期値をlinkedIngredientsにセット
        if (!linkedIngredients[index].quantity) {
            linkedIngredients[index].quantity = ingredientData.quantity || 0
        }
        if (!linkedIngredients[index].displayUnit) {
            linkedIngredients[index].displayUnit = ingredientData.unit || linked?.unit || ''
        }

        const tr = document.createElement('tr')
        tr.className = 'border-b'
        tr.innerHTML = `
            <td class="py-3 px-3">
                <p class="font-medium">${escapeHtml(linked?.linkedName || name)}</p>
                <p class="text-xs text-gray-400">${escapeHtml(name)}</p>
            </td>
            <td class="py-3 px-3">
                <input type="number" step="any" value="${linkedIngredients[index].quantity || ''}"
                    class="w-24 p-2 border rounded-lg quantity-input" data-index="${index}" />
            </td>
            <td class="py-3 px-3">
                <input type="text" value="${escapeHtml(linkedIngredients[index].displayUnit || '')}"
                    class="w-20 p-2 border rounded-lg unit-input" data-index="${index}" />
            </td>
        `
        tbody.appendChild(tr)
    })

    // 入力イベント
    tbody.querySelectorAll('.quantity-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index)
            linkedIngredients[index].quantity = parseFloat(e.target.value) || 0
        })
    })

    tbody.querySelectorAll('.unit-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index)
            linkedIngredients[index].displayUnit = e.target.value
        })
    })
}

// ===================================
// STEP7: 登録
// ===================================

async function registerRecipe() {
    const recipeType = document.querySelector('input[name="recipeType"]:checked')?.value
    const name = document.getElementById('recipeName').value.trim()
    const kana = toHalfWidthKatakana(document.getElementById('recipeKana').value.trim())
    const sectionId = document.getElementById('recipeSection').value
    const businessTypeId = getCurrentBusinessTypeId()

    if (!recipeType || !name || !kana || !sectionId) {
        alert('必須項目を入力してください')
        return
    }

    try {
        if (recipeType === 'preparation') {
            // 仕込み品登録
            const yieldQuantity = parseFloat(document.getElementById('yieldQuantity').value) || 0
            const yieldUnit = document.getElementById('yieldUnit').value.trim()

            if (!yieldQuantity || !yieldUnit) {
                alert('仕上がり量と単位を入力してください')
                return
            }

            // 仕込み品を登録
            const { data: prep, error: prepError } = await supabase
                .from('preparations')
                .insert({
                    preparation_name: name,
                    preparation_kana: kana,
                    section_id: parseInt(sectionId),
                    yield_quantity: yieldQuantity,
                    yield_unit: yieldUnit,
                    business_type_id: businessTypeId,
                    needs_review: false
                })
                .select()
                .single()

            if (prepError) throw prepError

            // 材料を登録
            const ingredientsToInsert = linkedIngredients
                .filter(ing => ing && ing.type && ing.id)
                .map(ing => ({
                    preparation_id: prep.preparation_id,
                    ingredient_type: ing.type,
                    ingredient_id: ing.id,
                    quantity: ing.quantity || 0
                }))

            if (ingredientsToInsert.length > 0) {
                const { error: ingError } = await supabase
                    .from('preparation_ingredients')
                    .insert(ingredientsToInsert)

                if (ingError) throw ingError
            }

            document.getElementById('completionMessage').textContent =
                `「${name}」を仕込み品として登録しました。`

        } else {
            // 商品登録
            const sellingPrice = parseFloat(document.getElementById('sellingPrice').value) || null

            // 商品を登録
            const { data: dish, error: dishError } = await supabase
                .from('dishes')
                .insert({
                    dish_name: name,
                    dish_kana: kana,
                    section_id: parseInt(sectionId),
                    selling_price: sellingPrice,
                    business_type_id: businessTypeId
                })
                .select()
                .single()

            if (dishError) throw dishError

            // 材料を登録
            const ingredientsToInsert = linkedIngredients
                .filter(ing => ing && ing.type && ing.id)
                .map(ing => ({
                    dish_id: dish.dish_id,
                    ingredient_type: ing.type,
                    ingredient_id: ing.id,
                    quantity: ing.quantity || 0
                }))

            if (ingredientsToInsert.length > 0) {
                const { error: ingError } = await supabase
                    .from('dish_ingredients')
                    .insert(ingredientsToInsert)

                if (ingError) throw ingError
            }

            document.getElementById('completionMessage').textContent =
                `「${name}」を商品として登録しました。`
        }

        // 選択したレシピをリストから削除
        extractedRecipes.splice(selectedRecipeIndex, 1)

        // 未登録レシピがあれば表示
        if (extractedRecipes.length > 0) {
            document.getElementById('remainingRecipes').classList.remove('hidden')
            renderRemainingRecipes()

            // 状態をリセット（次のレシピ選択に備える）
            selectedRecipeIndex = null
            linkedIngredients = []
            ingredientNames = []

            // STEP2としてセッション保存（復元時はレシピ選択から再開）
            currentStep = 2
            await saveSession()

        } else {
            document.getElementById('remainingRecipes').classList.add('hidden')
            // 全レシピ登録完了 → セッション削除
            if (currentSessionId) {
                await supabase
                    .from('ai_support_sessions')
                    .delete()
                    .eq('session_id', currentSessionId)
                currentSessionId = null
            }
        }

        // マスタデータを再読み込み（登録したデータを反映）
        await loadMasterData()

        goToStep(7)

    } catch (error) {
        console.error('登録エラー:', error)
        alert('登録に失敗しました: ' + error.message)
    }
}

function renderRemainingRecipes() {
    const container = document.getElementById('remainingRecipeList')
    container.innerHTML = ''

    extractedRecipes.forEach((recipe, index) => {
        const div = document.createElement('div')
        div.className = 'p-3 bg-gray-50 rounded-lg text-left'
        div.innerHTML = `
            <p class="font-medium">${escapeHtml(recipe.name)}</p>
            <p class="text-sm text-gray-500">材料: ${recipe.ingredients?.length || 0}種類</p>
        `
        container.appendChild(div)
    })
}

// ===================================
// ステップ管理
// ===================================

function goToStep(step) {
    currentStep = step

    // 全ステップを非表示
    document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'))

    // 対象ステップを表示
    document.getElementById(`step${step}`).classList.remove('hidden')

    // インジケーター更新
    document.querySelectorAll('.step-indicator').forEach(el => {
        const s = parseInt(el.dataset.step)
        const circle = el.querySelector('div')

        if (s < step) {
            // 完了
            el.classList.remove('opacity-50')
            circle.classList.remove('bg-gray-300', 'text-gray-600')
            circle.classList.add('bg-green-500', 'text-white')
        } else if (s === step) {
            // 現在
            el.classList.remove('opacity-50')
            circle.classList.remove('bg-gray-300', 'text-gray-600', 'bg-green-500')
            circle.classList.add('bg-blue-600', 'text-white')
        } else {
            // 未到達
            el.classList.add('opacity-50')
            circle.classList.remove('bg-blue-600', 'bg-green-500', 'text-white')
            circle.classList.add('bg-gray-300', 'text-gray-600')
        }
    })

    // ステップ固有の初期化
    // --- STEP2: レシピ選択 ---
    if (step === 2) {
        // 選択状態をリセット
        selectedRecipeIndex = null
        document.getElementById('goToStep3').disabled = true
        // レシピリストを再描画（2回目以降の登録時に配列とHTMLを同期させる）
        renderRecipeList()
    }

    // --- STEP3: 基本情報 ---
    if (step === 3 && selectedRecipeIndex !== null) {
        const recipe = extractedRecipes[selectedRecipeIndex]
        document.getElementById('recipeName').value = recipe.name || ''
        // AIの読み仮名を使用（name_kana）
        document.getElementById('recipeKana').value = recipe.name_kana || ''
        ingredientNames = (recipe.ingredients || []).map(i => i.name || '')
        linkedIngredients = new Array(ingredientNames.length).fill(null).map(() => ({}))

        // 種別をデフォルトで「仕込み品」に設定
        const prepRadio = document.querySelector('input[name="recipeType"][value="preparation"]')
        if (prepRadio) {
            prepRadio.checked = true
            toggleRecipeTypeFields('preparation')
        }
    }

    // --- STEP4: 材料リスト確認 ---
    if (step === 4) {
        renderIngredientNameList()
    }

    // --- STEP5: 材料の紐付け ---
    if (step === 5) {
        // 空の材料を除外
        const filteredNames = []
        const filteredLinked = []
        ingredientNames.forEach((name, i) => {
            if (name.trim() !== '') {
                filteredNames.push(name)
                filteredLinked.push(linkedIngredients[i] || {})
            }
        })
        ingredientNames = filteredNames
        linkedIngredients = filteredLinked
        renderIngredientLinkList()
    }

    // --- STEP6: 分量確認 ---
    if (step === 6) {
        // 仕込み品の場合は仕上がりフィールドを表示
        const recipeType = document.querySelector('input[name="recipeType"]:checked')?.value
        const yieldFields = document.getElementById('yieldFieldsStep6')
        if (recipeType === 'preparation') {
            yieldFields.classList.remove('hidden')
        } else {
            yieldFields.classList.add('hidden')
        }

        renderQuantityTable()
    }

    // セッション自動保存（STEP2以降）
    if (step >= 2 && step <= 6) {
        saveSession()
    }
}

function resetAll() {
    currentStep = 1
    uploadedFile = null
    extractedRecipes = []
    selectedRecipeIndex = null
    ingredientNames = []
    linkedIngredients = []
    duplicateMap = {}

    // セッション関連もリセット
    currentSessionId = null
    originalFileName = ''

    clearSelectedFile()
    document.getElementById('goToStep3').disabled = true

    // フォームリセット
    document.getElementById('recipeName').value = ''
    document.getElementById('recipeKana').value = ''
    document.getElementById('recipeSection').value = ''
    document.getElementById('yieldQuantity').value = ''
    document.getElementById('yieldUnit').value = ''
    document.getElementById('sellingPrice').value = ''

    // 種別選択をリセット
    const radios = document.querySelectorAll('input[name="recipeType"]')
    radios.forEach(r => r.checked = false)

    // 商品フィールドを非表示
    const dishFields = document.getElementById('dishFields')
    if (dishFields) {
        dishFields.classList.add('hidden')
    }

    // STEP6の仕上がりフィールドを非表示
    const yieldFieldsStep6 = document.getElementById('yieldFieldsStep6')
    if (yieldFieldsStep6) {
        yieldFieldsStep6.classList.add('hidden')
    }

    // 履歴を再読み込み
    loadSessionHistory()
}

// ===================================
// セッション保存・復元（F023）
// ===================================

// セッション履歴を読み込んで表示
async function loadSessionHistory() {
    const businessTypeId = getCurrentBusinessTypeId()

    try {
        const { data: sessions, error } = await supabase
            .from('ai_support_sessions')
            .select('*')
            .eq('business_type_id', businessTypeId)
            .order('updated_at', { ascending: false })
            .limit(10)

        if (error) throw error

        const section = document.getElementById('sessionHistorySection')
        const container = document.getElementById('sessionHistoryList')

        if (!sessions || sessions.length === 0) {
            section.classList.add('hidden')
            return
        }

        section.classList.remove('hidden')
        container.innerHTML = ''

        sessions.forEach(session => {
            const div = document.createElement('div')
            div.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors'
            div.dataset.sessionId = session.session_id

            const date = new Date(session.updated_at)
            const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`

            div.innerHTML = `
                <div class="flex items-center gap-3 flex-1 min-w-0">
                    <span class="text-xl">📄</span>
                    <div class="flex-1 min-w-0">
                        <p class="font-medium text-gray-800 truncate">${escapeHtml(session.file_name || '無題')}</p>
                        <p class="text-xs text-gray-500">
                            ${dateStr} ・ STEP${session.current_step} ・ 残り${session.remaining_count}件
                        </p>
                    </div>
                </div>
                <button class="delete-session-btn text-gray-400 hover:text-red-500 p-1 flex-shrink-0" data-session-id="${session.session_id}">
                    🗑️
                </button>
            `

            // セッション復元
            div.addEventListener('click', (e) => {
                if (e.target.closest('.delete-session-btn')) return
                restoreSession(session)
            })

            container.appendChild(div)
        })

        // 削除ボタン
        container.querySelectorAll('.delete-session-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation()
                const sessionId = parseInt(btn.dataset.sessionId)
                await deleteSession(sessionId)
            })
        })

    } catch (error) {
        console.error('セッション履歴読み込みエラー:', error)
    }
}

// セッションを保存
async function saveSession() {
    // STEP1では保存しない（ファイル読み取り完了後から保存開始）
    if (currentStep === 1 || extractedRecipes.length === 0) {
        return
    }

    const businessTypeId = getCurrentBusinessTypeId()

    // フォームデータを収集
    const formData = {
        recipeType: document.querySelector('input[name="recipeType"]:checked')?.value || '',
        recipeName: document.getElementById('recipeName').value,
        recipeKana: document.getElementById('recipeKana').value,
        sectionId: document.getElementById('recipeSection').value,
        sellingPrice: document.getElementById('sellingPrice').value,
        yieldQuantity: document.getElementById('yieldQuantity').value,
        yieldUnit: document.getElementById('yieldUnit').value
    }

    const sessionData = {
        extractedRecipes,
        selectedRecipeIndex,
        ingredientNames,
        linkedIngredients,
        duplicateMap,
        formData
    }

    try {
        if (currentSessionId) {
            // 既存セッションを更新
            const { error } = await supabase
                .from('ai_support_sessions')
                .update({
                    session_data: sessionData,
                    current_step: currentStep,
                    remaining_count: extractedRecipes.length,
                    updated_at: new Date().toISOString()
                })
                .eq('session_id', currentSessionId)

            if (error) throw error
            console.log('セッション更新:', currentSessionId)

        } else {
            // 新規セッション作成前に件数チェック
            await cleanupOldSessions(businessTypeId)

            // 新規作成
            const { data, error } = await supabase
                .from('ai_support_sessions')
                .insert({
                    business_type_id: businessTypeId,
                    file_name: originalFileName,
                    session_data: sessionData,
                    recipe_count: extractedRecipes.length,
                    remaining_count: extractedRecipes.length,
                    current_step: currentStep
                })
                .select()
                .single()

            if (error) throw error
            currentSessionId = data.session_id
            console.log('セッション作成:', currentSessionId)
        }

    } catch (error) {
        console.error('セッション保存エラー:', error)
    }
}

// 古いセッションを削除（10件を超えた場合）
async function cleanupOldSessions(businessTypeId) {
    try {
        // 現在の件数を確認
        const { data: sessions, error: countError } = await supabase
            .from('ai_support_sessions')
            .select('session_id')
            .eq('business_type_id', businessTypeId)
            .order('updated_at', { ascending: false })

        if (countError) throw countError

        // 10件以上あれば古いものを削除
        if (sessions && sessions.length >= 10) {
            const sessionsToDelete = sessions.slice(9) // 10件目以降
            const idsToDelete = sessionsToDelete.map(s => s.session_id)

            const { error: deleteError } = await supabase
                .from('ai_support_sessions')
                .delete()
                .in('session_id', idsToDelete)

            if (deleteError) throw deleteError
            console.log('古いセッション削除:', idsToDelete)
        }

    } catch (error) {
        console.error('セッションクリーンアップエラー:', error)
    }
}

// セッションを復元
async function restoreSession(session) {
    try {
        const data = session.session_data

        // 状態を復元
        currentSessionId = session.session_id
        originalFileName = session.file_name || ''
        extractedRecipes = data.extractedRecipes || []
        selectedRecipeIndex = data.selectedRecipeIndex
        ingredientNames = data.ingredientNames || []
        linkedIngredients = data.linkedIngredients || []
        duplicateMap = data.duplicateMap || {}

        // フォームデータを復元
        if (data.formData) {
            const formData = data.formData

            // 種別
            if (formData.recipeType) {
                const radio = document.querySelector(`input[name="recipeType"][value="${formData.recipeType}"]`)
                if (radio) {
                    radio.checked = true
                    toggleRecipeTypeFields(formData.recipeType)
                }
            }

            document.getElementById('recipeName').value = formData.recipeName || ''
            document.getElementById('recipeKana').value = formData.recipeKana || ''
            document.getElementById('recipeSection').value = formData.sectionId || ''
            document.getElementById('sellingPrice').value = formData.sellingPrice || ''
            document.getElementById('yieldQuantity').value = formData.yieldQuantity || ''
            document.getElementById('yieldUnit').value = formData.yieldUnit || ''
        }

        // ファイル選択状態を表示（実際のファイルはないので名前だけ）
        if (originalFileName) {
            document.getElementById('selectedFile').classList.remove('hidden')
            document.getElementById('fileName').textContent = originalFileName + '（復元済み）'
            document.getElementById('fileSize').textContent = '作業途中から再開'
            document.getElementById('fileIcon').textContent = '📄'
            document.getElementById('analyzeBtn').disabled = true
        }

        // 該当ステップへ移動
        goToStep(session.current_step)

        console.log('セッション復元完了:', session.session_id)

    } catch (error) {
        console.error('セッション復元エラー:', error)
        alert('セッションの復元に失敗しました')
    }
}

// セッションを削除
async function deleteSession(sessionId) {
    if (!confirm('このセッションを削除しますか？')) {
        return
    }

    try {
        const { error } = await supabase
            .from('ai_support_sessions')
            .delete()
            .eq('session_id', sessionId)

        if (error) throw error

        // 現在のセッションが削除された場合はリセット
        if (currentSessionId === sessionId) {
            currentSessionId = null
        }

        // 履歴を再読み込み
        await loadSessionHistory()

    } catch (error) {
        console.error('セッション削除エラー:', error)
        alert('削除に失敗しました')
    }
}

// ===================================
// ユーティリティ
// ===================================

function escapeHtml(str) {
    if (!str) return ''
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}