import { useEffect, useMemo, useState } from 'react'
import { useJobs } from '../../context/JobsContext'
import { useBrands } from '../../context/BrandsContext'
import { BRAND_CATEGORY_LABELS, type BrandCategoryId } from '../../data/brandDirectory'
import { detectBrandCandidates, type BrandCandidate } from '../../lib/brandCandidates'
import {
  dismissBrandCandidate,
  listAdminBrands,
  listDismissedBrandCandidateKeys,
  upsertBrand,
  type AdminBrand,
} from '../../lib/adminOperations'

const CATEGORY_OPTIONS = Object.entries(BRAND_CATEGORY_LABELS) as [BrandCategoryId, string][]

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

interface FormState {
  id?: number
  name: string
  slug: string
  category: BrandCategoryId
  domain: string
  initial: string
  color: string
  active: boolean
  featured: boolean
  aliasesText: string
  clearCandidateKeys?: string[]
}

const EMPTY_FORM: FormState = {
  name: '', slug: '', category: 'cafe', domain: '', initial: '', color: '#e53935',
  active: true, featured: false, aliasesText: '',
}

export function AdminBrands() {
  const { jobs } = useJobs()
  const { refreshBrands } = useBrands()
  const [brands, setBrands] = useState<AdminBrand[]>([])
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)

  const reload = async () => {
    setLoading(true)
    try {
      const [brandRows, dismissed] = await Promise.all([
        listAdminBrands(),
        listDismissedBrandCandidateKeys(),
      ])
      setBrands(brandRows)
      setDismissedKeys(dismissed)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải dữ liệu thương hiệu.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void reload() }, [])

  const candidates = useMemo<BrandCandidate[]>(
    () => detectBrandCandidates(jobs, brands.map((b) => ({ matchKeys: b.aliases.map((a) => a.alias) })), dismissedKeys),
    [jobs, brands, dismissedKeys],
  )

  function openCreateForm() {
    setForm({ ...EMPTY_FORM })
  }

  function openEditForm(b: AdminBrand) {
    setForm({
      id: b.id,
      name: b.name,
      slug: b.slug,
      category: b.category,
      domain: b.domain ?? '',
      initial: b.initial,
      color: b.color,
      active: b.active,
      featured: b.featured,
      aliasesText: b.aliases.map((a) => a.alias).join(', '),
    })
  }

  function openApproveForm(candidate: BrandCandidate) {
    setForm({
      name: candidate.companyName,
      slug: slugify(candidate.companyName),
      category: 'cafe',
      domain: '',
      initial: candidate.companyName.trim().charAt(0).toUpperCase() || '?',
      color: '#e53935',
      active: true,
      featured: false,
      aliasesText: candidate.companyName,
      clearCandidateKeys: [candidate.companyKey],
    })
  }

  async function handleDismiss(candidate: BrandCandidate) {
    try {
      await dismissBrandCandidate(candidate.companyKey)
      setDismissedKeys((prev) => new Set(prev).add(candidate.companyKey))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể bỏ qua ứng viên này.')
    }
  }

  async function handleSubmit() {
    if (!form) return
    const aliases = form.aliasesText.split(',').map((a) => a.trim()).filter(Boolean)
    if (aliases.length === 0) {
      setError('Cần ít nhất một alias.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await upsertBrand({
        id: form.id,
        name: form.name.trim(),
        slug: form.slug.trim(),
        category: form.category,
        domain: form.domain.trim() || undefined,
        initial: form.initial.trim() || form.name.trim().charAt(0).toUpperCase(),
        color: form.color,
        active: form.active,
        featured: form.featured,
        aliases,
        clearCandidateKeys: form.clearCandidateKeys,
      })
      setForm(null)
      await reload()
      await refreshBrands()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể lưu thương hiệu.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(b: AdminBrand) {
    try {
      await upsertBrand({
        id: b.id, name: b.name, slug: b.slug, category: b.category, domain: b.domain ?? undefined,
        initial: b.initial, color: b.color, active: !b.active, featured: b.featured,
        aliases: b.aliases.map((a) => a.alias),
      })
      await reload()
      await refreshBrands()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể cập nhật trạng thái.')
    }
  }

  async function toggleFeatured(b: AdminBrand) {
    try {
      await upsertBrand({
        id: b.id, name: b.name, slug: b.slug, category: b.category, domain: b.domain ?? undefined,
        initial: b.initial, color: b.color, active: b.active, featured: !b.featured,
        aliases: b.aliases.map((a) => a.alias),
      })
      await reload()
      await refreshBrands()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể cập nhật featured.')
    }
  }

  if (loading) return <section className="admin-panel"><p>Đang tải...</p></section>

  return (
    <section className="admin-panel">
      {error && <p className="admin-error">{error}</p>}

      <div className="admin-toolbar">
        <strong>Brands đã đăng ký ({brands.length})</strong>
        <button onClick={openCreateForm}>+ Thêm brand thủ công</button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Tên</th><th>Ngành</th><th>Aliases</th><th>Active</th><th>Featured</th><th>Sửa</th></tr></thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.id}>
                <td><strong>{b.name}</strong></td>
                <td>{BRAND_CATEGORY_LABELS[b.category]}</td>
                <td><small>{b.aliases.map((a) => a.alias).join(', ')}</small></td>
                <td>{b.active ? '✅' : '⛔'}</td>
                <td>{b.featured ? '⭐' : '—'}</td>
                <td className="admin-actions">
                  <button onClick={() => openEditForm(b)}>Sửa</button>
                  <button onClick={() => toggleActive(b)}>{b.active ? 'Ẩn' : 'Bật lại'}</button>
                  <button onClick={() => toggleFeatured(b)}>{b.featured ? 'Bỏ nổi bật' : 'Đặt nổi bật'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-toolbar">
        <strong>Brand ứng viên mới ({candidates.length})</strong>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Công ty</th><th>Số tin</th><th>Nơi làm việc</th><th>Tín hiệu chuỗi</th><th>Tin mẫu</th><th>Xử lý</th></tr></thead>
          <tbody>
            {candidates.length === 0 && <tr><td colSpan={6}><em>Không có ứng viên mới.</em></td></tr>}
            {candidates.map((c) => (
              <tr key={c.companyKey}>
                <td><strong>{c.companyName}</strong></td>
                <td>{c.jobCount}</td>
                <td><small>{c.locations.join(', ') || '—'}</small></td>
                <td>{c.chainSignal ? '🔗 có' : '—'}</td>
                <td><small>{c.sampleJob.title}</small></td>
                <td className="admin-actions">
                  <button onClick={() => openApproveForm(c)}>Duyệt</button>
                  <button onClick={() => handleDismiss(c)}>Bỏ qua</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="admin-panel" style={{ border: '1px solid #e5e7eb', marginTop: '1rem', padding: '1rem' }}>
          <h3>{form.id ? 'Sửa brand' : 'Brand mới'}</h3>
          <p><label>Tên: <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label></p>
          <p><label>Slug: <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></label></p>
          <p><label>Ngành:{' '}
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as BrandCategoryId })}>
              {CATEGORY_OPTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label></p>
          <p><label>Domain (favicon, optional): <input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} /></label></p>
          <p><label>Chữ cái đại diện: <input value={form.initial} maxLength={2} onChange={(e) => setForm({ ...form, initial: e.target.value })} /></label></p>
          <p><label>Màu: <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></label></p>
          <p><label>Aliases (phân cách bằng dấu phẩy, alias đầu tiên là alias chính):{' '}
            <input style={{ width: '100%' }} value={form.aliasesText} onChange={(e) => setForm({ ...form, aliasesText: e.target.value })} />
          </label></p>
          <p>
            <label><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</label>
            {' '}
            <label><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Featured</label>
          </p>
          <div className="admin-actions">
            <button disabled={saving} onClick={handleSubmit}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
            <button disabled={saving} onClick={() => setForm(null)}>Hủy</button>
          </div>
        </div>
      )}
    </section>
  )
}
