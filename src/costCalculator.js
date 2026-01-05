/**
 * 原価計算の共通関数
 * 
 * 【使い方】
 * import { calculateItemUnitCost, calculatePreparationCost, calculateDishCost } from './costCalculator.js'
 */

// ============================================
// アイテムの単位原価を計算
// ============================================
/**
 * @param {number} productUnitPrice - 仕入れ単価
 * @param {number} yieldQuantity - 取れる数
 * @returns {number} 単位原価
 */
export function calculateItemUnitCost(productUnitPrice, yieldQuantity) {
    if (!yieldQuantity || yieldQuantity <= 0) return 0
    return (productUnitPrice || 0) / yieldQuantity
}

// ============================================
// 仕込み品の原価を計算（再帰対応）
// ============================================
/**
 * @param {number} preparationId - 計算対象の仕込み品ID
 * @param {Array} allItems - 全アイテム配列（products含む）
 * @param {Array} allPreparations - 全仕込み品配列（preparation_ingredients含む）
 * @param {Set} visited - 循環参照検出用（内部使用）
 * @returns {number} 原価合計
 */
export function calculatePreparationCost(preparationId, allItems, allPreparations, visited = new Set()) {
    // 循環参照チェック
    if (visited.has(preparationId)) {
        console.warn(`循環参照を検出: preparation_id=${preparationId}`)
        return 0
    }
    visited.add(preparationId)

    const prep = allPreparations.find(p => p.preparation_id === preparationId)
    if (!prep || !prep.preparation_ingredients) return 0

    let totalCost = 0

    for (const ing of prep.preparation_ingredients) {
        const unitCost = getIngredientUnitCost(
            ing.ingredient_type,
            ing.ingredient_id,
            allItems,
            allPreparations,
            new Set(visited) // コピーを渡す
        )
        totalCost += unitCost * (ing.quantity || 0)
    }

    return totalCost
}

// ============================================
// 商品の原価を計算
// ============================================
/**
 * @param {number} dishId - 計算対象の商品ID
 * @param {Array} allItems - 全アイテム配列（products含む）
 * @param {Array} allPreparations - 全仕込み品配列（preparation_ingredients含む）
 * @param {Array} allDishes - 全商品配列（dish_ingredients含む）
 * @returns {number} 原価合計
 */
export function calculateDishCost(dishId, allItems, allPreparations, allDishes) {
    const dish = allDishes.find(d => d.dish_id === dishId)
    if (!dish || !dish.dish_ingredients) return 0

    let totalCost = 0

    for (const ing of dish.dish_ingredients) {
        const unitCost = getIngredientUnitCost(
            ing.ingredient_type,
            ing.ingredient_id,
            allItems,
            allPreparations,
            new Set()
        )
        totalCost += unitCost * (ing.quantity || 0)
    }

    return totalCost
}

// ============================================
// 材料の単位原価を取得（共通ヘルパー）
// ============================================
/**
 * @param {string} type - 'item' または 'preparation'
 * @param {number} id - 材料ID
 * @param {Array} allItems - 全アイテム配列
 * @param {Array} allPreparations - 全仕込み品配列
 * @param {Set} visited - 循環参照検出用
 * @returns {number} 単位原価
 */
export function getIngredientUnitCost(type, id, allItems, allPreparations, visited = new Set()) {
    if (type === 'item') {
        const item = allItems.find(i => i.item_id === id)
        if (!item) return 0

        // 手動単価の場合はmanual_unit_costを使用
        if (item.manual_price && item.manual_unit_cost !== null && item.manual_unit_cost !== undefined) {
            return item.manual_unit_cost
        }

        // 通常の場合は仕入れ単価から計算
        const productPrice = item.products?.unit_price || 0
        return calculateItemUnitCost(productPrice, item.yield_quantity)
    } else if (type === 'preparation') {
        const prep = allPreparations.find(p => p.preparation_id === id)
        if (!prep) return 0
        // 仕込み品の原価を計算して、仕上がり量で割る
        const totalCost = calculatePreparationCost(id, allItems, allPreparations, visited)
        return prep.yield_quantity > 0 ? totalCost / prep.yield_quantity : 0
    }
    return 0
}