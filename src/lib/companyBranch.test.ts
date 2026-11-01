// 결정 0007(Lee 2026-11-01) 상단 회사명 줄 시험 — 운영 공고 제목·회사명 그대로.
import { companyLine } from './companyBranch.ts'
function assert(ok: boolean, name: string) { if (!ok) throw new Error(name) }
// #5157: 제목에 브랜드가 있으면 지점명만
assert(companyLine('Highlands Coffee tuyển nhân viên bán hàng, pha chế và phục vụ', 'Highlands Coffee Mường Thanh Bắc Ninh') === 'Mường Thanh Bắc Ninh', '#5157 지점명만')
// #4824: 회사명이 제목에 다 있고 지점 없음 → 줄 없음
assert(companyLine('CTY KDA tuyển nam, nữ làm linh kiện tai nghe tại KCN Yên Phong', 'KDA') === undefined, '#4824 줄 없음')
// 제목에 회사명이 없으면 그대로
assert(companyLine('Việc làm chính thức đi làm ngay', 'Công ty TNHH ADTEK Việt Nam') === 'Công ty TNHH ADTEK Việt Nam', '회사명 그대로')
// 대소문자·성조 차이는 같은 글자로 본다
assert(companyLine('TEFAL TUYỂN PG BÁN HÀNG GIA DỤNG', 'Tefal') === undefined, '대문자 제목')
// 낱말 중간 일치는 인정하지 않음("Co" ≠ "Coffee")
assert(companyLine('Coffee shop tuyển', 'Co Ltd') === 'Co Ltd', '낱말 경계')
assert(companyLine('x', '') === undefined && companyLine('x', null) === undefined, '회사명 없음')
console.log('companyBranch.test.ts: 결정 0007 6개 경우 통과')
