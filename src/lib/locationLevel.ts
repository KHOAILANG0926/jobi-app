// 위치를 "찾았다"고 보는 기준 — 2026-10-18 결정 0006, 2026-10-20 Lee 수정("삭제하지 말고 해결 방법을 찾아야지").
// 찾음(공개): 확인된 좌표 / 공단 입구 / 동 중심(대략 위치 핀 + Google 길찾기는 주소 글자) / 공단(KCN) 이름이 주소에 있음.
// 원문에 위치 정보 없음(성 이름뿐): 바로 삭제.
// 원문엔 주소가 있는데 우리가 못 찾음: 비공개 + 매일 저녁 8시 목록 보고(원인·해결 방법) + 코드 고친 뒤 자동 재판정. 자동 삭제하지 않는다.
// 판정 보류: 아직 처리 중이거나 VietMap 고장·한도로 다시 시도할 예정(이때는 숨기지 않는다).
import { findIndustrialPark, foldText } from './industrialPark'

/** 주소에 공단 이름이 적혀 있음(우리 공단 표에 아직 없어도). 회사+공단으로 Google이 찾을 수 있으므로 "못 찾음"이 아니다. */
export function namesIndustrialPark(...texts: Array<string | null | undefined>): boolean {
  return texts.some((t) => !!t && /(?:^| )(?:kcn|kcx|ccn|khu cong nghiep|khu che xuat|cum cong nghiep) [a-z0-9]/.test(foldText(t)))
}

// 성·나라 이름뿐인 구간(위치 정보로 치지 않음)
const PROVINCE_ONLY = /^(?:(?:tinh|t|thanh pho|tp) )?(?:bac ninh|bac giang|ha noi|viet nam|vn)$/
// 원문 글에서 주소를 뜻하는 낱말(이 중 하나라도 있으면 "원문에 위치 정보 없음"이 아니다)
const ADDRESS_WORD = /(?:^| )(?:phuong|xa|thi tran|thi xa|huyen|quan|duong|pho|ngo|ngach|thon|xom|khu pho|khu|kdc|kcn|ccn|lo|so \d+|dia chi|dia diem)(?= |$)/

/** 공고에 성 이름보다 자세한 위치(동·도로·번지·공단 등)가 적혀 있는가. 원문(source_text)까지 본다. */
export function hasLocationDetail(texts: Array<string | null | undefined>, sourceText?: string | null): boolean {
  const field = texts.some((t) => String(t ?? '').split(',').map((s) => foldText(s)).some((s) => s && !PROVINCE_ONLY.test(s)))
  return field || ADDRESS_WORD.test(foldText(String(sourceText ?? '')))
}

export type LocationVerdict = 'located' | 'pending' | 'no_info' | 'our_miss'

export interface LocationFacts {
  hasExact: boolean
  /** map_r1_location_jobs 행(없으면 null) */
  state: { state: string; failures: number; calls: number; kind: string | null } | null
  texts: Array<string | null | undefined>
  sourceText?: string | null
}

export function locationVerdict(f: LocationFacts): LocationVerdict {
  if (f.hasExact) return 'located'
  if (findIndustrialPark(...f.texts) || namesIndustrialPark(...f.texts)) return 'located'
  const s = f.state
  if (!s) return 'pending'
  if (s.kind && ['exact', 'gate', 'area'].includes(s.kind)) return 'located'
  const notFound = (s.state === 'done' && s.kind === 'unresolved') || (s.state === 'failed' && (s.failures >= 2 || s.calls >= 2))
  if (!notFound) return 'pending'
  return hasLocationDetail(f.texts, f.sourceText) ? 'our_miss' : 'no_info'
}
