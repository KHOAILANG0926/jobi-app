// R2(#753) 업종 독립 기대값 — 원문 업무 내용으로 사람이 정한 업종 구분. 키는 r2Oracle.fixtures.ts의 공고 이름이다.
// 'non-service' = 공장·생산 업무(가게·음식·판매·서비스 업종이 아님) → 장소 유형(Google)·검색 결과로 가게 업종이 정해지면 오류.
// 'service'     = 음식·판매·서비스 업무 → 가게 업종이 정해져도 되고(안 정해져도 됨), 공장 업종으로 틀리게 정해지면 오류.
// 생산 코드(businessType)·낱말표로 만들지 않았다. 기대값을 코드에 맞춰 바꾸지 않는다(S2: *.fixtures.ts는 기존 줄 변경에 근거 필요).
export const R2_INDUSTRY: Record<string, 'service' | 'non-service'> = {
  '4824 KDA': 'non-service',           // "Làm ngồi linh kiện tai nghe" — 이어폰 부품 생산(KCN)
  '4828 Mao Yên': 'non-service',       // "Sản xuất dây truyền dữ liệu, dây mạng." — 전선 생산
  '4878 TEFAL': 'service',             // "bán các sản phẩm gia dụng" — 판매
  '4879 ADTEK': 'non-service',         // 공장(Nhà máy Quế Võ 3) 생산직
  '4982 Bomunttl(복수 직무)': 'service', // 음식점 설거지·서빙
  '5157 Highlands': 'service',         // 카페 판매·바리스타·서빙
  'FUSHAN 공단 공장': 'non-service',    // VSIP 공장, 업무 미기재(Lee 2026-10-27 결정)
}
// Google 장소 유형을 적대적으로 준다: 실제 업무와 상관없이 가게로 보이는 유형들.
export const HOSTILE_PLACES = [
  { id: 'h-mall', primaryType: 'shopping_mall', types: ['shopping_mall', 'store'] },
  { id: 'h-rest', primaryType: 'restaurant', types: ['restaurant', 'food'] },
  { id: 'h-hotel', primaryType: 'lodging', types: ['lodging', 'hotel'] },
  { id: 'h-market', primaryType: 'supermarket', types: ['supermarket', 'grocery_store'] },
]
