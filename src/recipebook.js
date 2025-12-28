import { supabase } from './supabase.js'
import { calculatePreparationCost, getIngredientUnitCost } from './costCalculator.js'
import { initBusinessTypeSelector, getCurrentBusinessTypeId } from './businessType.js'
import { toHalfWidthKatakana, withBusinessTypeFilter, renderIngredientTree } from './utils.js'

// ============================================
// DOM要素の取得
// ============================================
const searchInput = document.getElementById('searchInput')
const recipeContent = document.getElementById('recipeContent')
const emptyState = document.getElementById('emptyState')
const noResultState = document.getElementById('noResultState')

// ============================================
// 状態管理
// ============================================
let allPreparations = []
let allItems = []
let allSections = []
let searchQuery = ''

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
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value
        renderRecipes()
    })
}

// ============================================
// データ読み込み
// ============================================
async function loadData() {
    recipeContent.innerHTML = '<div class="bg-white rounded-lg shadow-md p-8 text-center"><p class="text-gray-500">読み込み中...</p></div>'

    const businessTypeId = getCurrentBusinessTypeId()

    // セクション一覧
    const { data: sections, error: sectionsError } = await withBusinessTypeFilter(
        supabase.from('preparation_sections').select('*').order('sort_order', { ascending: true }),
        businessTypeId
    )
    if (sectionsError) console.error('セクション取得エラー:', sectionsError)
    allSections = sections || []

    // 仕込み品一覧
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
        recipeContent.innerHTML = '<div class="bg-white rounded-lg shadow-md p-8 text-center"><p class="text-red-500">データの取得に失敗しました</p></div>'
        return
    }
    allPreparations = preparations || []

    // アイテム一覧
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
    if (itemsError) console.error('アイテム取得エラー:', itemsError)
    allItems = items || []

    renderRecipes()
}

// ============================================
// レシピ表示
// ============================================
function renderRecipes() {
    let filtered = allPreparations

    // 検索フィルタ
    if (searchQuery) {
        const searchKana = toHalfWidthKatakana(searchQuery)
        filtered = filtered.filter(prep =>
            prep.preparation_name.includes(searchQuery) ||
            (prep.preparation_kana && prep.preparation_kana.includes(searchKana))
        )
    }

    // 空判定
    if (allPreparations.length === 0) {
        recipeContent.innerHTML = ''
        emptyState.classList.remove('hidden')
        noResultState.classList.add('hidden')
        return
    }

    if (filtered.length === 0) {
        recipeContent.innerHTML = ''
        emptyState.classList.add('hidden')
        noResultState.classList.remove('hidden')
        return
    }

    emptyState.classList.add('hidden')
    noResultState.classList.add('hidden')

    // セクションごとにグループ化
    const grouped = {}
    allSections.forEach(s => {
        grouped[s.section_id] = { section: s, preparations: [] }
    })
    grouped['none'] = { section: { section_id: null, section_name: '未分類', sort_order: 9999 }, preparations: [] }

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

    sortedGroups.forEach((group, groupIndex) => {
        const sectionUniqueId = `section-${groupIndex}`

        html += `
            <div class="bg-white rounded-lg shadow-md overflow-hidden">
                <div class="section-header flex items-center justify-between p-4 bg-green-50 cursor-pointer hover:bg-green-100 transition-colors"
                     data-target="${sectionUniqueId}">
                    <div class="flex items-center gap-3">
                        <span class="section-arrow text-green-400 transition-transform duration-200">▶</span>
                        <h3 class="text-lg font-bold text-green-800">${group.section.section_name}</h3>
                        <span class="text-sm text-green-400">（${group.preparations.length}件）</span>
                    </div>
                </div>
                <div id="${sectionUniqueId}" class="section-content hidden overflow-hidden transition-all duration-300" style="max-height: 0;">
                    <div class="divide-y divide-gray-100">
        `

        // セクション内の仕込み品を五十音順でソート
        const sortedPreps = group.preparations.sort((a, b) => {
            const kanaA = a.preparation_kana || ''
            const kanaB = b.preparation_kana || ''
            return kanaA.localeCompare(kanaB, 'ja')
        })

        sortedPreps.forEach((prep, prepIndex) => {
            const cost = calculatePreparationCost(prep.preparation_id, allItems, allPreparations)
            const unitCost = prep.yield_quantity > 0 ? cost / prep.yield_quantity : 0
            const ingredientCount = prep.preparation_ingredients?.length || 0
            const prepUniqueId = `prep-${groupIndex}-${prepIndex}`

            html += `
                <div class="prep-item">
                    <div class="prep-header flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                         data-target="${prepUniqueId}">
                        <div class="flex items-center gap-3">
                            <span class="prep-arrow text-gray-400 transition-transform duration-200">▶</span>
                            <span class="text-orange-600">🍳</span>
                            <div>
                                <span class="font-bold text-gray-800">${prep.preparation_name}</span>
                                <span class="text-gray-400 text-sm ml-2">（材料${ingredientCount}種）</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-4 text-sm">
                            <div class="text-right">
                                <span class="text-gray-500">原価</span>
                                <span class="font-bold text-blue-600 ml-1">¥${Math.round(cost).toLocaleString()}</span>
                            </div>
                            <div class="text-right">
                                <span class="text-gray-500">単位原価</span>
                                <span class="font-bold text-gray-700 ml-1">¥${unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                <span class="text-gray-400 text-xs">/ ${prep.yield_unit}</span>
                            </div>
                            <div class="text-right text-gray-400 text-xs">
                                仕上がり: ${prep.yield_quantity} ${prep.yield_unit}
                            </div>
                        </div>
                    </div>
                    <div id="${prepUniqueId}" class="prep-content hidden overflow-hidden transition-all duration-300 bg-gray-50" style="max-height: 0;">
                        <div class="ingredient-tree py-2" data-prep-id="${prep.preparation_id}">
                            <!-- 材料ツリーは展開時に動的生成 -->
                        </div>
                        <div class="prep-close-btn flex items-center justify-end p-2 cursor-pointer hover:bg-gray-100"
                             data-target="${prepUniqueId}">
                            <span class="text-xs text-gray-500">▲ 閉じる</span>
                        </div>
                    </div>
                </div>
            `
        })

        html += `
                    </div>
                    <div class="section-close-btn flex items-center justify-end p-3 bg-green-50 cursor-pointer hover:bg-green-100"
                         data-target="${sectionUniqueId}">
                        <span class="text-xs text-green-600">▲ セクションを閉じる</span>
                    </div>
                </div>
            </div>
        `
    })

    recipeContent.innerHTML = html

    // セクションの開閉イベント
    document.querySelectorAll('.section-header').forEach(header => {
        header.addEventListener('click', () => toggleSection(header))
    })
    document.querySelectorAll('.section-close-btn').forEach(btn => {
        btn.addEventListener('click', () => closeSection(btn))
    })

    // 仕込み品の開閉イベント
    document.querySelectorAll('.prep-header').forEach(header => {
        header.addEventListener('click', () => togglePrep(header))
    })
    document.querySelectorAll('.prep-close-btn').forEach(btn => {
        btn.addEventListener('click', () => closePrep(btn))
    })
}

// ============================================
// セクション開閉
// ============================================
function toggleSection(header) {
    const targetId = header.dataset.target
    const content = document.getElementById(targetId)
    const arrow = header.querySelector('.section-arrow')
    const isOpening = content.classList.contains('hidden')

    // 同階層の他のセクションを閉じる
    document.querySelectorAll('.section-header').forEach(otherHeader => {
        const otherTargetId = otherHeader.dataset.target
        if (otherTargetId === targetId) return

        const otherContent = document.getElementById(otherTargetId)
        const otherArrow = otherHeader.querySelector('.section-arrow')

        if (otherContent && !otherContent.classList.contains('hidden')) {
            resetAllChildren(otherContent)

            otherContent.style.maxHeight = otherContent.scrollHeight + 'px'
            otherContent.offsetHeight
            otherContent.style.maxHeight = '0px'

            setTimeout(() => {
                otherContent.classList.add('hidden')
                otherArrow.style.transform = 'rotate(0deg)'
            }, 300)
        }
    })

    if (isOpening) {
        content.classList.remove('hidden')
        arrow.style.transform = 'rotate(90deg)'

        const height = content.scrollHeight
        content.style.maxHeight = '0px'
        content.offsetHeight
        content.style.maxHeight = height + 'px'

        setTimeout(() => {
            content.style.maxHeight = 'none'
        }, 300)
    } else {
        resetAllChildren(content)

        content.style.maxHeight = content.scrollHeight + 'px'
        content.offsetHeight
        content.style.maxHeight = '0px'

        setTimeout(() => {
            content.classList.add('hidden')
            arrow.style.transform = 'rotate(0deg)'
        }, 300)
    }
}

function closeSection(btn) {
    const targetId = btn.dataset.target
    const content = document.getElementById(targetId)
    const header = content.previousElementSibling
    const arrow = header.querySelector('.section-arrow')

    resetAllChildren(content)

    content.style.maxHeight = content.scrollHeight + 'px'
    content.offsetHeight
    content.style.maxHeight = '0px'

    setTimeout(() => {
        content.classList.add('hidden')
        arrow.style.transform = 'rotate(0deg)'
    }, 300)
}

// ============================================
// 仕込み品開閉
// ============================================
function togglePrep(header) {
    const targetId = header.dataset.target
    const content = document.getElementById(targetId)
    const arrow = header.querySelector('.prep-arrow')
    const isOpening = content.classList.contains('hidden')

    // 同じセクション内の他の仕込み品を閉じる
    const sectionContent = header.closest('.section-content')
    if (sectionContent) {
        sectionContent.querySelectorAll('.prep-header').forEach(otherHeader => {
            const otherTargetId = otherHeader.dataset.target
            if (otherTargetId === targetId) return

            const otherContent = document.getElementById(otherTargetId)
            const otherArrow = otherHeader.querySelector('.prep-arrow')

            if (otherContent && !otherContent.classList.contains('hidden')) {
                resetAllChildren(otherContent)

                otherContent.style.maxHeight = otherContent.scrollHeight + 'px'
                otherContent.offsetHeight
                otherContent.style.maxHeight = '0px'

                setTimeout(() => {
                    otherContent.classList.add('hidden')
                    otherArrow.style.transform = 'rotate(0deg)'
                }, 300)
            }
        })
    }

    if (isOpening) {
        content.classList.remove('hidden')
        arrow.style.transform = 'rotate(90deg)'

        const treeContainer = content.querySelector('.ingredient-tree')
        if (treeContainer && treeContainer.children.length === 0) {
            const prepId = parseInt(treeContainer.dataset.prepId)
            const prep = allPreparations.find(p => p.preparation_id === prepId)
            if (prep && prep.preparation_ingredients) {
                renderIngredientTree({
                    container: treeContainer,
                    ingredients: prep.preparation_ingredients,
                    allItems,
                    allPreparations,
                    depth: 0
                })
            }
        }

        const height = content.scrollHeight
        content.style.maxHeight = '0px'
        content.offsetHeight
        content.style.maxHeight = height + 'px'

        setTimeout(() => {
            content.style.maxHeight = 'none'
        }, 300)
    } else {
        resetAllChildren(content)

        content.style.maxHeight = content.scrollHeight + 'px'
        content.offsetHeight
        content.style.maxHeight = '0px'

        setTimeout(() => {
            content.classList.add('hidden')
            arrow.style.transform = 'rotate(0deg)'
        }, 300)
    }
}

function closePrep(btn) {
    const targetId = btn.dataset.target
    const content = document.getElementById(targetId)
    const prepItem = content.closest('.prep-item')
    const arrow = prepItem.querySelector('.prep-arrow')

    resetAllChildren(content)

    content.style.maxHeight = content.scrollHeight + 'px'
    content.offsetHeight
    content.style.maxHeight = '0px'

    setTimeout(() => {
        content.classList.add('hidden')
        arrow.style.transform = 'rotate(0deg)'
    }, 300)
}

// ============================================
// 子孫要素の状態をリセット
// ============================================
function resetAllChildren(container) {
    // 仕込み品の子要素をリセット
    container.querySelectorAll('.prep-content').forEach(child => {
        child.classList.add('hidden')
        child.style.maxHeight = '0px'
    })
    container.querySelectorAll('.prep-arrow').forEach(arrow => {
        arrow.style.transform = 'rotate(0deg)'
    })

    // 材料ツリー内の仕込み品をリセット
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