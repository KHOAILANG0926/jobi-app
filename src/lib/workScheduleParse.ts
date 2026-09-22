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

// 2026-09-22 실제 DB 재현 사례로 발견된 버그 수정 — "nghỉ chiều Thứ 7, Chủ
// nhật"처럼 "nghỉ" 뒤에 시간대 단어(chiều)와 콤마로 이어지는 요일 목록이
// 오면, 기존의 "nghỉ로부터 15글자 이내" 고정 거리 방식은 두 번째 요일
// (Chủ nhật)가 15글자를 넘어가 버려 부정 처리가 빠졌었다("nghỉ ngày Chủ
// nhật"처럼 짧은 경우만 우연히 맞았음). 고정 거리 대신, "nghỉ" 뒤에서
// 요일 토큰을 하나씩 순서대로 따라가며 그 사이(gap)가 콤마/공백/"và"(and)/
// "ngày"(day)/시간대 단어(chiều/sáng/tối/đêm)로만 이루어진 동안은 계속
// 부정 목록에 포함시키고, 그 외의 실제 내용이 끼면 그 nghỉ 절은 거기서
// 끊는다(다른 문장의 요일까지 잘못 부정하지 않기 위함).
const NGHI_CONNECTOR_RE = /^[\s,-]*((va|ngay|chieu|sang|toi|dem)[\s,-]*)*$/

/** work_days 자유 문장에서 요일 집합을 뽑는다. "A đến B" 형태는 그 사이
 * 모든 요일로 채우고, "nghỉ X" 근처의 요일은 제외한다. 요일 언급이 전혀
 * 없으면 빈 Set(억지로 추측하지 않음). */
export function parseWorkDays(text: string | null | undefined): Set<DayCode> {
  const result = new Set<DayCode>()
  if (!text) return result
  const norm = normalizeKeepingPunctuation(text)

  const found: { index: number; end: number; day: DayCode }[] = []
  for (const [re, day] of DAY_TOKENS) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(norm))) {
      found.push({ index: m.index, end: m.index + m[0].length, day })
      if (m.index === re.lastIndex) re.lastIndex++
    }
  }
  if (found.length === 0) return result
  found.sort((a, b) => a.index - b.index)

  const nghiPositions: number[] = []
  NGHI_RE.lastIndex = 0
  let nm: RegExpExecArray | null
  while ((nm = NGHI_RE.exec(norm))) nghiPositions.push(nm.index + nm[0].length)

  const negated = new Set<DayCode>()
  for (const nghiEnd of nghiPositions) {
    let cursor = nghiEnd
    for (const f of found) {
      if (f.index < cursor) continue
      const gap = norm.slice(cursor, f.index)
      if (!NGHI_CONNECTOR_RE.test(gap)) break
      negated.add(f.day)
      cursor = f.end
    }
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

// 2026-09-22 실제 DB 재현 사례로 발견된 버그 수정 — "8:00 – 17:00"(순수
// 주간 근무)처럼 종료 시각이 정각으로 "저녁(tối, 17~22시)" 경계에 딱
// 걸리는 공고가, 예전엔 시작/종료 시각을 각각 독립적으로 버킷 판정해서
// "저녁에도 일한다"로 오탐 처리됐었다(실제 활성 공고 4450/4426/4482/4525/
// 4517 등 "8:00-17:00"류 순수 주간 근무 다수가 재현됨). 종료 시각이 정각
// (분=0)이면 그 시각 자체는 근무 종료 시점이지 근무 시간이 아니므로
// 제외하고, 분이 남아있으면(예: 17h30) 그만큼은 실제로 그 버킷에 걸쳐
// 있으므로 포함한다. "X - Y"/"X đến Y" 형태로 짝지어진 두 시각만 이
// 규칙을 적용하고, 짝이 안 되는 단독 시각 언급은 기존처럼 그 시각 자체의
// 버킷만 더한다.
const RANGE_CONNECTOR_RE = /^\s*(-|–|—|đến)\s*$/i

function bucketsForRange(startHour: number, endHour: number, endMinute: number): TimeBucket[] {
  const buckets = new Set<TimeBucket>()
  if (startHour === endHour && endMinute === 0) {
    // "8h-8h"처럼 사실상 구간이 없는 표기(드묾) — 시작 시각 하나만.
    buckets.add(bucketForHour(startHour))
    return [...buckets]
  }
  // 분이 남아 있으면 종료 시각 버킷까지 포함, 정각이면 그 직전 시각까지만
  // (자정을 넘는 구간은 24로 모듈러 연산).
  const inclusiveEnd = endMinute > 0 ? endHour : (endHour - 1 + 24) % 24
  let h = startHour
  let guard = 0
  while (guard++ < 25) {
    buckets.add(bucketForHour(h))
    if (h === inclusiveEnd) break
    h = (h + 1) % 24
  }
  return [...buckets]
}

/** hours 자유 문장에서 실제 시계 시각(예: "8h00", "17:30")이 있는 것만
 * 인식해 시간대로 묶는다. "8 tiếng/ngày"처럼 기간 표현이거나 시각이 아예
 *없으면 빈 Set — 절대 추측으로 채우지 않는다. */
export function parseWorkHourBuckets(text: string | null | undefined): Set<TimeBucket> {
  const result = new Set<TimeBucket>()
  if (!text) return result
  const timeRe = /(\d{1,2})[h:](\d{2})?/g
  const times: { index: number; end: number; hour: number; minute: number }[] = []
  let m: RegExpExecArray | null
  while ((m = timeRe.exec(text))) {
    const rawHour = parseInt(m[1], 10)
    if (rawHour < 0 || rawHour > 24) continue
    times.push({
      index: m.index,
      end: m.index + m[0].length,
      hour: rawHour === 24 ? 0 : rawHour,
      minute: m[2] ? parseInt(m[2], 10) : 0,
    })
  }

  const consumed = new Set<number>()
  for (let i = 0; i < times.length - 1; i++) {
    if (consumed.has(i)) continue
    const a = times[i]
    const b = times[i + 1]
    if (!RANGE_CONNECTOR_RE.test(text.slice(a.end, b.index))) continue
    consumed.add(i)
    consumed.add(i + 1)
    for (const bucket of bucketsForRange(a.hour, b.hour, b.minute)) result.add(bucket)
  }
  for (let i = 0; i < times.length; i++) {
    if (consumed.has(i)) continue
    result.add(bucketForHour(times[i].hour))
  }
  return result
}
