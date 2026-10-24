#!/usr/bin/env python3
"""One-shot, private Muaban pilot. No bulk crawling or public-job writes."""
import fcntl
import json
import os
from pathlib import Path
import re
import sys
import urllib.request
from playwright.sync_api import sync_playwright

JOBS = [
    (126, "71286061", "https://muaban.net/viec-lam/ban-hang-tp-bac-ninh/tefal-tuyen-pg-ban-hang-gia-dung-id71286061"),
    (127, "71304112", "https://muaban.net/viec-lam/cong-nhan-huyen-que-vo-bac-ninh/viec-lam-chinh-thuc-di-lam-ngay-id71304112"),
]
BASE = Path.home() / ".jobi-muaban"
PHONE = re.compile(r"(?<!\d)0[35789](?:[ .-]?\d){8}(?!\d)")
REVEAL = re.compile(r"Bấm để hiện số|^Hiện số$", re.I)

def clean_phone(value):
    digits = re.sub(r"\D", "", value)
    return digits if re.fullmatch(r"0[35789]\d{8}", digits) else None

def phones_on_page(page):
    candidates = []
    for loc in page.locator('a[href^="tel:"]').all():
        if loc.is_visible():
            candidates.append(loc.get_attribute("href") or "")
    # Ignore fields (including signed-in account's phone) and scripts.
    text = page.locator("body").inner_text()
    candidates.extend(PHONE.findall(text))
    return sorted({p for value in candidates if (p := clean_phone(value))})

def extract(context, job_id, source_id, url):
    page = context.new_page()
    try:
        response = page.goto(url, wait_until="domcontentloaded", timeout=45000)
        if not response:
            raise RuntimeError("SOURCE_NO_HTTP_RESPONSE")
        if response.status != 200:
            raise RuntimeError("SOURCE_HTTP_" + str(response.status))
        if source_id not in page.url:
            raise RuntimeError("SOURCE_REDIRECT_OR_ID_MISMATCH")
        title = (page.locator("h1").first.inner_text(timeout=10000) or "").strip()
        if not title or len(title) < 10:
            raise RuntimeError("NO_JOB_TITLE")
        body = page.locator("body").inner_text(timeout=15000)
        if re.search(r"tin đã hết hạn|tin không còn tồn tại|tin đã bị xóa", body, re.I):
            raise RuntimeError("AD_EXPIRED")
        for button in page.get_by_text(REVEAL).all():
            if button.is_visible():
                button.click(timeout=10000)
                break
        page.wait_for_timeout(1000)
        if page.locator('input[name="phone"]').count() and page.locator('input[name="phone"]').is_visible():
            raise RuntimeError("LOGIN_SESSION_EXPIRED")
        numbers = phones_on_page(page)
        if len(numbers) != 1:
            raise RuntimeError("PHONE_NOT_UNAMBIGUOUS")
        # Only verified source phone and title written. Existing duties/address remain pending until independently checked.
        # Capture actual page text privately for strict publication-rule checks.
        root = page.locator("main")
        source_text = (root.first.inner_text(timeout=10000) if root.count() else body).strip()
        if title not in source_text:
            source_text = body.strip()
        if len(source_text) < 100:
            raise RuntimeError("SOURCE_TEXT_TOO_SHORT")
        return {"phone": numbers[0], "title": title, "source_id": source_id, "source_text": source_text[:16000]}
    finally:
        page.close()

def patch_artifact(artifact_id, details):
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        raise RuntimeError("PRIVATE_DB_CREDENTIAL_NOT_CONFIGURED")
    url = "https://edhuesdnuxlbcfephutq.supabase.co/rest/v1/research_artifacts?id=eq." + str(artifact_id) + "&kind=eq.job_collection_review"
    payload = {
        "contact": {"phone": details["phone"], "method": "phone"},
        "verification": {"phone_complete": True, "phone_evidence": "server_runner_auth_reveal_2026-10-24", "publication": "not_inserted"}
    }
    # Preserve all other existing JSON values using GET then optimistic checked PATCH.
    headers = {"apikey": key, "Authorization": "Bearer " + key, "Accept": "application/json"}
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=20) as response:
        records = json.load(response)
    if len(records) != 1 or str(records[0]["payload"].get("source_id")) != details["source_id"]:
        raise RuntimeError("ARTIFACT_ID_SOURCE_MISMATCH")
    existing = records[0]["payload"]
    existing["contact"] = {**(existing.get("contact") or {}), **payload["contact"]}
    # No local disk and no job text in Action logs; private review only.
    existing["source_text"] = details["source_text"]
    existing["verification"] = {**(existing.get("verification") or {}), **payload["verification"]}
    existing["verification"]["source_text_captured"] = True
    existing["verification"]["unresolved"] = [x for x in existing["verification"].get("unresolved", []) if x not in ("전체 전화번호", "전화번호 인증 추출")]
    newmeta = {**(records[0].get("meta") or {}), "not_public_job": True, "server_phone_extraction": True}
    data = json.dumps({"payload": existing, "meta": newmeta}).encode()
    headers.update({"Content-Type": "application/json", "Prefer": "return=representation"})
    request = urllib.request.Request(url, data=data, headers=headers, method="PATCH")
    with urllib.request.urlopen(request, timeout=20) as response:
        updated = json.load(response)
    if len(updated) != 1 or updated[0]["payload"]["contact"]["phone"] != details["phone"]:
        raise RuntimeError("PRIVATE_SAVE_VERIFICATION_FAILED")

def main():
    if os.getuid() == 0 or not (BASE / "profile").is_dir():
        raise RuntimeError("SERVER_PROFILE_NOT_AVAILABLE")
    if not os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        raise RuntimeError("PRIVATE_DB_CREDENTIAL_NOT_CONFIGURED")
    results = []
    with (BASE / "login.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        with sync_playwright() as playwright:
            context = playwright.chromium.launch_persistent_context(str(BASE / "profile"), headless=True, chromium_sandbox=True, locale="vi-VN")
            try:
                for artifact_id, source_id, url in JOBS:
                    try:
                        details = extract(context, artifact_id, source_id, url)
                        patch_artifact(artifact_id, details)
                        print(f"ARTIFACT_{artifact_id}=PRIVATE_PHONE_VERIFIED")
                        results.append(True)
                    except Exception as exc:
                        print(f"ARTIFACT_{artifact_id}=INCOMPLETE:{type(exc).__name__ if not isinstance(exc, RuntimeError) else str(exc)}")
                        results.append(False)
            finally:
                context.close()
    if not all(results):
        sys.exit(1)

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("PILOT_INCOMPLETE:" + (str(exc) if type(exc) is RuntimeError else type(exc).__name__))
        sys.exit(1)
