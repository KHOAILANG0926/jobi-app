"""옛 성/시(2025-07-01 이전 63개) → 지금 성/시(34개) 대응표 생성.

출처: vietnam-provinces 패키지(통계총국 공식 자료, crawler/requirements.txt와 같은 패키지)의
_province_conversion_2025.OLD_TO_NEW. vnProvinces.ts·vnWards.ts·vnDistricts.ts와 같은 출처.
사용(v2026.3.0, crawler/requirements.txt와 같은 판): PYTHONPATH=<vietnam-provinces 소스> python3 scripts/data/gen-vn-old-provinces.py > src/data/vnOldProvinces.ts
"""
import json
from vietnam_provinces import Province
from vietnam_provinces.legacy import Province as OldProvince
from vietnam_provinces._province_conversion_2025 import OLD_TO_NEW

out = {}
for old in OldProvince.iter_all():
    entry = OLD_TO_NEW.get(int(old.code))
    if not entry:
        continue
    news = [Province.from_code(n.code).name for n in entry.new_provinces]
    out[old.name] = news
print('/** 옛 성/시(2025-07-01 이전) → 지금 성/시. scripts/data/gen-vn-old-provinces.py로 생성(공식 vietnam-provinces 자료), 손으로 고치지 않는다. */')
print('export const VN_OLD_PROVINCE_TO_NEW: Record<string, string[]> = ' + json.dumps(out, ensure_ascii=False, indent=1))
