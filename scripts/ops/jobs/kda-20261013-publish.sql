-- 사용자 지시(2026-10-13 23:45): KDA 공고(#4824) 공개.
-- OCR(Tesseract)이 꾸민 포스터를 판독하지 못해 대조가 mismatch로 보류됨. 사용자 지시로 대조를 생략하고 공개한다.
-- 생략 사실과 직전 대조 결과를 ocr_check에 그대로 남긴다(manual_override=true).
update public.local_jobs
set ocr_check = jsonb_build_object(
      'status', 'ok',
      'checked_at', now(),
      'images_hash', md5(images::text),
      'manual_override', true,
      'override_reason', '사용자 공개 지시 2026-10-13 23:45. OCR이 꾸민 포스터를 판독하지 못함(직전 대조 mismatch). 대조 생략.',
      'previous', ocr_check),
    active = true
where id = 4824 and company = 'CTY KDA'
returning id, active, admin_hidden;
