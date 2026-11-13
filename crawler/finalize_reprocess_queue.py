"""Finalize queue only after independent OCR and publication gates have completed.

판정은 기존 기록을 읽기만 한다(새 게이트를 만들지 않는다): DB 공개 게이트 R7(images가 있으면 ocr_check.status ok + images_hash 일치, job_posting_rules),
OCR 검사 기록, 검사표 기록(ocr_check.inspect), R8 직업코드, 핀 보호(pin_guard). 결과는 세 가지다.
 - success  : 공개 중이고 기존 게이트 조건을 지킴(이미지 없는 공고는 OCR 결과를 요구하지 않는다)
 - held     : 비공개이고 기존 게이트가 남긴 실제 차단 사유가 있음 — 대기열에는 blocked + 사유로 남기되 실행은 실패시키지 않는다
 - failure  : 사유 불명 비공개, 공개→비공개 변경, 공개인데 OCR 불일치·해시 불일치, 핀 손실, 제목 이상 — 실행을 실패시킨다
'비공개였다'는 사실만으로 보류로 보지 않는다. 재처리 전 상태(result.before)는 '재처리가 공개를 내렸는가'를 가리는 데만 쓴다.
"""
import hashlib
import json
from datetime import datetime, timezone, date
import time
import pin_guard


def _jsonb_text(value):
    """PostgreSQL jsonb::text 와 같은 글자(md5(images::text)로 DB 게이트가 해시하는 모양): 객체 키는 짧은 것 먼저·같으면 바이트 순, 구분은 ', '·': '."""
    if isinstance(value, dict):
        keys = sorted(value, key=lambda k: (len(k.encode()), k.encode()))
        return "{" + ", ".join(f"{json.dumps(k, ensure_ascii=False)}: {_jsonb_text(value[k])}" for k in keys) + "}"
    if isinstance(value, list):
        return "[" + ", ".join(_jsonb_text(v) for v in value) + "]"
    return json.dumps(value, ensure_ascii=False)


def images_hash(images):
    return hashlib.md5(_jsonb_text(images).encode()).hexdigest()


def image_count(images):
    return len(images) if isinstance(images, list) else 0


def blocking_reason(current, today=None):
    """비공개 공고가 막힌 실제 사유(기존 게이트·검사 기록에서 읽음). 없으면 None = 사유 불명."""
    today = today or date.today().isoformat()
    oc = current.get("ocr_check") or {}
    if current.get("admin_hidden") is True:
        return "admin_hidden"
    if image_count(current.get("images")) > 0 and oc.get("status") in ("mismatch", "unreadable"):
        return "r7_" + oc["status"]
    if not current.get("occupation_code"):
        return "no_occupation_code"
    gate = current.get("publish_gate_reason")
    if gate not in (None, "ok"):
        return "publish_gate:" + str(gate)
    deadline = current.get("application_deadline")
    if deadline and str(deadline)[:10] < today:
        return "deadline_passed"
    inspect = oc.get("inspect") or {}
    if inspect.get("publishable") is False:
        failing = [i.get("key") for i in inspect.get("items", []) if i.get("ok") is False and i.get("key") != "public"]
        return "inspect_failed:" + ",".join(str(k) for k in failing[:6])
    return None


def verdict(current, item_result, pin_problems, today=None):
    """(결과, 사유). 결과는 success / held / failure. 순수 함수 — 시험이 같은 함수를 부른다."""
    title = (current.get("title") or "").strip()
    if not title or title.endswith(":") or title.casefold() == "vị trí tuyển dụng:":
        return "failure", "title_unverified"
    if pin_problems:
        return "failure", "location_regression:" + ";".join(pin_problems)
    published = current.get("active") is True and current.get("admin_hidden") is False
    images = current.get("images")
    oc = current.get("ocr_check") or {}
    if published:
        if image_count(images) > 0:
            if oc.get("status") != "ok":
                return "failure", "r7_not_ok:" + str(oc.get("status"))
            if oc.get("images_hash") != images_hash(images):
                return "failure", "ocr_images_hash_mismatch"
        return "success", None
    before = (item_result or {}).get("before") or {}
    if before.get("active") is True and before.get("admin_hidden") is False:
        return "failure", "unpublished_by_reprocess"
    reason = blocking_reason(current, today)
    if reason:
        return "held", reason
    return "failure", "unexplained_unpublished"


def run():
    from crawl_facebook import supabase
    queue = (supabase.table("job_reprocess_queue").select("id,job_id,result")
             .eq("status", "running").order("started_at").limit(50).execute().data or [])
    failures = 0
    for item in queue:
        current = (supabase.table("local_jobs").select(
            "id,title,active,admin_hidden,publish_gate_reason,ocr_check,occupation_code,images,application_deadline"
        ).eq("id", item["job_id"]).single().execute().data)
        # 핀 전후 비교(pin_guard): 위치 찾기는 저장 뒤 따로 돌므로 빠진 핀이 다시 찍힐 때까지 최대 2분 기다린다.
        pin_problems = []
        if "pins_before" in (item.get("result") or {}):
            for _ in range(8):
                pin_problems = pin_guard.problems(item["result"]["pins_before"], pin_guard.snapshot(supabase, item["job_id"]))
                if not any(p.startswith("pin_lost") for p in pin_problems): break
                time.sleep(15)
        outcome, reason = verdict(current, item.get("result"), pin_problems)
        title = (current.get("title") or "").strip()
        published = current.get("active") is True and current.get("admin_hidden") is False
        result = {**(item.get("result") or {}), "title": title, "title_verified": reason != "title_unverified",
                  "r7": (current.get("ocr_check") or {}).get("status"), "images": image_count(current.get("images")),
                  "published": published, "pin_problems": pin_problems, "verdict": outcome,
                  "url": f"https://viecganban.vn/viec-lam/sb-{item['job_id']}" if published else None}
        update = {"status": "success" if outcome == "success" else "blocked", "result": result,
                  "finished_at": datetime.now(timezone.utc).isoformat(),
                  "error": None if outcome == "success" else (("held:" if outcome == "held" else "") + reason)}
        supabase.table("job_reprocess_queue").update(update).eq("id", item["id"]).eq("status", "running").execute()
        print(json.dumps({"job_id": item["job_id"], **update}, ensure_ascii=False))
        if pin_problems: print(f"::error::job {item['job_id']} 다시 처리 뒤 지도 핀 문제: {';'.join(pin_problems)}")
        if outcome == "failure": failures += 1
    if failures: raise RuntimeError(f"{failures} jobs failed title/R7/publication verification")


if __name__ == "__main__": run()
