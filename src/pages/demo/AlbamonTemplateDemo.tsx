// 알바몬 기업회원 '간편! 템플릿'(상세모집요강 작성기) 그대로 따라 한 데모 — Lee 2026-11-08.
// 데모 전용 화면(저장 없음). 에디터·직접입력 탭은 보류(패키지 설치 허용 전). 한국 전용 항목은 넣지 않는다.
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import {
  TEMPLATES, TEMPLATE_CATEGORIES, TEMPLATE_COLORS, SECTION_LABEL, SECTION_ORDER, ROLE_DUTY_DEFAULT,
  bodyFromForm, colorOf, type OuterForm, type SectionKey, type TemplateInfo,
} from '../../lib/albamonTemplate'
import './AlbamonTemplateDemo.css'

type BodyKey = Exclude<SectionKey, 'logo' | 'roles'>
type EtcKey = 'etc1' | 'etc2' | 'etc3' | 'etc4'
const ETC_KEYS: EtcKey[] = ['etc1', 'etc2', 'etc3', 'etc4']
interface Role { name: string; duties: string }

// 데모용 바깥 입력값(공고 등록 화면에서 이미 입력했다고 가정한 값). 급여는 알바몬처럼 넣지 않는다.
const SAMPLE_FORM: OuterForm = {
  title: 'Tuyển nhân viên phục vụ', roles: ['Phục vụ'], period: 'Dài hạn (trên 1 năm)', days: ['T2', 'T3', 'T4', 'T5', 'T6'],
  start: '08:00', end: '17:00', benefits: 'Bao ăn trưa, BHXH', education: '', preferred: 'Có kinh nghiệm phục vụ',
  applyMethods: 'Gọi điện, Zalo', contactName: 'Chị Lan', contactPhone: '09xx xxx xxx',
}
const EMPTY_FORM: OuterForm = {
  title: '', roles: [], period: '', days: [], start: '', end: '', benefits: '', education: '', preferred: '',
  applyMethods: '', contactName: '', contactPhone: '',
}
const initialBodies = (f: OuterForm): Record<BodyKey, string> => ({
  work: bodyFromForm('work', f), support: bodyFromForm('support', f), apply: bodyFromForm('apply', f), contact: bodyFromForm('contact', f),
  etc1: '<p>Nhập nội dung</p>', etc2: '<p>Nhập nội dung</p>', etc3: '<p>Nhập nội dung</p>', etc4: '<p>Nhập nội dung</p>',
})

// 입력 중 커서가 사라지지 않도록: resetKey가 바뀔 때만 내용을 다시 넣는다.
function Editable({ html, plain, resetKey, onChange, className }: {
  html: string; plain?: boolean; resetKey: string; onChange: (v: string) => void; className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!ref.current) return
    if (plain) ref.current.textContent = html
    else ref.current.innerHTML = html
  }, [resetKey])
  return (
    <div
      ref={ref}
      className={className}
      contentEditable
      suppressContentEditableWarning
      onInput={(e) => onChange(plain ? (e.currentTarget.textContent ?? '') : e.currentTarget.innerHTML)}
    />
  )
}

function Mini({ t, colorId }: { t: TemplateInfo; colorId: number }) {
  const c = colorOf(colorId)
  return (
    <span className="amt-mini">
      {t.photo ? <img src={t.photo} alt="" loading="lazy" /> : <span className="amt-mini__none">Ảnh đang chuẩn bị</span>}
      <span className="amt-mini__bar" style={{ background: c.bar }} />
      <span className={`amt-mini__title amt-mini__title--${t.darkTitle ? 'dark' : 'white'}`}>Tiêu đề tuyển dụng</span>
    </span>
  )
}

interface DocState {
  tpl: TemplateInfo; colorId: number; on: Record<SectionKey, boolean>; extras: EtcKey[]
  company: string; title: string; roles: Role[]; bodies: Record<BodyKey, string>; etcTitles: Record<EtcKey, string>
}

function Doc({ s, edit, mobile, version, set }: {
  s: DocState; edit: boolean; mobile?: boolean; version: number
  set?: { company: (v: string) => void; title: (v: string) => void; roles: (r: Role[]) => void; body: (k: BodyKey, v: string) => void; etcTitle: (k: EtcKey, v: string) => void }
}) {
  const c = colorOf(s.colorId)
  const vars = { '--amt-bar': c.bar, '--amt-head': c.head, '--amt-dot': c.dot } as CSSProperties
  const rk = `${version}`
  const keys = SECTION_ORDER.filter((k) => k !== 'logo' && s.on[k] && (!k.startsWith('etc') || s.extras.includes(k as EtcKey)))
  return (
    <div className={`amt-doc${mobile ? ' amt-doc--mobile' : ''}`} style={vars}>
      <div className="amt-hero">
        {s.tpl.photo ? <img className="amt-hero__img" src={s.tpl.photo} alt="" /> : <div className="amt-hero__none">Ảnh đang chuẩn bị</div>}
        {s.on.logo && <div className="amt-hero__logo">LOGO</div>}
        <div className={`amt-hero__text amt-hero__text--${s.tpl.darkTitle ? 'dark' : 'white'}`}>
          {edit && set ? (
            <>
              <Editable plain className="amt-hero__company" html={s.company} resetKey={rk} onChange={set.company} />
              <Editable plain className="amt-hero__title" html={s.title} resetKey={rk} onChange={set.title} />
            </>
          ) : (
            <>
              <p className="amt-hero__company">{s.company}</p>
              <h2 className="amt-hero__title">{s.title}</h2>
            </>
          )}
        </div>
      </div>
      {keys.map((k) => {
        const isEtc = k.startsWith('etc')
        const heading = isEtc ? s.etcTitles[k as EtcKey] : SECTION_LABEL[k]
        return (
          <section className="amt-sec" key={k}>
            {edit && set && isEtc
              ? <Editable plain className="amt-sec__h" html={heading} resetKey={`${rk}-${k}`} onChange={(v) => set.etcTitle(k as EtcKey, v)} />
              : <h3 className="amt-sec__h">{heading}</h3>}
            {k === 'roles' ? (
              <>
                <table className="amt-table">
                  <thead><tr><th>Vị trí tuyển dụng</th><th>Công việc phụ trách</th></tr></thead>
                  <tbody>
                    {s.roles.map((r, i) => (
                      <tr key={i}>
                        <td>{edit && set ? <input value={r.name} placeholder="Nhập vị trí" onChange={(e) => set.roles(s.roles.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /> : r.name}</td>
                        <td>{edit && set ? <textarea rows={3} value={r.duties} onChange={(e) => set.roles(s.roles.map((x, j) => j === i ? { ...x, duties: e.target.value } : x))} /> : r.duties}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {edit && set && (
                  <div className="amt-row-tools">
                    <button type="button" onClick={() => set.roles([...s.roles, { name: '', duties: ROLE_DUTY_DEFAULT }])}>+ Thêm dòng</button>
                    <button type="button" disabled={s.roles.length < 2} onClick={() => set.roles(s.roles.slice(0, -1))}>− Xóa dòng</button>
                  </div>
                )}
              </>
            ) : edit && set ? (
              <Editable className="amt-sec__body" html={s.bodies[k as BodyKey]} resetKey={`${rk}-${k}`} onChange={(v) => set.body(k as BodyKey, v)} />
            ) : (
              <div className="amt-sec__body" dangerouslySetInnerHTML={{ __html: s.bodies[k as BodyKey] }} />
            )}
          </section>
        )
      })}
    </div>
  )
}

export default function AlbamonTemplateDemo() {
  const [tplId, setTplId] = useState(41)
  const tpl = TEMPLATES.find((t) => t.id === tplId) ?? TEMPLATES[0]
  const [colorId, setColorId] = useState(tpl.color)
  const [page, setPage] = useState(0)
  const [on, setOn] = useState<Record<SectionKey, boolean>>({
    logo: true, roles: true, work: true, support: true, apply: true, contact: false, etc1: true, etc2: true, etc3: true, etc4: true,
  })
  const [extras, setExtras] = useState<EtcKey[]>([])
  const [company, setCompany] = useState('Tên công ty')
  const [title, setTitle] = useState('Nhập tiêu đề tuyển dụng')
  const [roles, setRoles] = useState<Role[]>([{ name: '', duties: ROLE_DUTY_DEFAULT }])
  const [bodies, setBodies] = useState<Record<BodyKey, string>>(() => initialBodies(EMPTY_FORM))
  const [etcTitles, setEtcTitles] = useState<Record<EtcKey, string>>({ etc1: 'Khác 1', etc2: 'Khác 2', etc3: 'Khác 3', etc4: 'Khác 4' })
  const [version, setVersion] = useState(0)
  const [modal, setModal] = useState<'all' | 'pc' | 'mobile' | null>(null)

  const pick = (t: TemplateInfo) => { setTplId(t.id); setColorId(t.color); setPage(TEMPLATE_CATEGORIES.indexOf(t.category)) }
  const pageTemplates = TEMPLATES.filter((t) => t.category === TEMPLATE_CATEGORIES[page])
  const applyForm = () => {
    const f = SAMPLE_FORM
    setTitle(f.title); setRoles(f.roles.map((name) => ({ name, duties: ROLE_DUTY_DEFAULT })))
    setBodies((b) => ({ ...b, work: bodyFromForm('work', f), support: bodyFromForm('support', f), apply: bodyFromForm('apply', f), contact: bodyFromForm('contact', f) }))
    setVersion((v) => v + 1)
  }
  const addExtra = () => {
    const next = ETC_KEYS.find((k) => !extras.includes(k))
    if (next) { setExtras([...extras, next]); setOn((o) => ({ ...o, [next]: true })) }
  }
  const s: DocState = { tpl, colorId, on, extras, company, title, roles, bodies, etcTitles }

  return (
    <div className="amt">
      <h1 className="amt__title">Mô tả chi tiết tuyển dụng</h1>
      <p className="amt__lead">Bản demo theo mẫu Albamon — chưa lưu dữ liệu.</p>

      <div className="amt-tabs" role="tablist">
        <button type="button" role="tab" aria-selected className="amt-tab amt-tab--on">Mẫu nhanh!</button>
        <button type="button" role="tab" aria-selected={false} className="amt-tab" disabled>Trình soạn thảo<small>Đang chuẩn bị</small></button>
        <button type="button" role="tab" aria-selected={false} className="amt-tab" disabled>Nhập trực tiếp<small>Đang chuẩn bị</small></button>
      </div>

      <div className="amt-body">
        <aside className="amt-side">
          <div className="amt-box">
            <div className="amt-box__h">Chọn mẫu <button type="button" className="amt-link" onClick={() => setModal('all')}>Xem tất cả</button></div>
            <div className="amt-pager">
              <button type="button" aria-label="Trước" disabled={page === 0} onClick={() => setPage(page - 1)}>‹</button>
              <span className="amt-pager__name">{TEMPLATE_CATEGORIES[page]}<span className="amt-pager__num">{page + 1}/{TEMPLATE_CATEGORIES.length}</span></span>
              <button type="button" aria-label="Sau" disabled={page === TEMPLATE_CATEGORIES.length - 1} onClick={() => setPage(page + 1)}>›</button>
            </div>
            <div className="amt-thumbs">
              {pageTemplates.map((t) => (
                <button type="button" key={t.id} className={`amt-thumb${t.id === tplId ? ' amt-thumb--on' : ''}`} onClick={() => pick(t)} aria-label={t.name}>
                  <Mini t={t} colorId={t.id === tplId ? colorId : t.color} />
                  <span className="amt-thumb__name">{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="amt-box">
            <div className="amt-box__h">Chọn màu</div>
            <div className="amt-colors">
              {TEMPLATE_COLORS.map((c) => (
                <button type="button" key={c.id} aria-label={c.name} className={`amt-color${c.id === colorId ? ' amt-color--on' : ''}`} style={{ background: c.dot }} onClick={() => setColorId(c.id)} />
              ))}
            </div>
          </div>

          <div className="amt-box">
            <div className="amt-box__h">Chọn mục</div>
            <ul className="amt-checks">
              {SECTION_ORDER.filter((k) => !k.startsWith('etc') || extras.includes(k as EtcKey)).map((k) => (
                <li key={k}>
                  <label><input type="checkbox" checked={on[k]} onChange={(e) => setOn({ ...on, [k]: e.target.checked })} />{k.startsWith('etc') ? etcTitles[k as EtcKey] : SECTION_LABEL[k]}</label>
                  {k.startsWith('etc') && <button type="button" className="amt-del" aria-label="Xóa mục" onClick={() => setExtras(extras.filter((x) => x !== k))}>×</button>}
                </li>
              ))}
            </ul>
            <button type="button" className="amt-add" disabled={extras.length >= ETC_KEYS.length} onClick={addExtra}>+ Thêm mục</button>
          </div>

          <div className="amt-box">
            <div className="amt-box__h">Xem trước</div>
            <div className="amt-previews">
              <button type="button" onClick={() => setModal('pc')}>PC</button>
              <button type="button" onClick={() => setModal('mobile')}>Mobile</button>
            </div>
          </div>
        </aside>

        <main className="amt-main">
          <div className="amt-apply">
            <span>Đưa điều kiện đã nhập ở trên vào mô tả chi tiết (không gồm lương).</span>
            <button type="button" onClick={applyForm}>Áp dụng điều kiện đã nhập</button>
          </div>
          <Doc s={s} edit version={version} set={{
            company: setCompany, title: setTitle, roles: setRoles,
            body: (k, v) => setBodies((b) => ({ ...b, [k]: v })),
            etcTitle: (k, v) => setEtcTitles((t) => ({ ...t, [k]: v })),
          }} />
        </main>
      </div>

      {modal && (
        <div className="amt-modal" role="dialog" aria-modal onClick={(e) => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className={`amt-modal__box${modal === 'mobile' ? ' amt-modal__box--m' : ''}`}>
            <div className="amt-modal__h">
              {modal === 'all' ? 'Tất cả mẫu' : modal === 'pc' ? 'Xem trước PC' : 'Xem trước Mobile'}
              <button type="button" aria-label="Đóng" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="amt-modal__body">
              {modal === 'all' ? TEMPLATE_CATEGORIES.map((cat) => (
                <div key={cat}>
                  <p className="amt-all__cat">{cat}</p>
                  <div className="amt-all__grid">
                    {TEMPLATES.filter((t) => t.category === cat).map((t) => (
                      <button type="button" key={t.id} className={`amt-thumb${t.id === tplId ? ' amt-thumb--on' : ''}`} onClick={() => { pick(t); setModal(null) }} aria-label={t.name}>
                        <Mini t={t} colorId={t.color} />
                        <span className="amt-thumb__name">{t.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )) : <Doc s={s} edit={false} mobile={modal === 'mobile'} version={version} />}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
