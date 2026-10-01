// 공고 등록(PostJob)·관리(ManageGuestJob) 공용 — 근무지 지도 핀 + 근무조건 입력(2026-10-01).
// 값을 고르지 않은 항목은 NULL(정보 미확인)로 저장된다. "Không"을 고른 경우에만 false.
import { lazy, Suspense, useMemo } from 'react'
import { findRegionCenter } from '../../lib/jobCoords'
import { RECRUITMENT_LABELS, SCHEDULE_LABELS, SHIFT_LABELS, type JobConditions, type TriState } from '../../lib/jobConditions'
import type { RecruitmentType, ShiftType, WorkSchedule } from '../../types/job'
import type { PinPoint } from './LocationPinPicker'

const LocationPinPicker = lazy(() => import('./LocationPinPicker'))
const DEFAULT_CENTER: PinPoint = { lat: 21.1861, lng: 106.0763 } // Bắc Ninh

interface ChoiceProps<T extends string> {
  label: string
  value: T | null
  options: [T, string][]
  onChange: (v: T | null) => void
}

function Choice<T extends string>({ label, value, options, onChange }: ChoiceProps<T>) {
  return (
    <div className="jcf-row" role="radiogroup" aria-label={label}>
      <span className="jcf-row__label">{label}</span>
      <div className="jcf-seg">
        {options.map(([v, text]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? 'is-on' : ''}
            onClick={() => onChange(value === v ? null : v)}>{text}</button>
        ))}
        <button type="button" role="radio" aria-checked={value === null} className={`jcf-seg__unknown${value === null ? ' is-on' : ''}`}
          onClick={() => onChange(null)}>Chưa rõ</button>
      </div>
    </div>
  )
}

function Tri({ label, value, onChange }: { label: string; value: TriState; onChange: (v: TriState) => void }) {
  const opts: [string, TriState, string][] = [['yes', true, 'Có'], ['no', false, 'Không'], ['unknown', null, 'Chưa rõ']]
  return (
    <div className="jcf-row" role="radiogroup" aria-label={label}>
      <span className="jcf-row__label">{label}</span>
      <div className="jcf-seg">
        {opts.map(([k, v, text]) => (
          <button key={k} type="button" role="radio" aria-checked={value === v} className={`${value === v ? 'is-on' : ''}${v === null ? ' jcf-seg__unknown' : ''}`}
            onClick={() => onChange(v)}>{text}</button>
        ))}
      </div>
    </div>
  )
}

interface Props {
  conditions: JobConditions
  onConditionsChange: (c: JobConditions) => void
  pin: PinPoint | null
  onPinChange: (p: PinPoint | null) => void
  /** 주소 입력값 — 핀이 없을 때 지도 시작 위치 힌트로만 쓴다(좌표로 저장하지 않음). */
  addressHint: string
}

export default function JobConditionsFields({ conditions, onConditionsChange, pin, onPinChange, addressHint }: Props) {
  const set = <K extends keyof JobConditions>(k: K, v: JobConditions[K]) => onConditionsChange({ ...conditions, [k]: v })
  const center = useMemo(() => findRegionCenter(addressHint) ?? DEFAULT_CENTER, [addressHint])

  const useMyLocation = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => onPinChange({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { /* 거부 시 지도에서 직접 고르면 된다 */ },
      { timeout: 10000 },
    )
  }

  return (
    <>
      <fieldset className="jcf-section">
        <legend>Vị trí làm việc trên bản đồ</legend>
        <p className="jcf-help">Bấm vào bản đồ hoặc kéo ghim đến đúng nơi làm việc (cổng công ty/nhà máy). Tin có ghim sẽ hiện trên bản đồ “Tìm việc quanh bạn”.</p>
        <Suspense fallback={<div className="jcf-map jcf-map--loading">Đang tải bản đồ…</div>}>
          <LocationPinPicker value={pin} center={center} onChange={onPinChange} />
        </Suspense>
        <div className="jcf-pin-bar">
          <span>{pin ? `Đã chọn: ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : 'Chưa chọn vị trí trên bản đồ (không bắt buộc)'}</span>
          <span className="jcf-pin-bar__actions">
            <button type="button" onClick={useMyLocation}>Dùng vị trí hiện tại</button>
            {pin && <button type="button" onClick={() => onPinChange(null)}>Xóa ghim</button>}
          </span>
        </div>
      </fieldset>

      <fieldset className="jcf-section">
        <legend>Điều kiện làm việc</legend>
        <p className="jcf-help">Mục nào không chắc, hãy để “Chưa rõ”. Người tìm việc lọc theo các điều kiện này trên bản đồ.</p>
        <Choice<ShiftType> label="Ca làm việc" value={conditions.shiftType}
          options={(['day', 'night', 'rotating', 'other'] as ShiftType[]).map((v) => [v, SHIFT_LABELS[v]])}
          onChange={(v) => set('shiftType', v)} />
        <Tri label="Xe đưa đón" value={conditions.shuttleBus} onChange={(v) => set('shuttleBus', v)} />
        <Tri label="Ký túc xá" value={conditions.dormitory} onChange={(v) => set('dormitory', v)} />
        <Tri label="Bữa ăn" value={conditions.mealProvided} onChange={(v) => set('mealProvided', v)} />
        <Choice<Exclude<RecruitmentType, 'unknown'>> label="Hình thức tuyển"
          value={conditions.recruitmentType === 'unknown' ? null : conditions.recruitmentType}
          options={[['direct', RECRUITMENT_LABELS.direct], ['agency', RECRUITMENT_LABELS.agency]]}
          onChange={(v) => set('recruitmentType', v)} />
        <Tri label="Đi làm ngay" value={conditions.immediateStart} onChange={(v) => set('immediateStart', v)} />
        <Choice<WorkSchedule> label="Lịch làm việc" value={conditions.workSchedule}
          options={(['5_days', '6_days', 'other'] as WorkSchedule[]).map((v) => [v, SCHEDULE_LABELS[v]])}
          onChange={(v) => set('workSchedule', v)} />
        <Tri label="Làm cuối tuần" value={conditions.weekendWork} onChange={(v) => set('weekendWork', v)} />
      </fieldset>
    </>
  )
}
