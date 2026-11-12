from pin_guard import problems


def test_lost_pin_detected():
    before = [{"lat": 21.18, "lng": 106.06}, {"lat": 21.11, "lng": 105.96}]
    after = [{"lat": None, "lng": None}, {"lat": 21.11, "lng": 105.96}]
    assert problems(before, after) == ["pin_lost:2->1"]


def test_duplicate_pin_detected():
    # 2026-11-11 KRIK 5992: 같은 매장이 두 줄로 들어가 같은 좌표 핀 2개
    after = [{"lat": 21.1797715, "lng": 106.0667412}, {"lat": 21.1797715, "lng": 106.0667412}, {"lat": 21.1186, "lng": 105.9607}]
    assert problems([{"lat": 21.1797715, "lng": 106.0667412}], after) == ["duplicate_pin:21.179772,106.066741"]


def test_merging_duplicate_rows_is_not_a_loss():
    # Codex #724: 같은 좌표 두 줄을 한 줄로 합친 것은 손실이 아니다
    p = {"lat": 21.18, "lng": 106.06}
    assert problems([p, dict(p)], [p]) == []


def test_new_store_pin_is_fine():
    assert problems([{"lat": 21.17, "lng": 106.06}], [{"lat": 21.17, "lng": 106.06}, {"lat": 21.11, "lng": 105.95}]) == []


def test_unpinned_before_and_after_is_fine():
    assert problems([{"lat": None, "lng": None}], [{"lat": None, "lng": None}]) == []
