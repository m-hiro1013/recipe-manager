import { supabase } from './supabase.js'

// ============================================
// DOM要素の取得
// ============================================
const csvFileInput = document.getElementById('csvFile')
const importBtn = document.getElementById('importBtn')
const resultArea = document.getElementById('resultArea')
const resultMessage = document.getElementById('resultMessage')
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

// ============================================
// 状態管理
// ============================================
let allProducts = []
let allSuppliers = []
let selectedSuppliers = new Set()
let searchQuery = ''
let activeFilter = 'off' // 'off', 'on', 'all'
let currentPage = 1
const perPage = 100

// ============================================
// 初期化
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  loadData()
})

// ============================================
// データ読み込み（商品＋取引先）
// ============================================
async function loadData() {
  productList.innerHTML = '<p class="text-center text-gray-500 py-8">読み込み中...</p>'

  // 商品データ取得
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('*')
    .order('supplier_name', { ascending: true })

  if (productsError) {
    console.error('商品データ取得エラー:', productsError)
    productList.innerHTML = '<p class="text-center text-red-500 py-8">データの取得に失敗しました</p>'
    return
  }

  // 取引先データ取得
  const { data: suppliers, error: suppliersError } = await supabase
    .from('suppliers')
    .select('*')
    .order('supplier_name', { ascending: true })

  if (suppliersError) {
    console.error('取引先データ取得エラー:', suppliersError)
    return
  }

  allProducts = products
  allSuppliers = suppliers

  // 表示中の取引先を選択（非表示でないもの）
  const visibleSuppliers = suppliers.filter(s => !s.is_hidden).map(s => s.supplier_name)
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
    if (searchQuery && !p.product_name.includes(searchQuery)) return false
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
  const sortedSuppliers = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'ja'))

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
  const { error } = await supabase
    .from('products')
    .update({ is_active: isActive })
    .eq('product_code', productCode)

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
  const { error } = await supabase
    .from('products')
    .update({ is_active: isActive })
    .eq('supplier_name', supplierName)

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
  const { error } = await supabase
    .from('suppliers')
    .update({ is_hidden: true })
    .eq('supplier_name', supplierName)

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
  const { error } = await supabase
    .from('suppliers')
    .update({ is_hidden: false })
    .eq('supplier_name', supplierName)

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

// モーダル外クリックで閉じる
hiddenModal.addEventListener('click', (e) => {
  if (e.target === hiddenModal) {
    hiddenModal.classList.add('hidden')
  }
})

// ============================================
// CSVインポート機能
// ============================================
importBtn.addEventListener('click', async () => {
  const file = csvFileInput.files[0]

  if (!file) {
    showResult('error', 'ファイルを選択してください')
    return
  }

  importBtn.disabled = true
  importBtn.textContent = 'インポート中...'

  try {
    const text = await readFileAsShiftJIS(file)
    const rows = parseCSV(text)

    const headerRow = rows[1]
    const dataRows = rows.slice(2)

    const columnIndexes = {
      productCode: findColumnIndex(headerRow, '商品システムコード'),
      productName: findColumnIndex(headerRow, '商品名'),
      specification: findColumnIndex(headerRow, '規格'),
      unitPrice: findColumnIndex(headerRow, '単価'),
      supplierName: findColumnIndex(headerRow, '取引先名'),
      updatedAt: findColumnIndex(headerRow, '更新日')
    }

    const requiredColumns = ['productCode', 'productName', 'specification', 'unitPrice', 'supplierName', 'updatedAt']
    const columnNameMap = {
      productCode: '商品システムコード',
      productName: '商品名',
      specification: '規格',
      unitPrice: '単価',
      supplierName: '取引先名',
      updatedAt: '更新日'
    }

    for (const key of requiredColumns) {
      if (columnIndexes[key] === -1) {
        throw new Error(`必要な列「${columnNameMap[key]}」が見つかりません`)
      }
    }

    const allProductsFromCSV = dataRows
      .filter(row => row[columnIndexes.productCode])
      .map(row => ({
        product_code: row[columnIndexes.productCode],
        product_name: row[columnIndexes.productName],
        specification: row[columnIndexes.specification],
        unit_price: parseFloat(row[columnIndexes.unitPrice]) || 0,
        supplier_name: row[columnIndexes.supplierName],
        updated_at_csv: row[columnIndexes.updatedAt]
      }))

    const productMap = new Map()
    for (const product of allProductsFromCSV) {
      const existing = productMap.get(product.product_code)
      if (!existing || product.updated_at_csv > existing.updated_at_csv) {
        productMap.set(product.product_code, product)
      }
    }

    const products = Array.from(productMap.values()).map(p => ({
      product_code: p.product_code,
      product_name: p.product_name,
      specification: p.specification,
      unit_price: p.unit_price,
      supplier_name: p.supplier_name
    }))

    // 商品をupsert
    const { error: productsError } = await supabase
      .from('products')
      .upsert(products, {
        onConflict: 'product_code',
        ignoreDuplicates: false
      })

    if (productsError) {
      throw productsError
    }

    // 取引先を抽出してupsert
    const supplierNames = [...new Set(products.map(p => p.supplier_name).filter(Boolean))]
    const suppliersToUpsert = supplierNames.map(name => ({ supplier_name: name }))

    const { error: suppliersError } = await supabase
      .from('suppliers')
      .upsert(suppliersToUpsert, {
        onConflict: 'supplier_name',
        ignoreDuplicates: true
      })

    if (suppliersError) {
      console.error('取引先登録エラー:', suppliersError)
    }

    showResult('success', `✅ ${products.length}件のインポートが完了しました！`)

    await loadData()

  } catch (error) {
    console.error('インポートエラー:', error)
    showResult('error', `❌ エラー: ${error.message}`)
  } finally {
    importBtn.disabled = false
    importBtn.textContent = 'インポート実行'
  }
})

// ============================================
// ユーティリティ関数
// ============================================
function readFileAsShiftJIS(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = (e) => reject(e)
    reader.readAsText(file, 'Shift_JIS')
  })
}

function parseCSV(text) {
  const rows = []
  let currentRow = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        currentField += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        currentRow.push(currentField.trim())
        currentField = ''
      } else if (char === '\r' && nextChar === '\n') {
        currentRow.push(currentField.trim())
        rows.push(currentRow)
        currentRow = []
        currentField = ''
        i++
      } else if (char === '\n') {
        currentRow.push(currentField.trim())
        rows.push(currentRow)
        currentRow = []
        currentField = ''
      } else {
        currentField += char
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    rows.push(currentRow)
  }

  return rows
}

function findColumnIndex(headerRow, columnName) {
  return headerRow.findIndex(cell => {
    const cleaned = cell.replace(/^\[/, '').replace(/\]$/, '')
    return cleaned === columnName
  })
}

function showResult(type, message) {
  resultArea.classList.remove('hidden')

  if (type === 'success') {
    resultMessage.className = 'p-4 rounded-md bg-green-100 text-green-800'
  } else {
    resultMessage.className = 'p-4 rounded-md bg-red-100 text-red-800'
  }

  resultMessage.textContent = message
}