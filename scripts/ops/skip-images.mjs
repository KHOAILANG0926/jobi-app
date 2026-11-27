// 화면 글자·핀·목록만 확인하는 운영 검사에서 그림 파일 요청을 건너뛴다(SKIP_IMAGES=1일 때만).
// 사용량 정리: 검사가 열 때마다 공고 사진(Supabase 저장소)·사이트 그림(/images, /logo.png)을 받아 전송량이 쓰이던 것을 줄인다.
// 그림 모양을 확인하는 검사(app-smoke 등)는 이 함수를 쓰지 않는다. 지도 타일·지도 아이콘·API·글꼴은 건드리지 않는다.
const SUPABASE_STORAGE = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/(?:object|render)\//
export function isSkippableImage(url, siteOrigin) {
  if (SUPABASE_STORAGE.test(url)) return true
  try {
    const u = new URL(url)
    return u.origin === siteOrigin && (u.pathname === '/logo.png' || u.pathname.startsWith('/images/'))
  } catch { return false }
}
export async function skipImages(context, siteOrigin) {
  if (process.env.SKIP_IMAGES !== '1') return
  await context.route('**/*', (route) => (isSkippableImage(route.request().url(), siteOrigin) ? route.abort() : route.continue()))
}
