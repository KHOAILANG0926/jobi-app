// 웹 지도 부품(JobVietMap·HomeMapCanvas·VietMapMapCanvas)이 쓰는 스타일을 웹 css에서 뽑아 src/app/map.css로 복사하는 규칙.
// 앱은 index.css(PC 틀 잠금 파일)를 가져오지 않으므로 지도 규칙만 복사하되, 손으로 베끼지 않고 이 함수로만 만든다 —
// 웹의 지도 스타일이 바뀌면 mapStyle.test.ts가 map.css와 다름을 잡아 실패시키고, `node scripts/app/sync-map-css.mjs`로 다시 만든다.
export const MAP_SELECTOR = /(?:^|[\s>+~,(])\.(?:jd2-vmap|hme-map|hme-pin|job-location-map)(?![\w-]*[A-Za-z0-9])|\.(?:jd2-vmap|hme-map|hme-pin|job-location-map)(?:[-_][\w-]*)?(?![\w-])/

function stripComments(css: string): string { return css.replace(/\/\*[\s\S]*?\*\//g, '') }

// 최상위 블록 {prelude, body}로 쪼갠다(문자열·괄호 안 중괄호는 무시).
function blocks(css: string): { prelude: string; body: string }[] {
  const out: { prelude: string; body: string }[] = []
  let i = 0
  const n = css.length
  while (i < n) {
    let start = i, depthParen = 0, quote = ''
    while (i < n) {
      const c = css[i]
      if (quote) { if (c === quote && css[i - 1] !== '\\') quote = ''; i++; continue }
      if (c === '"' || c === "'") { quote = c; i++; continue }
      if (c === '(') depthParen++
      else if (c === ')') depthParen--
      else if ((c === '{' || c === ';') && depthParen === 0) break
      i++
    }
    if (i >= n) break
    if (css[i] === ';') { i++; continue } // @import 같은 문장
    const prelude = css.slice(start, i).trim()
    let depth = 1; i++
    const bodyStart = i
    quote = ''
    while (i < n && depth > 0) {
      const c = css[i]
      if (quote) { if (c === quote && css[i - 1] !== '\\') quote = '' }
      else if (c === '"' || c === "'") quote = c
      else if (c === '{') depth++
      else if (c === '}') depth--
      i++
    }
    out.push({ prelude, body: css.slice(bodyStart, i - 1).trim() })
  }
  return out
}

function splitSelectors(prelude: string): string[] {
  const parts: string[] = []
  let depth = 0, cur = ''
  for (const c of prelude) {
    if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth--
    if (c === ',' && depth === 0) { parts.push(cur.trim()); cur = '' } else cur += c
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts
}

function extract(css: string, wantKeyframes: (name: string) => boolean): string[] {
  const out: string[] = []
  for (const { prelude, body } of blocks(css)) {
    if (/^@(media|supports|container)\b/.test(prelude)) {
      const inner = extract(body, wantKeyframes)
      if (inner.length) out.push(`${prelude} {\n${inner.map((r) => r.split('\n').map((l) => '  ' + l).join('\n')).join('\n')}\n}`)
    } else if (/^@keyframes\b/.test(prelude)) {
      const name = prelude.replace(/^@keyframes\s+/, '').trim()
      if (wantKeyframes(name)) out.push(`${prelude} {\n  ${body.replace(/\s+/g, ' ')}\n}`)
    } else if (!prelude.startsWith('@')) {
      const keep = splitSelectors(prelude).filter((s) => MAP_SELECTOR.test(s))
      if (keep.length) out.push(`${keep.join(',\n')} {\n  ${body.replace(/\s+/g, ' ')}\n}`)
    }
  }
  return out
}

/** 웹 css 여러 개에서 지도 규칙만 뽑아 한 파일 글자로 만든다. 순서는 원본 파일 순서·원본 안 순서 그대로. */
export function buildMapCss(sources: { name: string; css: string }[]): string {
  const clean = sources.map((s) => ({ name: s.name, css: stripComments(s.css) }))
  // 지도 규칙이 쓰는 keyframes 이름(규칙 본문의 animation 이름)
  const used = new Set<string>()
  for (const s of clean) for (const r of extract(s.css, () => false)) for (const m of r.matchAll(/animation(?:-name)?\s*:\s*([A-Za-z_][\w-]*)/g)) used.add(m[1])
  const parts = clean.map((s) => `/* ${s.name}에서 복사 — 직접 고치지 말고 node scripts/app/sync-map-css.mjs 로 다시 만든다 */\n` + extract(s.css, (name) => used.has(name)).join('\n\n'))
  return parts.join('\n\n') + '\n'
}
