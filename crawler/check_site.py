"""vieclam24h.vn 구조 확인 스크립트"""
import asyncio
import json
import re
from playwright.async_api import async_playwright
from playwright_stealth import stealth_async

async def check():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-setuid-sandbox"])
        page = await browser.new_page(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            locale="vi-VN",
        )
        await stealth_async(page)

        url = "https://vieclam24h.vn/tim-kiem-viec-lam"
        print(f"로딩: {url}")
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(4000)

        title = await page.title()
        print(f"title: {title}")

        # __NEXT_DATA__ 확인
        next_data = await page.evaluate("""() => {
            const el = document.getElementById('__NEXT_DATA__')
            if (!el) return null
            try { return JSON.parse(el.textContent) } catch { return null }
        }""")

        if next_data:
            props = next_data.get("props", {}).get("pageProps", {})
            print(f"pageProps keys: {list(props.keys())[:15]}")
            for k, v in props.items():
                if isinstance(v, list) and len(v) > 0:
                    print(f"  {k}: list[{len(v)}], sample: {list(v[0].keys())[:8] if isinstance(v[0], dict) else v[0]}")
                elif isinstance(v, dict):
                    print(f"  {k}: dict keys: {list(v.keys())[:8]}")
        else:
            print("__NEXT_DATA__ 없음")

        # DOM 카드 확인 - 여러 셀렉터 시도
        for sel in ["a[href*='/viec-lam-']", "a[href*='viec-lam']", "[class*='JobCard']", "[class*='job-card']"]:
            cards = await page.query_selector_all(sel)
            if cards:
                print(f"셀렉터 '{sel}': {len(cards)}개")
                text = await cards[0].inner_text()
                href = await cards[0].get_attribute("href")
                print(f"  href: {href}")
                print(f"  text: {text[:300]}")
                break
        else:
            print("카드 못 찾음")

        await browser.close()

asyncio.run(check())
