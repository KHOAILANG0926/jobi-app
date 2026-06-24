import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { JobCategory } from '../types/job'
import type { Job } from '../types/job'

const supabase = createClient(
  'https://edhuesdnuxlbcfephutq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkaHVlc2RudXhsYmNmZXBodXRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDg5MTcsImV4cCI6MjA5NDU4NDkxN30.mnbMkGLy8UwFaOg6qdkDaV6DGZ2LyCSfOhJVB_48_HE'
)

const ADMIN_PASSWORD = '0926'

type Tab = 'dashboard' | 'post'

interface Stats {
  koreaJobs: number
  localUsers: number
  localEmployers: number
  localJobs: number
}

function loadLocalStats(): Pick<Stats, 'localUsers' | 'localEmployers' | 'localJobs'> {
  try {
    const accounts = JSON.parse(localStorage.getItem('vgb_accounts') || '[]')
    const jobs = JSON.parse(localStorage.getItem('vgb_jobs') || '[]')
    return {
      localUsers: accounts.filter((a: { role: string }) => a.role === 'seeker').length,
      localEmployers: accounts.filter((a: { role: string }) => a.role === 'employer').length,
      localJobs: jobs.length,
    }
  } catch {
    return { localUsers: 0, localEmployers: 0, localJobs: 0 }
  }
}

const EMPTY_JOB: Omit<Job, 'id'> = {
  title: '',
  company: '',
  category: 'other',
  salary: '',
  location: '',
  hours: '',
  employerPhone: '',
  applicationDeadline: '',
  urgent: false,
  description: '',
  postedAt: new Date().toISOString().slice(0, 10),
  lat: undefined,
  lng: undefined,
}

const CATEGORY_LABELS: Record<JobCategory, string> = {
  factory: '🏭 Nhà máy',
  cafe: '☕ Cafe / F&B',
  delivery: '🛵 Giao hàng',
  cleaning: '🧹 Vệ sinh',
  retail: '🛍️ Bán lẻ',
  other: '📌 Khác',
}

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('dashboard')

  // Dashboard state
  const [stats, setStats] = useState<Stats>({ koreaJobs: 0, localUsers: 0, localEmployers: 0, localJobs: 0 })
  const [loading, setLoading] = useState(false)
  const [recentAccounts, setRecentAccounts] = useState<{ id: string; name: string; phone: string; role: string; createdAt: string }[]>([])

  // Post job state
  const [rawText, setRawText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [jobForm, setJobForm] = useState<Omit<Job, 'id'>>(EMPTY_JOB)
  const [parseError, setParseError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  function handleLogin() {
    if (pw === ADMIN_PASSWORD) {
      setAuthed(true)
      setError('')
    } else {
      setError('Mật khẩu sai!')
    }
  }

  useEffect(() => {
    if (!authed) return
    setLoading(true)
    const local = loadLocalStats()
    try {
      const accounts = JSON.parse(localStorage.getItem('vgb_accounts') || '[]')
      setRecentAccounts(accounts.slice(0, 10))
    } catch {}
    supabase.from('korea_jobs').select('id', { count: 'exact', head: true }).then(({ count }) => {
      setStats({ ...local, koreaJobs: count ?? 0 })
      setLoading(false)
    })
  }, [authed])

  // Parse Facebook post with Claude AI
  async function handleParse() {
    if (!rawText.trim()) return
    setParsing(true)
    setParseError('')
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `Đây là bài đăng tuyển dụng từ Facebook. Hãy trích xuất thông tin và trả về JSON thuần túy (không có markdown, không có backtick).

Bài đăng:
"""
${rawText}
"""

Trả về JSON với các trường sau (nếu không tìm thấy thì để chuỗi rỗng):
{
  "title": "chức danh công việc",
  "company": "tên công ty/cơ sở",
  "category": "factory|cafe|delivery|cleaning|retail|other",
  "salary": "mức lương (chuỗi)",
  "location": "địa điểm làm việc",
  "hours": "giờ làm việc / ca",
  "employerPhone": "số điện thoại liên hệ",
  "applicationDeadline": "YYYY-MM-DD hoặc rỗng nếu không có",
  "urgent": true hoặc false,
  "description": "mô tả công việc đầy đủ bằng tiếng Việt",
  "lat": null,
  "lng": null
}`
          }]
        })
      })
      const data = await res.json()
      const text = data.content?.map((c: { type: string; text?: string }) => c.type === 'text' ? c.text : '').join('') || ''
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      setJobForm({
        ...EMPTY_JOB,
        ...parsed,
        postedAt: new Date().toISOString().slice(0, 10),
      })
    } catch {
      setParseError('Không đọc được bài đăng. Thử lại hoặc điền thủ công.')
    }
    setParsing(false)
  }

  async function handleSave() {
    if (!jobForm.title || !jobForm.company) {
      setParseError('Vui lòng điền ít nhất Tiêu đề và Công ty.')
      return
    }
    setSaving(true)
    setParseError('')
    const { error } = await supabase.from('local_jobs').insert({
      title: jobForm.title,
      company: jobForm.company,
      category: jobForm.category,
      salary: jobForm.salary,
      location: jobForm.location,
      hours: jobForm.hours || null,
      employer_phone: jobForm.employerPhone,
      application_deadline: jobForm.applicationDeadline || null,
      urgent: jobForm.urgent ?? false,
      description: jobForm.description,
      posted_at: new Date().toISOString().slice(0, 10),
      lat: jobForm.lat ?? null,
      lng: jobForm.lng ?? null,
      active: true,
    })
    if (error) {
      setParseError('Lỗi lưu dữ liệu: ' + error.message)
    } else {
      setSaveSuccess(true)
      setRawText('')
      setJobForm(EMPTY_JOB)
      setStats(prev => ({ ...prev, localJobs: prev.localJobs + 1 }))
      setTimeout(() => setSaveSuccess(false), 3000)
    }
    setSaving(false)
  }

  // ─── Login screen ───
  if (!authed) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
      }}>
        <div style={{
          background: '#fff', borderRadius: '20px', padding: '40px 32px',
          width: '100%', maxWidth: '360px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔐</div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>Quản trị viên</h1>
            <p style={{ color: '#888', fontSize: '13px', marginTop: '6px' }}>Việc gần Bạn Admin</p>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <input
              type="password"
              placeholder="Nhập mật khẩu quản trị"
              value={pw}
              onChange={e => setPw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{
                width: '100%', padding: '14px 16px',
                border: error ? '2px solid #e74c3c' : '2px solid #e0e0e0',
                borderRadius: '12px', fontSize: '15px', outline: 'none', boxSizing: 'border-box'
              }}
            />
            {error && <p style={{ color: '#e74c3c', fontSize: '13px', marginTop: '8px' }}>{error}</p>}
          </div>
          <button onClick={handleLogin} style={{
            width: '100%', padding: '14px',
            background: 'linear-gradient(135deg, #c0392b, #e74c3c)',
            color: '#fff', border: 'none', borderRadius: '12px',
            fontSize: '15px', fontWeight: 700, cursor: 'pointer'
          }}>Đăng nhập</button>
        </div>
      </div>
    )
  }

  // ─── Main ───
  return (
    <div style={{ background: '#f4f6fb', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e, #0f3460)',
        padding: '20px 24px', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>Dashboard Quản trị</h1>
          <p style={{ fontSize: '13px', opacity: 0.7, margin: '4px 0 0' }}>Việc gần Bạn</p>
        </div>
        <button onClick={() => setAuthed(false)} style={{
          background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none',
          borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer'
        }}>Đăng xuất</button>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #eee', display: 'flex' }}>
        {([['dashboard', '📊 Dashboard'], ['post', '➕ Đăng tin nhanh']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '14px 24px', fontSize: '14px', fontWeight: tab === t ? 700 : 400,
            color: tab === t ? '#e74c3c' : '#666', background: 'none', border: 'none',
            borderBottom: tab === t ? '3px solid #e74c3c' : '3px solid transparent',
            cursor: 'pointer'
          }}>{label}</button>
        ))}
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 16px' }}>

        {/* ── DASHBOARD TAB ── */}
        {tab === 'dashboard' && (
          loading ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#888' }}>Đang tải...</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                {[
                  { label: 'Người tìm việc', value: stats.localUsers, icon: '👤', color: '#3498db' },
                  { label: 'Nhà tuyển dụng', value: stats.localEmployers, icon: '🏢', color: '#27ae60' },
                  { label: 'Tin VN đang tuyển', value: stats.localJobs, icon: '📋', color: '#e67e22' },
                  { label: 'Tin Hàn Quốc', value: stats.koreaJobs, icon: '🇰🇷', color: '#c0392b' },
                ].map(s => (
                  <div key={s.label} style={{
                    background: '#fff', borderRadius: '16px', padding: '20px',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)', borderTop: `4px solid ${s.color}`
                  }}>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>{s.icon}</div>
                    <div style={{ fontSize: '32px', fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{
                background: 'linear-gradient(135deg, #1a1a2e, #0f3460)', borderRadius: '16px',
                padding: '20px 24px', color: '#fff', marginBottom: '28px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px'
              }}>
                <div>
                  <p style={{ fontSize: '13px', opacity: 0.7, margin: '0 0 4px' }}>Tổng thành viên</p>
                  <p style={{ fontSize: '36px', fontWeight: 800, margin: 0 }}>{stats.localUsers + stats.localEmployers}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '13px', opacity: 0.7, margin: '0 0 4px' }}>Tổng tin tuyển dụng</p>
                  <p style={{ fontSize: '36px', fontWeight: 800, margin: 0 }}>{stats.localJobs + stats.koreaJobs}</p>
                </div>
              </div>

              <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: '#1a1a1a' }}>Người dùng mới nhất</h2>
                {recentAccounts.length === 0 ? (
                  <p style={{ color: '#aaa', fontSize: '14px' }}>Chưa có người dùng nào.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {recentAccounts.map(acc => (
                      <div key={acc.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px', background: '#f9f9f9', borderRadius: '10px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '36px', height: '36px', borderRadius: '50%',
                            background: acc.role === 'employer' ? '#e8f5e9' : '#e3f2fd',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px'
                          }}>{acc.role === 'employer' ? '🏢' : '👤'}</div>
                          <div>
                            <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>{acc.name}</p>
                            <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>{acc.phone}</p>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{
                            fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px',
                            background: acc.role === 'employer' ? '#e8f5e9' : '#e3f2fd',
                            color: acc.role === 'employer' ? '#27ae60' : '#2980b9'
                          }}>{acc.role === 'employer' ? 'NTD' : 'Tìm việc'}</span>
                          <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#aaa' }}>
                            {new Date(acc.createdAt).toLocaleDateString('vi-VN')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )
        )}

        {/* ── POST JOB TAB ── */}
        {tab === 'post' && (
          <div>
            {/* Step 1: Paste */}
            <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px', color: '#1a1a1a' }}>
                📋 Bước 1 — Dán bài đăng Facebook
              </h2>
              <p style={{ fontSize: '13px', color: '#888', margin: '0 0 16px' }}>
                Copy bài đăng tuyển dụng từ Facebook rồi dán vào đây. AI sẽ tự động điền form.
              </p>
              <textarea
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder="Dán nội dung bài đăng Facebook vào đây...&#10;&#10;Ví dụ:&#10;🔥 TUYỂN GẤP nhân viên phục vụ&#10;📍 Địa điểm: Quán Cafe ABC, Hà Nội&#10;💰 Lương: 4-5 triệu/tháng&#10;📞 LH: 0912 345 678"
                style={{
                  width: '100%', height: '160px', padding: '14px', border: '2px solid #e0e0e0',
                  borderRadius: '12px', fontSize: '14px', resize: 'vertical',
                  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
                }}
              />
              <button
                onClick={handleParse}
                disabled={parsing || !rawText.trim()}
                style={{
                  marginTop: '12px', padding: '12px 28px',
                  background: parsing || !rawText.trim() ? '#ccc' : 'linear-gradient(135deg, #e74c3c, #c0392b)',
                  color: '#fff', border: 'none', borderRadius: '10px',
                  fontSize: '14px', fontWeight: 700, cursor: parsing || !rawText.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                {parsing ? '⏳ Đang phân tích...' : '✨ Phân tích tự động'}
              </button>
            </div>

            {/* Step 2: Form */}
            <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px', color: '#1a1a1a' }}>
                ✏️ Bước 2 — Kiểm tra & lưu tin
              </h2>
              <p style={{ fontSize: '13px', color: '#888', margin: '0 0 20px' }}>
                Kiểm tra lại thông tin, chỉnh sửa nếu cần rồi bấm Lưu tin.
              </p>

              {parseError && (
                <div style={{ background: '#ffeaea', border: '1px solid #e74c3c', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#c0392b' }}>
                  ⚠️ {parseError}
                </div>
              )}

              {saveSuccess && (
                <div style={{ background: '#eafaf1', border: '1px solid #27ae60', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#1e8449' }}>
                  ✅ Đã lưu tin tuyển dụng thành công!
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {/* Title */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Tiêu đề *</label>
                  <input value={jobForm.title} onChange={e => setJobForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} placeholder="VD: Tuyển nhân viên pha chế" />
                </div>
                {/* Company */}
                <div>
                  <label style={labelStyle}>Công ty / Cơ sở *</label>
                  <input value={jobForm.company} onChange={e => setJobForm(f => ({ ...f, company: e.target.value }))} style={inputStyle} placeholder="Tên công ty" />
                </div>
                {/* Category */}
                <div>
                  <label style={labelStyle}>Ngành nghề</label>
                  <select value={jobForm.category} onChange={e => setJobForm(f => ({ ...f, category: e.target.value as JobCategory }))} style={inputStyle}>
                    {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                {/* Salary */}
                <div>
                  <label style={labelStyle}>Mức lương</label>
                  <input value={jobForm.salary} onChange={e => setJobForm(f => ({ ...f, salary: e.target.value }))} style={inputStyle} placeholder="VD: 5-7 triệu/tháng" />
                </div>
                {/* Phone */}
                <div>
                  <label style={labelStyle}>Số điện thoại</label>
                  <input value={jobForm.employerPhone} onChange={e => setJobForm(f => ({ ...f, employerPhone: e.target.value }))} style={inputStyle} placeholder="0912 345 678" />
                </div>
                {/* Location */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Địa điểm</label>
                  <input value={jobForm.location} onChange={e => setJobForm(f => ({ ...f, location: e.target.value }))} style={inputStyle} placeholder="VD: Hà Nội — Cầu Giấy" />
                </div>
                {/* Hours */}
                <div>
                  <label style={labelStyle}>Giờ làm việc</label>
                  <input value={jobForm.hours || ''} onChange={e => setJobForm(f => ({ ...f, hours: e.target.value }))} style={inputStyle} placeholder="VD: Ca sáng 8:00–12:00" />
                </div>
                {/* Deadline */}
                <div>
                  <label style={labelStyle}>Hạn nộp hồ sơ</label>
                  <input type="date" value={jobForm.applicationDeadline} onChange={e => setJobForm(f => ({ ...f, applicationDeadline: e.target.value }))} style={inputStyle} />
                </div>
                {/* Description */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Mô tả công việc</label>
                  <textarea value={jobForm.description} onChange={e => setJobForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, height: '120px', resize: 'vertical' }} placeholder="Mô tả chi tiết công việc..." />
                </div>
                {/* Urgent */}
                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input type="checkbox" id="urgent" checked={!!jobForm.urgent} onChange={e => setJobForm(f => ({ ...f, urgent: e.target.checked }))} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                  <label htmlFor="urgent" style={{ fontSize: '14px', color: '#333', cursor: 'pointer', fontWeight: 600 }}>🔴 Tuyển gấp</label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button onClick={handleSave} disabled={saving} style={{
                  flex: 1, padding: '14px',
                  background: 'linear-gradient(135deg, #27ae60, #2ecc71)',
                  color: '#fff', border: 'none', borderRadius: '12px',
                  fontSize: '15px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer'
                }}>
                  {saving ? '⏳ Đang lưu...' : '💾 Lưu tin tuyển dụng'}
                </button>
                <button onClick={() => { setJobForm(EMPTY_JOB); setRawText(''); setParseError('') }} style={{
                  padding: '14px 20px', background: '#f0f0f0', color: '#666',
                  border: 'none', borderRadius: '12px', fontSize: '14px', cursor: 'pointer'
                }}>🗑️ Xóa</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '13px', fontWeight: 600, color: '#555', marginBottom: '6px'
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', border: '1.5px solid #e0e0e0',
  borderRadius: '10px', fontSize: '14px', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit', background: '#fafafa'
}
