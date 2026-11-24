// 공고 상세·목록 SSR(api/ssr.js)의 캐시 머리글 한 곳.
// 크롤러가 반복 요청하는 URL이므로 있는 화면은 짧게 공유 캐시한다(몇 분 안 반영이면 충분, 만료 직후에도 옛 응답을 바로 내려주고 뒤에서 새로 받는다).
// 없는 공고(404)는 캐시하지 않는다(DB 조회 실패 503과 같은 방식) — 비공개일 때 한 번 열린 주소의 404가 공유 캐시에 남으면
// 공개된 뒤에도 최대 12분(s-maxage 120 + stale-while-revalidate 600) 모두에게 404가 나갔다
// (2026-11-24 운영 검증 실패 #1016, sb-6337: 화면 대조 14:46:14 → 공개 14:46:32 → 운영 검사 14:46:45·14:50:14 모두 404).
export const ssrCacheControl = (notFound) => notFound ? 'no-store' : 'public, max-age=0, s-maxage=120, stale-while-revalidate=600'
