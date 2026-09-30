"""Chợ Tốt 수집 전용 계정 로그인 창(사람이 직접 로그인).
- 전용 프로필 chotot-collector-profile/ 만 사용(개인 계정·Claude 브라우저 창 세션과 무관).
- 이 스크립트는 로그인 화면을 띄우고, 창을 닫을 때까지(최대 20분) 기다렸다가 프로필을 저장한 채 종료한다.
- 쿠키·토큰·비밀번호를 출력/저장하지 않는다. 로그인 여부만 True/False로 출력한다."""
import asyncio, pathlib
from playwright.async_api import async_playwright

PROFILE = pathlib.Path(__file__).parent / "chotot-collector-profile"
START = "https://www.vieclamtot.com/viec-lam-huyen-que-vo-bac-ninh/134981334.htm"

async def main():
    PROFILE.mkdir(exist_ok=True)
    async with async_playwright() as p:
        ctx = await p.chromium.launch_persistent_context(str(PROFILE), headless=False, locale="vi-VN", viewport={"width": 1280, "height": 900})
        page = ctx.pages[0] if ctx.pages else await ctx.new_page()
        await page.goto(START, wait_until="domcontentloaded")
        print("로그인 창을 열었습니다. 'Hiện số' → 'Đăng nhập' 팝업에서 수집 전용 계정으로 로그인한 뒤 창을 닫아 주세요.", flush=True)
        closed = asyncio.Event()
        ctx.on("close", lambda *_: closed.set())
        try:
            await asyncio.wait_for(closed.wait(), timeout=1200)
        except asyncio.TimeoutError:
            print("20분 경과 — 창을 닫고 프로필을 저장합니다.", flush=True)
            await ctx.close()
    print(f"프로필 저장 위치: {PROFILE}", flush=True)

asyncio.run(main())
