"""행정구역 공통 시험(Lee 2026-11-03 "수집기도 같은 시험"): 앱과 같은 문항(test-fixtures/vn-admin-cases.json)으로
수집기 판정(vn_provinces_lookup)을 검사하고, 설치된 vietnam-provinces 판이 앱 자료 판(scripts/data/vn-admin-version.json)과
같은지 확인한다. 실행: python3 crawler/test_vn_admin_cases.py"""
import json
import sys
from importlib.metadata import version
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from vn_provinces_lookup import resolve_current_province, resolve_current_wards  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
meta = json.loads((ROOT / 'scripts' / 'data' / 'vn-admin-version.json').read_text(encoding='utf-8'))
cases = json.loads((ROOT / 'test-fixtures' / 'vn-admin-cases.json').read_text(encoding='utf-8'))['cases']

errors = []
installed = version('vietnam-provinces')
if installed != meta['version']:
    errors.append(f"설치된 vietnam-provinces {installed} != 앱 자료 판 {meta['version']}")

prov_bad = 0
for c in cases:
    old_province = c['old'][2]
    got_p = resolve_current_province(old_province)
    # 옛 성 하나가 두 성으로 나뉜 경우(Tiền Giang → Tây Ninh·Đồng Tháp)는 그중 하나면 맞음.
    if got_p not in c['provOptions']:
        prov_bad += 1
        if prov_bad <= 3:
            errors.append(f"성: {old_province} → {got_p} (기대 {c['provOptions']})")
# 동 판정(resolve_current_wards → DB resolved_wards)은 2026-11-03부터 어떤 화면·알림도 쓰지 않는다
# (화면은 주소 글자로 src/lib/jobAreaWards.ts가 판정). 그래서 여기서는 성과 자료 판만 검사한다.
print(f"vn admin cases: {len(cases)}건, 성 불일치 {prov_bad}")
if errors:
    print('\n'.join(errors))
    sys.exit(1)
print('test_vn_admin_cases: all passed')
