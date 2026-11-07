// 등록 입구에서 포스터 글자 읽기(Lee 2026-11-07): 글에 회사 이름이 없을 때만 크롤러가 부른다(crawler/ingest_gateway.py).
// 등록 뒤 판독(job-ocr-check)과 같은 판독기(ai-reader.mjs)를 쓴다. 출력: 판독 글자만(stdout). 실패하면 종료 코드 1.
import { readImageAI } from './ai-reader.mjs'
const file = process.argv[2]
if (!file) { console.error('사용: node scripts/ocr/read-poster.mjs <이미지 파일>'); process.exit(2) }
try {
  const text = await readImageAI(file)
  process.stdout.write(String(text?.text ?? text ?? ''))
} catch (e) {
  console.error('poster_read_failed', e?.message ?? '')
  process.exit(1)
}
