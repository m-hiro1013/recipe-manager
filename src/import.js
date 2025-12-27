import { supabase } from './supabase.js'

// ============================================
// DOM要素の取得
// ============================================
const csvFileInput = document.getElementById('csvFile')
const importBtn = document.getElementById('importBtn')
const resultArea = document.getElementById('resultArea')
const resultMessage = document.getElementById('resultMessage')
const selectedFileName = document.getElementById('selectedFileName')
const lastImportDate = document.getElementById('lastImportDate')
const totalProductCount = document.getElementById('totalProductCount')

// ============================================
// 初期化
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    loadStats()
})

// ============================================
// データ状況を読み込み
// ============================================
async function loadStats() {
    // 商品数を取得
    const { count, error: countError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })

    if (countError) {
        console.error('商品数取得エラー:', countError)
        totalProductCount.textContent = 'エラー'
    } else {
        totalProductCount.textContent = `${count.toLocaleString()} 件`
    }

    // 最終更新日時を取得（updated_atが一番新しいもの）
    const { data: latestProduct, error: latestError } = await supabase
        .from('products')
        .select('updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

    if (latestError || !latestProduct) {
        lastImportDate.textContent = 'データなし'
    } else {
        const date = new Date(latestProduct.updated_at)
        lastImportDate.textContent = date.toLocaleString('ja-JP')
    }
}

// ============================================
// ファイル選択時の表示更新
// ============================================
csvFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0]
    if (file) {
        selectedFileName.textContent = file.name
        selectedFileName.classList.remove('text-gray-400')
        selectedFileName.classList.add('text-blue-600', 'font-medium')
    } else {
        selectedFileName.textContent = '選択されていません'
        selectedFileName.classList.add('text-gray-400')
        selectedFileName.classList.remove('text-blue-600', 'font-medium')
    }
})

// ============================================
// CSVインポート実行
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

        // 統計情報を更新
        await loadStats()

        // ファイル選択をリセット
        csvFileInput.value = ''
        selectedFileName.textContent = '選択されていません'
        selectedFileName.classList.add('text-gray-400')
        selectedFileName.classList.remove('text-blue-600', 'font-medium')

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
        resultMessage.className = 'p-4 rounded-lg bg-green-100 text-green-800'
    } else {
        resultMessage.className = 'p-4 rounded-lg bg-red-100 text-red-800'
    }

    resultMessage.textContent = message
}