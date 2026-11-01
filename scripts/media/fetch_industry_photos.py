"""업종 대표 사진 후보 받기 — Lee 2026-11-01 결정(사람인 방식: 사진 없는 공고는 업종에 맞는 사진으로 대신).

Wikimedia Commons(열쇠 필요 없음, Openverse는 GitHub에서 응답 없음 2026-11-01)에서 상업적 사용 가능 사진만 업종마다 후보 6장을 받아
data/industry-photos/candidates/<업종>-<n>.jpg 로 저장하고, 출처·저작자·라이선스를
data/industry-photos/candidates/CANDIDATES.json 에 기록한다. 최종 선택은 사람이 보고 고른다.
"""
import io
import re
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

QUERIES = {
    'am_thuc_do_uong': ['barista coffee shop', 'restaurant kitchen cooking'],
    'quan_ly_ban_hang': ['supermarket shelves products', 'store shelves retail display'],
    'dich_vu': ['vacuum cleaner floor', 'hotel room bed made', 'cleaning supplies bucket mop'],
    'van_phong': ['office desk computer', 'office workspace'],
    'cskh_kinh_doanh': ['headset', 'telephone on desk', 'call centre'],
    'san_xuat_xay_dung': ['factory assembly line', 'electronics factory workers'],
    'cntt_ky_thuat': ['electrical panel wiring', 'tools on workbench', 'circuit board repair'],
    'thiet_ke': ['graphics tablet stylus', 'color swatches design', 'architect drawing table'],
    'truyen_thong': ['video camera studio', 'photographer camera'],
    'lai_xe_giao_hang': ['delivery motorbike', 'delivery truck parcels'],
    'y_te_dieu_duong': ['stethoscope', 'hospital ward beds', 'medicine pills pharmacy shelf'],
    'giao_duc_giang_day': ['empty classroom desks', 'chalkboard classroom', 'school books desk'],
    'khac': ['warehouse shelves pallets', 'warehouse boxes forklift'],
}
PER_CATEGORY = 6
import os
ROUND = os.environ.get('ROUND', '1')
OUT = Path('data/industry-photos/candidates' + ('' if ROUND == '1' else f'-r{ROUND}'))
UA = {'User-Agent': 'ViecganbanIndustryPhotos/1.0 (https://viecganban.vn; github actions)'}
W, H = 800, 500


def get(url, timeout=15):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return r.read()


ALLOWED = ('cc0', 'public domain', 'pd', 'cc by 4.0', 'cc by 3.0', 'cc by 2.5', 'cc by 2.0')


def search(q):
    """Wikimedia Commons 검색(열쇠 불필요). 상업 사용 가능 + 변경 허용 라이선스(CC0·PD·CC BY)만, 가로 사진만."""
    params = urllib.parse.urlencode({
        'action': 'query', 'format': 'json', 'generator': 'search', 'gsrsearch': f'{q} filetype:bitmap',
        'gsrnamespace': 6, 'gsrlimit': 25, 'prop': 'imageinfo',
        'iiprop': 'url|size|extmetadata', 'iiurlwidth': 1200,
    })
    pages = json.loads(get(f'https://commons.wikimedia.org/w/api.php?{params}')).get('query', {}).get('pages', {})
    out = []
    for p in sorted(pages.values(), key=lambda x: x.get('index', 0)):
        ii = (p.get('imageinfo') or [{}])[0]
        meta = ii.get('extmetadata', {})
        lic = (meta.get('LicenseShortName', {}).get('value') or '').strip()
        if lic.lower() not in ALLOWED and not lic.lower().startswith('public domain'):
            continue
        if not ii.get('width') or ii['width'] < ii.get('height', 0) * 1.2:
            continue
        artist = re.sub(r'<[^>]+>', '', meta.get('Artist', {}).get('value') or '').strip()
        out.append({
            'id': p['title'], 'url': ii.get('thumburl') or ii['url'], 'title': p['title'],
            'creator': artist, 'license': lic, 'license_version': None,
            'license_url': meta.get('LicenseUrl', {}).get('value'), 'source': 'wikimedia_commons',
            'foreign_landing_url': ii.get('descriptionurl'),
            'attribution': f"{p['title']} — {artist or 'unknown'} — {lic} (Wikimedia Commons)",
        })
    return out


def crop(data):
    img = Image.open(io.BytesIO(data)).convert('RGB')
    if img.width < 640 or img.height < 360:
        raise ValueError('too small')
    s = max(W / img.width, H / img.height)
    img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    l, t = (img.width - W) // 2, (img.height - H) // 2
    buf = io.BytesIO()
    img.crop((l, t, l + W, t + H)).save(buf, 'JPEG', quality=78, optimize=True, progressive=True)
    return buf.getvalue()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest, short = {}, []
    only = [c for c in os.environ.get('ONLY', '').split(',') if c]
    for cat, queries in QUERIES.items():
        if only and cat not in only:
            continue
        got, seen = [], set()
        for q in queries:
            try:
                results = search(q)
            except Exception as e:  # noqa: BLE001
                print(f'::warning::search failed {cat} "{q}": {e}', flush=True)
                continue
            time.sleep(1)
            print(f'{cat} "{q}": {len(results)} results', flush=True)
            for r in results:
                if len(got) >= PER_CATEGORY or r['id'] in seen:
                    continue
                seen.add(r['id'])
                try:
                    jpg = crop(get(r['url']))
                except Exception as e:  # noqa: BLE001
                    print(f'skip {cat} {r["id"]}: {e}', flush=True)
                    continue
                n = len(got) + 1
                (OUT / f'{cat}-{n}.jpg').write_bytes(jpg)
                got.append({
                    'file': f'{cat}-{n}.jpg', 'query': q, 'openverse_id': r['id'],
                    'title': r.get('title'), 'creator': r.get('creator'),
                    'license': r.get('license'), 'license_version': r.get('license_version'),
                    'license_url': r.get('license_url'), 'source': r.get('source'),
                    'landing_url': r.get('foreign_landing_url'), 'attribution': r.get('attribution'),
                })
            if len(got) >= PER_CATEGORY:
                break
        manifest[cat] = got
        (OUT / 'CANDIDATES.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'{cat}: {len(got)} candidates', flush=True)
        if len(got) < 2:
            short.append(cat)
    (OUT / 'CANDIDATES.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if short:
        print(f'::warning::후보 부족 업종: {short}', flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
