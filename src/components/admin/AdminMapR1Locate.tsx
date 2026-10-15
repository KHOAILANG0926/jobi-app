import { useState } from 'react'
import { supabase } from '../../lib/supabase'
/** Same lease, two-call budget, matching and persistence as GitHub Actions. */
export function AdminMapR1Locate({ onChanged, label = 'MAP-R1: Tự động xác định vị trí tin mới' }: { onChanged?: () => Promise<void>; label?: string }) {
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const run=async()=>{
    setBusy(true)
    try {
      const {data}=await supabase.auth.getSession()
      const token=data.session?.access_token
      if(!token)throw new Error('Phiên đăng nhập đã hết hạn.')
      const response=await fetch('/api/admin-auto-location',{method:'POST',headers:{Authorization:`Bearer ${token}`}})
      const body=await response.json()
      if(!response.ok)throw new Error(body.error==='map_r1_not_enabled'?'MAP-R1 chưa được kích hoạt sau khi duyệt cấu trúc dữ liệu.':'Chưa xử lý được vị trí. Không thay đổi trạng thái hiển thị tin.')
      await onChanged?.()
      setMessage(`Đã xử lý: ${body.processed} · Chính xác: ${body.exact} · Đại diện: ${body.representative} · Chưa rõ: ${body.unresolved} · API: ${body.apiCalls} · Lỗi: ${body.failed}`)
    }catch(e){setMessage(e instanceof Error?e.message:'Không xử lý được vị trí.')}
    finally{setBusy(false)}
  }
  return <div><button type="button" disabled={busy} onClick={run}>{busy?'Đang xử lý…':label}</button><p role="status">{message}</p></div>
}
