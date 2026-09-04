import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://asnrquijopjjqfjvwalc.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_qg5QMNLb-D-BelY5G27kYA_UnZU0Hxh'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
