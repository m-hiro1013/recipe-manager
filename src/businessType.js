import { supabase } from './supabase.js'

// ============================================
// 業態管理（共通モジュール）
// ============================================

// 現在選択中の業態ID（メモリ上で保持）
let currentBusinessTypeId = null

// 業態一覧キャッシュ
let businessTypesCache = null

// ============================================
// 業態一覧を取得
// ============================================
export async function getBusinessTypes() {
    if (businessTypesCache) {
        return businessTypesCache
    }

    const { data, error } = await supabase
        .from('business_types')
        .select('*')
        .order('sort_order', { ascending: true })

    if (error) {
        console.error('業態取得エラー:', error)
        return []
    }

    businessTypesCache = data || []
    return businessTypesCache
}

// ============================================
// キャッシュをクリア（業態追加/編集/削除後に呼ぶ）
// ============================================
export function clearBusinessTypesCache() {
    businessTypesCache = null
}

// ============================================
// 現在の業態IDを取得
// ============================================
export function getCurrentBusinessTypeId() {
    return currentBusinessTypeId
}

// ============================================
// 業態IDをセット
// ============================================
export function setCurrentBusinessTypeId(id) {
    currentBusinessTypeId = id
    // sessionStorageにも保存（ページ遷移で保持）
    if (id) {
        sessionStorage.setItem('currentBusinessTypeId', id.toString())
    } else {
        sessionStorage.removeItem('currentBusinessTypeId')
    }
}

// ============================================
// sessionStorageから復元
// ============================================
export function restoreBusinessTypeId() {
    const stored = sessionStorage.getItem('currentBusinessTypeId')
    if (stored) {
        currentBusinessTypeId = parseInt(stored)
    }
    return currentBusinessTypeId
}

// ============================================
// サイドメニューに業態セレクトを追加
// ============================================
export async function initBusinessTypeSelector(onChangeCallback) {
    const businessTypes = await getBusinessTypes()

    // 業態がない場合は何もしない
    if (businessTypes.length === 0) {
        return
    }

    // sessionStorageから復元
    restoreBusinessTypeId()

    // 初期値がなければ最初の業態を選択
    if (!currentBusinessTypeId && businessTypes.length > 0) {
        setCurrentBusinessTypeId(businessTypes[0].business_type_id)
    }

    // サイドメニューのロゴ部分の下に挿入
    const sidebar = document.getElementById('sidebar')
    const logoSection = sidebar.querySelector('.border-b')

    // 既存のセレクタがあれば削除
    const existingSelector = document.getElementById('businessTypeSelector')
    if (existingSelector) {
        existingSelector.remove()
    }

    // 業態セレクタを作成
    const selectorDiv = document.createElement('div')
    selectorDiv.id = 'businessTypeSelector'
    selectorDiv.className = 'p-4 border-b border-gray-700'

    const currentType = businessTypes.find(bt => bt.business_type_id === currentBusinessTypeId)

    selectorDiv.innerHTML = `
        <div class="relative">
            <button id="businessTypeDropdownBtn" 
                class="w-full flex items-center justify-between gap-2 px-3 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
                <span class="flex items-center gap-2">
                    <span>🏪</span>
                    <span id="currentBusinessTypeName" class="menu-text font-medium truncate">
                        ${currentType ? currentType.business_type_name : '選択してください'}
                    </span>
                </span>
                <svg class="w-4 h-4 menu-text flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
            </button>
            <div id="businessTypeDropdown" 
                class="absolute top-full left-0 right-0 mt-1 bg-gray-700 rounded-lg shadow-lg hidden z-50 max-h-60 overflow-y-auto">
                ${businessTypes.map(bt => `
                    <button class="business-type-option w-full text-left px-3 py-2 hover:bg-gray-600 transition-colors ${bt.business_type_id === currentBusinessTypeId ? 'bg-blue-600' : ''}"
                        data-id="${bt.business_type_id}">
                        ${bt.business_type_name}
                    </button>
                `).join('')}
            </div>
        </div>
    `

    // ロゴセクションの後に挿入
    logoSection.after(selectorDiv)

    // ドロップダウン開閉
    const dropdownBtn = document.getElementById('businessTypeDropdownBtn')
    const dropdown = document.getElementById('businessTypeDropdown')

    dropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        dropdown.classList.toggle('hidden')
    })

    // 外側クリックで閉じる
    document.addEventListener('click', () => {
        dropdown.classList.add('hidden')
    })

    // 業態選択
    document.querySelectorAll('.business-type-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation()
            const id = parseInt(btn.dataset.id)
            const selected = businessTypes.find(bt => bt.business_type_id === id)

            setCurrentBusinessTypeId(id)

            // 表示更新
            document.getElementById('currentBusinessTypeName').textContent = selected.business_type_name

            // 選択状態更新
            document.querySelectorAll('.business-type-option').forEach(b => {
                b.classList.remove('bg-blue-600')
            })
            btn.classList.add('bg-blue-600')

            // ドロップダウン閉じる
            dropdown.classList.add('hidden')

            // コールバック実行（データ再読み込みなど）
            if (onChangeCallback) {
                onChangeCallback(id)
            }
        })
    })

    return currentBusinessTypeId
}