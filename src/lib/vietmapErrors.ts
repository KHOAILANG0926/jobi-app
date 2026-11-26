// VietMap 호출 오류 종류. 브라우저 로그인(supabase)을 쓰지 않는 순수 파일 — 서버 위치 확인 묶음(chototAutoLocate·wardLocate)이 쓴다.
// 옛 adminVietmapClient.ts에서 분리했고, 그 파일의 호출 함수(callAdminVietmap)는 호출하는 곳이 없어 지웠다(구조 정리).

export class VietmapRequestError extends Error {
  readonly used: number | null
  readonly limit: number | null
  readonly day: string | null
  constructor(
    message: string,
    used: number | null = null,
    limit: number | null = null,
    day: string | null = null,
  ) {
    super(message)
    this.name = 'VietmapRequestError'
    this.used = used
    this.limit = limit
    this.day = day
  }
}

export class DailyLimitError extends VietmapRequestError {
  override readonly used: number
  override readonly limit: number
  constructor(used: number, limit: number, day: string | null = null) {
    super('daily_limit', used, limit, day)
    this.name = 'DailyLimitError'
    this.used = used
    this.limit = limit
  }
}
