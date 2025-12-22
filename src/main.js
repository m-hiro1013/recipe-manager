import { supabase } from './supabase.js'

async function testConnection() {
  const { data, error } = await supabase.from('products').select('*').limit(1)

  if (error) {
    console.log('Supabase接続OK！（テーブルはまだないよ）', error.message)
  } else {
    console.log('Supabase接続OK！データ:', data)
  }
}

testConnection()
