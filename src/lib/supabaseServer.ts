import { createClient } from '@supabase/supabase-js'

/** SSR(서버리스 함수)에서만 쓰는 클라이언트 — src/lib/supabase.ts와 같은
 *  프로젝트/anon key(공개용, RLS로 접근 제어됨)를 쓰지만, persistSession/
 *  autoRefreshToken은 브라우저 storage(localStorage)에 의존하므로 Node
 *  런타임에서는 꺼둔다. */
export const supabaseServer = createClient(
  'https://edhuesdnuxlbcfephutq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkaHVlc2RudXhsYmNmZXBodXRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDg5MTcsImV4cCI6MjA5NDU4NDkxN30.mnbMkGLy8UwFaOg6qdkDaV6DGZ2LyCSfOhJVB_48_HE',
  { auth: { persistSession: false, autoRefreshToken: false } }
)
