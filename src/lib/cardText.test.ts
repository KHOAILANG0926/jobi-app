// 카드 글자 다듬기(Lee 2026-11-01) — 실제 공개 공고
import { cardCompany, cardTitle } from './cardText.ts'
function eq(got: unknown, want: unknown, name: string) { if (got !== want) throw new Error(`${name}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`) }
eq(cardCompany('WALLACE BẮC NINH', 'Võ Cường, Bắc Ninh'), 'WALLACE', '#5247 region already below')
eq(cardCompany('TRUNG NGUYÊN LEGEND BẮC NINH', 'p Vũ Ninh, tỉnh Bắc Ninh'), 'TRUNG NGUYÊN LEGEND', '#5231')
eq(cardCompany('Highlands Coffee Mường Thanh Bắc Ninh', 'Phường Kinh Bắc, Tỉnh Bắc Ninh'), 'Highlands Coffee Mường Thanh', '#5157')
eq(cardCompany('ADTEK', 'Nhà máy Quế Võ III, Bắc Ninh'), 'ADTEK', 'no region in name')
eq(cardCompany('Bắc Ninh', 'Bắc Ninh'), 'Bắc Ninh', 'never empty')
eq(cardTitle('WALLACE BẮC NINH TUYỂN DỤNG NHÂN VIÊN ƯU TÚ', 'WALLACE BẮC NINH'), 'Tuyển dụng nhân viên ưu tú', '#5247 company removed, caps softened')
eq(cardTitle('TUYỂN NHÂN VIÊN PHỤC VỤ – TRUNG NGUYÊN LEGEND BẮC NINH', 'TRUNG NGUYÊN LEGEND BẮC NINH'), 'Tuyển nhân viên phục vụ', '#5231 trailing company')
eq(cardTitle('Highlands Coffee tuyển nhân viên bán hàng, pha chế và phục vụ', 'Highlands Coffee Mường Thanh Bắc Ninh'), 'Highlands Coffee tuyển nhân viên bán hàng, pha chế và phục vụ', 'partial company kept (not the full name)')
eq(cardTitle('tuyển nam, nữ làm linh kiện tai nghe tại KCN Yên Phong', 'CTY KDA'), 'tuyển nam, nữ làm linh kiện tai nghe tại KCN Yên Phong', 'normal title unchanged')
eq(cardTitle('TEFAL TUYỂN PG BÁN HÀNG GIA DỤNG', 'Groupe SEB'), 'Tefal tuyển PG bán hàng gia dụng', 'all caps softened')
console.log('cardText: real titles passed')
