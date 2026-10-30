// Lee 2026-10-30: 관리자 위치 목록에는 관리자가 실제로 고칠 수 있는 공고만 올린다.
// 단서 = 번지+도로명(기존 parseStreetAddress) 또는 실제 회사명(기존 isGenericCompanyName이 아닌 것).
// 단서가 없으면(동·공단 이름만) 관리자도 근거가 없으므로 목록에 올리지 않고 공개 화면은 "chưa xác minh" + 전화 그대로.
// 자동 ①번지·②회사+공단으로 찾은 공고는 이미 location_verified라 원래부터 목록에 없다.
import { parseStreetAddress } from './addressParse'
import { isGenericCompanyName } from './jobDetailView'

export function hasLocationClue(company: string | null | undefined, addresses: Array<string | null | undefined>): boolean {
  if (!isGenericCompanyName(company)) return true
  return addresses.some((a) => !!a && parseStreetAddress(a).searchable)
}
