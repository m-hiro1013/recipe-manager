import { supabase } from './supabase.js'
import { toFullWidthKatakana, normalizeForSearch, fetchAllWithPaging } from './utils.js'
import { initBusinessTypeSelector, getCurrentBusinessTypeId } from './businessType.js'

// ============================================
// DOM要素の取得
// ============================================
const searchInput = document.getElementById('searchInput')
const supplierFilter = document.getElementById('supplierFilter')
const productList = document.getElementById('productList')
const countDisplay = document.getElementById('countDisplay')
const pagination = document.getElementById('pagination')
const selectAllBtn = document.getElementById('selectAllBtn')
const deselectAllBtn = document.getElementById('deselectAllBtn')
const showHiddenBtn = document.getElementById('showHiddenBtn')
const hiddenModal = document.getElementById('hiddenModal')
const closeHiddenModal = document.getElementById('closeHiddenModal')
const hiddenList = document.getElementById('hiddenList')
const hiddenCount = document.getElementById('hiddenCount')
const detailViewBtn = document.getElementById('detailViewBtn')
const compactViewBtn = document.getElementById('compactViewBtn')

// ============================================
// 状態管理
// ============================================
let allProducts = []
let allSuppliers = []
let selectedSuppliers = new Set()
let searchQuery = ''
let activeFilter = 'all'
let currentPage = 1
const perPage = 100
let viewMode = 'detail'
let expandedSupplier = null

// ============================================
// 初期化
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  // 業態セレクタを初期化（変更時にデータ再読み込み）
  await initBusinessTypeSelector(() => {
    loadData()
  })
  loadData()
})

// ============================================
// データ読み込み（商品＋取引先）
// ============================================
async function loadData() {
  productList.innerHTML = '<p class="text-center text-gray-500 py-8">読み込み中...</p>'

  const businessTypeId = getCurrentBusinessTypeId()
  if (!businessTypeId) {
    productList.innerHTML = '<p class="text-center text-red-500 py-8">業態を選択してください</p>'
    return
  }

  // 商品データ取得（productsとproduct_business_typesをJOIN）
  const { data: allProductsData, error: productsError } = await fetchAllWithPaging(
    'products',
    '*, product_business_types!inner(is_active)',
    {
      orderColumn: 'supplier_name',
      ascending: true,
      filters: [
        { column: 'product_business_types.business_type_id', value: businessTypeId }
      ]
    }
  )

  if (productsError) {
    productList.innerHTML = '<p class="text-center text-red-500 py-8">データの取得に失敗しました</p>'
    console.error('商品取得エラー:', productsError)
    return
  }

  // 取引先データ取得（suppliersとsupplier_business_typesをJOIN）
  const { data: suppliers, error: suppliersError } = await supabase
    .from('suppliers')
    .select('*, supplier_business_types!inner(is_hidden)')
    .eq('supplier_business_types.business_type_id', businessTypeId)
    .order('supplier_name', { ascending: true })

  if (suppliersError) {
    console.error('取引先データ取得エラー:', suppliersError)
    return
  }

  // データを整形（JOINした結果をフラットに）
  allProducts = allProductsData.map(p => ({
    ...p,
    is_active: p.product_business_types?.[0]?.is_active ?? false
  }))

  allSuppliers = suppliers.map(s => ({
    ...s,
    is_hidden: s.supplier_business_types?.[0]?.is_hidden ?? false
  }))

  // 表示中の取引先を選択（非表示でないもの）
  const visibleSuppliers = allSuppliers.filter(s => !s.is_hidden).map(s => s.supplier_name)
  selectedSuppliers = new Set(visibleSuppliers)

  updateHiddenCount()
  renderSupplierFilter()
  renderProducts()
}

// ============================================
// 非表示件数更新
// ============================================
function updateHiddenCount() {
  const count = allSuppliers.filter(s => s.is_hidden).length
  hiddenCount.textContent = count
}

// ============================================
// 取引先フィルター表示
// ============================================
function renderSupplierFilter() {
  const visibleSuppliers = allSuppliers.filter(s => !s.is_hidden)

  supplierFilter.innerHTML = visibleSuppliers.map(supplier => `
    <label class="flex items-center gap-1 bg-white px-3 py-1.5 rounded-full border-2 cursor-pointer transition-all
                  ${selectedSuppliers.has(supplier.supplier_name) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}">
      <input 
        type="checkbox" 
        value="${supplier.supplier_name}" 
        ${selectedSuppliers.has(supplier.supplier_name) ? 'checked' : ''}
        class="supplier-checkbox sr-only"
      />
      <span class="text-sm ${selectedSuppliers.has(supplier.supplier_name) ? 'text-blue-700 font-medium' : 'text-gray-600'}">${supplier.supplier_name}</span>
    </label>
  `).join('')

  // チェックボックスイベント
  document.querySelectorAll('.supplier-checkbox').forEach(checkbox => {
    checkbox.parentElement.addEventListener('click', (e) => {
      e.preventDefault()
      const value = checkbox.value
      if (selectedSuppliers.has(value)) {
        selectedSuppliers.delete(value)
      } else {
        selectedSuppliers.add(value)
      }
      currentPage = 1
      renderSupplierFilter()
      renderProducts()
    })
  })
}

// ============================================
// 商品一覧表示
// ============================================
function renderProducts() {
  // 検索・使用フラグでフィルタリングした商品
  let filtered = allProducts.filter(p => {
    // 取引先フィルター
    if (!selectedSuppliers.has(p.supplier_name)) return false
    // 検索フィルター
    if (searchQuery) {
      const normalizedQuery = normalizeForSearch(searchQuery)
      const normalizedName = normalizeForSearch(p.product_name)
      if (!normalizedName.includes(normalizedQuery) && !p.product_name.includes(searchQuery)) return false
    }
    // 使用フラグフィルター
    if (activeFilter === 'on' && !p.is_active) return false
    if (activeFilter === 'off' && p.is_active) return false
    return true
  })

  // 件数表示
  const activeCount = allProducts.filter(p => p.is_active).length
  countDisplay.textContent = `全 ${allProducts.length.toLocaleString()}件 / 使用 ${activeCount.toLocaleString()}件`

  // 取引先ごとにグループ化
  const grouped = {}

  // まず選択中の全業者を空配列で初期化（商品0件でも表示するため）
  for (const supplierName of selectedSuppliers) {
    grouped[supplierName] = []
  }

  // 商品を振り分け
  for (const p of filtered) {
    if (grouped[p.supplier_name]) {
      grouped[p.supplier_name].push(p)
    }
  }

  // 五十音順でソート
  let sortedSuppliers = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'ja'))
  // 検索中は商品0件の業者を除外
  if (searchQuery) {
    sortedSuppliers = sortedSuppliers.filter(supplier => grouped[supplier].length > 0)
  }

  // コンパクト表示の場合はページネーションなし
  if (viewMode === 'compact') {
    let html = ''

    for (const supplier of sortedSuppliers) {
      const products = grouped[supplier]
      const isExpanded = expandedSupplier === supplier

      html += `
        <div class="border-l-4 border-blue-500 pl-4 mb-2">
          <div class="flex flex-wrap items-center gap-2 py-2">
            <h3 class="text-lg font-bold text-blue-700 cursor-pointer hover:text-blue-900 supplier-toggle" data-supplier="${supplier}">
              ${isExpanded ? '▼' : '▶'} ${supplier}
              <span class="text-sm font-normal text-gray-500">(${products.length}件)</span>
            </h3>
            <button 
              data-supplier="${supplier}" 
              data-action="on"
              class="supplier-bulk-btn text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200"
            >全てON</button>
            <button 
              data-supplier="${supplier}" 
              data-action="off"
              class="supplier-bulk-btn text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
            >全てOFF</button>
            <button 
              data-supplier="${supplier}" 
              class="supplier-hide-btn text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
            >非表示</button>
          </div>
      `

      // 展開中の業者だけ商品リストを表示
      if (isExpanded && products.length > 0) {
        html += `<div class="space-y-1 mt-2">`
        for (const product of products) {
          html += `
            <div class="flex items-center gap-4 p-2 rounded-lg hover:bg-blue-50 transition-colors ${product.is_active ? 'bg-green-50' : ''} border-b border-gray-100">
              <input 
                type="checkbox" 
                ${product.is_active ? 'checked' : ''}
                data-product-code="${product.product_code}"
                class="active-checkbox w-5 h-5 text-green-600 rounded border-2 border-gray-300 focus:ring-green-500 flex-shrink-0"
              />
              <div class="flex-1 min-w-0 flex items-center gap-2">
                <span class="font-medium text-gray-800 truncate">${product.product_name}</span>
                <span class="text-gray-400">/</span>
                <span class="text-sm text-gray-500 truncate">${product.specification || '-'}</span>
              </div>
              <div class="font-bold text-gray-700 whitespace-nowrap flex-shrink-0">
                ¥${(product.unit_price || 0).toLocaleString()}
              </div>
            </div>
          `
        }
        html += `</div>`
      } else if (isExpanded && products.length === 0) {
        html += `<p class="text-gray-400 text-sm py-2 mt-2">該当する商品がありません</p>`
      }

      html += `</div>`
    }

    if (html === '') {
      html = '<p class="text-center text-gray-500 py-8">該当する取引先がありません</p>'
    }

    productList.innerHTML = html
    pagination.innerHTML = ''

    // 業者名クリックで展開/閉じる
    document.querySelectorAll('.supplier-toggle').forEach(el => {
      el.addEventListener('click', (e) => {
        const supplier = e.currentTarget.dataset.supplier
        expandedSupplier = expandedSupplier === supplier ? null : supplier
        renderProducts()
      })
    })

    // 使用フラグのチェックボックスイベント
    document.querySelectorAll('.active-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', async (e) => {
        const productCode = e.target.dataset.productCode
        const isActive = e.target.checked
        await updateActiveFlag(productCode, isActive)
      })
    })

    // 業者一括ON/OFFボタンイベント
    document.querySelectorAll('.supplier-bulk-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const supplier = e.target.dataset.supplier
        const action = e.target.dataset.action
        await bulkUpdateSupplierProducts(supplier, action === 'on')
      })
    })

    // 業者非表示ボタンイベント
    document.querySelectorAll('.supplier-hide-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const supplier = e.target.dataset.supplier
        await hideSupplier(supplier)
      })
    })

    return
  }

  // ========== 詳細表示（従来の処理） ==========

  // 全商品数（ページネーション用）
  let totalItems = 0
  for (const supplier of sortedSuppliers) {
    // 商品がある場合はその数、ない場合は業者ヘッダー分の1
    totalItems += grouped[supplier].length > 0 ? grouped[supplier].length : 1
  }

  const totalPages = Math.ceil(totalItems / perPage)
  const startIndex = (currentPage - 1) * perPage
  const endIndex = startIndex + perPage

  // HTML生成
  let html = ''
  let currentIndex = 0

  for (const supplier of sortedSuppliers) {
    const products = grouped[supplier]

    // この業者の表示範囲を計算
    const supplierItemCount = products.length > 0 ? products.length : 1
    const supplierStartIndex = currentIndex
    const supplierEndIndex = currentIndex + supplierItemCount

    // ページ範囲と重なるか確認
    if (supplierEndIndex > startIndex && supplierStartIndex < endIndex) {
      // 業者ヘッダー
      html += `
        <div class="border-l-4 border-blue-500 pl-4 mb-4">
          <div class="flex flex-wrap items-center gap-2 mb-2">
            <h3 class="text-lg font-bold text-blue-700">
              ${supplier}
              <span class="text-sm font-normal text-gray-500">(${products.length}件)</span>
            </h3>
            <button 
              data-supplier="${supplier}" 
              data-action="on"
              class="supplier-bulk-btn text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200"
            >全てON</button>
            <button 
              data-supplier="${supplier}" 
              data-action="off"
              class="supplier-bulk-btn text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
            >全てOFF</button>
            <button 
              data-supplier="${supplier}" 
              class="supplier-hide-btn text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
            >非表示</button>
          </div>
          <div class="space-y-1">
      `

      if (products.length === 0) {
        html += `
          <p class="text-gray-400 text-sm py-2">該当する商品がありません</p>
        `
      } else {
        // 商品を表示
        for (let i = 0; i < products.length; i++) {
          const productIndex = currentIndex + i
          if (productIndex >= startIndex && productIndex < endIndex) {
            const product = products[i]
            html += `
              <div class="flex items-center gap-4 p-2 rounded-lg hover:bg-blue-50 transition-colors ${product.is_active ? 'bg-green-50' : ''} border-b border-gray-100">
                <input 
                  type="checkbox" 
                  ${product.is_active ? 'checked' : ''}
                  data-product-code="${product.product_code}"
                  class="active-checkbox w-5 h-5 text-green-600 rounded border-2 border-gray-300 focus:ring-green-500 flex-shrink-0"
                />
                <div class="flex-1 min-w-0 flex items-center gap-2">
                  <span class="font-medium text-gray-800 truncate">${product.product_name}</span>
                  <span class="text-gray-400">/</span>
                  <span class="text-sm text-gray-500 truncate">${product.specification || '-'}</span>
                </div>
                <div class="font-bold text-gray-700 whitespace-nowrap flex-shrink-0">
                  ¥${(product.unit_price || 0).toLocaleString()}
                </div>
              </div>
            `
          }
        }
      }

      html += '</div></div>'
    }

    currentIndex += supplierItemCount
  }

  if (html === '') {
    html = '<p class="text-center text-gray-500 py-8">該当する商品がありません</p>'
  }

  productList.innerHTML = html

  // 使用フラグのチェックボックスイベント
  document.querySelectorAll('.active-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', async (e) => {
      const productCode = e.target.dataset.productCode
      const isActive = e.target.checked
      await updateActiveFlag(productCode, isActive)
    })
  })

  // 業者一括ON/OFFボタンイベント
  document.querySelectorAll('.supplier-bulk-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const supplier = e.target.dataset.supplier
      const action = e.target.dataset.action
      await bulkUpdateSupplierProducts(supplier, action === 'on')
    })
  })

  // 業者非表示ボタンイベント
  document.querySelectorAll('.supplier-hide-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const supplier = e.target.dataset.supplier
      await hideSupplier(supplier)
    })
  })

  renderPagination(totalPages)
}

// ============================================
// 使用フラグ更新（単体）
// ============================================
async function updateActiveFlag(productCode, isActive) {
  const businessTypeId = getCurrentBusinessTypeId()

  const { error } = await supabase
    .from('product_business_types')
    .update({ is_active: isActive })
    .eq('product_code', productCode)
    .eq('business_type_id', businessTypeId)

  if (error) {
    console.error('フラグ更新エラー:', error)
    alert('更新に失敗しました')
    return
  }

  const product = allProducts.find(p => p.product_code === productCode)
  if (product) {
    product.is_active = isActive
  }

  renderProducts()
}

// ============================================
// 業者の商品を一括ON/OFF
// ============================================
async function bulkUpdateSupplierProducts(supplierName, isActive) {
  const businessTypeId = getCurrentBusinessTypeId()

  // この業者の商品コード一覧を取得
  const productCodes = allProducts
    .filter(p => p.supplier_name === supplierName)
    .map(p => p.product_code)

  if (productCodes.length === 0) return

  const { error } = await supabase
    .from('product_business_types')
    .update({ is_active: isActive })
    .in('product_code', productCodes)
    .eq('business_type_id', businessTypeId)

  if (error) {
    console.error('一括更新エラー:', error)
    alert('更新に失敗しました')
    return
  }

  // ローカルデータも更新
  allProducts.forEach(p => {
    if (p.supplier_name === supplierName) {
      p.is_active = isActive
    }
  })

  renderProducts()
}

// ============================================
// 業者を非表示
// ============================================
async function hideSupplier(supplierName) {
  const businessTypeId = getCurrentBusinessTypeId()

  const { error } = await supabase
    .from('supplier_business_types')
    .update({ is_hidden: true })
    .eq('supplier_name', supplierName)
    .eq('business_type_id', businessTypeId)

  if (error) {
    console.error('非表示更新エラー:', error)
    alert('更新に失敗しました')
    return
  }

  // ローカルデータも更新
  const supplier = allSuppliers.find(s => s.supplier_name === supplierName)
  if (supplier) {
    supplier.is_hidden = true
  }
  selectedSuppliers.delete(supplierName)

  updateHiddenCount()
  renderSupplierFilter()
  renderProducts()
}

// ============================================
// 業者を表示に戻す
// ============================================
async function showSupplier(supplierName) {
  const businessTypeId = getCurrentBusinessTypeId()

  const { error } = await supabase
    .from('supplier_business_types')
    .update({ is_hidden: false })
    .eq('supplier_name', supplierName)
    .eq('business_type_id', businessTypeId)

  if (error) {
    console.error('表示更新エラー:', error)
    alert('更新に失敗しました')
    return
  }

  // ローカルデータも更新
  const supplier = allSuppliers.find(s => s.supplier_name === supplierName)
  if (supplier) {
    supplier.is_hidden = false
  }
  selectedSuppliers.add(supplierName)

  updateHiddenCount()
  renderSupplierFilter()
  renderProducts()
  renderHiddenList()
}

// ============================================
// 非表示リスト表示
// ============================================
function renderHiddenList() {
  const hiddenSuppliers = allSuppliers.filter(s => s.is_hidden)

  if (hiddenSuppliers.length === 0) {
    hiddenList.innerHTML = '<p class="text-center text-gray-500 py-4">非表示にした取引先はありません</p>'
    return
  }

  hiddenList.innerHTML = hiddenSuppliers.map(supplier => {
    const productCount = allProducts.filter(p => p.supplier_name === supplier.supplier_name).length
    return `
      <div class="flex justify-between items-center p-3 border-b">
        <div>
          <span class="font-medium">${supplier.supplier_name}</span>
          <span class="text-sm text-gray-500">(${productCount}件)</span>
        </div>
        <button 
          data-supplier="${supplier.supplier_name}"
          class="show-supplier-btn text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200"
        >表示に戻す</button>
      </div>
    `
  }).join('')

  // 表示に戻すボタンイベント
  document.querySelectorAll('.show-supplier-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const supplier = e.target.dataset.supplier
      await showSupplier(supplier)
    })
  })
}

// ============================================
// ページネーション表示
// ============================================
function renderPagination(totalPages) {
  if (totalPages <= 1) {
    pagination.innerHTML = ''
    return
  }

  pagination.innerHTML = `
    <button 
      id="prevBtn"
      class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
      ${currentPage === 1 ? 'disabled' : ''}
    >
      ← 前へ
    </button>
    <span class="text-gray-700 font-medium">${currentPage} / ${totalPages} ページ</span>
    <button 
      id="nextBtn"
      class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
      ${currentPage === totalPages ? 'disabled' : ''}
    >
      次へ →
    </button>
  `

  document.getElementById('prevBtn')?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--
      renderProducts()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  })

  document.getElementById('nextBtn')?.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++
      renderProducts()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  })
}

// ============================================
// イベントリスナー
// ============================================

// 検索
searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value
  currentPage = 1
  renderProducts()
})

// 表示切り替え（ON/OFF/全部）
document.querySelectorAll('.active-filter').forEach(radio => {
  radio.addEventListener('change', (e) => {
    activeFilter = e.target.value
    currentPage = 1
    renderProducts()
  })
})

// 全選択
selectAllBtn.addEventListener('click', () => {
  const visibleSuppliers = allSuppliers.filter(s => !s.is_hidden).map(s => s.supplier_name)
  selectedSuppliers = new Set(visibleSuppliers)
  currentPage = 1
  renderSupplierFilter()
  renderProducts()
})

// 全解除
deselectAllBtn.addEventListener('click', () => {
  selectedSuppliers = new Set()
  currentPage = 1
  renderSupplierFilter()
  renderProducts()
})

// 非表示リストモーダル表示
showHiddenBtn.addEventListener('click', () => {
  renderHiddenList()
  hiddenModal.classList.remove('hidden')
})

// モーダル閉じる
closeHiddenModal.addEventListener('click', () => {
  hiddenModal.classList.add('hidden')
})

// 表示モード切り替え
detailViewBtn.addEventListener('click', () => {
  viewMode = 'detail'
  detailViewBtn.classList.add('bg-blue-600', 'text-white')
  detailViewBtn.classList.remove('bg-white', 'text-gray-700', 'hover:bg-gray-50')
  compactViewBtn.classList.remove('bg-blue-600', 'text-white')
  compactViewBtn.classList.add('bg-white', 'text-gray-700', 'hover:bg-gray-50')
  renderProducts()
})

compactViewBtn.addEventListener('click', () => {
  viewMode = 'compact'
  compactViewBtn.classList.add('bg-blue-600', 'text-white')
  compactViewBtn.classList.remove('bg-white', 'text-gray-700', 'hover:bg-gray-50')
  detailViewBtn.classList.remove('bg-blue-600', 'text-white')
  detailViewBtn.classList.add('bg-white', 'text-gray-700', 'hover:bg-gray-50')
  renderProducts()
})