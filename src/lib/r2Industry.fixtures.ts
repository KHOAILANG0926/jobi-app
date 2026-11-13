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

// 검색 AI(web_search_20250305) 응답 — 실제 Messages API 응답 모양(server_tool_use → web_search_tool_result → citations가 붙은 text 블록)으로 만든 기록용 본문.
// 라이브 호출이 아니라 문서화된 응답 구조를 따른 고정 본문이다(키·외부 호출 없음). 공장 업무 공고와 가게 공고에 같은 모양으로 준다.
const searchBody = (answerJson: string, quotes: Array<{ url: string; cited_text: string }>) => ({
  id: 'msg_x', type: 'message', role: 'assistant', stop_reason: 'end_turn',
  content: [
    { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'x' } },
    { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: quotes.map((q) => ({ type: 'web_search_result', url: q.url, title: 't', encrypted_content: 'e' })) },
    { type: 'text', text: 'Kết quả: ', citations: quotes.map((q) => ({ type: 'web_search_result_location', url: q.url, title: 't', cited_text: q.cited_text, encrypted_index: 'i' })) },
    { type: 'text', text: answerJson },
  ],
})
export const WEB_BODIES = {
  // 가게(Wallace) — 같은 이름+같은 번지·도로가 한 인용문에 있음
  shop: searchBody('{"type":"fnb"}', [{ url: 'https://map.example/wallace', cited_text: 'Wallace Burger & Chicken - Quán ăn tại Số 216 Đường Nguyễn Trãi, Bắc Ninh' }]),
  // 공장 업무 공고인데 검색은 같은 이름·거리의 음식점/마트를 집음(장소 유형이 업무를 덮으려는 상황)
  factoryHostile: searchBody('{"type":"fnb"}', [{ url: 'https://map.example/fushan', cited_text: 'FUSHAN - Nhà hàng & Siêu thị tại 12 Đường số 5, KCN VSIP Bắc Ninh' }]),
  noCitation: searchBody('{"type":"fnb"}', []),
  noJson: searchBody('Không tìm thấy thông tin', [{ url: 'https://map.example/a', cited_text: 'x' }]),
  badJson: searchBody('{"type": fnb', [{ url: 'https://map.example/a', cited_text: 'x' }]),
  emptyContent: { id: 'msg_x', type: 'message', content: [] },
  errorBody: { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } },
} as const
