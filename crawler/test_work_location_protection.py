"""재수집이 사람이 확인·입력한 근무지(geocode_status='manual')를 지우거나 덮어쓰지 않는지(2026-09-29)."""

from crawl_topcv import is_protected_work_location, merge_protected_work_locations


def check(cond, label):
    if not cond:
        raise AssertionError(label)
    print(f"✅ {label}")


def main() -> int:
    manual_park = {"raw_address": "Khu công nghiệp VSIP Bắc Ninh", "normalized_address": "khu công nghiệp vsip bắc ninh",
                   "lat": 21.0799, "lng": 105.9807, "geocode_status": "manual", "coordinate_accuracy": "region",
                   "location_verified": False}
    manual_verified = {"raw_address": "Lô A1", "normalized_address": "lô a1", "lat": 10.7, "lng": 106.7,
                       "geocode_status": "manual", "coordinate_accuracy": "exact", "location_verified": True}
    manual_empty = {"raw_address": "X", "geocode_status": "manual", "lat": None, "location_verified": False}
    auto = {"raw_address": "Y", "geocode_status": "success", "lat": 1.0, "location_verified": False}

    check(is_protected_work_location(manual_park), "manual row with coordinates is protected")
    check(is_protected_work_location(manual_verified), "manual verified row is protected")
    check(not is_protected_work_location(manual_empty), "manual row without coordinates/verification is not protected")
    check(not is_protected_work_location(auto), "automatic geocode row is not protected")

    recrawled = [
        {"raw_address": "KHU CÔNG NGHIỆP VSIP BẮC NINH", "normalized_address": "khu công nghiệp vsip  bắc ninh",
         "lat": 21.2, "lng": 106.0, "geocode_status": "success", "coordinate_accuracy": "ward", "location_verified": False,
         "sort_order": 0},
        {"raw_address": "Đường 5, Từ Sơn", "normalized_address": "đường 5, từ sơn", "lat": None, "lng": None,
         "geocode_status": "failed", "coordinate_accuracy": "unresolved", "location_verified": False, "sort_order": 1},
    ]
    merged = merge_protected_work_locations([manual_park, manual_verified], recrawled)
    check(len(merged) == 3, "same address as a manual row -> automatic result dropped, others kept")
    check(merged[0]["lat"] == 21.0799 and merged[0]["geocode_status"] == "manual", "manual park coordinate survives recrawl unchanged")
    check(merged[1]["location_verified"] is True, "manual verification survives recrawl")
    check([r["sort_order"] for r in merged] == [0, 1, 2], "sort_order renumbered")
    check(merge_protected_work_locations([], recrawled) == recrawled, "no protected rows -> recrawl result unchanged")
    print("\n결과: work location protection tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
