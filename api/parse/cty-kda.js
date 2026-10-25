import { timingSafeEqual } from 'node:crypto'
import { CTY_KDA_SYSTEM_PROMPT } from '../_lib/cty-kda-system-prompt.js'
import { guardCtyKdaParserOutput } from '../_lib/cty-kda-guard.js'

export const config = { maxDuration: 60 }
function authorized(header, secret) {
  if (!secret || typeof header !== 'string' || !header.startsWith('Bearer ')) return false
  const a = Buffer.from(header.slice(7)), b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}
export function createCtyKdaHandler({ fetcher = fetch, env = process.env } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
    if (!authorized(req.headers?.authorization, env.CTY_KDA_PARSER_TOKEN))
      return res.status(401).json({ error: 'unauthorized' })
    let body = req.body
    if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = null } }
    const raw = body?.raw_text
    if (typeof raw !== 'string' || !raw.trim() || raw.length > 30000)
      return res.status(400).json({ error: 'invalid_raw_text' })
    if (!env.OPENAI_API_KEY || !env.CTY_KDA_MODEL)
      return res.status(503).json({ error: 'parser_not_configured' })
    try {
      const response = await fetcher('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: env.CTY_KDA_MODEL,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: CTY_KDA_SYSTEM_PROMPT },
            { role: 'user', content: raw },
          ],
        }),
        signal: AbortSignal.timeout(45000),
      })
      if (!response.ok) return res.status(502).json({ error: 'ai_provider_unavailable' })
      const data = await response.json()
      const parsed = JSON.parse(data?.choices?.[0]?.message?.content || 'null')
      const guarded = guardCtyKdaParserOutput(parsed)
      // Never write raw text or parser output to the DB in this endpoint.
      return res.status(200).json(guarded)
    } catch {
      return res.status(502).json({ error: 'parser_failed' })
    }
  }
}
export default createCtyKdaHandler()
