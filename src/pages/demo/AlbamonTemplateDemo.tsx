// 알바몬 기업회원 공고등록 '상세모집요강 > 간편! 템플릿' 그대로 따라 한 데모 — Lee 2026-11-08.
// 배치·크기·동작은 알바몬 화면에서 직접 잰 값(AlbamonTemplateDemo.css). 저장 없음. 에디터 탭은 보류(패키지 설치 허용 전).
// 바꾼 것: 글자는 베트남어, 사진은 우리 업종 사진(없으면 회색 '사진 준비 중'), 위아래 로고는 우리 로고, 알바몬 전용(꿀팁 마스코트) 뺌.
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  TEMPLATES, TEMPLATE_CATEGORIES, TEMPLATE_COLORS, SECTION_LABEL, colorOf, type SectionKey, type TemplateInfo,
} from '../../lib/albamonTemplate'
import './AlbamonTemplateDemo.css'

type BodyKey = Exclude<SectionKey, 'logo' | 'roles'>
type EtcKey = 'etc1' | 'etc2' | 'etc3' | 'etc4'
const ETC_KEYS: EtcKey[] = ['etc1', 'etc2', 'etc3', 'etc4']
const BASE_KEYS: SectionKey[] = ['logo', 'roles', 'work', 'support', 'apply', 'contact']
// 왼쪽 항목 버튼(97px 칸)에 들어가는 짧은 이름
const ITEM_LABEL: Record<SectionKey, string> = {
  logo: 'Logo', roles: 'Vị trí', work: 'Điều kiện', support: 'Yêu cầu', apply: 'Ứng tuyển', contact: 'Liên hệ',
  etc1: 'Khác 1', etc2: 'Khác 2', etc3: 'Khác 3', etc4: 'Khác 4',
}
const PH = 'Nhập nội dung'
// CKEditor 기본 글자색 15가지(알바몬 글자 색깔 메뉴와 같은 편집기)
const TEXT_COLORS = ['#000000', '#4d4d4d', '#999999', '#e6e6e6', '#ffffff', '#e64d4d', '#e6994d', '#e6e64d', '#99e64d', '#4de64d', '#4de699', '#4de6e6', '#4d99e6', '#4d4de6', '#994de6']
interface Role { name: string; duties: string }

const Check = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="12" fill="#ff501b" /><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const Arrow = ({ dir }: { dir: 'l' | 'r' }) => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden><path d={dir === 'r' ? 'M7 4l5 5-5 5' : 'M11 4L6 9l5 5'} fill="none" stroke="#6a6a6a" strokeWidth="1.5" /></svg>
)
const Caret = () => <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><path d="M2 3.5l3 3 3-3" fill="none" stroke="#333" strokeWidth="1.3" /></svg>

// 항목 글 상자: 도구줄(굵게·목록·글자색) + 글칸. 입력 중 커서가 사라지지 않게 처음 한 번만 내용을 넣는다.
function TextBox({ html, onChange }: { html: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<'list' | 'color' | null>(null)
  useLayoutEffect(() => { if (ref.current) ref.current.innerHTML = html }, [])
  const emit = () => { const el = ref.current; if (!el) return; if (el.innerHTML === '<br>') el.innerHTML = ''; onChange(el.innerHTML) }
  const cmd = (name: string, value?: string) => { ref.current?.focus(); document.execCommand(name, false, value); emit() }
  const listStyle = (style: string) => {
    ref.current?.focus()
    const sel = window.getSelection()
    let node: Node | null = sel?.anchorNode ?? null
    while (node && node !== ref.current && !(node instanceof HTMLUListElement)) node = node.parentNode
    if (!(node instanceof HTMLUListElement)) { document.execCommand('insertUnorderedList'); node = window.getSelection()?.anchorNode ?? null; while (node && node !== ref.current && !(node instanceof HTMLUListElement)) node = node.parentNode }
    if (node instanceof HTMLUListElement) node.style.listStyleType = style
    setMenu(null); emit()
  }
  return (
    <div className="amt-ed">
      <div className="amt-ed__bar">
        <button type="button" className="amt-ed__btn" title="In đậm (Ctrl+B)" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('bold')}><b>B</b></button>
        <button type="button" className="amt-ed__btn" title="Danh sách" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('insertUnorderedList')}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden><circle cx="3" cy="5" r="1.3" /><circle cx="3" cy="9" r="1.3" /><circle cx="3" cy="13" r="1.3" /><path d="M7 5h9M7 9h9M7 13h9" stroke="#333" strokeWidth="1.4" /></svg>
        </button>
        <button type="button" className="amt-ed__btn" title="Kiểu danh sách" onMouseDown={(e) => e.preventDefault()} onClick={() => setMenu(menu === 'list' ? null : 'list')}><Caret /></button>
        <button type="button" className="amt-ed__btn" title="Màu chữ" onMouseDown={(e) => e.preventDefault()} onClick={() => setMenu(menu === 'color' ? null : 'color')}>
          <span style={{ textDecoration: 'underline', fontWeight: 600 }}>A</span><Caret />
        </button>
        {menu === 'list' && (
          <div className="amt-ed__menu" style={{ left: 60 }}>
            {[['disc', '●'], ['circle', '○'], ['square', '■']].map(([s, t]) => (
              <button type="button" key={s} style={{ width: 32, height: 32 }} onMouseDown={(e) => e.preventDefault()} onClick={() => listStyle(s)}>{t}</button>
            ))}
          </div>
        )}
        {menu === 'color' && (
          <div className="amt-ed__menu amt-ed__menu--colors" style={{ left: 110 }}>
            {TEXT_COLORS.map((c) => (
              <button type="button" key={c} className="amt-ed__sw" style={{ background: c }} aria-label={c} onMouseDown={(e) => e.preventDefault()} onClick={() => { cmd('foreColor', c); setMenu(null) }} />
            ))}
            <button type="button" style={{ width: '100%', height: 28, fontSize: 12 }} onMouseDown={(e) => e.preventDefault()} onClick={() => { cmd('removeFormat'); setMenu(null) }}>Bỏ màu</button>
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

// 미리보기·직접입력 가져오기용(입력칸 없이 결과만)
function DocView({ s, mobile }: { s: DocState; mobile?: boolean }) {
  const c = colorOf(s.colorId)
  const vars = { '--amt-bar': c.bar, '--amt-head': c.head } as CSSProperties
  const tc = s.tpl.darkTitle ? 'amt-c1' : 'amt-c2'
  return (
    <div className={`amt-preview${mobile ? ' amt-preview--m' : ''}`} style={vars}>
      <div className="amt-doc">
        <div className="amt-blogo"><img src="/logo.png" alt="Viecganban" /></div>
        <div className="amt-top">
          <div className="amt-visual">
            {s.tpl.photo ? <img className="amt-visual__img" src={s.tpl.photo} alt="" /> : <div className="amt-visual__none">Ảnh đang chuẩn bị</div>}
            {s.on.logo && <p className={`amt-visual__company ${tc}`}>{s.company}</p>}
            <div className={`amt-visual__title ${tc}`}><h2>{s.title}</h2></div>
          </div>
          {s.desc.trim() && <div className="amt-desc"><p>{s.desc}</p></div>}
        </div>
        {shownKeys(s).map((k) => (
          <section className="amt-sec" key={k}>
            <div className="amt-sec__tit">{k.startsWith('etc') ? s.etcTitles[k as EtcKey] : SECTION_LABEL[k]}</div>
            <div className="amt-wp">
              {k === 'roles' ? (
                <table className="amt-tbl amt-tbl--view">
                  <thead><tr><th>{s.colHeads[0]}</th><th>{s.colHeads[1]}</th></tr></thead>
                  <tbody>{s.roles.filter((r) => r.name || r.duties).map((r, i) => <tr key={i}><td style={{ textAlign: 'center' }}>{r.name}</td><td>{r.duties}</td></tr>)}</tbody>
                </table>
              ) : <div className="amt-view" dangerouslySetInnerHTML={{ __html: s.bodies[k as BodyKey] }} />}
            </div>
          </section>
        ))}
        <div className="amt-blogo"><img src="/logo.png" alt="Viecganban" /></div>
      </div>
    </div>
  )
}

// 작성 화면(알바몬 tempArea)
function DocEdit({ s, set }: { s: DocState; set: DocSetters }) {
  const c = colorOf(s.colorId)
  const vars = { '--amt-bar': c.bar, '--amt-head': c.head } as CSSProperties
  const tc = s.tpl.darkTitle ? 'amt-c1' : 'amt-c2'
  const grow = (el: HTMLTextAreaElement) => { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` }
  return (
    <div className="amt-doc" style={vars}>
      <div className="amt-blogo"><img src="/logo.png" alt="Viecganban" /></div>
      <div className="amt-top">
        <div className="amt-visual">
          {s.tpl.photo ? <img className="amt-visual__img" src={s.tpl.photo} alt="" /> : <div className="amt-visual__none">Ảnh đang chuẩn bị</div>}
          {s.on.logo && <p className={`amt-visual__company ${tc}`}>{s.company}</p>}
          <div className={`amt-visual__title ${tc}`}>
            <textarea rows={1} value={s.title} placeholder="Nhập tiêu đề tuyển dụng" ref={(el) => { if (el) grow(el) }} onChange={(e) => { set.title(e.target.value); grow(e.target) }} />
          </div>
        </div>
        <div className="amt-desc">
          <p className="amt-desc__h" style={{ margin: 0 }}>Giới thiệu công ty và mô tả thêm công việc<span>(Không bắt buộc)</span></p>
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
                      <th><input value={s.colHeads[0]} onChange={(e) => set.colHeads([e.target.value, s.colHeads[1]])} /></th>
                      <th><input value={s.colHeads[1]} onChange={(e) => set.colHeads([s.colHeads[0], e.target.value])} /></th>
                    </tr></thead>
                    <tbody>
                      {s.roles.map((r, i) => (
                        <tr key={i}>
                          <td><textarea value={r.name} placeholder={PH} onChange={(e) => set.roles(s.roles.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /></td>
                          <td>
                            <textarea value={r.duties} placeholder={`• ${PH}`} onChange={(e) => set.roles(s.roles.map((x, j) => j === i ? { ...x, duties: e.target.value } : x))} />
                            {s.roles.length > 1 && <button type="button" className="amt-tbl__del" aria-label="Xóa dòng" onClick={() => set.roles(s.roles.filter((_, j) => j !== i))}>×</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="amt-addrow"><button type="button" onClick={() => set.roles([...s.roles, { name: '', duties: '' }])}>+ Thêm dòng</button></div>
                </>
              ) : <TextBox key={k} html={s.bodies[k as BodyKey]} onChange={(v) => set.body(k as BodyKey, v)} />}
            </div>
          </section>
        )
      })}
      <div className="amt-blogo"><img src="/logo.png" alt="Viecganban" /></div>
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

// 직접입력 HTML 정리: 실행되는 것(스크립트·틀·이벤트·javascript: 주소)은 지운다.
function cleanHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  doc.querySelectorAll('script,iframe,object,embed,link,meta,style,form,base').forEach((el) => el.remove())
  doc.querySelectorAll('*').forEach((el) => {
    for (const a of Array.from(el.attributes)) {
      const v = a.value.trim().toLowerCase()
      if (a.name.startsWith('on') || ((a.name === 'href' || a.name === 'src') && (v.startsWith('javascript:') || v.startsWith('data:text')))) el.removeAttribute(a.name)
    }
  })
  return doc.body.firstElementChild?.innerHTML ?? ''
}

export default function AlbamonTemplateDemo() {
  const [tplId, setTplId] = useState(41)
  const tpl = TEMPLATES.find((t) => t.id === tplId) ?? TEMPLATES[0]
  const [colorId, setColorId] = useState(tpl.color)
  const [page, setPage] = useState(0)
  const [on, setOn] = useState<Record<SectionKey, boolean>>({
    logo: true, roles: true, work: true, support: true, apply: true, contact: false, etc1: false, etc2: false, etc3: false, etc4: false,
  })
  const [extras, setExtras] = useState<EtcKey[]>([])
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [colHeads, setColHeads] = useState<[string, string]>(['Vị trí tuyển dụng', 'Công việc và yêu cầu'])
  const [roles, setRoles] = useState<Role[]>([{ name: '', duties: '' }, { name: '', duties: '' }])
  const [bodies, setBodies] = useState<Record<BodyKey, string>>({ work: '', support: '', apply: '', contact: '', etc1: '', etc2: '', etc3: '', etc4: '' })
  const [etcTitles, setEtcTitles] = useState<Record<EtcKey, string>>({ etc1: '', etc2: '', etc3: '', etc4: '' })
  const [modal, setModal] = useState<'all' | 'pc' | 'mobile' | null>(null)
  const [pending, setPending] = useState(tplId)
  const [filter, setFilter] = useState('')
  const [tab, setTab] = useState<'template' | 'direct'>('template')
  const [directHtml, setDirectHtml] = useState('')

  const pick = (t: TemplateInfo) => { setTplId(t.id); setColorId(t.color); setPage(TEMPLATE_CATEGORIES.indexOf(t.category)) }
  const pageTemplates = TEMPLATES.filter((t) => t.category === TEMPLATE_CATEGORIES[page])
  const s: DocState = { tpl, colorId, on, extras, company: 'Công ty mẫu', title, desc, colHeads, roles, bodies, etcTitles }
  const set: DocSetters = {
    title: setTitle, desc: setDesc, colHeads: setColHeads, roles: setRoles,
    body: (k, v) => setBodies((b) => ({ ...b, [k]: v })),
    etcTitle: (k, v) => setEtcTitles((t) => ({ ...t, [k]: v })),
    remove: (k) => setOn((o) => ({ ...o, [k]: false })),
  }
  const addItem = () => { const next = ETC_KEYS.find((k) => !extras.includes(k)); if (next) setExtras([...extras, next]) }
  const importTemplate = () => {
    if (directHtml.trim() && !window.confirm('Nội dung đang nhập sẽ bị thay bằng mẫu hiện tại. Tiếp tục?')) return
    setDirectHtml(renderToStaticMarkup(<DocView s={s} />))
  }

  return (
    <div className="amt">
      <h1 className="amt__title">Mô tả chi tiết tuyển dụng</h1>
      <p className="amt__lead">Bản demo theo mẫu Albamon — chưa lưu dữ liệu.</p>

      <div className="amt-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'template'} className={`amt-tab${tab === 'template' ? ' amt-tab--on' : ''}`} onClick={() => setTab('template')}>Mẫu nhanh!</button>
        <button type="button" role="tab" aria-selected={false} className="amt-tab" disabled>Trình soạn thảo<small>Đang chuẩn bị</small></button>
        <button type="button" role="tab" aria-selected={tab === 'direct'} className={`amt-tab${tab === 'direct' ? ' amt-tab--on' : ''}`} onClick={() => setTab('direct')}>Nhập trực tiếp</button>
      </div>
      <div className="amt-tabline" />

      {tab === 'direct' ? (
        <div className="amt-direct">
          <div className="amt-direct__bar">
            <span>Nhập trực tiếp nội dung (có thể dùng HTML).</span>
            <div className="amt-direct__btns">
              <button type="button" onClick={importTemplate}>Lấy nội dung từ mẫu hiện tại</button>
              <button type="button" onClick={() => setModal('pc')}>Xem trước PC</button>
              <button type="button" onClick={() => setModal('mobile')}>Xem trước Mobile</button>
            </div>
          </div>
          <textarea className="amt-direct__text" value={directHtml} onChange={(e) => setDirectHtml(e.target.value)} placeholder="Nhập mô tả chi tiết tuyển dụng" />
        </div>
      ) : (
        <div className="amt-body">
          <aside className="amt-side">
            <div className="amt-side__h">Chọn mẫu
              <button type="button" className="amt-side__all" onClick={() => { setPending(tplId); setFilter(''); setModal('all') }}>Xem tất cả<Arrow dir="r" /></button>
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
                <button type="button" className="amt-item amt-item--add" disabled={extras.length >= ETC_KEYS.length} onClick={addItem}>Thêm mục<span aria-hidden>+</span></button>
              </div>
            </div>

            <div className="amt-side__line" />
            <div className="amt-side__sec" style={{ marginTop: 24 }}>
              <div className="amt-side__h">Xem trước mô tả</div>
              <div className="amt-previews">
                <button type="button" onClick={() => setModal('pc')}>
                  <svg width="36" height="32" viewBox="0 0 36 32" aria-hidden><rect x="1" y="1" width="34" height="22" rx="1" fill="#e8e8e8" stroke="#9e9e9e" strokeWidth="1.5" /><path d="M13 11l4 4 6-7" fill="none" stroke="#fff" strokeWidth="2" /><path d="M18 23v5M10 30h16" stroke="#9e9e9e" strokeWidth="2" /></svg>
                  PC
                </button>
                <button type="button" onClick={() => setModal('mobile')}>
                  <svg width="22" height="32" viewBox="0 0 22 32" aria-hidden><rect x="1" y="1" width="20" height="30" rx="3" fill="none" stroke="#9e9e9e" strokeWidth="1.5" /><path d="M6 15l4 4 6-7" fill="none" stroke="#9e9e9e" strokeWidth="1.6" /></svg>
                  Mobile
                </button>
              </div>
            </div>
          </aside>

          <div className="amt-area">
            <DocEdit s={s} set={set} />
          </div>
        </div>
      )}

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
                      {TEMPLATE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="amt-all__grid">
                    {TEMPLATES.filter((t) => !filter || t.category === filter).map((t) => (
                      <button type="button" key={t.id} className={`amt-all__it${t.id === pending ? ' amt-all__it--on' : ''}`} onClick={() => setPending(t.id)}>
                        <span className="amt-all__img">
                          {t.photo ? <img src={t.photo} alt="" loading="lazy" /> : <span className="amt-thumb__none">Ảnh đang chuẩn bị</span>}
                          {t.id === pending && <span className="amt-all__on"><svg width="28" height="28" viewBox="0 0 24 24" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" strokeWidth="2.4" /></svg></span>}
                        </span>
                        <span className="amt-all__name">{t.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : tab === 'direct'
                ? <div className="amt-free" dangerouslySetInnerHTML={{ __html: cleanHtml(directHtml) || '<p>Chưa có nội dung.</p>' }} />
                : <DocView s={s} mobile={modal === 'mobile'} />}
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
    </div>
  )
}
