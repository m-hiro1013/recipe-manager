/**
 * モーダル管理クラス集
 * 
 * 【含まれるクラス】
 * - IngredientModalManager: 材料選択モーダル（preparations, dishes, ai-support で使用）
 * - QuickItemModalManager: クイックアイテム作成モーダル（preparations, dishes, ai-support で使用）
 */

import { supabase } from './supabase.js'
import {
    toHalfWidthKatakana,
    sanitizeToFullWidthKatakana,
    normalizeForSearch
} from './utils.js'

// ============================================
// 材料選択モーダル共通モジュール
// ============================================

/**
 * 材料選択モーダルの状態管理クラス
 * HTMLも動的に生成するため、各ページでモーダルHTMLを用意する必要なし
 */
export class IngredientModalManager {
    constructor(options) {
        // 親モーダル（作成 or 編集モーダル）
        this.parentModal = options.parentModal

        // データ参照（外部から渡される）
        this.getAllItems = options.getAllItems
        this.getAllPreparations = options.getAllPreparations
        this.getAllProducts = options.getAllProducts
        this.getAllSuppliers = options.getAllSuppliers
        this.getIngredientUnitCost = options.getIngredientUnitCost

        // コールバック
        this.onIngredientsAdded = options.onIngredientsAdded
        this.onQuickItemCreate = options.onQuickItemCreate
        this.onQuickItemManualCreate = options.onQuickItemManualCreate

        // 除外ID（編集中の仕込み品を除外する用）
        this.getExcludePrepId = options.getExcludePrepId || (() => null)

        // 状態
        this.currentTab = 'items'
        this.itemSearchQuery = ''
        this.prepSearchQuery = ''
        this.productSearchQuery = ''
        this.productSupplierFilter = ''
        this.productActiveFilter = 'on'
        this.selectedIngredients = []
        this.expandedProductSupplier = null
        this.isModalCreated = false

        // DOM要素（createModal後に設定）
        this.elements = {}
    }

    /**
     * モーダルHTMLを生成してDOMに追加
     */
    createModal() {
        if (this.isModalCreated) return

        const modalHTML = `
            <div id="ingredientModal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex items-center justify-center">
                <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
                    <div class="p-4 border-b flex justify-between items-center">
                        <h2 class="text-lg font-bold">🧩 材料を選択</h2>
                        <button id="closeIngredientModal" class="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                    </div>

                    <!-- タブ -->
                    <div class="flex border-b">
                        <button id="tabItems" class="flex-1 px-4 py-3 text-center font-bold border-b-2 border-blue-600 text-blue-600">
                            🧩 アイテム
                        </button>
                        <button id="tabPreparations" class="flex-1 px-4 py-3 text-center font-bold border-b-2 border-transparent text-gray-500 hover:text-gray-700">
                            🍳 仕込み品
                        </button>
                        <button id="tabProducts" class="flex-1 px-4 py-3 text-center font-bold border-b-2 border-transparent text-gray-500 hover:text-gray-700">
                            📦 仕入れ商品
                        </button>
                    </div>

                    <div class="p-4 overflow-y-auto max-h-[60vh]">
                        <!-- アイテムタブ -->
                        <div id="tabContentItems">
                            <input type="text" id="itemSearchInput" placeholder="🔍 アイテム名で検索..."
                                class="w-full p-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 mb-4" />
                            <div id="itemSelectList" class="space-y-1 max-h-[40vh] overflow-y-auto">
                            </div>
                        </div>

                        <!-- 仕込み品タブ -->
                        <div id="tabContentPreparations" class="hidden">
                            <input type="text" id="prepSearchInput" placeholder="🔍 仕込み品名で検索..."
                                class="w-full p-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 mb-4" />
                            <div id="prepSelectList" class="space-y-1 max-h-[40vh] overflow-y-auto">
                            </div>
                        </div>

                        <!-- 仕入れ商品タブ -->
                        <div id="tabContentProducts" class="hidden">
                            <div class="flex gap-2 mb-4">
                                <input type="text" id="productSearchInput" placeholder="🔍 商品名で検索..."
                                    class="flex-1 p-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" />
                                <select id="supplierSelect"
                                    class="p-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500">
                                    <option value="">全業者</option>
                                </select>
                            </div>
                            <div class="flex items-center gap-4 mb-4">
                                <span class="text-sm text-gray-600">使用フラグ:</span>
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="productActiveFilter" value="on" checked class="product-active-filter" />
                                    <span class="text-sm">ONのみ</span>
                                </label>
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="productActiveFilter" value="off" class="product-active-filter" />
                                    <span class="text-sm">OFFのみ</span>
                                </label>
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="productActiveFilter" value="all" class="product-active-filter" />
                                    <span class="text-sm">すべて</span>
                                </label>
                            </div>
                            <p class="text-sm text-gray-500 mb-4">💡 商品をクリックすると、アイテムを作成して追加できます</p>
                            <div id="productSelectList" class="space-y-1 max-h-[40vh] overflow-y-auto">
                            </div>
                        </div>
                    </div>

                    <!-- 選択状況・追加ボタン -->
                    <div class="p-4 border-t bg-gray-50 flex justify-between items-center">
                        <span id="selectedCount" class="text-sm text-gray-600">選択中: 0件</span>
                        <button id="addSelectedIngredients"
                            class="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                            disabled>
                            選択した材料を追加
                        </button>
                    </div>
                </div>
            </div>
        `

        // DOMに追加
        const container = document.createElement('div')
        container.innerHTML = modalHTML
        document.body.appendChild(container.firstElementChild)

        // DOM要素を取得
        this.elements = {
            modal: document.getElementById('ingredientModal'),
            closeBtn: document.getElementById('closeIngredientModal'),
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
            addSelectedIngredientsBtn: document.getElementById('addSelectedIngredients')
        }

        this.isModalCreated = true
        this.setupEventListeners()
    }

    /**
     * モーダルを開く
     */
    open() {
        if (!this.isModalCreated) {
            this.createModal()
        }

        this.selectedIngredients = []
        this.itemSearchQuery = ''
        this.prepSearchQuery = ''
        this.productSearchQuery = ''
        this.productSupplierFilter = ''
        this.productActiveFilter = 'on'
        this.expandedProductSupplier = null

        this.elements.itemSearchInput.value = ''
        this.elements.prepSearchInput.value = ''
        this.elements.productSearchInput.value = ''
        this.elements.supplierSelect.value = ''

        const activeFilterRadio = document.querySelector('input[name="productActiveFilter"][value="on"]')
        if (activeFilterRadio) activeFilterRadio.checked = true

        // 業者プルダウンを更新
        this.renderSupplierSelect()

        this.switchTab('items')
        this.updateSelectedCount()

        this.parentModal.classList.add('hidden')
        this.elements.modal.classList.remove('hidden')
    }

    /**
     * モーダルを閉じる
     */
    close() {
        this.elements.modal.classList.add('hidden')
        this.parentModal.classList.remove('hidden')
    }

    /**
     * 親モーダルを設定（作成/編集の切り替え用）
     */
    setParentModal(modal) {
        this.parentModal = modal
    }

    /**
     * 業者プルダウン生成
     */
    renderSupplierSelect() {
        const allSuppliers = this.getAllSuppliers()
        this.elements.supplierSelect.innerHTML = '<option value="">全業者</option>'
        allSuppliers.forEach(supplier => {
            this.elements.supplierSelect.innerHTML += `<option value="${supplier.supplier_name}">${supplier.supplier_name}</option>`
        })
    }

    /**
     * タブ切り替え
     */
    switchTab(tab) {
        this.currentTab = tab

        const tabs = [this.elements.tabItems, this.elements.tabPreparations, this.elements.tabProducts]
        const contents = [this.elements.tabContentItems, this.elements.tabContentPreparations, this.elements.tabContentProducts]
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
            this.renderItemSelectList()
        } else if (tab === 'preparations') {
            this.renderPrepSelectList()
        } else if (tab === 'products') {
            this.renderProductSelectList()
        }
    }

    /**
     * アイテム選択リスト表示
     */
    renderItemSelectList() {
        const allItems = this.getAllItems()
        let filtered = allItems

        if (this.itemSearchQuery) {
            const searchKana = toHalfWidthKatakana(this.itemSearchQuery)
            filtered = allItems.filter(item =>
                item.item_name.includes(this.itemSearchQuery) ||
                (item.item_kana && item.item_kana.includes(searchKana))
            )
        }

        if (filtered.length === 0) {
            this.elements.itemSelectList.innerHTML = '<p class="text-center text-gray-500 py-8">該当するアイテムがありません</p>'
            return
        }

        this.elements.itemSelectList.innerHTML = filtered.map(item => {
            const isSelected = this.selectedIngredients.some(s => s.type === 'item' && s.id === item.item_id)
            const unitCost = this.getIngredientUnitCost('item', item.item_id)
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

        this.elements.itemSelectList.querySelectorAll('.item-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => this.handleIngredientCheckbox(e))
        })
    }

    /**
     * 仕込み品選択リスト表示
     */
    renderPrepSelectList() {
        const allPreparations = this.getAllPreparations()
        let filtered = allPreparations

        // 編集中の仕込み品を除外
        const excludeId = this.getExcludePrepId()
        if (excludeId) {
            filtered = filtered.filter(p => p.preparation_id !== excludeId)
        }

        if (this.prepSearchQuery) {
            const searchKana = toHalfWidthKatakana(this.prepSearchQuery)
            filtered = filtered.filter(prep =>
                prep.preparation_name.includes(this.prepSearchQuery) ||
                (prep.preparation_kana && prep.preparation_kana.includes(searchKana))
            )
        }

        if (filtered.length === 0) {
            this.elements.prepSelectList.innerHTML = '<p class="text-center text-gray-500 py-8">該当する仕込み品がありません</p>'
            return
        }

        this.elements.prepSelectList.innerHTML = filtered.map(prep => {
            const isSelected = this.selectedIngredients.some(s => s.type === 'preparation' && s.id === prep.preparation_id)
            const unitCost = this.getIngredientUnitCost('preparation', prep.preparation_id)
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

        this.elements.prepSelectList.querySelectorAll('.prep-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => this.handleIngredientCheckbox(e))
        })
    }

    /**
     * 仕入れ商品選択リスト表示
     */
    renderProductSelectList() {
        const allProducts = this.getAllProducts()
        const allSuppliers = this.getAllSuppliers()

        // 非表示の業者を除外
        const visibleSupplierNames = new Set(allSuppliers.map(s => s.supplier_name))
        let filtered = allProducts.filter(p => visibleSupplierNames.has(p.supplier_name))

        if (this.productSupplierFilter) {
            filtered = filtered.filter(p => p.supplier_name === this.productSupplierFilter)
        }

        if (this.productActiveFilter === 'on') {
            filtered = filtered.filter(p => p.is_active)
        } else if (this.productActiveFilter === 'off') {
            filtered = filtered.filter(p => !p.is_active)
        }

        if (this.productSearchQuery) {
            const normalizedQuery = normalizeForSearch(this.productSearchQuery)
            filtered = filtered.filter(p => {
                const normalizedName = normalizeForSearch(p.product_name)
                return normalizedName.includes(normalizedQuery) || p.product_name.includes(this.productSearchQuery)
            })
        }

        // 「仕入れ商品なしで作成」ボタン
        let html = `
            <div class="p-3 border-b border-gray-200">
                <button type="button" class="quick-manual-create-btn w-full px-4 py-3 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded-lg font-bold transition-colors flex items-center justify-center gap-2">
                    🔁 仕入れ商品なしで作成
                </button>
            </div>
        `

        if (filtered.length === 0) {
            html += '<p class="text-center text-gray-500 py-8">該当する商品がありません</p>'
            this.elements.productSelectList.innerHTML = html
            this.setupManualCreateButton()
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

        for (const supplier of sortedSuppliers) {
            const products = grouped[supplier]
            const isExpanded = this.expandedProductSupplier === supplier

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

        this.elements.productSelectList.innerHTML = html

        // 業者クリックで展開
        this.elements.productSelectList.querySelectorAll('.product-supplier-row').forEach(row => {
            row.addEventListener('click', () => {
                const supplier = row.dataset.supplier
                this.expandedProductSupplier = this.expandedProductSupplier === supplier ? null : supplier
                this.renderProductSelectList()
            })
        })

        // 商品クリックでクイックアイテム作成
        this.elements.productSelectList.querySelectorAll('.product-row').forEach(row => {
            row.addEventListener('click', () => {
                if (this.onQuickItemCreate) {
                    this.onQuickItemCreate(row)
                }
            })
        })

        // 手動作成ボタン
        this.setupManualCreateButton()
    }

    /**
     * 手動作成ボタンのイベント設定
     */
    setupManualCreateButton() {
        const btn = this.elements.productSelectList.querySelector('.quick-manual-create-btn')
        if (btn) {
            btn.addEventListener('click', () => {
                if (this.onQuickItemManualCreate) {
                    this.onQuickItemManualCreate()
                }
            })
        }
    }

    /**
     * チェックボックス変更ハンドラ
     */
    handleIngredientCheckbox(e) {
        const checkbox = e.target
        const type = checkbox.dataset.type
        const id = parseInt(checkbox.dataset.id)
        const name = checkbox.dataset.name
        const unit = checkbox.dataset.unit
        const unitCost = parseFloat(checkbox.dataset.unitCost) || 0

        if (checkbox.checked) {
            if (!this.selectedIngredients.some(s => s.type === type && s.id === id)) {
                this.selectedIngredients.push({ type, id, name, unit, unitCost })
            }
        } else {
            this.selectedIngredients = this.selectedIngredients.filter(s => !(s.type === type && s.id === id))
        }

        this.updateSelectedCount()
    }

    /**
     * 選択数更新
     */
    updateSelectedCount() {
        const count = this.selectedIngredients.length
        this.elements.selectedCount.textContent = `選択中: ${count}件`
        this.elements.addSelectedIngredientsBtn.disabled = count === 0
    }

    /**
     * 選択した材料を追加
     */
    addSelectedIngredients() {
        if (this.onIngredientsAdded) {
            this.onIngredientsAdded(this.selectedIngredients)
        }
        this.close()
    }

    /**
     * 選択済みに追加（クイックアイテム作成後用）
     */
    addToSelected(ingredient) {
        this.selectedIngredients.push(ingredient)
        this.updateSelectedCount()
    }

    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        // 閉じるボタン
        this.elements.closeBtn.addEventListener('click', () => this.close())

        // タブ切り替え
        this.elements.tabItems.addEventListener('click', () => this.switchTab('items'))
        this.elements.tabPreparations.addEventListener('click', () => this.switchTab('preparations'))
        this.elements.tabProducts.addEventListener('click', () => this.switchTab('products'))

        // 検索
        this.elements.itemSearchInput.addEventListener('input', (e) => {
            this.itemSearchQuery = e.target.value
            this.renderItemSelectList()
        })

        this.elements.prepSearchInput.addEventListener('input', (e) => {
            this.prepSearchQuery = e.target.value
            this.renderPrepSelectList()
        })

        this.elements.productSearchInput.addEventListener('input', (e) => {
            this.productSearchQuery = e.target.value
            this.renderProductSelectList()
        })

        // 業者フィルター
        this.elements.supplierSelect.addEventListener('change', (e) => {
            this.productSupplierFilter = e.target.value
            this.renderProductSelectList()
        })

        // 使用フラグフィルター
        document.querySelectorAll('.product-active-filter').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.productActiveFilter = e.target.value
                this.renderProductSelectList()
            })
        })

        // 選択した材料を追加
        this.elements.addSelectedIngredientsBtn.addEventListener('click', () => this.addSelectedIngredients())
    }
}

// ============================================
// クイックアイテム作成モーダル
// ============================================

/**
 * クイックアイテム作成モーダルの共通処理
 * HTML動的生成 + 手動単価モード対応
 */
export class QuickItemModalManager {
    constructor(options) {
        // データ参照
        this.getAllProducts = options.getAllProducts
        this.getAllGenres = options.getAllGenres
        this.getBusinessTypeId = options.getBusinessTypeId
        this.supabase = options.supabase

        // コールバック
        this.onItemCreated = options.onItemCreated

        // 状態
        this.currentMode = 'product' // 'product' or 'manual'
        this.isModalCreated = false

        // DOM要素（createModal後に設定）
        this.elements = {}
    }

    /**
     * モーダルHTMLを生成してDOMに追加
     */
    createModal() {
        if (this.isModalCreated) return

        const modalHTML = `
            <div id="quickItemModal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-[60] flex items-center justify-center">
                <div class="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden">
                    <div class="p-4 border-b flex justify-between items-center">
                        <h2 class="text-lg font-bold">🧩 クイックアイテム作成</h2>
                        <button id="closeQuickItemModal" class="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                    </div>
                    <div class="p-6 overflow-y-auto max-h-[70vh]">
                        
                        <!-- モード切り替えタブ -->
                        <div class="flex gap-2 mb-4">
                            <button type="button" id="quickTabProductMode"
                                class="flex-1 px-3 py-2 rounded-lg font-bold transition-colors text-sm bg-blue-600 text-white">
                                📦 仕入れ商品から
                            </button>
                            <button type="button" id="quickTabManualMode"
                                class="flex-1 px-3 py-2 rounded-lg font-bold transition-colors text-sm bg-gray-200 text-gray-700 hover:bg-gray-300">
                                🔁 手動で入力
                            </button>
                        </div>

                        <input type="hidden" id="quickProductCode" />
                        <input type="hidden" id="quickProductPrice" />
                        <input type="hidden" id="quickCurrentMode" value="product" />

                        <!-- 仕入れ商品モード -->
                        <div id="quickProductModeSection">
                            <div class="mb-4 p-3 bg-gray-100 rounded-lg">
                                <p class="text-sm text-gray-500">選択した商品</p>
                                <p id="quickProductInfo" class="font-medium text-gray-800">商品を選択してください</p>
                            </div>
                        </div>

                        <!-- 手動入力モード -->
                        <div id="quickManualModeSection" class="hidden">
                            <div class="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <p class="text-sm text-yellow-800 mb-3">🔁 仕入れ商品に紐付かないアイテムを作成します</p>
                                
                                <div class="grid grid-cols-2 gap-3 mb-3">
                                    <div>
                                        <label class="block text-xs font-bold text-gray-700 mb-1">
                                            総量 <span class="text-red-500">*</span>
                                        </label>
                                        <input type="number" id="quickManualTotalQuantity" step="0.01" min="0"
                                            class="w-full p-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                                            placeholder="例：1000" />
                                    </div>
                                    <div>
                                        <label class="block text-xs font-bold text-gray-700 mb-1">
                                            総量の単位
                                        </label>
                                        <input type="text" id="quickManualTotalUnit" readonly
                                            class="w-full p-2 border-2 border-gray-100 rounded-lg bg-gray-50 text-gray-500 text-sm"
                                            placeholder="使用単位と同じ" />
                                    </div>
                                </div>

                                <div class="mb-3">
                                    <label class="block text-xs font-bold text-gray-700 mb-1">
                                        仕入れ金額
                                    </label>
                                    <div class="flex items-center gap-2">
                                        <span class="text-gray-500 text-sm">¥</span>
                                        <input type="number" id="quickManualTotalPrice" step="1" min="0"
                                            class="flex-1 p-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                                            placeholder="例：500（0円も可）" />
                                    </div>
                                </div>

                                <div class="bg-yellow-100 rounded-lg p-3">
                                    <p class="text-xs text-gray-600 mb-1">単位原価（自動計算）</p>
                                    <p id="quickManualUnitCostPreview" class="text-lg font-bold text-yellow-700">---</p>
                                </div>
                            </div>
                        </div>

                        <!-- 共通フォーム -->
                        <div class="mb-4">
                            <label class="block text-sm font-bold text-gray-700 mb-2">
                                アイテム名 <span class="text-red-500">*</span>
                            </label>
                            <input type="text" id="quickItemName" placeholder="例：カットレモン"
                                class="w-full p-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" />
                        </div>

                        <div class="mb-4">
                            <label class="block text-sm font-bold text-gray-700 mb-2">
                                読み仮名 <span class="text-red-500">*</span>
                            </label>
                            <input type="text" id="quickItemKana" placeholder="例：カットレモン"
                                class="w-full p-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" />
                            <p class="mt-1 text-xs text-gray-500">ひらがな・カタカナで入力（自動で全角カタカナに変換）</p>
                        </div>

                        <!-- 仕入れ商品モード用：使用単位と取れる数 -->
                        <div id="quickProductFields">
                            <div class="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label class="block text-sm font-bold text-gray-700 mb-2">
                                        使用単位 <span class="text-red-500">*</span>
                                    </label>
                                    <input type="text" id="quickItemUnit" placeholder="例：個"
                                        class="w-full p-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" />
                                </div>
                                <div>
                                    <label class="block text-sm font-bold text-gray-700 mb-2">
                                        取れる数 <span class="text-red-500">*</span>
                                    </label>
                                    <input type="number" id="quickYieldQuantity" placeholder="例：10" step="0.01" min="0.01"
                                        class="w-full p-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" />
                                </div>
                            </div>
                        </div>

                        <!-- 手動モード用：使用単位のみ -->
                        <div id="quickManualFields" class="hidden">
                            <div class="mb-4">
                                <label class="block text-sm font-bold text-gray-700 mb-2">
                                    使用単位 <span class="text-red-500">*</span>
                                </label>
                                <input type="text" id="quickManualItemUnit" placeholder="例：g、ml、個"
                                    class="w-full p-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500" />
                            </div>
                        </div>

                        <!-- ジャンル -->
                        <div class="mb-4">
                            <label class="block text-sm font-bold text-gray-700 mb-2">
                                ジャンル <span class="text-red-500">*</span>
                            </label>
                            <select id="quickItemGenre"
                                class="w-full p-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500">
                                <option value="">選択してください</option>
                            </select>
                        </div>

                        <!-- 単位原価プレビュー（仕入れ商品モード用） -->
                        <div id="quickProductCostPreview" class="bg-blue-50 rounded-lg p-4 mb-4">
                            <p class="text-sm text-gray-600 mb-1">単位原価（自動計算）</p>
                            <p id="quickUnitCostPreview" class="text-xl font-bold text-blue-600">---</p>
                        </div>

                        <!-- 要確認フラグ -->
                        <div class="mb-4">
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" id="quickItemNeedsReview"
                                    class="w-5 h-5 text-red-600 rounded border-2 border-gray-300 focus:ring-red-500" />
                                <span class="text-sm font-bold text-gray-700">⚠️ 要確認</span>
                                <span class="text-xs text-gray-500">（仮の数値で登録する場合）</span>
                            </label>
                        </div>

                        <div class="flex gap-4">
                            <button id="cancelQuickItem"
                                class="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50 transition-colors">
                                キャンセル
                            </button>
                            <button id="submitQuickItem"
                                class="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors">
                                作成して追加
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `

        // DOMに追加
        const container = document.createElement('div')
        container.innerHTML = modalHTML
        document.body.appendChild(container.firstElementChild)

        // DOM要素を取得
        this.elements = {
            modal: document.getElementById('quickItemModal'),
            closeBtn: document.getElementById('closeQuickItemModal'),
            cancelBtn: document.getElementById('cancelQuickItem'),
            submitBtn: document.getElementById('submitQuickItem'),
            productCode: document.getElementById('quickProductCode'),
            productPrice: document.getElementById('quickProductPrice'),
            currentMode: document.getElementById('quickCurrentMode'),
            productInfo: document.getElementById('quickProductInfo'),
            itemName: document.getElementById('quickItemName'),
            itemKana: document.getElementById('quickItemKana'),
            itemUnit: document.getElementById('quickItemUnit'),
            yieldQuantity: document.getElementById('quickYieldQuantity'),
            unitCostPreview: document.getElementById('quickUnitCostPreview'),
            itemGenre: document.getElementById('quickItemGenre'),
            itemNeedsReview: document.getElementById('quickItemNeedsReview'),
            // タブ
            tabProductMode: document.getElementById('quickTabProductMode'),
            tabManualMode: document.getElementById('quickTabManualMode'),
            // セクション
            productModeSection: document.getElementById('quickProductModeSection'),
            manualModeSection: document.getElementById('quickManualModeSection'),
            productFields: document.getElementById('quickProductFields'),
            manualFields: document.getElementById('quickManualFields'),
            productCostPreview: document.getElementById('quickProductCostPreview'),
            // 手動入力フィールド
            manualTotalQuantity: document.getElementById('quickManualTotalQuantity'),
            manualTotalUnit: document.getElementById('quickManualTotalUnit'),
            manualTotalPrice: document.getElementById('quickManualTotalPrice'),
            manualUnitCostPreview: document.getElementById('quickManualUnitCostPreview'),
            manualItemUnit: document.getElementById('quickManualItemUnit')
        }

        this.isModalCreated = true
        this.setupEventListeners()
    }

    /**
 * モーダルを開く（仕入れ商品モード）
 * @param {HTMLElement|Object} rowOrData - DOM要素 または データオブジェクト
 */
    open(rowOrData) {
        if (!this.isModalCreated) {
            this.createModal()
        }

        let code, name, spec, price, supplier
        let initialItemName = ''
        let initialItemKana = ''

        // DOM要素かオブジェクトかを判定
        if (rowOrData instanceof HTMLElement) {
            // DOM要素から取得（preparations.js, dishes.js からの呼び出し）
            code = rowOrData.dataset.code
            name = rowOrData.dataset.name
            spec = rowOrData.dataset.spec || ''
            price = parseFloat(rowOrData.dataset.price) || 0
            supplier = rowOrData.dataset.supplier
        } else {
            // オブジェクトから取得（ai-support.js からの呼び出し）
            code = rowOrData.productCode
            name = rowOrData.productName
            spec = rowOrData.specification || ''
            price = parseFloat(rowOrData.unitPrice) || 0
            supplier = rowOrData.supplierName

            // 初期値（AIサポート用）
            initialItemName = rowOrData.initialItemName || ''
            initialItemKana = rowOrData.initialItemKana || ''
        }

        this.elements.productCode.value = code
        this.elements.productPrice.value = price
        this.elements.productInfo.textContent = `${supplier} / ${name}（${spec || '-'}）- ¥${price.toLocaleString()}`

        this.resetForm()
        this.switchMode('product')

        // 初期値をセット（resetFormの後に実行）
        if (initialItemName) {
            this.elements.itemName.value = initialItemName
        }
        if (initialItemKana) {
            this.elements.itemKana.value = initialItemKana
        }

        this.elements.modal.classList.remove('hidden')
    }

    /**
     * モーダルを開く（手動入力モード）
     */
    openManualMode(options = {}) {
        if (!this.isModalCreated) {
            this.createModal()
        }

        this.resetForm()
        this.switchMode('manual')

        // 初期値設定（AIサポートから呼ばれる場合）
        if (options.itemName) {
            this.elements.itemName.value = options.itemName
        }
        if (options.itemKana) {
            this.elements.itemKana.value = options.itemKana
        }

        this.elements.modal.classList.remove('hidden')
    }

    /**
     * モーダルを閉じる
     */
    close() {
        this.elements.modal.classList.add('hidden')
    }

    /**
     * フォームリセット
     */
    resetForm() {
        this.elements.itemName.value = ''
        this.elements.itemKana.value = ''
        this.elements.itemUnit.value = ''
        this.elements.yieldQuantity.value = ''
        this.elements.unitCostPreview.textContent = '---'
        if (this.elements.itemGenre) this.elements.itemGenre.value = ''
        if (this.elements.itemNeedsReview) this.elements.itemNeedsReview.checked = false

        // 手動入力フィールド
        this.elements.manualTotalQuantity.value = ''
        this.elements.manualTotalUnit.value = ''
        this.elements.manualTotalPrice.value = ''
        this.elements.manualUnitCostPreview.textContent = '---'
        this.elements.manualItemUnit.value = ''

        this.elements.submitBtn.disabled = false
        this.elements.submitBtn.textContent = '作成して追加'
    }

    /**
     * モード切り替え
     */
    switchMode(mode) {
        this.currentMode = mode
        this.elements.currentMode.value = mode

        if (mode === 'product') {
            // タブスタイル
            this.elements.tabProductMode.classList.remove('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300')
            this.elements.tabProductMode.classList.add('bg-blue-600', 'text-white')
            this.elements.tabManualMode.classList.remove('bg-blue-600', 'text-white')
            this.elements.tabManualMode.classList.add('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300')

            // セクション表示
            this.elements.productModeSection.classList.remove('hidden')
            this.elements.manualModeSection.classList.add('hidden')
            this.elements.productFields.classList.remove('hidden')
            this.elements.manualFields.classList.add('hidden')
            this.elements.productCostPreview.classList.remove('hidden')
        } else {
            // タブスタイル
            this.elements.tabManualMode.classList.remove('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300')
            this.elements.tabManualMode.classList.add('bg-blue-600', 'text-white')
            this.elements.tabProductMode.classList.remove('bg-blue-600', 'text-white')
            this.elements.tabProductMode.classList.add('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300')

            // セクション表示
            this.elements.productModeSection.classList.add('hidden')
            this.elements.manualModeSection.classList.remove('hidden')
            this.elements.productFields.classList.add('hidden')
            this.elements.manualFields.classList.remove('hidden')
            this.elements.productCostPreview.classList.add('hidden')
        }
    }

    /**
     * 単位原価プレビュー更新（仕入れ商品モード）
     */
    updateProductUnitCostPreview() {
        const price = parseFloat(this.elements.productPrice.value) || 0
        const qty = parseFloat(this.elements.yieldQuantity.value) || 0

        if (price > 0 && qty > 0) {
            const unitCost = price / qty
            this.elements.unitCostPreview.textContent = `¥${unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
        } else {
            this.elements.unitCostPreview.textContent = '---'
        }
    }

    /**
     * 単位原価プレビュー更新（手動入力モード）
     */
    updateManualUnitCostPreview() {
        const qty = parseFloat(this.elements.manualTotalQuantity.value) || 0
        const price = parseFloat(this.elements.manualTotalPrice.value) || 0

        if (qty > 0) {
            const unitCost = price / qty
            this.elements.manualUnitCostPreview.textContent = `¥${unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
        } else {
            this.elements.manualUnitCostPreview.textContent = '---'
        }

        // 使用単位を総量の単位に連動
        this.elements.manualTotalUnit.value = this.elements.manualItemUnit.value
    }

    /**
     * ジャンルセレクト生成
     */
    renderGenreSelect() {
        if (!this.elements?.itemGenre) return

        const genres = this.getAllGenres()
        const options = '<option value="">選択してください</option>' +
            genres.map(g => `<option value="${g.genre_id}">${g.genre_name}</option>`).join('')

        this.elements.itemGenre.innerHTML = options
    }

    /**
     * アイテム作成
     */
    async createItem() {
        const isManualMode = this.currentMode === 'manual'
        const name = this.elements.itemName.value.trim()
        const kana = sanitizeToFullWidthKatakana(this.elements.itemKana.value.trim())
        const genreIdValue = this.elements.itemGenre ? this.elements.itemGenre.value : ''
        const businessTypeId = this.getBusinessTypeId()
        const needsReview = this.elements.itemNeedsReview ? this.elements.itemNeedsReview.checked : false

        // 共通バリデーション
        if (!name) {
            alert('アイテム名を入力してください')
            return null
        }
        if (!kana) {
            alert('読み仮名を入力してください')
            return null
        }
        if (!genreIdValue) {
            alert('ジャンルを選択してください')
            return null
        }

        let unit, yieldQty, unitCost, productCode = null

        if (isManualMode) {
            // 手動入力モードのバリデーション
            unit = this.elements.manualItemUnit.value.trim()
            const manualQty = parseFloat(this.elements.manualTotalQuantity.value)
            const manualPrice = parseFloat(this.elements.manualTotalPrice.value) || 0

            if (!unit) {
                alert('使用単位を入力してください')
                return null
            }
            if (!manualQty || manualQty <= 0) {
                alert('総量を入力してください')
                return null
            }

            yieldQty = manualQty
            unitCost = manualPrice / manualQty
        } else {
            // 仕入れ商品モードのバリデーション
            unit = this.elements.itemUnit.value.trim()
            yieldQty = parseFloat(this.elements.yieldQuantity.value)
            const price = parseFloat(this.elements.productPrice.value) || 0
            productCode = this.elements.productCode.value

            if (!unit) {
                alert('使用単位を入力してください')
                return null
            }
            if (!yieldQty || yieldQty <= 0) {
                alert('取れる数を正しく入力してください')
                return null
            }
            if (!productCode) {
                alert('仕入れ商品が選択されていません')
                return null
            }

            unitCost = price / yieldQty

            // 商品の使用フラグを更新
            const allProducts = this.getAllProducts()
            const product = allProducts.find(p => p.product_code === productCode)
            if (product && !product.is_active) {
                const { error: updateError } = await this.supabase
                    .from('products')
                    .update({ is_active: true })
                    .eq('product_code', productCode)

                if (updateError) {
                    console.error('商品フラグ更新エラー:', updateError)
                } else {
                    product.is_active = true
                }
            }
        }

        this.elements.submitBtn.disabled = true
        this.elements.submitBtn.textContent = '作成中...'

        // アイテム作成
        const insertData = {
            item_name: name,
            item_kana: toHalfWidthKatakana(kana),
            unit: unit,
            yield_quantity: yieldQty,
            business_type_id: businessTypeId,
            needs_review: needsReview,
            manual_price: isManualMode
        }

        if (genreIdValue) {
            insertData.genre_id = parseInt(genreIdValue)
        }

        if (isManualMode) {
            insertData.product_code = null
            insertData.manual_unit_cost = unitCost
        } else {
            insertData.product_code = productCode
            insertData.manual_unit_cost = null
        }

        const { data: newItem, error } = await this.supabase
            .from('items')
            .insert(insertData)
            .select()
            .single()

        if (error) {
            console.error('アイテム作成エラー:', error)
            alert('作成に失敗しました: ' + error.message)
            this.elements.submitBtn.disabled = false
            this.elements.submitBtn.textContent = '作成して追加'
            return null
        }

        this.elements.submitBtn.disabled = false
        this.elements.submitBtn.textContent = '作成して追加'

        alert(`✅ アイテム「${name}」を作成しました！\n\n選択リストに追加されています。`)

        this.close()

        // コールバック
        if (this.onItemCreated) {
            const allProducts = this.getAllProducts()
            const product = isManualMode ? null : allProducts.find(p => p.product_code === productCode)
            this.onItemCreated(newItem, product, { type: 'item', id: newItem.item_id, name, unit, unitCost })
        }

        return newItem
    }

    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        // 閉じるボタン
        this.elements.closeBtn.addEventListener('click', () => this.close())
        this.elements.cancelBtn.addEventListener('click', () => this.close())

        // タブ切り替え
        this.elements.tabProductMode.addEventListener('click', () => this.switchMode('product'))
        this.elements.tabManualMode.addEventListener('click', () => this.switchMode('manual'))

        // 単位原価プレビュー更新（仕入れ商品モード）
        this.elements.yieldQuantity.addEventListener('input', () => this.updateProductUnitCostPreview())

        // 単位原価プレビュー更新（手動入力モード）
        this.elements.manualTotalQuantity.addEventListener('input', () => this.updateManualUnitCostPreview())
        this.elements.manualTotalPrice.addEventListener('input', () => this.updateManualUnitCostPreview())
        this.elements.manualItemUnit.addEventListener('input', () => {
            this.elements.manualTotalUnit.value = this.elements.manualItemUnit.value
        })

        // 作成ボタン
        this.elements.submitBtn.addEventListener('click', () => this.createItem())

        // 読み仮名の変換
        this.elements.itemKana.addEventListener('blur', (e) => {
            e.target.value = sanitizeToFullWidthKatakana(e.target.value)
        })
    }
}