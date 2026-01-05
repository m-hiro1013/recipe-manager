// supabase/functions/ai-check-duplicates/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// JSONを抽出する関数
function extractJSON(text: string): object | null {
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()
  
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch (e) {
      console.error('JSON parse failed:', e)
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
    const { recipes, preparations, dishes } = await req.json()

    // 入力チェック
    if (!recipes || !Array.isArray(recipes) || recipes.length === 0) {
      return new Response(
        JSON.stringify({ duplicates: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 既存データがなければ空で返す
    if ((!preparations || preparations.length === 0) && (!dishes || dishes.length === 0)) {
      return new Response(
        JSON.stringify({ duplicates: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY が設定されていません')
    }

    // プロンプト作成
    const recipeNames = recipes.map((r: any, i: number) => `${i}: ${r.name}`).join('\n')
    const prepNames = (preparations || []).map((p: any) => `仕込み品/${p.preparation_id}: ${p.preparation_name}`).join('\n')
    const dishNames = (dishes || []).map((d: any) => `商品/${d.dish_id}: ${d.dish_name}`).join('\n')

    const prompt = `以下のレシピ名と、データベースに登録済みの仕込み品・商品を比較して、
同一または類似の【可能性があるもの】を判定してください。

【重要】見逃しを防ぐため、少しでも関連がありそうなら候補に含めてください。
最終判断はユーザーが行うので、迷ったら「類似あり」として出力してください。

【類似と判定するパターン】
- 完全一致（表記ゆれ含む）: 「つぶ貝」=「ツブ貝」=「ツブガイ」
- 同一料理の別表記: 「鶏の唐揚げ」=「チキン唐揚げ」=「鶏もも肉の唐揚げ」=「からあげ」
- 略称・正式名称: 「トムヤムクン」=「トムヤンクン」
- 漢字・ひらがな・カタカナの違い: 「蛸」=「タコ」=「たこ」
- 「〇〇風」の有無: 「ベトナム風生春巻き」≒「生春巻き」
- 店舗名・地名入り: 「立川オリジナル唐揚げ」≒「唐揚げ」
- サイズ・量の違い: 「ハーフ〇〇」≒「〇〇」
- 主要な食材が同じ: 「海老のマリネ」≒「エビマリネ」
- 調理法が同じ系統: 「〇〇のグリル」≒「〇〇のロースト」

【読み取ったレシピ】
${recipeNames}

【登録済みの仕込み品・商品】
${prepNames}
${dishNames}

【出力形式】
以下のJSON形式で出力してください。類似候補がないレシピは含めないでください。
{
  "duplicates": [
    {
      "recipeIndex": 0,
      "candidates": [
        { "type": "preparation", "id": 1, "name": "登録済みの名前" },
        { "type": "dish", "id": 2, "name": "登録済みの名前" }
      ]
    }
  ]
}

JSONのみ出力してください。説明は不要です。`

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
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          topK: 32,
          topP: 1,
          maxOutputTokens: 4096,
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
    const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    console.log('Gemini Response:', textContent.substring(0, 500))

    // JSONを抽出
    const parsed = extractJSON(textContent)
    
    if (parsed && parsed.duplicates) {
      console.log('Successfully parsed duplicates:', parsed.duplicates.length)
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } else {
      console.log('No duplicates found or parse failed')
      return new Response(JSON.stringify({ duplicates: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message, duplicates: [] }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})