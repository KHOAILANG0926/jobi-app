/**
 * jobCoords.ts의 normalizeViText()는 검색/매칭용이라 "-"/"–" 같은 문장부호를
 * 전부 공백으로 지워버린다 — 그러면 "Thứ 2 - Thứ 6"의 범위 표시("-")가
 * 사라져서 범위 판정이 깨진다(실제로 겪은 버그). 여기서는 억양부호만 지우고
 * "-"/"–"/숫자/공백은 그대로 남기는 가벼운 정규화를 따로 쓴다.
 */
function normalizeKeepingPunctuation(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
}

/**
 * local_jobs.work_days/hours는 크롤러가 "FreeText"로 저장한 자유 문장이라
 * (구조화된 요일 배열/시작·종료 시각이 아님), 요일·시간대 필터를 만들려면
 * 이 텍스트에서 직접 추출해야 한다. 2026-09-17 사용자 지시로 실제 DB 값을
 * 확인한 결과 요일 표현("Thứ 2 đến Thứ 7", "thứ 7, chủ nhật" 등)은 정해진
 * 어휘라 규칙 기반 추출이 가능함을 확인, 시간은 "8 tiếng/ngày"처럼 시계
 * 시각이 아닌 것도 섞여 있어(순수 기간 표현, 또는 추출 노이즈) 시계 시각
 * 패턴(예: "8h00", "17:00")이 실제로 있는 것만 인식하고 나머지는 그냥
 * 빈 결과로 둔다 — 추측으로 채우지 않는다.
 */

export type DayCode = 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'CN'

export const DAY_ORDER: DayCode[] = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

export const DAY_LABELS: Record<DayCode, string> = {
  T2: 'Thứ 2',
  T3: 'Thứ 3',
  T4: 'Thứ 4',
  T5: 'Thứ 5',
  T6: 'Thứ 6',
  T7: 'Thứ 7',
  CN: 'Chủ nhật',
}

const DAY_TOKENS: [RegExp, DayCode][] = [
  [/\bthu\s*2\b|\bthu\s*hai\b/g, 'T2'],
  [/\bthu\s*3\b|\bthu\s*ba\b/g, 'T3'],
  [/\bthu\s*4\b|\bthu\s*tu\b/g, 'T4'],
  [/\bthu\s*5\b|\bthu\s*nam\b/g, 'T5'],
  [/\bthu\s*6\b|\bthu\s*sau\b/g, 'T6'],
  [/\bthu\s*7\b|\bthu\s*bay\b/g, 'T7'],
  [/\bchu\s*nhat\b|\bcn\b/g, 'CN'],
]

const NGHI_RE = /\bnghi\b/g

/** work_days 자유 문장에서 요일 집합을 뽑는다. "A đến B" 형태는 그 사이
 * 모든 요일로 채우고, "nghỉ X" 근처의 요일은 제외한다. 요일 언급이 전혀
 * 없으면 빈 Set(억지로 추측하지 않음). */
export function parseWorkDays(text: string | null | undefined): Set<DayCode> {
  const result = new Set<DayCode>()
  if (!text) return result
  const norm = normalizeKeepingPunctuation(text)

  const found: { index: number; day: DayCode }[] = []
  for (const [re, day] of DAY_TOKENS) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(norm))) {
      found.push({ index: m.index, day })
      if (m.index === re.lastIndex) re.lastIndex++
    }
  }
  if (found.length === 0) return result
  found.sort((a, b) => a.index - b.index)

  const nghiPositions: number[] = []
  NGHI_RE.lastIndex = 0
  let nm: RegExpExecArray | null
  while ((nm = NGHI_RE.exec(norm))) nghiPositions.push(nm.index)

  const negated = new Set<DayCode>()
  for (const f of found) {
    if (nghiPositions.some((p) => f.index > p && f.index - p < 15)) negated.add(f.day)
  }

  for (let i = 0; i < found.length; i++) {
    const cur = found[i]
    if (negated.has(cur.day)) continue
    result.add(cur.day)
    const next = found[i + 1]
    if (next && !negated.has(next.day)) {
      const between = norm.slice(cur.index, next.index)
      if (/den|-|–/.test(between)) {
        const startIdx = DAY_ORDER.indexOf(cur.day)
        const endIdx = DAY_ORDER.indexOf(next.day)
        if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
          for (let d = startIdx; d <= endIdx; d++) result.add(DAY_ORDER[d])
        }
      }
    }
  }
  return result
}

export type TimeBucket = 'sang' | 'chieu' | 'toi' | 'dem'

export const TIME_BUCKET_ORDER: TimeBucket[] = ['sang', 'chieu', 'toi', 'dem']

export const TIME_BUCKET_LABELS: Record<TimeBucket, string> = {
  sang: 'Sáng (05:00–11:00)',
  chieu: 'Chiều (11:00–17:00)',
  toi: 'Tối (17:00–22:00)',
  dem: 'Đêm (22:00–05:00)',
}

function bucketForHour(h: number): TimeBucket {
  const hh = h === 24 ? 0 : h
  if (hh >= 5 && hh < 11) return 'sang'
  if (hh >= 11 && hh < 17) return 'chieu'
  if (hh >= 17 && hh < 22) return 'toi'
  return 'dem'
}

/** hours 자유 문장에서 실제 시계 시각(예: "8h00", "17:30")이 있는 것만
 * 인식해 시간대로 묶는다. "8 tiếng/ngày"처럼 기간 표현이거나 시각이 아예
 *없으면 빈 Set — 절대 추측으로 채우지 않는다. */
export function parseWorkHourBuckets(text: string | null | undefined): Set<TimeBucket> {
  const result = new Set<TimeBucket>()
  if (!text) return result
  const re = /(\d{1,2})[h:](\d{2})?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const h = parseInt(m[1], 10)
    if (h >= 0 && h <= 24) result.add(bucketForHour(h))
  }
  return result
}
