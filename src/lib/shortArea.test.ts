// 카드용 짧은 위치(Lee 2026-11-01 알바몬 구성) — 실제 공개 공고 주소
import { shortArea } from './shortArea.ts'
function eq(got: unknown, want: unknown, name: string) { if (got !== want) throw new Error(`${name}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`) }
eq(shortArea('216 Nguyễn Trãi, Võ Cường, Bắc Ninh, Bắc Ninh'), 'Võ Cường, Bắc Ninh', '#5247')
eq(shortArea('KCN Yên Phong, Bắc Ninh'), 'KCN Yên Phong, Bắc Ninh', '#4824')
eq(shortArea('Nhà máy Quế Võ III, Bắc Ninh'), 'Nhà máy Quế Võ III, Bắc Ninh', '#4879')
eq(shortArea('Số 395 Ngô Gia Tự, Phường Kinh Bắc, Tỉnh Bắc Ninh'), 'Phường Kinh Bắc, Tỉnh Bắc Ninh', '#5157')
eq(shortArea('Ngô Tất Tố - TP. Bắc Ninh'), 'Ngô Tất Tố, TP. Bắc Ninh', '#4982')
eq(shortArea('Khu phố Mao Yên, phường Phương Liễu, Bắc Ninh'), 'phường Phương Liễu, Bắc Ninh', '#4828')
eq(shortArea('33 Lý Thái Tổ, P. Ninh Xá, TP. Bắc Ninh'), 'P. Ninh Xá, TP. Bắc Ninh', '#4878')
eq(shortArea(''), '', 'empty')
console.log('shortArea: real addresses passed')
