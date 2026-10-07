"""박닌 공고 검토용 수집(DB 쓰기 없음) — Vieclam24h. 결과: scripts/research/out/bn_v24h.json
실행: PYTHONIOENCODING=utf-8 python scripts/research/bn_collect_v24h.py [목표건수]"""
import asyncio, sys, json, re, os, random
sys.path.insert(0, 'crawler')
import crawl_topcv as c

TARGET = int(sys.argv[1]) if len(sys.argv) > 1 else 100
OUT = 'scripts/research/out/bn_v24h.json'
PHONE = re.compile(r'(?:\+?84|0)[\s.\-]?\d(?:[\s.\-]?\d){8}')
PLACEHOLDER = re.compile(r'nhà tuyển dụng|facebook|ẩn danh|không rõ', re.I)

def phones(text):
    return sorted({re.sub(r'[\s.\-]', '', m) for m in PHONE.findall(text or '')})

async def main():
    os.makedirs('scripts/research/out', exist_ok=True)
    rows, seen = [], set()
    async with c.browser_page() as page:
        for pn in range(1, 12):
            u = 'https://vieclam24h.vn/tim-kiem-viec-lam-nhanh?province_ids[]=90' + ('' if pn == 1 else f'&page={pn}')
            raw = await c.crawl_category(page, u)
            if not raw: break
            await asyncio.sleep(random.uniform(4, 7))
            for j in raw:
                href = j['href'].split('?')[0]
                if href in seen: continue
                seen.add(href)
                d = await c.fetch_job_detail(page, j['href'])
                await asyncio.sleep(random.uniform(3, 6))
                sec = d.get('sections', {})
                loc = sec.get('Địa điểm làm việc', '')
                alltext = '\n'.join(sec.values())
                rows.append({
                    'source': 'vieclam24h', 'url_internal_only': href,
                    'company': d.get('detailCompany') or j['company'], 'title': d.get('detailTitle') or j['title'],
                    'salary': d.get('detailSalary') or j['salary'], 'address': loc,
                    'phones': phones(alltext), 'deadline': d.get('deadline'),
                    'fetchOk': d.get('fetchOk'), 'expired': d.get('expiredBanner'),
                })
                ok = sum(1 for r in rows if 'Bắc Ninh' in r['address'])
                print(f'[{len(rows)}] ok_bn={ok} {rows[-1]["company"][:30]} | {loc[:60]}', flush=True)
                json.dump(rows, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
                if ok >= TARGET + 20: return
            print(f'-- page {pn} done', flush=True)
asyncio.run(main())
