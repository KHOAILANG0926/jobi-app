"""공고 → 베트남 공식 직업코드(QĐ 34/2020/QĐ-TTg) 자동 분류 (규칙 R8의 입력).

- 결과는 (코드, 원문 근거) 또는 None. 근거는 공고 제목/원문에서 **그대로 잘라낸 글자**다(가공 금지).
  DB 트리거(R8)가 근거가 실제 원문에 있는지, 코드가 occupation_master에 있는지 다시 검사한다.
- 모르면 None(미분류). 'other' 같은 기본값을 붙이지 않는다.
- 회사명·공단명(KCN)·업종으로 추정하지 않는다 — 제목과 공고 원문만 본다.
- 제목에서 먼저 찾고, 제목에 없을 때만 원문 앞부분을 본다. 원문에서 흔히 다른 뜻으로 나오는 말
  ("bảo vệ", "bán hàng", "phục vụ", "văn phòng" 등)은 제목에서만 인정한다(title_only).
- 코드는 모두 data/occupations/34-2020/occupation_codes.json 에 있는 것만 쓴다(테스트가 강제).
- 규칙 목록은 순서가 우선순위다(구체적인 것 먼저, "công nhân" 같은 포괄 규칙은 맨 끝).
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

BODY_SCAN_CHARS = 1500


@dataclass(frozen=True)
class Rule:
    code: str
    pattern: str            # 성조·대소문자를 뺀 글자 기준 정규식
    title_only: bool = False


# (코드: 공식 명칭) — 명칭은 테스트에서 공식 목록과 대조한다.
RULES: list[Rule] = [
    Rule('82022', r'(lam|lap rap|ghep|cam) linh kien( (dien tu|tai nghe|dien thoai|camera))?|linh kien (dien tu|tai nghe|dien thoai|camera)|lap rap (dien tu|bo mach)|bo mach dien tu'),  # Thợ lắp ráp thiết bị điện tử/linh kiện điện tử
    Rule('7212', r'\btho han\b|\bhan (tig|mig|co2|dien|inox)\b|\bcong nhan han\b'),        # Thợ hàn và thợ cắt kim loại bằng nhiệt
    Rule('7223', r'\bcnc\b|\btien phay\b|\bvan hanh may (tien|phay)\b'),                       # Thợ lắp ráp và vận hành máy công cụ kim loại
    Rule('8344', r'\blai xe nang\b|\bxe nang\b'),                                              # Thợ vận hành xe bốc dỡ
    Rule('8332', r'\blai xe (tai|container|dau keo)\b|\btai xe (container|dau keo|xe tai)\b'), # Lái xe tải hạng vừa và xe tải hạng nặng
    Rule('8322', r'\blai xe\b|\btai xe\b'),                                                    # Lái xe con, taxi và xe tải hạng nhẹ
    Rule('9621', r'\bshipper\b|\bgiao hang\b'),                                                # Người đưa thư, người giao hàng và người khuân vác hành lý
    Rule('3434', r'\bbep truong\b'),                                                           # Đầu bếp trưởng
    Rule('9402', r'\bphu bep\b'),                                                              # Người phụ bếp
    Rule('5120', r'\bdau bep\b|\bbep chinh\b|\bbep (au|a|viet|han|nhat)\b'),                   # Đầu bếp
    Rule('5132', r'\bpha che\b|\bbarista\b|\bbartender\b'),                                    # Nhân viên pha chế
    Rule('5230', r'\bthu ngan\b'),                                                             # Nhân viên thu ngân và bán vé
    Rule('5222', r'\bquan ly cua hang\b|\bcua hang truong\b|\bgiam sat cua hang\b'),           # Nhân viên giám sát cửa hàng
    Rule('5244', r'\btelesales?\b|\bban hang qua dien thoai\b'),                               # Nhân viên bán hàng qua trung tâm liên lạc
    Rule('5131', r'\bboi ban\b|\bchay ban\b|\b(nhan vien )?phuc vu\b', title_only=True),      # Bồi bàn
    Rule('5223', r'\b(nhan vien |tu van )?ban hang\b', title_only=True),                      # Nhân viên trợ giúp bán hàng
    Rule('5401', r'\bbao ve\b', title_only=True),                                              # Nhân viên an ninh (trừ công an)
    Rule('9111', r'\bgiup viec (gia dinh|nha)\b|\bosin\b|\bdon nha\b'),                        # Người quét dọn và giúp việc gia đình
    Rule('9112', r'\btap vu\b|\blao cong\b|\bve sinh (cong nghiep|van phong|toa nha)\b|\bdon (dep|phong) (khach san|van phong)\b|\bbuong phong\b'),  # Người quét dọn và giúp việc trong văn phòng, khách sạn...
    Rule('9121', r'\bgiat (la|ui)\b'),                                                         # Thợ giặt là bằng tay
    Rule('5311', r'\bbao mau\b|\btrong tre\b|\bcham soc tre\b'),                               # Nhân viên chăm sóc trẻ em
    Rule('3221', r'\bdieu duong\b|\by ta\b'),                                                  # Y tá/điều dưỡng, kỹ thuật viên chăm sóc bệnh nhân
    Rule('2341', r'\bgiao vien tieu hoc\b'),                                                   # Giáo viên tiểu học (cấp I)
    Rule('5141', r'\bcat toc\b|\btho toc\b|\blam toc\b|\buon nhuom\b'),                        # Thợ làm đầu
    Rule('5142', r'\bspa\b|\bnail\b|\blam mong\b|\bnoi mi\b'),                                 # Nhân viên làm đẹp và nhân viên có liên quan
    Rule('2411', r'\bke toan truong\b'),                                                       # Kế toán và các nhà chuyên môn có liên quan
    Rule('4311', r'\bke toan\b'),                                                              # Nhân viên kế toán
    Rule('4132', r'\bnhap lieu\b'),                                                            # Nhân viên nhập dữ liệu
    Rule('4226', r'\ble tan\b'),                                                               # Lễ tân (tổng hợp)
    Rule('4222', r'\btong dai vien\b|\bcall ?center\b'),                                       # Nhân viên trung tâm thông tin liên lạc
    Rule('4229', r'\bcham soc khach hang\b|\bcskh\b'),                                         # Nhân viên thông tin khách hàng chưa được phân vào đâu
    Rule('4406', r'\bnhan vien nhan su\b|\bhanh chinh nhan su\b|\bhcns\b'),                    # Nhân viên tổ chức nhân sự
    Rule('4110', r'\bhanh chinh\b|\bnhan vien van phong\b', title_only=True),                 # Nhân viên tổng hợp
    Rule('2512', r'\blap trinh\b|\bdeveloper\b|\bbackend\b|\bfrontend\b'),                     # Nhà phát triển phần mềm
    Rule('2166', r'\bthiet ke do hoa\b|\bgraphic design'),                                     # Nhà thiết kế đồ họa và truyền thông đa phương tiện
    Rule('2431', r'\bmarketing\b'),                                                            # Nhà chuyên môn về quảng cáo và tiếp thị
    Rule('4321', r'\bthu kho\b|\bnhan vien kho\b|\bquan ly kho\b'),                            # Nhân viên ghi chép tồn kho
    Rule('9333', r'\bboc (xep|vac)\b|\bkhuan vac\b'),                                          # Người mang vác hàng
    Rule('7411', r'\btho dien\b|\bdien (dan dung|cong nghiep|nuoc)\b'),                        # Thợ lắp điện cho tòa nhà và thợ điện có liên quan
    Rule('7231', r'\bsua (xe|o to|xe may)\b|\bco khi o to\b'),                                 # Thợ cơ khí và sửa chữa xe có động cơ
    Rule('9313', r'\bphu ho\b|\bphu xay dung\b'),                                              # Thợ phụ xây dựng
    Rule('7112', r'\btho (xay|ne)\b'),                                                         # Thợ nề và các thợ có liên quan
    Rule('7115', r'\btho moc\b|\bmoc noi that\b'),                                             # Thợ mộc và thợ làm đồ gỗ
    Rule('7131', r'\btho son\b'),                                                              # Thợ sơn và thợ liên quan khác
    Rule('8153', r'\bcong nhan may\b|\bmay cong nghiep\b'),                                    # Thợ vận hành máy may
    Rule('7531', r'\btho may\b'),                                                              # Thợ may, thợ làm da thú và thợ làm mũ
    Rule('7543', r'\bkiem hang\b|\bkiem tra chat luong\b|\bkcs\b|\bqc\b'),                     # Thợ phân loại và kiểm tra sản phẩm (trừ thực phẩm và đồ uống)
    Rule('9321', r'\bdong goi\b'),                                                             # Lao động đóng gói thủ công
    Rule('9329', r'\bcong nhan\b|\blao dong pho thong\b|\bldpt\b'),                            # Lao động công nghiệp khác chưa được phân vào đâu
]
_COMPILED = [(r, re.compile(r.pattern)) for r in RULES]


def _fold(text: str) -> tuple[str, list[int]]:
    """성조·대소문자 제거. 접힌 글자 각각이 원문 몇 번째 글자에서 왔는지 함께 돌려준다."""
    out, index = [], []
    for i, ch in enumerate(unicodedata.normalize('NFC', text or '')):
        base = 'd' if ch in 'đĐ' else ''.join(c for c in unicodedata.normalize('NFD', ch) if unicodedata.category(c) != 'Mn')
        for c in base.lower():
            out.append(c)
            index.append(i)
    return ''.join(out), index


def _find(text: str, allow_title_only: bool) -> tuple[str, str] | None:
    folded, index = _fold(text)
    original = unicodedata.normalize('NFC', text or '')
    for rule, regex in _COMPILED:
        if rule.title_only and not allow_title_only:
            continue
        m = regex.search(folded)
        if m:
            start, end = index[m.start()], index[m.end() - 1] + 1
            return rule.code, original[start:end]
    return None


def classify_occupation(title: str, source_text: str = '') -> dict | None:
    """{'occupation_code', 'occupation_evidence'} 또는 None(미분류)."""
    hit = _find(title, allow_title_only=True) or _find((source_text or '')[:BODY_SCAN_CHARS], allow_title_only=False)
    if not hit:
        return None
    code, evidence = hit
    return {'occupation_code': code, 'occupation_evidence': evidence}
