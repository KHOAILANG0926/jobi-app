import { useNavigate } from 'react-router-dom'

const BRANDS = [
  { name: 'GrabFood', color: '#00B14F', initial: 'G', category: 'Giao hàng' },
  { name: 'Highlands Coffee', color: '#8B1A1A', initial: 'H', category: 'Nhà hàng' },
  { name: 'WinMart', color: '#E53935', initial: 'W', category: 'Bán lẻ' },
  { name: 'Shopee', color: '#EE4D2D', initial: 'S', category: 'Thương mại' },
  { name: 'Circle K', color: '#E53935', initial: 'C', category: 'Bán lẻ' },
  { name: 'FamilyMart', color: '#0057A8', initial: 'F', category: 'Bán lẻ' },
  { name: 'McDonald\'s', color: '#FFC72C', initial: 'M', category: 'Nhà hàng' },
  { name: 'KFC VN', color: '#E53935', initial: 'K', category: 'Nhà hàng' },
]

export default function FranchiseJobs() {
  const navigate = useNavigate()
  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>
        🏢 Thương hiệu lớn tuyển dụng
      </h1>
      <p style={{ color: '#64748b', marginBottom: '2rem' }}>
        Cơ hội làm việc tại các thương hiệu lớn trên toàn quốc
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        {BRANDS.map((brand, i) => (
          <div
            key={i}
            onClick={() => navigate('/')}
            style={{
              background: 'white',
              borderRadius: 16,
              padding: '1.5rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
              transition: 'transform 0.2s',
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: brand.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.5rem', fontWeight: 800, color: 'white'
            }}>
              {brand.initial}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{brand.name}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{brand.category}</div>
            </div>
            <button style={{
              background: '#fee2e2', color: '#e53935',
              border: 'none', borderRadius: 8,
              padding: '0.4rem 1rem', fontSize: '0.8rem',
              fontWeight: 600, cursor: 'pointer'
            }}>
              Xem việc làm
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
