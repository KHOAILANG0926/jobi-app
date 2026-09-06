"""2026-09-06 사용자 지시로 신설 — 과거 실수로 인자 없는 일반 실행이 곧바로
전체 운영 크롤을 시작해 200건 넘게 수집된 사고의 재발 방지 안전장치
(--confirm-full-crawl, --sample-limit)를 검증한다.

crawl_topcv.build_arg_parser()/resolve_cli_mode()는 순수 함수다 — argparse
인자만으로 실행 모드를 결정하거나 SystemExit을 던질 뿐, asyncio.run으로
들어가는 실제 네트워크 크롤/DB 쓰기는 전혀 수행하지 않는다. 이 테스트는
그 결정 로직만 검증하며, 실제 크롤러나 DB는 절대 건드리지 않는다."""

from __future__ import annotations

import crawl_topcv


def assert_equal(actual, expected, label: str) -> None:
    if actual != expected:
        raise AssertionError(f"{label}: expected {expected!r}, got {actual!r}")


def assert_true(value, label: str) -> None:
    if not value:
        raise AssertionError(label)


def _mode_for(argv: list[str]) -> str:
    args = crawl_topcv.build_arg_parser().parse_args(argv)
    return crawl_topcv.resolve_cli_mode(args)


def _raises_system_exit(argv: list[str]) -> str:
    """resolve_cli_mode()가 SystemExit을 던지면 그 메시지를 문자열로
    반환하고, 던지지 않으면(=차단돼야 하는데 안 됨) AssertionError."""
    args = crawl_topcv.build_arg_parser().parse_args(argv)
    try:
        mode = crawl_topcv.resolve_cli_mode(args)
    except SystemExit as exc:
        return str(exc)
    raise AssertionError(f"SystemExit이 발생해야 하는데 mode={mode!r}로 정상 진행됨(argv={argv!r})")


def test_no_args_blocks_full_crawl_before_it_starts() -> None:
    """인자 없이 실행 → 전체 크롤 시작 전 차단(2026-09-04류 사고 재발 방지)."""
    msg = _raises_system_exit([])
    assert_true("confirm-full-crawl" in msg, f"에러 메시지에 --confirm-full-crawl 안내가 있어야 함, got: {msg!r}")


def test_confirm_full_crawl_allows_entering_full_crawl_mode() -> None:
    """--confirm-full-crawl → 기존 전체 크롤 진입 가능(차단되지 않음)."""
    mode = _mode_for(["--confirm-full-crawl"])
    assert_equal(mode, "full_crawl", "--confirm-full-crawl만 지정하면 full_crawl 모드로 진입해야 함")


def test_sample_limit_10_is_allowed() -> None:
    """--sample-limit 10 → 허용(경계값)."""
    mode = _mode_for(["--confirm-full-crawl", "--sample-limit", "10"])
    assert_equal(mode, "full_crawl", "--sample-limit 10은 허용돼 full_crawl 모드로 진입해야 함")


def test_sample_limit_11_is_blocked() -> None:
    """--sample-limit 11 → 실행 전에 오류로 차단(--confirm-full-crawl 여부와
    무관하게, 상한 검증 자체가 먼저 걸려야 함)."""
    msg = _raises_system_exit(["--confirm-full-crawl", "--sample-limit", "11"])
    assert_true("sample-limit" in msg, f"에러 메시지에 --sample-limit 안내가 있어야 함, got: {msg!r}")

    # --confirm-full-crawl 없이 --sample-limit 11만 줘도, "sample-limit 초과"
    # 사유로 먼저 막혀야 한다(다른 사유로 뒤늦게 막히면 안 됨 — 검증 순서 확인).
    msg2 = _raises_system_exit(["--sample-limit", "11"])
    assert_true("sample-limit" in msg2, f"--confirm-full-crawl 없이도 sample-limit 사유로 먼저 차단돼야 함, got: {msg2!r}")


def test_existing_dry_run_urls_mode_unaffected() -> None:
    """기존 --dry-run-urls는 --confirm-full-crawl 없이도 그대로 정상 동작
    (이번 안전장치의 영향을 받지 않아야 함)."""
    mode = _mode_for(["--dry-run-urls", "https://vieclam24h.vn/test-a.html"])
    assert_equal(mode, "dry_run_urls", "--dry-run-urls는 --confirm-full-crawl 없이도 정상 진행돼야 함")


def test_existing_process_url_mode_unaffected() -> None:
    """기존 --process-url --confirm-write 조합도 그대로 정상 동작."""
    mode = _mode_for(["--process-url", "https://vieclam24h.vn/test-a.html", "--confirm-write"])
    assert_equal(mode, "process_url", "--process-url --confirm-write는 --confirm-full-crawl 없이도 정상 진행돼야 함")


def test_existing_reprocess_ids_mode_unaffected() -> None:
    """기존 --reprocess-ids --confirm-write 조합도 그대로 정상 동작."""
    mode = _mode_for(["--reprocess-ids", "123,456", "--confirm-write"])
    assert_equal(mode, "reprocess_ids", "--reprocess-ids --confirm-write는 --confirm-full-crawl 없이도 정상 진행돼야 함")


def test_existing_verify_write_urls_mode_unaffected() -> None:
    """기존 --verify-write-urls --confirm-write --verify-write 조합도 그대로 정상 동작."""
    mode = _mode_for([
        "--verify-write-urls", "https://vieclam24h.vn/test-a.html",
        "--confirm-write", "--verify-write",
    ])
    assert_equal(mode, "verify_write_urls", "--verify-write-urls 조합은 --confirm-full-crawl 없이도 정상 진행돼야 함")


def test_process_url_without_confirm_write_still_blocked() -> None:
    """기존 안전장치(--confirm-write 누락 시 차단)도 이번 변경으로 깨지지 않아야 함."""
    msg = _raises_system_exit(["--process-url", "https://vieclam24h.vn/test-a.html"])
    assert_true("confirm-write" in msg, f"--confirm-write 안내가 있어야 함, got: {msg!r}")


def main() -> int:
    tests = [
        test_no_args_blocks_full_crawl_before_it_starts,
        test_confirm_full_crawl_allows_entering_full_crawl_mode,
        test_sample_limit_10_is_allowed,
        test_sample_limit_11_is_blocked,
        test_existing_dry_run_urls_mode_unaffected,
        test_existing_process_url_mode_unaffected,
        test_existing_reprocess_ids_mode_unaffected,
        test_existing_verify_write_urls_mode_unaffected,
        test_process_url_without_confirm_write_still_blocked,
    ]
    for test in tests:
        test()
        print(f"✅ {test.__name__}")
    print(f"\n결과: {len(tests)}/{len(tests)} CLI safety tests passed")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as exc:
        print(f"❌ {exc}")
        raise SystemExit(1)
    except Exception as exc:
        print(f"❌ unexpected error: {exc}")
        raise SystemExit(1)
