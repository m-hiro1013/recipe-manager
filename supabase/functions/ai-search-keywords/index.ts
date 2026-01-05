// supabase/functions/ai-search-keywords/index.ts

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
    const { ingredientName } = await req.json()

    if (!ingredientName) {
      return new Response(
        JSON.stringify({ keywords: [], kana: '' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY が設定されていません')
    }

    const prompt = `以下の材料名から、データベース検索用のキーワードを生成してください。

【材料名】
${ingredientName}

【生成ルール】
- 部分一致検索で使う短いキーワード（2〜5文字程度）を複数生成
- 類義語、表記ゆれ（ひらがな/カタカナ/漢字）を含める
- 略称、正式名称の両方を含める
- 主要な食材名を抽出
- 最大10個まで

【出力形式】
{
  "keywords": ["キーワード1", "キーワード2", "キーワード3"],
  "kana": "ザイリョウメイ"
}

【例】
材料名: 鯛のカルパッチョ
出力: {"keywords": ["カルパッチョ", "鯛", "たい", "タイ", "真鯛", "マダイ"], "kana": "タイノカルパッチョ"}

材料名: 鶏もも肉
出力: {"keywords": ["鶏もも", "鶏モモ", "とりもも", "チキン", "鶏肉", "もも肉"], "kana": "トリモモニク"}

材料名: EXVオリーブオイル
出力: {"keywords": ["オリーブ", "オイル", "EXV", "エキストラ", "バージン"], "kana": "イーエックスブイオリーブオイル"}

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
          temperature: 0.2,
          topK: 32,
          topP: 1,
          maxOutputTokens: 1024,
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
    
    console.log('Gemini Response:', textContent)

    // JSONを抽出
    const parsed = extractJSON(textContent)
    
    if (parsed && parsed.keywords) {
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } else {
      // パース失敗時は材料名そのままをキーワードに
      return new Response(JSON.stringify({ 
        keywords: [ingredientName], 
        kana: '' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message, keywords: [], kana: '' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})