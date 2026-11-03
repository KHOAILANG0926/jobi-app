"""베트남 행정구역 자료 생성기 — 앱(src/data/vn*.ts)이 쓰는 자료를 공식 자료 한 판에서 만든다.

출처: vietnam-provinces 패키지(통계총국 공식 자료). crawler/requirements.txt에 고정한 판과 같은
판으로 돌린다. 앱 자료와 수집기 판이 어긋나지 않게 scripts/data/vn-admin-version.json에 판과
해시를 남기고, 시험(src/lib/vnAdminVersion.test.ts)이 비교한다.

사용:
  git clone https://github.com/sunshine-tech/VietnamProvinces <dir> && git -C <dir> checkout v<판>
  PYTHONPATH=<dir> python3 -I scripts/data/gen-vn-admin.py <판>
손으로 고치지 않는다(Lee 2026-11-03 "명확한 기준").
"""
import hashlib
import json
import re
import sys
from pathlib import Path

from vietnam_provinces import Province, Ward
from vietnam_provinces.legacy import District as OldDistrict, Province as OldProvince, Ward as OldWard
from vietnam_provinces._province_conversion_2025 import OLD_TO_NEW as PROV_OLD_TO_NEW
from vietnam_provinces._ward_conversion_2025 import OLD_TO_NEW as WARD_OLD_TO_NEW

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'src' / 'data'
version = sys.argv[1] if len(sys.argv) > 1 else 'unknown'

WARD_PREFIX = re.compile(r'^(Phường|Xã|Đặc khu) ')
DISTRICT_PREFIX = re.compile(r'^(Quận|Huyện|Thị xã|Thành phố) ')

provinces = sorted(p.name for p in Province.iter_all())
prov_name = {int(p.code): p.name for p in Province.iter_all()}
ward_by_code = {int(w.code): w for w in Ward.iter_all()}

wards_by_province: dict[str, list[str]] = {p: [] for p in provinces}
for w in ward_by_code.values():
    wards_by_province[prov_name[int(w.province_code)]].append(w.name)
for p in wards_by_province:
    wards_by_province[p].sort(key=lambda n: WARD_PREFIX.sub('', n))

# 옛 군/구 → 그 군/구의 옛 동들이 합쳐진 새 동들(새 성 기준). 옛 군/구 대응이 없는 새 동(외딴 섬 특구)은
# 자기 자신 하나짜리 칸.
old_district = {int(d.code): d for d in OldDistrict.iter_all()}
wards_by_district: dict[str, dict[str, set[str]]] = {p: {} for p in provinces}
old_ward_index: dict[str, list] = {}
covered: set[int] = set()
for ow in OldWard.iter_all():
    e = WARD_OLD_TO_NEW.get(int(ow.code))
    if not e:
        continue
    d = old_district[int(ow.district_code)]
    news = [ward_by_code[int(n.code)] for n in e.new_wards if int(n.code) in ward_by_code]
    for nw in news:
        covered.add(int(nw.code))
        p = prov_name[int(nw.province_code)]
        wards_by_district[p].setdefault(d.name, set()).add(nw.name)
    if news:
        old_p = OldProvince.from_code(d.province_code).name
        # [옛 동, 옛 군/구, 옛 성, 새 성, [새 동...]]
        old_ward_index.setdefault(prov_name[int(news[0].province_code)], []).append(
            [ow.name, d.name, old_p, [nw.name for nw in news]])
for code, w in ward_by_code.items():
    if code not in covered:
        wards_by_district[prov_name[int(w.province_code)]].setdefault(w.name, set()).add(w.name)

districts_by_province = {p: sorted(ds, key=lambda n: DISTRICT_PREFIX.sub('', WARD_PREFIX.sub('', n))) for p, ds in wards_by_district.items()}
wards_by_district_sorted = {
    p: {d: sorted(ws, key=lambda n: WARD_PREFIX.sub('', n)) for d, ws in sorted(ds.items(), key=lambda kv: DISTRICT_PREFIX.sub('', WARD_PREFIX.sub('', kv[0])))}
    for p, ds in wards_by_district.items()
}

old_province_to_new = {}
for op in OldProvince.iter_all():
    e = PROV_OLD_TO_NEW.get(int(op.code))
    if e:
        old_province_to_new[op.name] = [prov_name[int(n.code)] for n in e.new_provinces]

HEAD = f'// 자동 생성: scripts/data/gen-vn-admin.py (vietnam-provinces v{version}). 손으로 고치지 않는다.\n'


def write(name: str, body: str) -> str:
    text = HEAD + body
    (DATA / name).write_text(text, encoding='utf-8')
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def js(v) -> str:
    return json.dumps(v, ensure_ascii=False, indent=1)


hashes = {
    'vnProvinces.ts': write('vnProvinces.ts', f'/** 지금 유효한 성/시 34개(공고 유무와 무관하게 전부 선택 가능 — 2026-09-16 사용자 지시). */\nexport const VN_PROVINCES: string[] = {js(provinces)}\n'),
    'vnWards.ts': write('vnWards.ts', f'/** 성/시별 지금 동/사 전체(접두어 Phường/Xã/Đặc khu를 뗀 이름 순 — 2026-09-17 사용자 지적). */\nexport const VN_WARDS_BY_PROVINCE: Record<string, string[]> = {js(wards_by_province)}\n'),
    'vnDistricts.ts': write('vnDistricts.ts', '/** 옛(2025-07-01 이전) 군/구 = 지금은 행정단위가 아닌 생활권 묶음. 지금 동이 여러 옛 군/구에 걸치면\n * 모두에 나온다. 옛 군/구 대응이 없는 외딴 섬 특구는 자기 자신 하나짜리 칸. */\n'
                           f'export const VN_DISTRICTS_BY_PROVINCE: Record<string, string[]> = {js(districts_by_province)}\n\n'
                           f'export const VN_WARDS_BY_DISTRICT: Record<string, Record<string, string[]>> = {js(wards_by_district_sorted)}\n'),
    'vnOldProvinces.ts': write('vnOldProvinces.ts', f'/** 옛 성/시(2025-07-01 이전) → 지금 성/시. */\nexport const VN_OLD_PROVINCE_TO_NEW: Record<string, string[]> = {js(old_province_to_new)}\n'),
    'vnOldWards.ts': write('vnOldWards.ts', '/** 옛 동/사 → 지금 동/사(공식 대응표). 지금 성별로 [옛 동, 옛 군/구, 옛 성, [지금 동...]].\n'
                           ' * 지금 동이 여럿이면 옛 동이 쪼개진 것 — 하나로 단정하지 않는다. 크므로 동 판정이 필요한 화면만 불러온다. */\n'
                           f'export const VN_OLD_WARDS_BY_PROVINCE: Record<string, [string, string, string, string[]][]> = {json.dumps(old_ward_index, ensure_ascii=False)}\n'),
}
(ROOT / 'scripts' / 'data' / 'vn-admin-version.json').write_text(
    json.dumps({'package': 'vietnam-provinces', 'version': version, 'sha256': hashes}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(version, {k: v[:12] for k, v in hashes.items()})
