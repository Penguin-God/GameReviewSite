import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yuuvafgczbpwhiaflbnb.supabase.co'
const supabaseKey = 'sb_publishable_kBcRR_a7hoBSmlWSGhcB9g_TIjrRimK'

// 전체 웹에서 공통으로 사용할 단일 Supabase 클라이언트 인스턴스입니다.
export const supabase = createClient(supabaseUrl, supabaseKey)