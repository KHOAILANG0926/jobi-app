// 검사표 결과를 local_jobs에 기록하는 SQL — 한 곳(ocr-check-write.mjs와 같은 방식, #728 R4).
// $1 id, $2 검사 기록 JSON, $3 공개 여부(d.active), $4 읽을 때의 내용 지문, $5 inspect_hold 유지(고용주·legacy 대기 중), $6 관리자 숨김,
// $7 읽을 때의 active, $8 읽을 때의 OCR 상태. $4·$7·$8이 지금 값과 다르면 아무것도 쓰지 않는다 — 읽은 뒤 다른 쪽(OCR 불일치 내림·소유자 철회·관리자)이 바꾼 공개 상태를
// 낡은 판정으로 덮어쓰지 않는다(rowCount 0 → 호출자가 다음 실행에서 재검사). 공개 여부를 올리는 쓰기는 이 문장 하나다.
export const INSPECT_RECORD_SQL = `update public.local_jobs
      set ocr_check = (case when $5::boolean then coalesce(ocr_check, '{}'::jsonb) else coalesce(ocr_check, '{}'::jsonb) - 'inspect_hold' end
                       - case when $6::boolean then 'ocr_hold' else '' end) || jsonb_build_object('inspect', $2::jsonb),   -- OCR 내림 표지는 관리자가 숨기면 지운다. 공개 요청만으로는 지우지 않는다(아래 CLEAR_OCR_HOLD_SQL)
          active = $3::boolean
      where id = $1 and public.job_inspect_content_hash(local_jobs) = $4
        and (origin in ('crawler','admin') or coalesce(ocr_check->>'inspect_hold', '') = 'true')   -- 읽은 뒤 소유자가 철회(hold 제거)했으면 덮어쓰지 않는다(Codex #797)
        and active is not distinct from $7::boolean and (ocr_check->>'status') is not distinct from $8::text   -- 읽은 뒤 OCR이 내렸거나 상태가 바뀌었으면 덮어쓰지 않는다
      returning active`

// OCR 내림 표지는 실제로 공개된 것이 확인된 뒤에만 지운다 — 검사표가 active=true를 요청해도 DB 트리거(공개 게이트·직업분류·정책)가 거부하면 결과는 비공개이고,
// 그때 표지를 지우면 원인을 고친 뒤 다시 공개할 근거가 사라진다(Codex P1, #728 R4). $1 = id. 호출자는 기록 문장이 돌려준 active가 true일 때만 부른다.
export const CLEAR_OCR_HOLD_SQL = `update public.local_jobs set ocr_check = ocr_check - 'ocr_hold' where id = $1 and active and ocr_check ? 'ocr_hold'`
