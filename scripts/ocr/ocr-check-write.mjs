// OCR 대조 결과를 local_jobs.ocr_check에 쓰는 SQL — 한 곳(#728 S7).
// ocr_check는 단계마다 자기 기록(inspect·screen_audit·business_type·benefits_ai·detail_fill·repair …)을 쌓는 한 JSON 덩어리다.
// 다른 단계는 모두 `coalesce(ocr_check,'{}') || jsonb_build_object(…)`로 **합치는데**, 이 쓰기만 덩어리를 OCR 결과만으로 **통째로 교체**해
// OCR이 다시 돌 때마다(사진 바뀜·대조 항목 바뀜·판 올림) 다른 단계 기록이 사라지고 그 단계들이 같은 일(AI 호출·웹 검색)을 되풀이했다.
// 단계 기록은 모두 내용 지문(hash)으로 유효성을 따지므로 합쳐도 낡은 기록이 잘못 쓰이지 않는다.
// $1 = job id, $2 = ocr_text, $3 = OCR 결과 JSON. hold=true면 같은 문장에서 비공개(R7 보류)로 둔다.
// 내림 표지(ocr_check.ocr_hold): OCR이 **공개 중이던** 공고를 내릴 때만 같은 문장에서 남긴다(UPDATE 식의 active는 바꾸기 전 값).
// 검사표(job-inspect.mjs)는 이 표지가 있는 공고를 되살릴 수 있는 공고(hold)로 본다 — OCR이 검사표보다 먼저 정상으로 돌아와도 재공개가 끊기지 않게(Codex P1, #728 R4).
// inspect_hold는 쓸 수 없다: DB 트리거가 공개 공고를 내리는 문장에서 inspect_hold를 지운다("직접 내린 공고는 검사기가 되살리지 않는다"). 이미 다른 이유로 비공개였던 공고에는 표지를 남기지 않는다.
export function ocrCheckUpdateSql(hold) {
  return `update public.local_jobs set ocr_text = $2, ocr_check = coalesce(ocr_check, '{}'::jsonb) || jsonb_set(
          jsonb_set($3::jsonb, '{images_hash}', to_jsonb(md5(images::text))),
          '{compared_hash}', to_jsonb(md5(to_jsonb(array[
            employer_phone, contact_zalo, salary, contact_name, company,
            age_min::text, age_max::text
          ])::text)))${hold ? ` || case when active then '{"ocr_hold": true}'::jsonb else '{}'::jsonb end, active = false` : ''} where id = $1`
}

// 사진을 못 받은 이유 가르기(#990, 2026-11-23): 같은 공고가 매 실행 '실패(exit 2)'로 멈추지 않게 영구 접근 거부와 일시 오류를 나눈다.
// 영구 = 우리 저장소가 아닌 외부 주소(예: 페이스북 사진 주소)가 403·404·410 — 만료·삭제라 다시 받아도 같다 → 이 사진은 '읽을 수 없음'으로 건너뛴다(글자 읽을 사진이 하나도 없으면 compareWithOcr의 읽기불가가 그대로 적용).
// 일시 = 5xx·429·네트워크 오류, 그리고 우리 저장소(비공개 bucket)의 403·404는 열쇠·저장 문제라 실제 실패로 남겨 다시 시도·알린다.
// (AI 판독 입력 파일이 아니라서 교정 검사 대상이 아니다 — 판독·대조 결과에 영향을 주지 않고 '사진을 받았는가'만 가른다.)
export function imageFetchPermanent(status, url, ownStorageUrl) {
  const own = ownStorageUrl && String(url).startsWith(String(ownStorageUrl))
  return !own && [403, 404, 410].includes(Number(status))
}
