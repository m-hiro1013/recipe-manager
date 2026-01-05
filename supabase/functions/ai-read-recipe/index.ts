// supabase/functions/ai-read-recipe/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

// Stable版モデルを使用
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// JSONを抽出する関数（より堅牢に）
function extractJSON(text: string): object | null {
  // まずマークダウンのコードブロックを除去
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()
  
  // JSONオブジェクトを探す（{ で始まり } で終わる部分）
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch (e) {
      console.error('First JSON parse attempt failed:', e)
    }
  }
  
  // 配列形式を探す（[ で始まり ] で終わる部分）
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/)
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0])
      return { recipes: parsed }
    } catch (e) {
      console.error('Array JSON parse attempt failed:', e)
    }
  }
  
  // "recipes" キーを含む部分を探す
  const recipesMatch = cleaned.match(/"recipes"\s*:\s*\[[\s\S]*?\]\s*\}/)
  if (recipesMatch) {
    try {
      return JSON.parse('{' + recipesMatch[0])
    } catch (e) {
      console.error('Recipes key parse attempt failed:', e)
    }
  }
  
  return null
}

serve(async (req) => {
  // CORS対応
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { imageBase64, mimeType } = await req.json()

    if (!imageBase64) {
      throw new Error('画像データが提供されていません')
    }

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY が設定されていません')
    }

    // Gemini APIリクエスト
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || 'image/png',
                  data: imageBase64
                }
              },
              {
                text: `この資料から【すべてのレシピ・メニュー】を抽出してください。

【重要】
- 全ページを確認し、すべての料理を抽出すること
- 1ページ目だけでなく、2ページ目以降も必ず読むこと
- 50品以上ある場合もすべて抽出すること
- 出力はJSONのみ（説明文不要）

【出力形式】
{
  "recipes": [
    {
      "name": "料理名",
      "name_kana": "リョウリメイ",
      "ingredients": [
        { "name": "材料名", "quantity": 100, "unit": "g" }
      ]
    }
  ]
}

【ルール】
- quantityは数値のみ（単位はunitに）
- 数量不明や「適量」なら quantity: 0
- name_kanaは全角カタカナ
- 「仕込み」「オーダー」などのセクション名は無視し、料理名だけ抽出
- 同じ料理が複数ページにあっても1つだけ
- JSONのみ出力、他の文章は絶対に書かない`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          topK: 32,
          topP: 1,
          maxOutputTokens: 16384,  // 増やした（8192 → 16384）
          thinkingConfig: {
            thinkingBudget: 0
          }
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API Error:', errorText)
      throw new Error(`Gemini API エラー: ${response.status}`)
    }

    const result = await response.json()
    
    // レスポンスからテキストを抽出
    const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    // デバッグ用：レスポンスの長さと最初の500文字をログ
    console.log('Gemini Response length:', textContent.length)
    console.log('Gemini Response preview:', textContent.substring(0, 500))

    // JSONを抽出（堅牢な方法で）
    const parsed = extractJSON(textContent)
    
    if (parsed && parsed.recipes) {
      console.log('Successfully parsed recipes:', parsed.recipes.length)
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } else {
      console.error('Could not extract JSON from response')
      console.error('Full response:', textContent)
      // パースできなくても空の配列を返す
      return new Response(JSON.stringify({ recipes: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'AI読み取りに失敗しました' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})