// 알바몬 기업회원 공고등록 '상세모집요강'(간편! 템플릿·직접입력) 그대로 따라 한 데모 — Lee 2026-11-08.
// 배치·크기·동작은 알바몬 PC(www)·모바일(m) 화면에서 직접 확인한 값. 저장 없음. 에디터 탭은 보류(패키지 설치 허용 전).
// 바꾼 것: 글자는 베트남어, 사진은 우리 업종 사진(없으면 회색 '사진 준비 중'), 알바몬 로고 자리는 우리 로고,
// 알바몬 전용(꿀팁 마스코트·제한규정 링크·외부 제휴 게시 안내) 뺌.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent as RMouseEvent } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  TEMPLATES, TEMPLATE_CATEGORIES, TEMPLATE_COLORS, SECTION_LABEL, ROLE_DUTY_DEFAULT, bodyFromForm, colorOf,
  type OuterForm, type SectionKey, type TemplateInfo,
} from '../../lib/albamonTemplate'
import './AlbamonTemplateDemo.css'

type BodyKey = Exclude<SectionKey, 'logo' | 'roles'>
type EtcKey = 'etc1' | 'etc2' | 'etc3' | 'etc4'
type Tab = 'template' | 'direct'
const ETC_KEYS: EtcKey[] = ['etc1', 'etc2', 'etc3', 'etc4']
const BASE_KEYS: SectionKey[] = ['logo', 'roles', 'work', 'support', 'apply', 'contact']
const ALL_KEYS: SectionKey[] = [...BASE_KEYS, ...ETC_KEYS]
// 항목 버튼 이름(PC 97px 칸)
const ITEM_LABEL: Record<SectionKey, string> = {
  logo: 'Logo', roles: 'Vị trí', work: 'Điều kiện', support: 'Yêu cầu', apply: 'Ứng tuyển', contact: 'Liên hệ',
  etc1: 'Khác 1', etc2: 'Khác 2', etc3: 'Khác 3', etc4: 'Khác 4',
}
const PH = 'Nhập nội dung'
const TAB_NAME: Record<Tab, string> = { template: 'Mẫu nhanh!', direct: 'Nhập trực tiếp' }
// 바깥 입력값(이 데모에는 공고 등록 칸이 없어 빈 값). '적용하기'는 알바몬처럼 급여 없이 이름표만 채운다.
const FORM: OuterForm = {
  title: '', roles: [], period: '', days: [], start: '', end: '', benefits: '', education: '', preferred: '',
  applyMethods: '', contactName: '', contactPhone: '',
}
// 직접입력 '항목 선택' 버튼이 끝에 붙이는 글(알바몬 형식 ◇ 제목 + 줄)
const DIRECT_BLOCK: Record<'work' | 'support' | 'apply' | 'contact', string> = {
  work: '\n◇ Điều kiện làm việc\n Thời hạn làm việc: \n Ngày làm việc: \n Thời gian làm việc: \n Phúc lợi: \n      ',
  support: '\n◇ Điều kiện ứng tuyển\n Học vấn: Không yêu cầu\n Ưu tiên: \n      ',
  apply: "\n◇ Cách ứng tuyển\n Cách ứng tuyển: \n Khi gọi điện, hãy nói <strong>'Tôi xem tin tuyển dụng trên Viecganban'</strong> để được hỗ trợ nhanh hơn.\n      ",
  contact: '\n◇ Thông tin người liên hệ\n Người liên hệ: \n Số điện thoại: \n      ',
}
const DIRECT_KEYS = ['work', 'support', 'apply', 'contact'] as const
// 편집기 글자색(알바몬 글자 색깔 메뉴 24가지 + 색깔 제거)
const TEXT_COLORS: [string, string][] = [
  ['Green', '#1abc9d'], ['Sea Foam', '#2fcc71'], ['Aqua', '#3298db'], ['Grape', '#9b59b6'], ['Mango', '#f1c413'],
  ['Teal', '#0fa084'], ['Moss', '#26ad60'], ['Ocean', '#2980b9'], ['Plum', '#8d44ac'], ['Tangerine', '#f39c16'],
  ['Tangerine Dark', '#e67e23'], ['Red', '#e74b3c'], ['Mercury', '#ecf0f2'], ['Silver', '#dddddd'], ['Magnesium', '#bcc3c5'],
  ['Orange Brown', '#d35400'], ['Cayenne', '#c03a2b'], ['Nickel', '#999999'], ['Aluminum', '#95a4a6'], ['Tin', '#7d8b8c'],
  ['Iron', '#4e5f70'], ['Tungsten', '#2c3d51'], ['Đen', '#000000'], ['Trắng', '#ffffff'],
]
interface Role { name: string; duties: string }

const Check = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="12" fill="#ff501b" /><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const Arrow = ({ dir, color = '#6a6a6a' }: { dir: 'l' | 'r'; color?: string }) => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden><path d={dir === 'r' ? 'M7 4l5 5-5 5' : 'M11 4L6 9l5 5'} fill="none" stroke={color} strokeWidth="1.5" /></svg>
)
const Caret = () => <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><path d="M2 3.5l3 3 3-3" fill="none" stroke="#333" strokeWidth="1.3" /></svg>
const Chevrons = () => <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M3 3l4 3.5L11 3M3 7.5l4 3.5 4-3.5" fill="none" stroke="#fff" strokeWidth="1.3" /></svg>
const Search = () => <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><circle cx="6" cy="6" r="4.2" fill="none" stroke="#fff" strokeWidth="1.6" /><path d="M9.2 9.2L12.5 12.5" stroke="#fff" strokeWidth="1.6" /></svg>

// 위아래 줄 + 사이트 로고(알바몬 로고 자리)
const BrandLine = () => <div className="amt-blogo"><span className="amt-blogo__mark"><img src="/logo.png" alt="" />Việc gần Bạn</span></div>

// 항목 글 상자: 도구줄(굵게·목록과 모양·글자색) + 글칸. 입력 중 커서가 사라지지 않게 처음 한 번만 내용을 넣는다(다시 넣을 땐 key를 바꾼다).
function TextBox({ html, onChange }: { html: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<'list' | 'color' | null>(null)
  const [docColors, setDocColors] = useState<string[]>([])
  useLayoutEffect(() => { if (ref.current) ref.current.innerHTML = html }, [])
  const emit = () => { const el = ref.current; if (!el) return; if (el.innerHTML === '<br>') el.innerHTML = ''; onChange(el.innerHTML) }
  const cmd = (name: string, value?: string) => { ref.current?.focus(); document.execCommand(name, false, value); emit() }
  const findUl = () => { let n: Node | null = window.getSelection()?.anchorNode ?? null; while (n && n !== ref.current && !(n instanceof HTMLUListElement)) n = n.parentNode; return n instanceof HTMLUListElement ? n : null }
  const listStyle = (style: string) => {
    ref.current?.focus()
    if (!findUl()) document.execCommand('insertUnorderedList')
    const ul = findUl(); if (ul) ul.style.listStyleType = style
    setMenu(null); emit()
  }
  const color = (c: string) => { cmd('foreColor', c); setDocColors((d) => (d.includes(c) ? d : [...d, c])); setMenu(null) }
  const keep = (e: RMouseEvent) => e.preventDefault()
  return (
    <div className="amt-ed">
      <div className="amt-ed__bar">
        <button type="button" className="amt-ed__btn" title="In đậm (Ctrl+B)" onMouseDown={keep} onClick={() => cmd('bold')}><b>B</b></button>
        <span className="amt-ed__split">
          <button type="button" className="amt-ed__btn" title="Danh sách" onMouseDown={keep} onClick={() => cmd('insertUnorderedList')}>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden><circle cx="3" cy="5" r="1.3" /><circle cx="3" cy="9" r="1.3" /><circle cx="3" cy="13" r="1.3" /><path d="M7 5h9M7 9h9M7 13h9" stroke="#333" strokeWidth="1.4" /></svg>
          </button>
          <button type="button" className="amt-ed__btn amt-ed__btn--arrow" title="Danh sách" onMouseDown={keep} onClick={() => setMenu(menu === 'list' ? null : 'list')}><Caret /></button>
        </span>
        <button type="button" className="amt-ed__btn" title="Màu chữ" onMouseDown={keep} onClick={() => setMenu(menu === 'color' ? null : 'color')}>
          <span style={{ textDecoration: 'underline', fontWeight: 600 }}>A</span><Caret />
        </button>
        {menu === 'list' && (
          <div className="amt-ed__menu amt-ed__menu--list">
            {[['disc', 'Tròn đen', '●'], ['circle', 'Tròn trắng', '○'], ['square', 'Vuông đen', '■']].map(([s, n, t]) => (
              <button type="button" key={s} title={n} aria-label={n} onMouseDown={keep} onClick={() => listStyle(s)}>{t}</button>
            ))}
          </div>
        )}
        {menu === 'color' && (
          <div className="amt-ed__menu amt-ed__menu--colors">
            <button type="button" className="amt-ed__erase" onMouseDown={keep} onClick={() => { cmd('removeFormat'); setMenu(null) }}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M5 12h7M2.5 8.5l5-5 3 3-5 5H4z" fill="none" stroke="#333" strokeWidth="1.2" /></svg>Bỏ màu
            </button>
            <div className="amt-ed__grid">
              {TEXT_COLORS.map(([n, c]) => <button type="button" key={c} className="amt-ed__sw" style={{ background: c }} title={n} aria-label={n} onMouseDown={keep} onClick={() => color(c)} />)}
            </div>
            <p className="amt-ed__label">Màu trong tài liệu</p>
            <div className="amt-ed__grid">
              {docColors.map((c) => <button type="button" key={c} className="amt-ed__sw" style={{ background: c }} aria-label={c} onMouseDown={keep} onClick={() => color(c)} />)}
            </div>
          </div>
        )}
      </div>
      <div ref={ref} className="amt-ed__text" contentEditable suppressContentEditableWarning data-ph={PH} onInput={emit} onFocus={() => setMenu(null)} />
    </div>
  )
}

interface DocState {
  tpl: TemplateInfo; colorId: number; on: Record<SectionKey, boolean>; extras: EtcKey[]; company: string; title: string; desc: string
  colHeads: [string, string]; roles: Role[]; bodies: Record<BodyKey, string>; etcTitles: Record<EtcKey, string>
}
interface DocSetters {
  title: (v: string) => void; desc: (v: string) => void; colHeads: (v: [string, string]) => void; roles: (r: Role[]) => void
  body: (k: BodyKey, v: string) => void; etcTitle: (k: EtcKey, v: string) => void; remove: (k: SectionKey) => void
}
const shownKeys = (s: DocState) => (['roles', 'work', 'support', 'apply', 'contact', ...s.extras] as SectionKey[]).filter((k) => s.on[k])
const docVars = (colorId: number) => { const c = colorOf(colorId); return { '--amt-bar': c.bar, '--amt-head': c.head } as CSSProperties }

// 미리보기(알바몬 미리보기 창 내용): 입력칸 없이 결과만. PC = 708px 왼쪽 정렬, 모바일 = 520px 가운데.
function Preview({ s, mobile }: { s: DocState; mobile?: boolean }) {
  const tc = s.tpl.darkTitle ? 'amt-c1' : 'amt-c2'
  return (
    <div className={`amt-pv${mobile ? ' amt-pv--m' : ''}`} style={docVars(s.colorId)}>
      <BrandLine />
      <div className="amt-pv__visual">
        {s.tpl.photo ? <img className="amt-visual__img" src={s.tpl.photo} alt="" /> : <div className="amt-visual__none">Ảnh đang chuẩn bị</div>}
        {s.on.logo && <p className={`amt-pv__company ${tc}`}>{s.company}</p>}
        {s.title && <h2 className={`amt-pv__title ${tc}`}>{s.title}</h2>}
      </div>
      {s.desc.trim() && <p className="amt-pv__desc">{s.desc}</p>}
      {shownKeys(s).map((k) => (
        <section className="amt-pv__sec" key={k}>
          <div className="amt-pv__tit">{k.startsWith('etc') ? s.etcTitles[k as EtcKey] : SECTION_LABEL[k]}</div>
          <div className="amt-pv__wp">
            {k === 'roles' ? (
              <table className="amt-pv__tbl">
                <thead><tr><th>{s.colHeads[0]}</th><th>{s.colHeads[1]}</th></tr></thead>
                <tbody>{s.roles.map((r, i) => <tr key={i}><td>{r.name}</td><td>{r.duties}</td></tr>)}</tbody>
              </table>
            ) : <div className="amt-pv__body" dangerouslySetInnerHTML={{ __html: s.bodies[k as BodyKey] }} />}
          </div>
        </section>
      ))}
      <BrandLine />
    </div>
  )
}

// 작성 화면(알바몬 tempArea)
function DocEdit({ s, set, version }: { s: DocState; set: DocSetters; version: number }) {
  const tc = s.tpl.darkTitle ? 'amt-c1' : 'amt-c2'
  const grow = (el: HTMLTextAreaElement) => { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` }
  return (
    <div className="amt-doc" style={docVars(s.colorId)}>
      <BrandLine />
      <div className="amt-top">
        <div className="amt-visual">
          {s.tpl.photo ? <img className="amt-visual__img" src={s.tpl.photo} alt="" /> : <div className="amt-visual__none">Ảnh đang chuẩn bị</div>}
          {s.on.logo && <p className={`amt-visual__company ${tc}`}>{s.company}</p>}
          <div className={`amt-visual__title ${tc}`}>
            <textarea rows={1} value={s.title} placeholder="Nhập tiêu đề tuyển dụng" ref={(el) => { if (el) grow(el) }} onChange={(e) => { set.title(e.target.value); grow(e.target) }} />
          </div>
        </div>
        <div className="amt-desc">
          <p className="amt-desc__h">Giới thiệu công ty và mô tả thêm công việc<span>(Không bắt buộc)</span></p>
          <textarea value={s.desc} placeholder={PH} onChange={(e) => set.desc(e.target.value)} />
        </div>
      </div>
      {shownKeys(s).map((k) => {
        const isEtc = k.startsWith('etc')
        return (
          <section className="amt-sec" key={k}>
            <div className="amt-sec__tit">
              {isEtc
                ? <input value={s.etcTitles[k as EtcKey]} maxLength={20} placeholder="Nhập tiêu đề (tối đa 20 ký tự)." onChange={(e) => set.etcTitle(k as EtcKey, e.target.value)} />
                : SECTION_LABEL[k]}
              <button type="button" className="amt-sec__del" onClick={() => set.remove(k)}>Xóa mục</button>
            </div>
            <div className="amt-wp">
              {k === 'roles' ? (
                <>
                  <table className="amt-tbl">
                    <thead><tr>
                      <th><input value={s.colHeads[0]} aria-label="Tên cột 1" onChange={(e) => set.colHeads([e.target.value, s.colHeads[1]])} /></th>
                      <th><input value={s.colHeads[1]} aria-label="Tên cột 2" onChange={(e) => set.colHeads([s.colHeads[0], e.target.value])} /></th>
                    </tr></thead>
                    <tbody>
                      {s.roles.map((r, i) => (
                        <tr key={i}>
                          <td><textarea value={r.name} placeholder={PH} onChange={(e) => set.roles(s.roles.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /></td>
                          <td>
                            <textarea value={r.duties} placeholder={`• ${PH}`} onChange={(e) => set.roles(s.roles.map((x, j) => j === i ? { ...x, duties: e.target.value } : x))} />
                            <button type="button" className="amt-tbl__del" aria-label="Xóa dòng" onClick={() => set.roles(s.roles.length > 1 ? s.roles.filter((_, j) => j !== i) : [{ name: '', duties: '' }])}>×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="amt-addrow"><button type="button" onClick={() => set.roles([...s.roles, { name: '', duties: '' }])}>+ Thêm dòng</button></div>
                </>
              ) : <TextBox key={`${k}-${version}`} html={s.bodies[k as BodyKey]} onChange={(v) => set.body(k as BodyKey, v)} />}
            </div>
          </section>
        )
      })}
      <BrandLine />
    </div>
  )
}

const Thumb = ({ t, on, onPick }: { t: TemplateInfo; on: boolean; onPick: () => void }) => (
  <button type="button" className={`amt-thumb${on ? ' amt-thumb--on' : ''}`} onClick={onPick} aria-label={t.name} aria-pressed={on}>
    {t.photo ? <img src={t.photo} alt="" loading="lazy" /> : <span className="amt-thumb__none">Ảnh đang chuẩn bị</span>}
    <span className="amt-thumb__dim"><strong className="amt-thumb__name">{t.name}</strong></span>
    {on && <span className="amt-thumb__check"><Check size={24} /></span>}
  </button>
)

// 타입선택 격자(PC 창·모바일 아래 창 공용): 사진 + 이름 + 돋보기(견본 보기)
function TypeGrid({ list, pending, setPending, onZoom }: { list: TemplateInfo[]; pending: number; setPending: (id: number) => void; onZoom: (t: TemplateInfo) => void }) {
  return (
    <div className="amt-all__grid">
      {list.map((t) => (
        <div key={t.id} className={`amt-all__it${t.id === pending ? ' amt-all__it--on' : ''}`}>
          <div className="amt-all__wrap">
            <button type="button" className="amt-all__pick" onClick={() => setPending(t.id)} aria-label={t.name} aria-pressed={t.id === pending}>
              <span className="amt-all__img">
                {t.photo ? <img src={t.photo} alt="" loading="lazy" /> : <span className="amt-thumb__none">Ảnh đang chuẩn bị</span>}
                {t.id === pending && <span className="amt-all__on"><svg width="28" height="28" viewBox="0 0 24 24" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" strokeWidth="2.4" /></svg></span>}
              </span>
            </button>
            <button type="button" className="amt-all__zoom" aria-label={`Xem mẫu ${t.name}`} onClick={() => onZoom(t)}><Search /></button>
          </div>
          <button type="button" className="amt-all__pick amt-all__name" tabIndex={-1} onClick={() => setPending(t.id)}>{t.name}</button>
        </div>
      ))}
    </div>
  )
}

// 돋보기 견본 내용(알바몬 견본과 같은 구성)
const sampleState = (t: TemplateInfo): DocState => ({
  tpl: t, colorId: t.color, on: { logo: true, roles: true, work: true, support: true, apply: true, contact: true, etc1: false, etc2: false, etc3: false, etc4: false },
  extras: [], company: 'Việc gần Bạn', title: '[T2–T6/Ngắn hạn] Cùng Việc gần Bạn tìm người đồng hành',
  desc: 'Tuyển nhân viên làm thêm chăm chỉ, có trách nhiệm.',
  colHeads: ['Vị trí tuyển dụng', 'Công việc và yêu cầu'],
  roles: [{ name: 'Quầy, phục vụ', duties: '• Công việc: quầy, giữ sảnh sạch sẽ\n• Yêu cầu: ưu tiên có kinh nghiệm' }],
  bodies: {
    work: '<ul><li>Thời hạn làm việc: trên 1 năm (có thể thương lượng)</li><li>Ngày làm việc: T2~T6</li><li>Thời gian làm việc: 09:00-18:00</li><li>Phúc lợi: BHXH, BHYT, BHTN</li></ul>',
    support: '<ul><li>Học vấn: Không yêu cầu</li><li>Ưu tiên: có kinh nghiệm việc tương tự, ở gần</li></ul>',
    apply: "<ul><li>Ứng tuyển online</li></ul><p>Khi gọi điện, hãy nói <strong>'Tôi xem tin tuyển dụng trên Viecganban'</strong> để được hỗ trợ nhanh hơn.</p>",
    contact: '<ul><li>Người liên hệ: Nguyễn Văn A</li><li>0900-000-000</li></ul>', etc1: '', etc2: '', etc3: '', etc4: '',
  },
  etcTitles: { etc1: '', etc2: '', etc3: '', etc4: '' },
})

// 직접입력 HTML 정리: 실행되는 것(스크립트·틀·이벤트·javascript: 주소)은 지운다. 줄바꿈은 알바몬처럼 <br>.
function cleanHtml(text: string): string {
  const doc = new DOMParser().parseFromString(`<div>${text.replace(/\n/g, '<br>')}</div>`, 'text/html')
  doc.querySelectorAll('script,iframe,object,embed,link,meta,style,form,base').forEach((el) => el.remove())
  doc.querySelectorAll('*').forEach((el) => {
    for (const a of Array.from(el.attributes)) {
      const v = a.value.trim().toLowerCase()
      if (a.name.startsWith('on') || ((a.name === 'href' || a.name === 'src') && (v.startsWith('javascript:') || v.startsWith('data:text')))) el.removeAttribute(a.name)
    }
  })
  return doc.body.firstElementChild?.innerHTML ?? ''
}

// 미리보기 창(알바몬처럼 새 창: PC 800×800, 모바일 420×764). 창이 막히면 화면 안 창으로 보여 준다.
function openPreview(html: string, mobile: boolean): boolean {
  const w = window.open('', mobile ? 'VGMobilePreview' : 'VGPCPreview', mobile ? 'width=420,height=764,scrollbars=yes' : 'width=800,height=800,scrollbars=yes')
  if (!w) return false
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).map((n) => n.outerHTML).join('')
  w.document.open()
  w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${location.origin}/"><title>Xem trước | Việc gần Bạn</title>${styles}</head><body class="amt-pvwin${mobile ? ' amt-pvwin--m' : ''}">${html}</body></html>`)
  w.document.close()
  return true
}

const emptyBodies = (): Record<BodyKey, string> => ({ work: '', support: '', apply: '', contact: '', etc1: '', etc2: '', etc3: '', etc4: '' })
const startOn = (): Record<SectionKey, boolean> => ({ logo: true, roles: true, work: true, support: true, apply: true, contact: false, etc1: false, etc2: false, etc3: false, etc4: false })

// 공고 등록 화면(PostJob) 맨 아래 '상세모집요강' 자리에 들어간다. outer = 위에서 입력한 값(적용하기에 씀), company = 기업정보 회사 이름.
// onHtml(데모 B안, Lee 2026-11-08 "B로 바꾸고 데모 먼저"): 지금 만든 상세모집요강 모양(HTML)을 등록 화면에 넘긴다 → 미리보기 상세 ④에 그대로.
export function AlbamonTemplateEditor({ outer = FORM, company = '', onHtml }: { outer?: OuterForm; company?: string; onHtml?: (html: string) => void }) {
  const [tplId, setTplId] = useState(41)
  const tpl = TEMPLATES.find((t) => t.id === tplId) ?? TEMPLATES[0]
  const [colorId, setColorId] = useState(tpl.color)
  const [page, setPage] = useState(0)
  const [on, setOn] = useState<Record<SectionKey, boolean>>(startOn)
  const [extras, setExtras] = useState<EtcKey[]>([])
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [colHeads, setColHeads] = useState<[string, string]>(['Vị trí tuyển dụng', 'Công việc và yêu cầu'])
  const [roles, setRoles] = useState<Role[]>([{ name: '', duties: '' }, { name: '', duties: '' }])
  const [bodies, setBodies] = useState<Record<BodyKey, string>>(emptyBodies)
  const [etcTitles, setEtcTitles] = useState<Record<EtcKey, string>>({ etc1: '', etc2: '', etc3: '', etc4: '' })
  const [version, setVersion] = useState(0)
  const [tab, setTab] = useState<Tab>('template')
  const [directText, setDirectText] = useState('')
  const [notice, setNotice] = useState(true)
  // 창: all(타입선택) · zoom(돋보기 견본) · pc/mobile(미리보기가 막혔을 때) · 모바일 아래 창
  const [modal, setModal] = useState<'all' | 'pc' | 'mobile' | null>(null)
  const [zoom, setZoom] = useState<TemplateInfo | null>(null)
  const [sheet, setSheet] = useState<'tpl' | 'color' | 'items' | 'direct' | null>(null)
  const [pending, setPending] = useState(tplId)
  const [pendingColor, setPendingColor] = useState(colorId)
  const [pendingOn, setPendingOn] = useState(on)
  const [pendingDirect, setPendingDirect] = useState<string[]>([])
  const [filter, setFilter] = useState('')

  const pick = (t: TemplateInfo) => { setTplId(t.id); setColorId(t.color); setPage(TEMPLATE_CATEGORIES.indexOf(t.category)) }
  const pageTemplates = TEMPLATES.filter((t) => t.category === TEMPLATE_CATEGORIES[page])
  const s: DocState = { tpl, colorId, on, extras, company: company.trim() || 'Tên công ty', title, desc, colHeads, roles, bodies, etcTitles }
  const set: DocSetters = {
    title: setTitle, desc: setDesc, colHeads: setColHeads, roles: setRoles,
    body: (k, v) => setBodies((b) => ({ ...b, [k]: v })),
    etcTitle: (k, v) => setEtcTitles((t) => ({ ...t, [k]: v })),
    remove: (k) => setOn((o) => ({ ...o, [k]: false })),
  }
  // '현재 입력한 조건으로 상세모집요강에 적용하기'(확인 없이 바로): 모집부문 업무칸 + 근무·지원·접수·담당자 칸을 이름표로 채운다. 제목·급여는 넣지 않는다.
  // 알바몬 확인: 공고제목이 사진 위 제목으로 들어가고(평소에는 따로), 모집분야가 있으면 표 줄 이름이 된다.
  const applyForm = () => {
    setTitle(outer.title)
    setRoles((rs) => outer.roles.length ? outer.roles.map((name) => ({ name, duties: ROLE_DUTY_DEFAULT })) : rs.map((r) => ({ ...r, duties: ROLE_DUTY_DEFAULT })))
    setBodies((b) => ({ ...b, work: bodyFromForm('work', outer), support: bodyFromForm('support', outer), apply: bodyFromForm('apply', outer), contact: bodyFromForm('contact', outer) }))
    setVersion((v) => v + 1)
  }
  // 탭 이동(알바몬과 같은 확인 문구). 간편! 템플릿으로 돌아오면 처음 상태에 바깥 조건이 채워지고, 직접입력은 빈 칸에서 시작한다.
  const goTab = (next: Tab) => {
    if (next === tab) return
    if (!window.confirm(`Khi chuyển sang tab ${TAB_NAME[next]}, nội dung đã nhập ở tab ${TAB_NAME[tab]} sẽ không được áp dụng. Bạn có muốn chuyển không?`)) return
    if (next === 'template') {
      setOn(startOn()); setExtras([]); setTitle(''); setDesc(''); setColHeads(['Vị trí tuyển dụng', 'Công việc và yêu cầu'])
      setRoles([{ name: '', duties: ROLE_DUTY_DEFAULT }, { name: '', duties: ROLE_DUTY_DEFAULT }])
      setBodies({ ...emptyBodies(), work: bodyFromForm('work', outer), support: bodyFromForm('support', outer), apply: bodyFromForm('apply', outer), contact: bodyFromForm('contact', outer) })
      setEtcTitles({ etc1: '', etc2: '', etc3: '', etc4: '' }); setVersion((v) => v + 1)
    } else setDirectText('')
    setTab(next)
  }
  const addItem = () => { const next = ETC_KEYS.find((k) => !extras.includes(k)); if (next) setExtras([...extras, next]) }
  const preview = (mobile: boolean) => {
    const html = renderToStaticMarkup(tab === 'direct'
      ? <div className={`amt-pvd${mobile ? ' amt-pvd--m' : ''}`} dangerouslySetInnerHTML={{ __html: cleanHtml(directText) }} />
      : <Preview s={s} mobile={mobile} />)
    if (!openPreview(html, mobile)) setModal(mobile ? 'mobile' : 'pc')
  }
  // B안: 내용이 바뀔 때마다 결과 모양을 위로 넘긴다(직접입력 탭은 정리한 HTML)
  const docHtml = tab === 'direct' ? cleanHtml(directText) : renderToStaticMarkup(<Preview s={s} />)
  useEffect(() => { onHtml?.(docHtml) }, [docHtml, onHtml])
  // 공고 등록 화면 오른쪽 상자·아래 줄의 '미리보기'가 보내는 신호
  const previewRef = useRef(preview)
  previewRef.current = preview
  useEffect(() => {
    const h = (e: Event) => previewRef.current(!!(e as CustomEvent<{ mobile?: boolean }>).detail?.mobile)
    window.addEventListener('amt:preview', h)
    return () => window.removeEventListener('amt:preview', h)
  }, [])
  const openAll = () => { setPending(tplId); setFilter(''); setModal('all') }
  const itemSummary = () => {
    const names = ALL_KEYS.filter((k) => on[k] && (!k.startsWith('etc') || extras.includes(k as EtcKey))).map((k) => ITEM_LABEL[k])
    return names.length > 2 ? `${names.slice(0, 2).join(', ')} và ${names.length - 2} mục khác` : names.join(', ')
  }
  const openSheet = (k: 'tpl' | 'color' | 'items' | 'direct') => {
    setPending(tplId); setFilter(''); setPendingColor(colorId); setPendingOn(on); setPendingDirect([]); setSheet(k)
  }
  const saveSheet = () => {
    if (sheet === 'tpl') { const t = TEMPLATES.find((x) => x.id === pending); if (t) pick(t) }
    if (sheet === 'color') setColorId(pendingColor)
    if (sheet === 'items') { setOn(pendingOn); setExtras(ETC_KEYS.filter((k) => pendingOn[k])) }
    if (sheet === 'direct') setDirectText((d) => d + DIRECT_KEYS.filter((k) => pendingDirect.includes(k)).map((k) => DIRECT_BLOCK[k]).join(''))
    setSheet(null)
  }
  const filtered = TEMPLATES.filter((t) => !filter || t.category === filter)

  const PreviewIcons = () => (
    <div className="amt-side__pv">
      <div className="amt-side__h">Xem trước mô tả</div>
      <div className="amt-previews">
        <button type="button" onClick={() => preview(false)}>
          <svg width="36" height="32" viewBox="0 0 36 32" aria-hidden><rect x="1" y="1" width="34" height="22" rx="1" fill="#e8e8e8" stroke="#9e9e9e" strokeWidth="1.5" /><path d="M13 11l4 4 6-7" fill="none" stroke="#fff" strokeWidth="2" /><path d="M18 23v5M10 30h16" stroke="#9e9e9e" strokeWidth="2" /></svg>
          PC
        </button>
        <button type="button" onClick={() => preview(true)}>
          <svg width="22" height="32" viewBox="0 0 22 32" aria-hidden><rect x="1" y="1" width="20" height="30" rx="3" fill="none" stroke="#9e9e9e" strokeWidth="1.5" /><path d="M6 15l4 4 6-7" fill="none" stroke="#9e9e9e" strokeWidth="1.6" /></svg>
          Mobile
        </button>
      </div>
    </div>
  )

  return (
    <div className="amt amt--embed">
      <div className="amt-apply">
        <button type="button" className="amt-apply__btn" onClick={applyForm}>
          <Chevrons /><span><small>Áp dụng các điều kiện đã nhập</small><b>vào mô tả chi tiết tuyển dụng</b></span><Chevrons />
        </button>
      </div>

      <div className="amt-head">
        <h2>Mô tả chi tiết tuyển dụng</h2>
        <button type="button" className="amt-head__toggle" aria-expanded={notice} onClick={() => setNotice(!notice)}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden><path d="M2 7h3l7-4v12l-7-4H2z" fill="#ffb21b" /><path d="M5 11l1.5 4" stroke="#ffb21b" strokeWidth="2" /></svg>
          Hãy đọc lưu ý trước khi viết mô tả!
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden style={{ transform: notice ? 'none' : 'rotate(180deg)' }}><path d="M2 8l4-4 4 4" fill="none" stroke="#333" strokeWidth="1.3" /></svg>
        </button>
      </div>
      {notice && (
        <ul className="amt-notice">
          <li>Nếu ghi lương thấp hơn lương tối thiểu hoặc giới hạn độ tuổi/giới tính, tin có thể bị xóa.</li>
          <li>Khi đính kèm liên kết tệp, hãy dùng <b>liên kết bắt đầu bằng ‘https’</b>.</li>
          <li><b>Người đăng chịu trách nhiệm về bản quyền và tính xác thực của hình ảnh, video đăng tải; Việc gần Bạn không chịu trách nhiệm về việc này.</b></li>
        </ul>
      )}

      <div className="amt-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'template'} className={`amt-tab${tab === 'template' ? ' amt-tab--on' : ''}`} onClick={() => goTab('template')}>Mẫu nhanh!</button>
        <button type="button" role="tab" aria-selected={false} className="amt-tab" disabled>Trình soạn thảo<small>Đang chuẩn bị</small></button>
        <button type="button" role="tab" aria-selected={tab === 'direct'} className={`amt-tab${tab === 'direct' ? ' amt-tab--on' : ''}`} onClick={() => goTab('direct')}>Nhập trực tiếp</button>
      </div>
      <div className="amt-tabline" />

      {tab === 'template' ? (
        <>
          {/* 모바일: 설정 줄 3개(누르면 아래 창) */}
          <div className="amt-rows">
            <button type="button" className="amt-row" onClick={() => openSheet('tpl')}>
              <span className="amt-row__ic" style={{ background: '#8fd3c3' }} />Chọn mẫu<span className="amt-row__val amt-row__val--blue">{tpl.name}</span><Arrow dir="r" color="#9e9e9e" />
            </button>
            <button type="button" className="amt-row" onClick={() => openSheet('color')}>
              <span className="amt-row__ic" style={{ background: '#ffcf5a' }} />Chọn màu<span className="amt-row__val"><span className="amt-row__dot" style={{ background: colorOf(colorId).dot }} /></span><Arrow dir="r" color="#9e9e9e" />
            </button>
            <button type="button" className="amt-row" onClick={() => openSheet('items')}>
              <span className="amt-row__ic" style={{ background: '#9ad08f' }} />Chọn mục<span className="amt-row__val amt-row__val--blue">{itemSummary()}</span><Arrow dir="r" color="#9e9e9e" />
            </button>
          </div>

          <div className="amt-body">
            <aside className="amt-side">
              <div className="amt-side__h">Chọn mẫu
                <button type="button" className="amt-side__all" onClick={openAll}>Xem tất cả<Arrow dir="r" /></button>
              </div>
              <div className="amt-thumbs">
                {pageTemplates.map((t) => <Thumb key={t.id} t={t} on={t.id === tplId} onPick={() => pick(t)} />)}
              </div>
              <div className="amt-pager">
                <button type="button" aria-label="Trước" disabled={page === 0} onClick={() => setPage(page - 1)}><Arrow dir="l" /></button>
                <span><b>{page + 1}</b> / {TEMPLATE_CATEGORIES.length}</span>
                <button type="button" aria-label="Sau" disabled={page === TEMPLATE_CATEGORIES.length - 1} onClick={() => setPage(page + 1)}><Arrow dir="r" /></button>
              </div>

              <div className="amt-side__sec">
                <div className="amt-side__h">Chọn màu</div>
                <div className="amt-colors">
                  {TEMPLATE_COLORS.map((c) => (
                    <button type="button" key={c.id} aria-label={c.name} aria-pressed={c.id === colorId} className="amt-color" style={{ background: c.dot }} onClick={() => setColorId(c.id)}>
                      {c.id === colorId && <span className="amt-color__check"><Check size={16} /></span>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="amt-side__sec">
                <div className="amt-side__h">Chọn mục</div>
                <div className="amt-items">
                  {[...BASE_KEYS, ...extras].map((k) => (
                    <button type="button" key={k} aria-pressed={on[k]} className={`amt-item${on[k] ? ' amt-item--on' : ''}`} onClick={() => setOn({ ...on, [k]: !on[k] })}>{ITEM_LABEL[k]}</button>
                  ))}
                  {extras.length < ETC_KEYS.length && <button type="button" className="amt-item amt-item--add" onClick={addItem}>Thêm mục<span aria-hidden>+</span></button>}
                </div>
              </div>
              <PreviewIcons />
            </aside>

            <div className="amt-area">
              <DocEdit s={s} set={set} version={version} />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="amt-rows">
            <button type="button" className="amt-row" onClick={() => openSheet('direct')}>
              <span className="amt-row__ic" style={{ background: '#9ad08f' }} />Chọn mục<span className="amt-row__val" /><Arrow dir="r" color="#9e9e9e" />
            </button>
          </div>
          <div className="amt-body amt-body--direct">
            <aside className="amt-side">
              <div className="amt-side__h">Chọn mục</div>
              <div className="amt-items" style={{ marginTop: 16 }}>
                {DIRECT_KEYS.map((k) => (
                  <button type="button" key={k} className="amt-item amt-item--ins" onClick={() => setDirectText((d) => d + DIRECT_BLOCK[k])}>{ITEM_LABEL[k]}<span aria-hidden>+</span></button>
                ))}
              </div>
              <PreviewIcons />
            </aside>
            <div className="amt-direct">
              <textarea className="amt-direct__text" value={directText} placeholder="Nhập nội dung" onChange={(e) => setDirectText(e.target.value)} />
            </div>
          </div>
        </>
      )}

      {/* 모바일: 미리보기 버튼 */}
      <button type="button" className="amt-mpv" onClick={() => preview(true)}>Xem trước mô tả chi tiết</button>

      {modal && (
        <div className="amt-modal" role="dialog" aria-modal onClick={(e) => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className={`amt-modal__box${modal === 'mobile' ? ' amt-modal__box--m' : ''}`}>
            <div className="amt-modal__h">
              {modal === 'all' ? 'Chọn kiểu' : modal === 'pc' ? 'Xem trước PC' : 'Xem trước Mobile'}
              <button type="button" aria-label="Đóng" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="amt-modal__body">
              {modal === 'all' ? (
                <>
                  <div className="amt-all__top">
                    <p>Mẫu theo ngành nghề<span>(Tổng {TEMPLATES.length} mẫu)</span></p>
                    <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Ngành nghề">
                      <option value="">Tất cả</option>
                      {TEMPLATE_CATEGORIES.slice(1).map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <TypeGrid list={filtered} pending={pending} setPending={setPending} onZoom={setZoom} />
                </>
              ) : tab === 'direct'
                ? <div className={`amt-pvd${modal === 'mobile' ? ' amt-pvd--m' : ''}`} dangerouslySetInnerHTML={{ __html: cleanHtml(directText) }} />
                : <Preview s={s} mobile={modal === 'mobile'} />}
            </div>
            {modal === 'all' && (
              <div className="amt-modal__foot">
                <button type="button" className="amt-btn-line" onClick={() => setModal(null)}>Hủy</button>
                <button type="button" className="amt-btn-main" onClick={() => { const t = TEMPLATES.find((x) => x.id === pending); if (t) pick(t); setModal(null) }}>Xác nhận</button>
              </div>
            )}
          </div>
        </div>
      )}

      {zoom && (
        <div className="amt-modal amt-modal--top" role="dialog" aria-modal onClick={(e) => { if (e.target === e.currentTarget) setZoom(null) }}>
          <div className="amt-modal__box amt-modal__box--zoom">
            <div className="amt-modal__h">{zoom.name}<button type="button" aria-label="Đóng" onClick={() => setZoom(null)}>×</button></div>
            <div className="amt-modal__body amt-modal__body--white"><Preview s={sampleState(zoom)} /></div>
          </div>
        </div>
      )}

      {sheet && (
        <div className="amt-sheet" role="dialog" aria-modal onClick={(e) => { if (e.target === e.currentTarget) setSheet(null) }}>
          <div className="amt-sheet__box">
            <div className="amt-sheet__h">{sheet === 'tpl' ? 'Chọn mẫu' : sheet === 'color' ? 'Chọn màu' : 'Chọn mục'}
              <button type="button" aria-label="Đóng" onClick={() => setSheet(null)}>×</button>
            </div>
            <div className="amt-sheet__body">
              {sheet === 'tpl' && (
                <>
                  <div className="amt-all__top amt-all__top--m"><p>Mẫu theo ngành nghề</p><span>Tổng {TEMPLATES.length}</span></div>
                  <div className="amt-chips">
                    {['', ...TEMPLATE_CATEGORIES.slice(1)].map((c) => (
                      <button type="button" key={c || 'all'} className={`amt-chip${filter === c ? ' amt-chip--on' : ''}`} onClick={() => setFilter(c)}>{c || 'Tất cả'}</button>
                    ))}
                  </div>
                  <TypeGrid list={filtered} pending={pending} setPending={setPending} onZoom={setZoom} />
                </>
              )}
              {sheet === 'color' && (
                <div className="amt-colors amt-colors--m">
                  {TEMPLATE_COLORS.map((c) => (
                    <button type="button" key={c.id} aria-label={c.name} aria-pressed={c.id === pendingColor} className="amt-color" style={{ background: c.dot }} onClick={() => setPendingColor(c.id)}>
                      {c.id === pendingColor && <span className="amt-color__check"><Check size={16} /></span>}
                    </button>
                  ))}
                </div>
              )}
              {sheet === 'items' && (
                <div className="amt-pills">
                  {ALL_KEYS.map((k) => (
                    <button type="button" key={k} aria-pressed={pendingOn[k]} className={`amt-pill${pendingOn[k] ? ' amt-pill--on' : ''}`} onClick={() => setPendingOn({ ...pendingOn, [k]: !pendingOn[k] })}>{ITEM_LABEL[k]}</button>
                  ))}
                </div>
              )}
              {sheet === 'direct' && (
                <div className="amt-pills">
                  {DIRECT_KEYS.map((k) => (
                    <button type="button" key={k} aria-pressed={pendingDirect.includes(k)} className={`amt-pill${pendingDirect.includes(k) ? ' amt-pill--on' : ''}`} onClick={() => setPendingDirect(pendingDirect.includes(k) ? pendingDirect.filter((x) => x !== k) : [...pendingDirect, k])}>{ITEM_LABEL[k]}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="amt-sheet__foot"><button type="button" className="amt-btn-main" onClick={saveSheet}>Lưu</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
