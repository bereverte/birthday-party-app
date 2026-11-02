import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. See .env.example.')
}

// Single shared client. The session is persisted in localStorage, so guests
// keep the same anonymous user when they reopen the tab.
// Typed with the generated schema: regenerate after each migration (see README).
export const supabase = createClient<Database>(url, key)
