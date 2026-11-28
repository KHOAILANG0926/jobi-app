import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assignRepresentativeImages } from '../scripts/ocr/assign-image.mjs'
import { main as publish } from '../scripts/ci/claude-publish.mjs'
import { imageTool, parseLooseName, publishBundle, register } from '../scripts/images/register-images.mjs'

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
  const git = (...a: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { encoding: 'utf8' })
  git('init', '-q'); git('add', '-A'); git('commit', '-qm', 'base')
  const base = git('rev-parse', 'HEAD').trim()
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
  // 게시 묶음 → 기존 게시 단계(이미지 모드) 검증: 바뀐 파일은 사진·목록뿐, 새 PR 본문은 필수 검사 형식, 트리 대조까지 통과해야 한다(시험 실행 — 게시 안 함).
  const out = join(root, '..', 'pub-out-' + Date.now())
  const bundle = publishBundle(out, { root, added: first.added, skipped: first.skipped, api: () => [] })
  if (!bundle || bundle.files.some((f: string) => !/^(data\/industry-photos\/manifest\.json|public\/images\/industry\/)/.test(f))) throw new Error('게시 묶음 파일 범위 오류 ' + JSON.stringify(bundle))
  const pr = join(root, '..', 'pub-pr-' + Date.now())
  git('worktree', 'add', '-q', '--detach', pr, base)
  const log = console.log; const lines: string[] = []; console.log = (m: unknown) => { lines.push(String(m)) }
  const res = await publish(['pr', '--repo', 'o/r', '--out', out, '--head-sha', base, '--head-ref', 'images/register-test', '--workdir', pr, '--images', '--dry-run'])
  console.log = log
  if (!res.ok) throw new Error('이미지 게시 단계 거절: ' + JSON.stringify(res.problems))
  const bad = await publish(['pr', '--repo', 'o/r', '--out', out, '--head-sha', base, '--head-ref', 'feature/x', '--workdir', pr, '--images', '--dry-run'])
  if (bad.ok) throw new Error('images/ 아닌 브랜치는 거절해야 함')
  rmSync(out, { recursive: true, force: true })
  // 등록 → 공고 배정(기존 고정 배정 실행기, 방금 등록한 목록으로): 직무·환경이 맞는 새 공고가 방금 등록한 사진을 받고, 이미 배정된 공고는 그대로다.
  const newManifest = JSON.parse(readFileSync(join(root, 'data', 'industry-photos', 'manifest.json'), 'utf8'))
  const job = (id: number, over: Record<string, unknown>) => ({ id, title: 'Tuyển nhân viên', company: 'Quán ' + id, category: 'am_thuc_do_uong', subcategory: null, occupation_code: '5120', description: 'Công việc\nNấu phở', representative_image_id: null as string | null, ...over })
  const jobs = [job(1, { company: 'Phở Hà Nội', title: 'Tuyển đầu bếp nấu phở' }), job(2, { company: 'Phở Bắc', title: 'Tuyển nấu phở' }), job(3, { company: 'Phở cũ', title: 'Tuyển nấu phở', representative_image_id: 'cooking_pho_001_old' })]
  const upd: Array<[number, string]> = []
  const fake = { async query(sql: string, p: unknown[] = []) {
    if (sql.includes('group by 1')) return { rows: [] }
    if (sql.includes('select id, title')) return { rows: jobs.filter((j) => !j.representative_image_id) }
    const j = jobs.find((x) => x.id === p[0] && !x.representative_image_id); if (!j) return { rowCount: 0, rows: [] }
    j.representative_image_id = String(p[1]); upd.push([j.id, j.representative_image_id]); return { rowCount: 1, rows: [] } } }
  await assignRepresentativeImages(fake, { manifest: newManifest, log: () => {} })
  if (upd.length !== 2 || !upd.every(([, id]) => id.startsWith('cooking_pho_')) || !upd.some(([, id]) => mine.some((i: { id: string }) => i.id === id))) throw new Error('방금 등록한 사진이 배정되지 않음 ' + JSON.stringify(upd))
  eq(jobs[2].representative_image_id, 'cooking_pho_001_old', '이미 배정된 공고는 그대로')
} finally { rmSync(root, { recursive: true, force: true }); rmSync(src, { recursive: true, force: true }) }
console.log('register-images ok')
