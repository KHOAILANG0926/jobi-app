/**
 * 상세 ④ 꾸민 본문(Lee 2026-11-10 "이런 식으로 좀 화려하게" — 알바몬 쿠팡 공고 참고, 글 모형 확인 "이 모양으로 데모 만들어").
 * 맨 위 업종 그림 머리(#563)는 JobDetail 그대로, 그 아래만: 큰 급여 숫자 + 상여 알약, 형광펜 소제목, 아이콘 카드 줄,
 * 채용 절차 화살표(원문에 단계 낱말이 2개 이상일 때만), 복리후생 타일, 큰 전화 버튼.
 * 글·숫자는 모두 원문·DB 그대로(지어내지 않음). 아이콘·강조는 줄 낱말로 자동으로 고른다.
 */
import type { ReactNode } from 'react'
import { Settings, Package, ClipboardCheck, Sparkles, Clock, Truck, Banknote, Utensils, ChefHat, CheckCircle2, Phone, ChevronRight,
  ShieldCheck, Bus, BedDouble, CalendarCheck, House, Fuel, ChartNoAxesColumnIncreasing, Gift, Users, MessageCircle, Mail } from 'lucide-react'
import type { DetailSection } from '../lib/jobDetailSections'
import { richLineIcon, richProcessSteps, type RichIcon } from '../lib/detailRich'

const ICONS: Record<RichIcon, typeof Settings> = {
  operate: Settings, pack: Package, check: ClipboardCheck, clean: Sparkles, time: Clock, drive: Truck, cash: Banknote,
  serve: Utensils, cook: ChefHat, people: Users, chat: MessageCircle, mail: Mail, phone: Phone, dot: CheckCircle2,
}
const BENEFIT_ICONS: Record<string, typeof Settings> = {
  bus: Bus, dorm: BedDouble, meal: Utensils, attendance: CalendarCheck, housing: House, fuel: Fuel, performance: ChartNoAxesColumnIncreasing,
}

/** 금액은 주황 굵게, "이름표:" 앞부분은 파랑 굵게 — 글자는 그대로. */
function emphasize(line: string): ReactNode {
  const text = line.replace(/^\s*[-•*]\s+/, '')
  const label = /^([^:：]{2,40})[:：]\s*(.+)$/u.exec(text)
  const money = (s: string) => s.split(/(\d[\d.,]*\s*(?:đ|đồng|vnđ|vnd|k|triệu|tr)\b\.?)/giu).map((p, i) =>
    i % 2 ? <span key={i} className="jd2-rich__o">{p}</span> : p)
  return label ? <><span className="jd2-rich__b">{label[1]}:</span> {money(label[2])}</> : money(text)
}

export interface DetailRichProps {
  periodLabel?: string | null
  salaryText?: string | null
  overtimeNote?: string
  /** 상여 알약: 원문 대문자 홍보 줄 중 급여 반복이 아닌 줄(그대로) */
  pill?: string
  sections: DetailSection[]
  benefits: { key: string; label: string }[]
  insurance: string[]
  phone?: string | null
}

export function DetailRich(p: DetailRichProps) {
  const contact = p.sections.find((s) => s.label === 'Liên hệ')
  const body = p.sections.filter((s) => s !== contact)
  const tiles = [...p.benefits.map((b) => ({ key: b.key, label: b.label, Icon: BENEFIT_ICONS[b.key] ?? Gift })),
    ...(p.insurance.length ? [{ key: 'ins', label: p.insurance.join(' · '), Icon: ShieldCheck }] : [])]
  const digits = (p.phone ?? '').replace(/[^\d+]/g, '')
  return (
    <div className="jd2-rich">
      {p.salaryText && (
        <div className="jd2-rich__hero">
          {p.periodLabel && <small>{p.periodLabel}</small>}
          <b>{p.salaryText}</b>
          {p.pill && <span className="jd2-rich__pill">{p.pill}</span>}
          {p.overtimeNote && <span className="jd2-rich__note">*{p.overtimeNote}</span>}
        </div>
      )}
      {body.map((sec) => {
        const steps = sec.key === '06' ? richProcessSteps(sec.lines) : []
        return (
          <section key={sec.key} id={`jd2-detail-${sec.key}`} className="jd2-rich__sec">
            <h3 className="jd2-rich__h"><span>{sec.label}</span></h3>
            {steps.length >= 2 && (
              <div className="jd2-rich__flow">
                {steps.map((s, i) => <span key={s} className="jd2-rich__step">{i > 0 && <ChevronRight size={14} aria-hidden="true" />}{s}</span>)}
              </div>
            )}
            {sec.lines.map((line, i) => {
              const Icon = ICONS[richLineIcon(line, sec.key)]
              return <p key={i} className="jd2-rich__card"><Icon size={20} strokeWidth={1.8} aria-hidden="true" /><span>{emphasize(line)}</span></p>
            })}
          </section>
        )
      })}
      {tiles.length > 0 && (
        <section className="jd2-rich__sec">
          <h3 className="jd2-rich__h"><span>Phúc lợi</span></h3>
          <div className="jd2-rich__tiles">
            {tiles.map(({ key, label, Icon }) => <div key={key} className="jd2-rich__tile"><Icon size={26} strokeWidth={1.7} aria-hidden="true" /><span>{label}</span></div>)}
          </div>
        </section>
      )}
      {(contact || digits.length >= 8) && (
        <section id="jd2-detail-07" className="jd2-rich__sec">
          <h3 className="jd2-rich__h"><span>Liên hệ</span></h3>
          {digits.length >= 8 && <a className="jd2-rich__cta" href={`tel:${digits}`}><Phone size={18} aria-hidden="true" />Gọi ngay {p.phone}</a>}
          {contact?.lines.map((line, i) => <p key={i} className="jd2-rich__contact">{emphasize(line)}</p>)}
        </section>
      )}
    </div>
  )
}
