import { createClient } from '@supabase/supabase-js'
import { runLocationBatch, vietmapRequest } from '../../api/_lib/auto-location-runtime.mjs'
if (process.env.MAP_R1_ENABLED !== 'true') { console.log('MAP-R1 disabled: migration/activation approval required'); process.exit(0) }
const {SUPABASE_SERVICE_ROLE_KEY,VIETMAP_SERVICE_KEY} = process.env
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://edhuesdnuxlbcfephutq.supabase.co'
if (!SUPABASE_SERVICE_ROLE_KEY || !VIETMAP_SERVICE_KEY) { console.error('Required GitHub Secrets missing'); process.exit(1) }
try {
  const db = createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
  const summary = await runLocationBatch(db,vietmapRequest(VIETMAP_SERVICE_KEY),10)
  console.log(JSON.stringify(summary))
  if (summary.failed) process.exitCode=1
} catch { console.error('MAP-R1 storage unavailable; no automatic DDL or retry'); process.exitCode=1 }
