import { supabase } from './supabase.js'
import { calculateDishCost, getIngredientUnitCost } from './costCalculator.js'
import { initBusinessTypeSelector, getCurrentBusinessTypeId } from './businessType.js'
import { toHalfWidthKatakana, loadTaxRate, withBusinessTypeFilter, renderIngredientTree } from './utils.js'

// ============================================
// DOM要素の取得
// ============================================
const searchInput = document.getElementById('searchInput')
const menuContent = document.getElementById('menuContent')
const emptyState = document.getElementById('emptyState')
const noResultState = document.getElementById('noResultState')

// ============================================
// 状態管理
// ============================================
let allDishes = []
let allItems = []
let allPreparations = []
let allSections = []
let taxRate = 10
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
        renderMenu()
    })
}

// ============================================
// データ読み込み
// ============================================
async function loadData() {
    menuContent.innerHTML = '<div class="bg-white rounded-lg shadow-md p-8 text-center"><p class="text-gray-500">読み込み中...</p></div>'

    taxRate = await loadTaxRate()
    const businessTypeId = getCurrentBusinessTypeId()

    // セクション一覧
    const { data: sections, error: sectionsError } = await withBusinessTypeFilter(
        supabase.from('dish_sections').select('*').order('sort_order', { ascending: true }),
        businessTypeId
    )
    if (sectionsError) console.error('セクション取得エラー:', sectionsError)
    allSections = sections || []

    // 商品一覧
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
        menuContent.innerHTML = '<div class="bg-white rounded-lg shadow-md p-8 text-center"><p class="text-red-500">データの取得に失敗しました</p></div>'
        return
    }
    allDishes = dishes || []

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
        `),
        businessTypeId
    )
    if (prepError) console.error('仕込み品取得エラー:', prepError)
    allPreparations = preparations || []

    renderMenu()
}

// ============================================
// メニュー表示
// ============================================
function renderMenu() {
    let filtered = allDishes

    // 検索フィルタ
    if (searchQuery) {
        const searchKana = toHalfWidthKatakana(searchQuery)
        filtered = filtered.filter(dish =>
            dish.dish_name.includes(searchQuery) ||
            (dish.dish_kana && dish.dish_kana.includes(searchKana))
        )
    }

    // 空判定
    if (allDishes.length === 0) {
        menuContent.innerHTML = ''
        emptyState.classList.remove('hidden')
        noResultState.classList.add('hidden')
        return
    }

    if (filtered.length === 0) {
        menuContent.innerHTML = ''
        emptyState.classList.add('hidden')
        noResultState.classList.remove('hidden')
        return
    }

    emptyState.classList.add('hidden')
    noResultState.classList.add('hidden')

    // セクションごとにグループ化
    const grouped = {}
    allSections.forEach(s => {
        grouped[s.section_id] = { section: s, dishes: [] }
    })
    grouped['none'] = { section: { section_id: null, section_name: '未分類', sort_order: 9999 }, dishes: [] }

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

    sortedGroups.forEach((group, groupIndex) => {
        const sectionUniqueId = `section-${groupIndex}`

        html += `
            <div class="bg-white rounded-lg shadow-md overflow-hidden">
                <div class="section-header flex items-center justify-between p-4 bg-purple-50 cursor-pointer hover:bg-purple-100 transition-colors"
                     data-target="${sectionUniqueId}">
                    <div class="flex items-center gap-3">
                        <span class="section-arrow text-purple-400 transition-transform duration-200">▶</span>
                        <h3 class="text-lg font-bold text-purple-800">${group.section.section_name}</h3>
                        <span class="text-sm text-purple-400">（${group.dishes.length}件）</span>
                    </div>
                </div>
                <div id="${sectionUniqueId}" class="section-content hidden overflow-hidden transition-all duration-300" style="max-height: 0;">
                    <div class="divide-y divide-gray-100">
        `

        // セクション内の商品を五十音順でソート
        const sortedDishes = group.dishes.sort((a, b) => {
            const kanaA = a.dish_kana || ''
            const kanaB = b.dish_kana || ''
            return kanaA.localeCompare(kanaB, 'ja')
        })

        sortedDishes.forEach((dish, dishIndex) => {
            const cost = calculateDishCost(dish.dish_id, allItems, allPreparations, allDishes)
            const sellingPrice = dish.selling_price || 0
            const taxIncludedPrice = sellingPrice > 0 ? Math.round(sellingPrice * (1 + taxRate / 100)) : 0
            const costRate = sellingPrice > 0 ? (cost / sellingPrice * 100) : 0
            const ingredientCount = dish.dish_ingredients?.length || 0
            const dishUniqueId = `dish-${groupIndex}-${dishIndex}`

            html += `
                <div class="dish-item">
                    <div class="dish-header flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                         data-target="${dishUniqueId}">
                        <div class="flex items-center gap-3">
                            <span class="dish-arrow text-gray-400 transition-transform duration-200">▶</span>
                            <span class="text-gray-600">🍽️</span>
                            <div>
                                <span class="font-bold text-gray-800">${dish.dish_name}</span>
                                <span class="text-gray-400 text-sm ml-2">（材料${ingredientCount}種）</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-4 text-sm">
                            <div class="text-right">
                                <span class="text-gray-500">原価</span>
                                <span class="font-bold text-blue-600 ml-1">¥${Math.round(cost).toLocaleString()}</span>
                            </div>
                            ${sellingPrice > 0 ? `
                                <div class="text-right">
                                    <span class="text-gray-500">売価</span>
                                    <span class="font-bold text-gray-800 ml-1">¥${sellingPrice.toLocaleString()}</span>
                                    <span class="text-gray-400 text-xs">（税込¥${taxIncludedPrice.toLocaleString()}）</span>
                                </div>
                                <div class="text-right">
                                    <span class="text-gray-500">原価率</span>
                                    <span class="font-bold ml-1 ${costRate > 35 ? 'text-red-600' : costRate > 30 ? 'text-orange-500' : 'text-green-600'}">${costRate.toFixed(1)}%</span>
                                </div>
                            ` : `
                                <div class="text-gray-400 text-xs">売価未設定</div>
                            `}
                        </div>
                    </div>
                    <div id="${dishUniqueId}" class="dish-content hidden overflow-hidden transition-all duration-300 bg-gray-50" style="max-height: 0;">
                        <div class="ingredient-tree py-2" data-dish-id="${dish.dish_id}">
                            <!-- 材料ツリーは展開時に動的生成 -->
                        </div>
                        <div class="dish-close-btn flex items-center justify-end p-2 cursor-pointer hover:bg-gray-100"
                             data-target="${dishUniqueId}">
                            <span class="text-xs text-gray-500">▲ 閉じる</span>
                        </div>
                    </div>
                </div>
            `
        })

        html += `
                    </div>
                    <div class="section-close-btn flex items-center justify-end p-3 bg-purple-50 cursor-pointer hover:bg-purple-100"
                         data-target="${sectionUniqueId}">
                        <span class="text-xs text-purple-600">▲ セクションを閉じる</span>
                    </div>
                </div>
            </div>
        `
    })

    menuContent.innerHTML = html

    // セクションの開閉イベント
    document.querySelectorAll('.section-header').forEach(header => {
        header.addEventListener('click', () => toggleSection(header))
    })
    document.querySelectorAll('.section-close-btn').forEach(btn => {
        btn.addEventListener('click', () => closeSection(btn))
    })

    // 商品の開閉イベント
    document.querySelectorAll('.dish-header').forEach(header => {
        header.addEventListener('click', () => toggleDish(header))
    })
    document.querySelectorAll('.dish-close-btn').forEach(btn => {
        btn.addEventListener('click', () => closeDish(btn))
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
            // 子孫も全部リセット
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
        // 開く
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
        // 閉じる（子孫もリセット）
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

    // 子孫もリセット
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
// 商品開閉
// ============================================
function toggleDish(header) {
    const targetId = header.dataset.target
    const content = document.getElementById(targetId)
    const arrow = header.querySelector('.dish-arrow')
    const isOpening = content.classList.contains('hidden')

    // 同じセクション内の他の商品を閉じる
    const sectionContent = header.closest('.section-content')
    if (sectionContent) {
        sectionContent.querySelectorAll('.dish-header').forEach(otherHeader => {
            const otherTargetId = otherHeader.dataset.target
            if (otherTargetId === targetId) return

            const otherContent = document.getElementById(otherTargetId)
            const otherArrow = otherHeader.querySelector('.dish-arrow')

            if (otherContent && !otherContent.classList.contains('hidden')) {
                // 子孫も全部リセット
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
        // 開く
        content.classList.remove('hidden')
        arrow.style.transform = 'rotate(90deg)'

        // 材料ツリーがまだ生成されてなければ生成
        const treeContainer = content.querySelector('.ingredient-tree')
        if (treeContainer && treeContainer.children.length === 0) {
            const dishId = parseInt(treeContainer.dataset.dishId)
            const dish = allDishes.find(d => d.dish_id === dishId)
            if (dish && dish.dish_ingredients) {
                renderIngredientTree({
                    container: treeContainer,
                    ingredients: dish.dish_ingredients,
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
        // 閉じる（子孫もリセット）
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

function closeDish(btn) {
    const targetId = btn.dataset.target
    const content = document.getElementById(targetId)
    const dishItem = content.closest('.dish-item')
    const arrow = dishItem.querySelector('.dish-arrow')

    // 子孫もリセット
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
    // 商品の子要素をリセット
    container.querySelectorAll('.dish-content').forEach(child => {
        child.classList.add('hidden')
        child.style.maxHeight = '0px'
    })
    container.querySelectorAll('.dish-arrow').forEach(arrow => {
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