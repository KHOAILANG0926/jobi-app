import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { imageTool, parseLooseName, register } from '../scripts/images/register-images.mjs'

// 이미지 자동 등록 시험(2026-11-27 Lee): 파일 이름만 맞으면 이름 해석 → 최적화 → 중복 검사 → 번호 부여 → 목록 등록이 한 번에 되고, 다시 돌려도 아무것도 바뀌지 않는다.
const eq = (a: unknown, b: unknown, note: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${note}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`) }
eq(parseLooseName('ordering_noodle_restaurant_7.PNG'), { role: 'ordering_noodle', environment: 'restaurant' }, '긴 직무 이름 우선')
eq(parseLooseName('cooking-pho 3.jpg'), { role: 'cooking', environment: 'pho' }, '구분자 정리')
eq(parseLooseName('random_photo.png'), undefined, '모르는 이름')

if (!imageTool()) { console.log('register-images: 이름 해석만 확인(ImageMagick 없는 환경 — 최적화·등록 시험 건너뜀)'); process.exit(0) }
const tool = imageTool()!
const root = mkdtempSync(join(tmpdir(), 'reg-root-'))
const src = mkdtempSync(join(tmpdir(), 'reg-src-'))
try {
  mkdirSync(join(root, 'data', 'industry-photos'), { recursive: true })
  mkdirSync(join(root, 'public', 'images'), { recursive: true })
  cpSync(join(import.meta.dirname, '..', 'data', 'industry-photos', 'manifest.json'), join(root, 'data', 'industry-photos', 'manifest.json'))
  const mk = (name: string, spec: string) => execFileSync(tool, ['-size', '2400x1600', spec, join(src, name)])
  mk('cooking_pho_1.png', 'plasma:fractal') // 큰 그림 → 줄여서 등록
  cpSync(join(src, 'cooking_pho_1.png'), join(src, 'cooking_pho_2.png')) // 같은 그림 → 중복 건너뜀(번호 안 씀)
  mk('barista_cafe_1.jpg', 'gradient:red-blue')
  mk('mystery_thing.png', 'xc:white') // 이름을 못 읽음 → 보고만
  const first = register(src, { root, ai: true })
  eq(first.added.length, 2, '등록 2건')
  eq(first.skipped.length, 2, '중복 1 + 이름 불명 1')
  const m = JSON.parse(readFileSync(join(root, 'data', 'industry-photos', 'manifest.json'), 'utf8'))
  const mine = m.images.filter((i: { id: string }) => first.added.includes(i.id))
  for (const i of mine) {
    const f = join(root, 'public', i.file)
    if (!existsSync(f) || statSync(f).size > 300 * 1024) throw new Error('파일 없음/300KB 초과 ' + i.id)
    eq(i.kind, 'ai', '종류')
    if (!i.sha256 || !i.origin) throw new Error('출처·해시 누락')
  }
  const pho = mine.find((i: { id: string }) => i.id.startsWith('cooking_pho_'))
  eq([pho.env, pho.roles, pho.group], ['nha_hang_pho', ['5120'], 'am_thuc_do_uong'], '직무·환경·업종 분류')
  eq(register(src, { root, ai: true }).added, [], '다시 돌려도 새 등록 없음')
  eq(JSON.parse(readFileSync(join(root, 'data', 'industry-photos', 'manifest.json'), 'utf8')).images.length, m.images.length, '목록 그대로')
} finally { rmSync(root, { recursive: true, force: true }); rmSync(src, { recursive: true, force: true }) }
console.log('register-images ok')
