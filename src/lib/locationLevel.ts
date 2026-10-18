// 위치를 "찾았다"고 보는 기준(결정 0006, 2026-10-18 Lee): 성(省) 중심보다 정확한 곳을 하나라도 알면 찾음.
// 찾음: 확인된 좌표 / 공단 입구 / 동 중심 / 공단(KCN) 이름이 주소에 있음. 못 찾음: 성 중심뿐.
// 판정 보류: 아직 처리 중이거나 VietMap 고장·한도로 다시 시도할 예정인 경우(이때는 숨기지 않는다).
import { findIndustrialPark, foldText } from './industrialPark'

/** 주소에 공단 이름이 적혀 있음(우리 공단 표에 아직 없어도). 회사+공단으로 Google이 찾을 수 있으므로 "못 찾음"이 아니라
 *  공단 표를 보강할 대상이다(예: #4824 KCN Yên Phong — 표에는 '확장 단지'만 있음). */
export function namesIndustrialPark(...texts: Array<string | null | undefined>): boolean {
  return texts.some((t) => !!t && /(?:^| )(?:kcn|kcx|ccn|khu cong nghiep|khu che xuat|cum cong nghiep) [a-z0-9]/.test(foldText(t)))
}

export type LocationVerdict = 'located' | 'unlocated' | 'pending'

export interface LocationFacts {
  hasExact: boolean
  /** map_r1_location_jobs 행(없으면 null) */
  state: { state: string; failures: number; calls: number; kind: string | null } | null
  texts: Array<string | null | undefined>
}

export function locationVerdict(f: LocationFacts): LocationVerdict {
  if (f.hasExact) return 'located'
  if (findIndustrialPark(...f.texts) || namesIndustrialPark(...f.texts)) return 'located'
  const s = f.state
  if (!s) return 'pending'
  if (s.kind && ['exact', 'gate', 'area'].includes(s.kind)) return 'located'
  if (s.state === 'done' && s.kind === 'unresolved') return 'unlocated'
  // 실패는 2번까지 다시 시도한 뒤에만 "못 찾음"
  if (s.state === 'failed' && (s.failures >= 2 || s.calls >= 2)) return 'unlocated'
  return 'pending'
}
