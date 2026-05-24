import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://edhuesdnuxlbcfephutq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkaHVlc2RudXhsYmNmZXBodXRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDg5MTcsImV4cCI6MjA5NDU4NDkxN30.mnbMkGLy8UwFaOg6qdkDaV6DGZ2LyCSfOhJVB_48_HE'
)

const ADMIN_PASSWORD = 'viecganbạn2024'

interface Stats {
  koreaJobs: number
  localUsers: number
  localEmployers: number
  localJobs: number
}

function loadLocalStats(): Pick<Stats, 'localUsers' | 'localEmployers' | 'localJobs'> {
  try {
    const accounts = JSON.parse(localStorage.getItem('jobi_accounts') || '[]')
    const jobs = JSON.parse(localStorage.getItem('jobi_jobs') || '[]')
    return {
      localUsers: accounts.filter((a: { role: string }) => a.role === 'jobseeker').length,
      localEmployers: accounts.filter((a: { role: string }) => a.role === 'employer').length,
      localJobs: jobs.length,
    }
  } catch {
    return { localUsers: 0, localEmployers: 0, localJobs: 0 }
  }
}

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [stats, setStats] = useState<Stats>({ koreaJobs: 0, localUsers: 0, localEmployers: 0, localJobs: 0 })
  const [loading, setLoading] = useState(false)
  const [recentAccounts, setRecentAccounts] = useState<{ id: string; name: string; phone: string; role: string; createdAt: string }[]>([])

  function handleLogin() {
    if (pw === ADMIN_PASSWORD) {
      setAuthed(true)
      setError('')
    } else {
      setError('Mat khau sai!')
    }
  }

  useEffect(() => {
    if (!authed) return
    setLoading(true)
    const local = loadLocalStats()

    // Load recent accounts
    try {
      const accounts = JSON.parse(localStorage.getItem('jobi_accounts') || '[]')
      setRecentAccounts(accounts.slice(0, 10))
    } catch {}

    supabase.from('korea_jobs').select('id', { count: 'exact', head: true }).then(({ count }) => {
      setStats({ ...local, koreaJobs: count ?? 0 })
      setLoading(false)
    })
  }, [authed])

  if (!authed) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}>
        <div style={{
          background: '#fff',
          borderRadius: '20px',
          padding: '40px 32px',
          width: '100%',
          maxWidth: '360px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔐</div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>
              Quan tri vien
            </h1>
            <p style={{ color: '#888', fontSize: '13px', marginTop: '6px' }}>
              Viec gan Ban Admin
            </p>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <input
              type="password"
              placeholder="Nhap mat khau quan tri"
              value={pw}
              onChange={e => setPw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{
                width: '100%',
                padding: '14px 16px',
                border: error ? '2px solid #e74c3c' : '2px solid #e0e0e0',
                borderRadius: '12px',
                fontSize: '15px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {error && <p style={{ color: '#e74c3c', fontSize: '13px', marginTop: '8px' }}>{error}</p>}
          </div>

          <button
            onClick={handleLogin}
            style={{
              width: '100%',
              padding: '14px',
              background: 'linear-gradient(135deg, #c0392b, #e74c3c)',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Dang nhap
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#f4f6fb', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e, #0f3460)',
        padding: '24px',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>Dashboard Quan tri</h1>
          <p style={{ fontSize: '13px', opacity: 0.7, margin: '4px 0 0' }}>Viec gan Ban</p>
        </div>
        <button
          onClick={() => setAuthed(false)}
          style={{
            background: 'rgba(255,255,255,0.15)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          Dang xuat
        </button>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#888' }}>Dang tai...</div>
        ) : (
          <>
            {/* Stats grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '16px',
              marginBottom: '28px'
            }}>
              {[
                { label: 'Nguoi tim viec', value: stats.localUsers, icon: '👤', color: '#3498db' },
                { label: 'Nha tuyen dung', value: stats.localEmployers, icon: '🏢', color: '#27ae60' },
                { label: 'Tin VN dang tuyen', value: stats.localJobs, icon: '📋', color: '#e67e22' },
                { label: 'Tin Han Quoc', value: stats.koreaJobs, icon: '🇰🇷', color: '#c0392b' },
              ].map(s => (
                <div key={s.label} style={{
                  background: '#fff',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                  borderTop: `4px solid ${s.color}`
                }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>{s.icon}</div>
                  <div style={{ fontSize: '32px', fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Total summary */}
            <div style={{
              background: 'linear-gradient(135deg, #1a1a2e, #0f3460)',
              borderRadius: '16px',
              padding: '20px 24px',
              color: '#fff',
              marginBottom: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <p style={{ fontSize: '13px', opacity: 0.7, margin: '0 0 4px' }}>Tong thanh vien</p>
                <p style={{ fontSize: '36px', fontWeight: 800, margin: 0 }}>
                  {stats.localUsers + stats.localEmployers}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '13px', opacity: 0.7, margin: '0 0 4px' }}>Tong tin tuyen dung</p>
                <p style={{ fontSize: '36px', fontWeight: 800, margin: 0 }}>
                  {stats.localJobs + stats.koreaJobs}
                </p>
              </div>
            </div>

            {/* Recent signups */}
            <div style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
            }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: '#1a1a1a' }}>
                Nguoi dung moi nhat
              </h2>
              {recentAccounts.length === 0 ? (
                <p style={{ color: '#aaa', fontSize: '14px' }}>Chua co nguoi dung nao.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {recentAccounts.map(acc => (
                    <div key={acc.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: '#f9f9f9',
                      borderRadius: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '36px', height: '36px',
                          borderRadius: '50%',
                          background: acc.role === 'employer' ? '#e8f5e9' : '#e3f2fd',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '16px'
                        }}>
                          {acc.role === 'employer' ? '🏢' : '👤'}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>{acc.name}</p>
                          <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>{acc.phone}</p>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '3px 10px',
                          borderRadius: '20px',
                          background: acc.role === 'employer' ? '#e8f5e9' : '#e3f2fd',
                          color: acc.role === 'employer' ? '#27ae60' : '#2980b9'
                        }}>
                          {acc.role === 'employer' ? 'NTD' : 'Tim viec'}
                        </span>
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
        )}
      </div>
    </div>
  )
}
