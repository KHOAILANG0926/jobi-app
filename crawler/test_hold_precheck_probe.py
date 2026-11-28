"""보류함 위치 확인 프로브 시험 — 네트워크·DB 없이. 쓰기 없음·정확히 1개일 때만·번호/원문 비출력."""
from __future__ import annotations

import io
import sys
from contextlib import redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import hold_precheck_probe as p  # noqa: E402


class Q:
    def __init__(self, rows, writes):
        self.rows, self.writes = rows, writes

    def select(self, *_a):
        return self

    def eq(self, *_a):
        return self

    def in_(self, *_a):
        return self

    def execute(self):
        return type("R", (), {"data": self.rows})()

    def update(self, *_a, **_k):
        self.writes.append("update")
        return self

    def upsert(self, *_a, **_k):
        self.writes.append("upsert")
        return self


class Client:
    def __init__(self, rows):
        self.rows, self.writes = rows, []

    def table(self, _n):
        return Q(self.rows, self.writes)


ROW = {"name": "n1", "payload": {"company": "CTY A", "employer_phone": "0912345678", "source_text": "bí mật 0912345678"},
       "meta": {"status": "unfound", "reason": "not_found", "attempts": 1}}


def run_probe(rows, company, verdict):
    seen = {}
    buf = io.StringIO()
    client = Client(rows)
    with redirect_stdout(buf):
        code = p.probe(client, company, precheck=lambda payload: seen.setdefault("payload", payload) and verdict)
    return code, buf.getvalue(), client.writes, seen


def test_found_prints_no_secret_and_writes_nothing():
    code, out, writes, seen = run_probe([ROW], " cty a ", {"findable": True, "kind": "exact", "reason": "exact_address"})
    assert code == 0 and "확정 좌표 확보 가능" in out and "exact_address" in out
    assert "0912345678" not in out and "bí mật" not in out
    assert "공고·보류 줄은 바꾸지 않음" in out and "위치 결과 보관과 API 사용량 기록" in out  # 부수 효과를 숨기지 않음
    assert writes == [] and seen["payload"]["_recheck"] is True
    assert "_recheck" not in ROW["payload"]  # 보류 줄 원본은 바뀌지 않음


def test_not_found_is_a_normal_result():
    code, out, writes, _ = run_probe([ROW], "CTY A", {"findable": False, "kind": "none", "reason": "not_found"})
    assert code == 0 and "찾지 못함" in out and writes == []


def test_requires_exactly_one_match():
    two = [ROW, {**ROW, "name": "n2"}]
    assert run_probe(two, "CTY A", {"findable": True})[0] == 2
    assert run_probe([ROW], "다른 회사", {"findable": True})[0] == 2


def test_hook_unavailable_is_distinct():
    code, out, writes, _ = run_probe([ROW], "CTY A", {"findable": False, "reason": "precheck_unavailable"})
    assert code == 3 and writes == []


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
    print("OK")
