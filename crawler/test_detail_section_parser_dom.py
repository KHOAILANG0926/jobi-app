"""2026-09-05 사용자 지시로 신설 — GPT 2차 독립검증: job_quality.py의 Python
거울 테스트는 실제 크롤이 쓰는 JS DOM 파서를 전혀 실행하지 않으므로,
findDetailContainer()의 document.body fallback이나 헤딩 부분포함 매칭 같은
JS 전용 실패 경로를 검증하지 못했다. 이 파일은 crawl_topcv.py의
fetch_job_detail()이 실제로 page.evaluate()에 넘기는 JS 문자열을 (수동
재작성 없이) AST로 그대로 읽어와, Playwright Chromium 위에 합성 HTML을
올려 실행한다 — 이 파일의 실행 결과가 실제 크롤 동작과 어긋날 수 없다."""

from __future__ import annotations

import ast
import pathlib

from playwright.sync_api import sync_playwright

CRAWL_TOPCV_PATH = pathlib.Path(__file__).parent / "crawl_topcv.py"

# fetch_job_detail()의 page.evaluate() JS 중, 상세 본문 섹션(Mô tả công việc/
# Yêu cầu công việc/Quyền lợi) 추출 로직만 잘라내는 경계 마커. crawl_topcv.py
# 안에서 실제로 등장하는 고유 문자열이어야 하며, 구조가 바뀌면 아래
# _load_section_parser_snippet()가 AssertionError로 즉시 실패한다(조용히
# 낡은 코드를 테스트하는 것을 막기 위함).
_START_MARKER = "const LOCATION_TARGET"
_END_MARKER = "// 실제 지원 버튼"


def _load_full_detail_js() -> str:
    source = CRAWL_TOPCV_PATH.read_text(encoding="utf-8")
    tree = ast.parse(source)
    for node in ast.walk(tree):
        if not (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "evaluate"):
            continue
        if not node.args or not isinstance(node.args[0], ast.Constant) or not isinstance(node.args[0].value, str):
            continue
        candidate = node.args[0].value
        if "findDetailContainer" in candidate:
            return candidate
    raise AssertionError(
        "crawl_topcv.py에서 fetch_job_detail()의 page.evaluate() JS(findDetailContainer 포함)를 "
        "찾지 못함 — 실제 코드 구조가 바뀌어 이 회귀 테스트가 낡은 사본을 검사하게 되는 것을 막기 위해 중단."
    )


def _load_section_parser_snippet() -> str:
    full_js = _load_full_detail_js()
    start = full_js.index(_START_MARKER)
    end = full_js.index(_END_MARKER, start)
    return full_js[start:end]


_BROWSER_CTX = {}


def _get_browser():
    if "pw" not in _BROWSER_CTX:
        _BROWSER_CTX["pw"] = sync_playwright().start()
        _BROWSER_CTX["browser"] = _BROWSER_CTX["pw"].chromium.launch()
    return _BROWSER_CTX["browser"]


def _close_browser() -> None:
    if "browser" in _BROWSER_CTX:
        _BROWSER_CTX["browser"].close()
        _BROWSER_CTX["pw"].stop()
        _BROWSER_CTX.clear()


def _run_real_section_parser(html: str) -> dict:
    """synthetic HTML을 실제 crawl_topcv.py의 JS 섹션 파서로 실행 — 반환값은
    {"sections": {...}, "containerFound": bool}."""
    snippet = _load_section_parser_snippet()
    harness = "() => {\n" + snippet + "\n  return { sections: sections, containerFound: detailContainer !== null }\n}"
    browser = _get_browser()
    page = browser.new_page()
    try:
        page.set_content(html)
        return page.evaluate(harness)
    finally:
        page.close()


def assert_true(value, label: str) -> None:
    if not value:
        raise AssertionError(label)


def assert_false(value, label: str) -> None:
    if value:
        raise AssertionError(label)


def assert_equal(actual, expected, label: str) -> None:
    if actual != expected:
        raise AssertionError(f"{label}: expected {expected!r}, got {actual!r}")


# 모든 fixture 공통: 상세 컨테이너는 h1의 부모이고, "Thông tin chung" h2를
# 포함해야 findDetailContainer()가 이 컨테이너를 찾는다(실제 사이트 구조를
# 흉내낸 최소 골격).
def _wrap_container(inner_html: str, *, include_thong_tin_chung: bool = True) -> str:
    trailer = "<h2>Thông tin chung</h2><table><tr><td>Ngày đăng</td></tr></table>" if include_thong_tin_chung else ""
    return f"""
    <html><body>
      <div id="outside-company-intro">
        <p>Công Ty ABC chuyên sản xuất đồ gia dụng, thành lập năm 2005.</p>
        <div>Việc làm tương tự cho bạn</div>
        <a>Từ khóa: việc làm, tuyển dụng, lương cao</a>
      </div>
      <div id="detail-container">
        <h1>Tiêu Đề Công Việc Test</h1>
        {inner_html}
        {trailer}
      </div>
    </body></html>
    """


def test_p_ul_p_mixed_preserves_all_sentences_in_dom_order() -> None:
    """요구 fixture 1: 정상 상세 컨테이너 안에 P + UL + P가 혼합된 경우
    모든 문장이 DOM 순서대로 보존됨(표본 1/4 실제 구조 재현)."""
    html = _wrap_container(
        """
        <h2>Mô tả công việc</h2>
        <div id="wrapper">
          <p>Sản phẩm: Sơn phủ chuyên dụng.</p>
          <ul><li>Kiểm tra nguyên liệu đầu vào.</li><li>Kiểm tra thành phẩm.</li></ul>
          <p>Làm việc tại KCN Quế Võ 1.</p>
        </div>
        <h2>Yêu cầu công việc</h2>
        <div><p>Tốt nghiệp Trung cấp.</p></div>
        <h2>Quyền lợi</h2>
        <div><p>Lương thỏa thuận.</p></div>
        """
    )
    result = _run_real_section_parser(html)
    desc = result["sections"].get("Mô tả công việc", "")
    assert_true(desc, "P+UL+P: Mô tả công việc section must not be empty")
    lines = desc.split("\n")
    assert_equal(len(lines), 4, f"P+UL+P: must preserve exactly 4 lines (intro + 2 bullets + trailer), got {lines!r}")
    assert_true("Sản phẩm: Sơn phủ chuyên dụng." in lines[0], f"first line must be the intro paragraph, got {lines!r}")
    assert_true(lines[1].startswith("• ") and "Kiểm tra nguyên liệu" in lines[1], f"line 2 must be bullet 1, got {lines!r}")
    assert_true(lines[2].startswith("• ") and "Kiểm tra thành phẩm" in lines[2], f"line 3 must be bullet 2, got {lines!r}")
    assert_true("Làm việc tại KCN Quế Võ 1." in lines[3], f"last line must be the trailing paragraph, got {lines!r}")


def test_div_p_ul_div_mixed_preserves_all_benefit_sentences() -> None:
    """요구 fixture 2: DIV + P + UL + DIV 혼합 구조에서 복리후생 문장이
    전부 보존됨(표본 7 "Chế độ khác:" 실제 구조 재현)."""
    html = _wrap_container(
        """
        <h2>Mô tả công việc</h2>
        <div><p>desc</p></div>
        <h2>Yêu cầu công việc</h2>
        <div><p>req</p></div>
        <h2>Quyền lợi</h2>
        <div id="wrapper">
          <div>Mức Lương thỏa thuận theo năng lực.</div>
          <p>Công ty hỗ trợ cơm trưa.</p>
          <ul><li>Thưởng Lễ, Tết.</li></ul>
          <div>Chế độ khác:</div>
        </div>
        """
    )
    result = _run_real_section_parser(html)
    benefits = result["sections"].get("Quyền lợi", "")
    assert_true("Mức Lương thỏa thuận theo năng lực." in benefits, f"benefit div 1 must be preserved, got {benefits!r}")
    assert_true("Công ty hỗ trợ cơm trưa." in benefits, f"benefit p must be preserved, got {benefits!r}")
    assert_true("• Thưởng Lễ, Tết." in benefits, f"benefit li must be preserved, got {benefits!r}")
    assert_true("Chế độ khác:" in benefits, f"benefit div 2 (trailing header) must be preserved, got {benefits!r}")
    lines = benefits.split("\n")
    assert_equal(len(lines), 4, f"all 4 benefit pieces must be present exactly once, got {lines!r}")


def test_company_intro_and_similar_jobs_outside_container_never_included() -> None:
    """요구 fixture 3: 상세 컨테이너 밖에 회사 소개와 Việc làm tương tự가
    있어도 출력에 포함되지 않음."""
    html = _wrap_container(
        """
        <h2>Mô tả công việc</h2>
        <div><p>Nội dung công việc thật.</p></div>
        <h2>Yêu cầu công việc</h2>
        <div><p>Yêu cầu thật.</p></div>
        <h2>Quyền lợi</h2>
        <div><p>Quyền lợi thật.</p></div>
        """
    )
    result = _run_real_section_parser(html)
    combined = "\n".join(result["sections"].values())
    assert_false("Công Ty ABC chuyên sản xuất" in combined, "company-intro text (outside container) must never leak into any section")
    assert_false("Việc làm tương tự" in combined, "similar-jobs text (outside container) must never leak into any section")
    assert_false("Từ khóa" in combined, "keyword/ad text (outside container) must never leak into any section")


def test_no_reliable_container_never_falls_back_to_document_body() -> None:
    """요구 fixture 4: 상세 컨테이너를 찾지 못한 경우 document.body 전체를
    본문으로 사용하지 않음 — "Thông tin chung"이 페이지 어디에도 없으면
    findDetailContainer()는 null을 반환해야 하고, 실제로 존재하는 헤딩/
    본문이 있어도 그 3개 섹션은 채워지면 안 된다."""
    html = _wrap_container(
        """
        <h2>Mô tả công việc</h2>
        <div><p>Nội dung công việc thật.</p></div>
        <h2>Yêu cầu công việc</h2>
        <div><p>Yêu cầu thật.</p></div>
        <h2>Quyền lợi</h2>
        <div><p>Quyền lợi thật.</p></div>
        """,
        include_thong_tin_chung=False,
    )
    result = _run_real_section_parser(html)
    assert_false(result["containerFound"], "findDetailContainer() must return null (containerFound=False) when no ancestor mentions 'Thông tin chung'")
    assert_equal(result["sections"], {}, f"no section may be filled when the container cannot be found — must not fall back to document.body, got {result['sections']!r}")


def test_unexpected_intermediate_heading_does_not_mix_sections() -> None:
    """요구 fixture 5: 예상하지 않은 중간 헤더를 만난 경우 다른 섹션과
    혼합하지 않음 — 그 섹션 자체를 비우고(파싱 실패 취급), 이후 섹션에도
    새어 들어가지 않아야 한다."""
    html = _wrap_container(
        """
        <h2>Mô tả công việc</h2>
        <p>Line 1 desc</p>
        <h3>Unexpected Header</h3>
        <p>Should not appear anywhere</p>
        <h2>Yêu cầu công việc</h2>
        <p>Req A</p>
        <h2>Quyền lợi</h2>
        <p>Benefit A</p>
        """
    )
    result = _run_real_section_parser(html)
    sections = result["sections"]
    assert_true("Mô tả công việc" not in sections or not sections["Mô tả công việc"], f"section stopped at an unrecognized heading must not be stored, got {sections.get('Mô tả công việc')!r}")
    combined = "\n".join(sections.values())
    assert_false("Should not appear anywhere" in combined, "content sandwiched before the unexpected heading and the next known heading must never leak into any section")
    assert_true("Req A" in sections.get("Yêu cầu công việc", ""), f"the next section must still be captured correctly on its own, got {sections!r}")


def test_nested_list_does_not_duplicate_the_same_sentence() -> None:
    """요구 fixture 6: 중첩 목록이 있을 경우 같은 문장이 중복 저장되지
    않음 — 바깥 li의 텍스트가 안쪽 li 텍스트를 통째로 포함해버리는 것을
    막아야 한다(안쪽 li는 querySelectorAll로 별도 방문됨)."""
    html = _wrap_container(
        """
        <h2>Mô tả công việc</h2>
        <div><p>desc</p></div>
        <h2>Yêu cầu công việc</h2>
        <div><p>req</p></div>
        <h2>Quyền lợi</h2>
        <div>
          <ul>
            <li>Đóng đầy đủ BHXH, BHYT, BHTN
              <ul><li>Phép năm theo quy định của Luật Lao động Việt Nam.</li></ul>
            </li>
          </ul>
        </div>
        """
    )
    result = _run_real_section_parser(html)
    benefits = result["sections"].get("Quyền lợi", "")
    lines = [l for l in benefits.split("\n") if l.strip()]
    outer_count = sum(1 for l in lines if "BHXH" in l)
    inner_count = sum(1 for l in lines if "Phép năm" in l)
    assert_equal(outer_count, 1, f"outer <li> sentence must appear exactly once, got {lines!r}")
    assert_equal(inner_count, 1, f"nested <li> sentence must appear exactly once, got {lines!r}")
    outer_line = next(l for l in lines if "BHXH" in l)
    assert_false("Phép năm" in outer_line, f"outer <li> line must not also swallow the nested <li>'s own sentence, got {outer_line!r}")


def test_word_paste_comment_markers_never_leak_into_text() -> None:
    """실측 재검증 중 자체 발견: 실제 원문 DOM에 Word 붙여넣기 흔적인
    <!--StartFragment-->/<!--EndFragment--> 주석 노드가 li 안에 섞여
    있었다(표본 7/8/9) — 중첩 li 자체 텍스트 추출 로직이 주석 노드까지
    텍스트로 읽어버리면 "StartFragment" 문자열이 그대로 출력에 새어
    들어간다. 이 회귀 테스트는 그 문제를 재현하고 고정한다."""
    html = _wrap_container(
        """
        <h2>Mô tả công việc</h2>
        <div><p>desc</p></div>
        <h2>Yêu cầu công việc</h2>
        <div><p>req</p></div>
        <h2>Quyền lợi</h2>
        <div>
          <ul>
            <li><!--StartFragment-->Mức lương thỏa thuận theo năng lực<!--EndFragment--></li>
          </ul>
        </div>
        """
    )
    result = _run_real_section_parser(html)
    benefits = result["sections"].get("Quyền lợi", "")
    assert_false("StartFragment" in benefits, f"Word-paste comment marker must never leak into extracted text, got {benefits!r}")
    assert_false("EndFragment" in benefits, f"Word-paste comment marker must never leak into extracted text, got {benefits!r}")
    assert_true("Mức lương thỏa thuận theo năng lực" in benefits, f"the real sentence around the comment markers must still be preserved, got {benefits!r}")


def main() -> int:
    tests = [
        test_p_ul_p_mixed_preserves_all_sentences_in_dom_order,
        test_div_p_ul_div_mixed_preserves_all_benefit_sentences,
        test_company_intro_and_similar_jobs_outside_container_never_included,
        test_no_reliable_container_never_falls_back_to_document_body,
        test_unexpected_intermediate_heading_does_not_mix_sections,
        test_nested_list_does_not_duplicate_the_same_sentence,
        test_word_paste_comment_markers_never_leak_into_text,
    ]
    try:
        for test in tests:
            test()
            print(f"✅ {test.__name__}")
    finally:
        _close_browser()
    print(f"\n결과: {len(tests)}/{len(tests)} real DOM section parser tests passed")
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
