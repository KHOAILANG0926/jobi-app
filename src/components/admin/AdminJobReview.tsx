import type { AdminLanguage } from '../../lib/adminLanguage'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type ReviewItem = {
  job_id: number; title: string; company: string; source_name: string | null
  reason: string; content_hash: string; queued_at: string; original_text: string | null
  description_text: string | null; location_text: string | null
  active: boolean; admin_hidden: boolean
}
export function AdminJobReview({ language = 'ko' }: { language?: AdminLanguage }) {
  const t = (ko: string, vi: string) => language === 'ko' ? ko : vi
  const [items, setItems] = useState<ReviewItem[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const reload = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('admin_job_review_queue')
    setError(error?.message ?? '')
    setItems(error ? [] : (data ?? []) as ReviewItem[])
    setLoading(false)
  }, [])
  useEffect(() => { void reload() }, [reload])
  const current = items.find(x => x.job_id === selected)
  async function saveCorrection() {
    if (!current || !reason.trim() || !draft.trim() || saving) return
    setSaving(true); setError('')
    const { error } = await supabase.rpc('admin_review_correct_job', {
      target_job_id: current.job_id, expected_content_hash: current.content_hash,
      fields: { description: draft }, correction_reason: reason.trim(),
    })
    if (error) setError(error.message)
    else { setSelected(null); setReason(''); await reload() }
    setSaving(false)
  }
  return <section className="admin-panel">
    <h2>{t("검토 대기 공고","Duyệt tin tuyển dụng cần xử lý")}</h2>
    <p>{t("자동 검증을 통과하지 못한 공고는 비공개로 유지됩니다.","Tin chưa vượt qua kiểm tra tự động sẽ được giữ ẩn. Chỉ quy trình xác minh mới cho phép đăng công khai.")}</p>
    <button type="button" onClick={() => void reload()}>{t("새로고침","Làm mới")}</button>
    {loading && <p>{t("불러오는 중...","Đang tải...")}</p>}
    {error && <p className="admin-error" role="alert">{error}</p>}
    {!loading && !error && <p>{t("검토 대기: ","Chờ kiểm tra: ")}<strong>{items.length}</strong></p>}
    <div className="admin-table-wrap"><table className="admin-table">
      <thead><tr><th>{t("공고 ID","Mã tin")}</th><th>{t("회사","Doanh nghiệp")}</th><th>{t("검토 사유","Vấn đề cần xử lý")}</th><th>{t("등록 시간","Thời gian")}</th><th>{t("상세","Chi tiết")}</th></tr></thead>
      <tbody>{items.map(item => <tr key={item.job_id}>
        <td>#{item.job_id}</td><td>{item.company || item.title}</td><td>{item.reason}</td>
        <td>{new Date(item.queued_at).toLocaleString('vi-VN')}</td>
        <td><button type="button" onClick={() => { setSelected(item.job_id); setDraft(item.description_text ?? ''); setReason('') }}>{t("검토","Kiểm tra")}</button></td>
      </tr>)}</tbody></table></div>
    {current && <section style={{padding:16, marginTop:16, border:'1px solid #ddd', borderRadius:8}}>
      <h3>{t('공고 검토','Kiểm tra tin')} #{current.job_id} · {current.title}</h3>
      <p><strong>{t("근무 위치:","Vị trí làm việc:")}</strong> {current.location_text || t('정보 없음','Chưa có thông tin')}</p>
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:16}}>
        <div><h4>{t("원문","Nội dung gốc")}</h4><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{current.original_text || 'Chưa có nội dung gốc'}</pre></div>
        <div><h4>{t("표시 내용","Nội dung hiển thị")}</h4><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{current.description_text || 'Chưa có nội dung hiển thị'}</pre></div>
      </div>
      <label htmlFor="review-description"><strong>{t("공고 내용 수정","Sửa nội dung công việc")}</strong></label>
      <textarea id="review-description" value={draft} onChange={e=>setDraft(e.target.value)} rows={8} style={{width:'100%', boxSizing:'border-box'}} />
      <label htmlFor="review-reason"><strong>{t("수정 사유(필수)","Lý do chỉnh sửa (bắt buộc)")}</strong></label>
      <input id="review-reason" value={reason} onChange={e=>setReason(e.target.value)} style={{width:'100%', boxSizing:'border-box'}} />
      <p>{t("저장 후에도 비공개로 유지되며 자동 검증을 통과해야 공개됩니다.","Việc lưu sẽ giữ tin ở trạng thái ẩn. Nội dung mới phải qua kiểm tra tự động trước khi công khai.")}</p>
      <button type="button" disabled={saving || !reason.trim() || !draft.trim() || draft === (current.description_text ?? '')} onClick={() => void saveCorrection()}>{saving ? t('저장 중...','Đang lưu...') : t('수정 저장 후 재검토','Lưu và kiểm tra lại')}</button>
      <button type="button" onClick={() => setSelected(null)}>{t("닫기","Đóng")}</button>
    </section>}
  </section>
}
