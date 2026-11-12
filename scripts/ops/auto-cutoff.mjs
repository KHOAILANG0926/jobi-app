// Lee 2026-11-01: 자동 작업은 config/auto-processing-cutoff.json 시각 이후에 만든 공고만 다룬다(기존 공고 보호).
// OCR·AI 칸·상세 채우기·검사·다시 수집 대기열이 모두 이 한 파일을 읽는다(Python: crawler/auto_cutoff.py).
import { readFileSync } from 'node:fs'

export const AUTO_CUTOFF = JSON.parse(readFileSync(new URL('../../config/auto-processing-cutoff.json', import.meta.url), 'utf8')).created_after
if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(AUTO_CUTOFF)) throw new Error('auto-processing-cutoff.json created_after 형식 오류')
/** SQL 조건(별칭 a의 created_at). 값은 위에서 형식을 검사한 고정 문자열이다. */
export const afterCutoff = (a = '') => `${a ? a + '.' : ''}created_at >= '${AUTO_CUTOFF}'::timestamptz`

// 기존 공고 한 번 다시 정리(Lee 2026-11-08 AI 판정, 2026-11-12 "예전 거는 지금 전체 확인해서 다시 수정"): 워크플로 수동 실행 입력 all_jobs가
// AUTO_ALL_JOBS=1을 주면 기준 시각 이전 공고도 다룬다. 단 기준 틀 공고(KDA, jobQuyenLoi.BASELINE_FRAME_JOB_IDS)는 절대 건드리지 않는다.
// 이 한 함수가 OCR 뒤 단계(상세 채우기·AI 칸·업종·검사표)의 대상 조건이다.
// 기준 틀 목록은 화면 코드(jobQuyenLoi.ts) 한 곳에서 읽는다 — all_jobs일 때만 불러온다(평소 실행은 TS 불러오기 도구 없이 돈다).
export const ALL_JOBS = process.env.AUTO_ALL_JOBS === '1'
const BASELINE_IDS = ALL_JOBS
  ? [...(await import('../../src/lib/jobQuyenLoi.ts')).BASELINE_FRAME_JOB_IDS].map((x) => Number(String(x).replace(/^sb-/, '')))
  : []
if (ALL_JOBS && (!BASELINE_IDS.length || !BASELINE_IDS.every(Number.isInteger))) throw new Error('기준 틀 공고 번호를 못 읽음 — 전체 정리를 멈춤')
export const autoScope = (a = '') => ALL_JOBS
  ? `${a ? a + '.' : ''}id <> all(array[${BASELINE_IDS.join(',')}]::bigint[])`
  : afterCutoff(a)
