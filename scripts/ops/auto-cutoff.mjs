// Lee 2026-11-01: 자동 작업은 config/auto-processing-cutoff.json 시각 이후에 만든 공고만 다룬다(기존 공고 보호).
// OCR·AI 칸·상세 채우기·검사·다시 수집 대기열이 모두 이 한 파일을 읽는다(Python: crawler/auto_cutoff.py).
import { readFileSync } from 'node:fs'

export const AUTO_CUTOFF = JSON.parse(readFileSync(new URL('../../config/auto-processing-cutoff.json', import.meta.url), 'utf8')).created_after
if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(AUTO_CUTOFF)) throw new Error('auto-processing-cutoff.json created_after 형식 오류')
/** SQL 조건(별칭 a의 created_at). 값은 위에서 형식을 검사한 고정 문자열이다. */
export const afterCutoff = (a = '') => `${a ? a + '.' : ''}created_at >= '${AUTO_CUTOFF}'::timestamptz`
