import type { ReactNode } from 'react'
import { Banknote, Bus, BedDouble, CalendarCheck, CheckCircle2, ChefHat, ChevronRight, ChartNoAxesColumnIncreasing, ClipboardCheck, Clock, Fuel, Gift, House, Mail, MessageCircle, Package, Phone, Settings, ShieldCheck, Sparkles, Truck, Users, Utensils } from 'lucide-react'
import type { DetailSection } from '../../lib/jobDetailSections'
import { richLineIcon, richProcessSteps, type RichIcon } from '../../lib/detailRich'
import type { DetailBenefit } from './detailModel'

// 상세 ④ 꾸민 본문(웹 DetailRich와 같은 규칙: lib/detailRich의 줄 아이콘·채용 절차·상여 알약). 글·숫자는 원문 그대로, 지어내지 않는다.
const ICONS: Record<RichIcon, typeof Settings> = {
  operate: Settings, pack: Package, check: ClipboardCheck, clean: Sparkles, time: Clock, drive: Truck, cash: Banknote,
  serve: Utensils, cook: ChefHat, people: Users, chat: MessageCircle, mail: Mail, phone: Phone, dot: CheckCircle2,
}
const BENEFIT_ICONS: Record<string, typeof Settings> = { bus: Bus, dorm: BedDouble, meal: Utensils, attendance: CalendarCheck, housing: House, fuel: Fuel, performance: ChartNoAxesColumnIncreasing }

function emphasize(line: string): ReactNode {
  const text = line.replace(/^\s*[-•*]\s+/, '')
  const label = /^([^:：]{2,40})[:：]\s*(.+)$/u.exec(text)
  const money = (s: string) => s.split(/(\d[\d.,]*\s*(?:đ|đồng|vnđ|vnd|k|triệu|tr)\b\.?)/giu).map((p, i) => (i % 2 ? <span key={i} className="app-rich__o">{p}</span> : p))
  return label ? <><span className="app-rich__b">{label[1]}:</span> {money(label[2])}</> : money(text)
}

export default function DetailRich({ periodLabel, salaryText, overtimeNote, pill, sections, benefits, insurance, phone }: {
  periodLabel?: string; salaryText?: string; overtimeNote?: string; pill?: string; sections: DetailSection[]; benefits: DetailBenefit[]; insurance: string[]; phone?: string
}) {
  const contact = sections.find((s) => s.label === 'Liên hệ')
  const body = sections.filter((s) => s !== contact)
  const tiles = [...benefits.filter((b) => b.active).map((b) => ({ key: b.key, label: b.label, Icon: BENEFIT_ICONS[b.key] ?? Gift })), ...(insurance.length ? [{ key: 'ins', label: insurance.join(' · '), Icon: ShieldCheck }] : [])]
  const digits = (phone ?? '').replace(/[^\d+]/g, '')
  return (
    <div className="app-rich">
      {salaryText && (
        <div className="app-rich__hero">
          {periodLabel && <small>{periodLabel}</small>}
          <b>{salaryText}</b>
          {pill && <span className="app-rich__pill">{pill}</span>}
          {overtimeNote && <span className="app-rich__note">*{overtimeNote}</span>}
        </div>
      )}
      {body.map((sec) => {
        const steps = sec.key === '06' ? richProcessSteps(sec.lines) : []
        return (
          <section key={sec.key} className="app-rich__sec">
            <h3 className="app-rich__h">{sec.label}</h3>
            {steps.length >= 2 && <div className="app-rich__flow">{steps.map((s, i) => <span key={s} className="app-rich__step">{i > 0 && <ChevronRight size={14} aria-hidden />}{s}</span>)}</div>}
            {sec.lines.map((line, i) => { const Icon = ICONS[richLineIcon(line, sec.key)]; return <p key={i} className="app-rich__card"><Icon size={20} strokeWidth={1.8} aria-hidden /><span>{emphasize(line)}</span></p> })}
          </section>
        )
      })}
      {tiles.length > 0 && (
        <section className="app-rich__sec"><h3 className="app-rich__h">Phúc lợi</h3>
          <div className="app-rich__tiles">{tiles.map(({ key, label, Icon }) => <div key={key} className="app-rich__tile"><Icon size={26} strokeWidth={1.7} aria-hidden /><span>{label}</span></div>)}</div>
        </section>
      )}
      {(contact || digits.length >= 8) && (
        <section className="app-rich__sec"><h3 className="app-rich__h">Liên hệ</h3>
          {digits.length >= 8 && <a className="app-rich__cta" href={`tel:${digits}`}><Phone size={18} aria-hidden />Gọi ngay {phone}</a>}
          {contact?.lines.map((line, i) => <p key={i} className="app-rich__contact">{emphasize(line)}</p>)}
        </section>
      )}
    </div>
  )
}
