import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useJobs } from '../../context/JobsContext'
import { externalMapLinks, findRegionCenter } from '../../lib/jobCoords'
import type { AdminMapPick } from './AdminVietMap'

const AdminVietMap = lazy(() => import('./AdminVietMap'))
type Point = {lat:number;lng:number}
type PendingJob = {jobId:number;title:string;company:string;address:string;createdAt:string;
  workLocationId:number|null;approximate:(Point & {accuracy:string})|null}
type ReviewReply = {pending:PendingJob[];count:number}
const CENTER = {lat:21.1861,lng:106.0763}

async function request(action:'list'|'resolve'|'confirm', data?:object) {
  const {data:auth}=await supabase.auth.getSession()
  const token=auth.session?.access_token
  if(!token)throw new Error('Đăng nhập quản trị trước khi xác nhận')
  const response=await fetch('/api/admin?action=location-review',{
    method:action==='list'?'GET':'POST',
    headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},
    ...(data?{body:JSON.stringify({action,...data})}:{})
  })
  const result=await response.json()
  if(!response.ok)throw new Error(result.error||'Không thể xác nhận vị trí')
  return result
}

// Lee 2026-10-30: 엑셀처럼 목록 → 줄을 누르면 문제 부분만 펼침. 문제는 빨강, 해결되면 초록,
// 모두 초록이면 큰 "수정 완료" 버튼 → 저장되면 목록에서 사라진다.
const ROW_GRID = '70px minmax(0,2fr) minmax(0,1.2fr) minmax(0,2.4fr) 170px'
const RED = '#d92d20', GREEN = '#15803d'

function LocationReviewItem({job,open,onToggle,onComplete}:{job:PendingJob;open:boolean;onToggle:()=>void;onComplete:()=>void}) {
  const [link,setLink]=useState('')
  const [point,setPoint]=useState<Point|null>(null)
  const [resolvedUrl,setResolvedUrl]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  async function resolve() {
    setBusy(true);setError('');setPoint(null);setResolvedUrl('')
    try {
      const result=await request('resolve',{link})
      setPoint(result.point);setResolvedUrl(result.point.resolvedUrl||'')
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  }
  async function confirm() {
    if(!point||busy)return
    setBusy(true);setError('')
    try {
      await request('confirm',{jobId:job.jobId,address:job.address,
        workLocationId:job.workLocationId,lat:point.lat,lng:point.lng,googleLink:resolvedUrl})
      onComplete()
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  }
  const areaFallback = !job.approximate ? findRegionCenter(job.address) : null
  const rough = job.approximate || (areaFallback ? {...areaFallback,accuracy:'region/ward — approximate'} : null)
  // 2026-10-30 Lee: 앱 메인·상세의 "Xem trên Google Maps"와 같은 방식(같은 함수)으로 연다 — 좌표가 있으면 좌표 중심, 없을 때만 주소 글자 검색.
  const searchUrl=(rough && externalMapLinks(rough,false,14)?.view) || 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(job.address)
  const locationOk=!!point && !!job.address
  const allOk=locationOk
  const status=allOk
    ? <span style={{color:GREEN,fontWeight:700}}>🟢 Sẵn sàng (준비됨)</span>
    : <span style={{color:RED,fontWeight:700}}>🔴 Vị trí chưa xác nhận</span>
  return <article className="admin-location-card" style={{borderBottom:'1px solid #e5e7eb',background:open?'#fafafa':'#fff'}}>
    <button type="button" onClick={onToggle} aria-expanded={open}
      style={{display:'grid',gridTemplateColumns:ROW_GRID,gap:12,width:'100%',padding:'10px 12px',textAlign:'left',background:'none',border:0,cursor:'pointer',font:'inherit',alignItems:'center'}}>
      <strong>#{job.jobId} —</strong>
      <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{job.title}</span>
      <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{job.company}</span>
      <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{job.address || '—'}</span>
      {status}
    </button>
    {open && <div style={{padding:'4px 12px 16px'}}>
      <div style={{border:`2px solid ${locationOk?GREEN:RED}`,borderRadius:8,padding:12}}>
        <p style={{margin:'0 0 8px',color:locationOk?GREEN:RED,fontWeight:700}}>
          {locationOk ? `🟢 Vị trí sẽ xác nhận: ${point!.lat.toFixed(6)}, ${point!.lng.toFixed(6)}`
            : job.address ? '🔴 Vị trí chưa xác nhận — chạm vào bản đồ hoặc dán liên kết Google Maps (지도에서 자리를 누르거나 링크를 넣으세요)'
            : '🔴 Không có địa chỉ trong tin — cần bổ sung nguồn trước khi xác nhận'}
        </p>
        <p style={{margin:'4px 0'}}><b>Địa chỉ gốc:</b> {job.address || '—'}</p>
        <p style={{margin:'4px 0'}}><b>Ghim hiện tại:</b> {rough
          ? `${rough.lat.toFixed(6)}, ${rough.lng.toFixed(6)} — ${rough.accuracy}`
          : 'Chưa có tọa độ, chỉ hiển thị khu vực'}</p>
        {job.address && <p style={{margin:'4px 0'}}><a href={searchUrl} target="_blank" rel="noopener noreferrer">Xem địa chỉ gốc trên Google Maps</a></p>}
        <label>Liên kết chia sẻ Google Maps (bao gồm maps.app.goo.gl)
          <input style={{display:'block',width:'100%'}} type="url" value={link} onChange={e=>setLink(e.target.value)}
            placeholder="https://maps.app.goo.gl/..." />
        </label>
        <button type="button" disabled={busy||!link.trim()} onClick={()=>void resolve()}>Xem tọa độ từ liên kết</button>
        <Suspense fallback={<p>Đang tải bản đồ…</p>}>
          <AdminVietMap center={point||rough||CENTER}
            markers={point?[{id:'selected',...point,label:'Vị trí sẽ xác nhận',status:'picked'}]:
              rough?[{id:'approx',...rough,label:'Vị trí tạm',status:'pending'}]:[]}
            onPick={(p:AdminMapPick)=>{setPoint({lat:p.lat,lng:p.lng});setResolvedUrl('');setError('')}} height={260} />
        </Suspense>
      </div>
      {error&&<p role="alert" className="admin-error" style={{color:RED,fontWeight:700}}>{error}</p>}
      {allOk && <button type="button" disabled={busy} onClick={()=>void confirm()}
        style={{display:'block',width:'100%',marginTop:12,padding:'14px 16px',border:0,borderRadius:8,background:GREEN,color:'#fff',fontSize:16,fontWeight:700,cursor:'pointer'}}>
        {busy ? 'Đang lưu…' : '✔ Hoàn tất sửa (수정 완료)'}
      </button>}
    </div>}
  </article>
}

export function AdminLocationReviewQueue(){
  const { refreshJobs } = useJobs()
  const [jobs,setJobs]=useState<PendingJob[]>([])
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(true)
  const [openId,setOpenId]=useState<number|null>(null)
  const restoreScroll=useRef<{left:number;top:number}|null>(null)
  useLayoutEffect(()=>{
    if(!restoreScroll.current)return
    window.scrollTo({...restoreScroll.current,behavior:'instant'})
    restoreScroll.current=null
  },[jobs])
  const load=async(preserveScroll=true)=>{
    setBusy(true)
    try {
      const data=await request('list') as ReviewReply
      if(preserveScroll)restoreScroll.current={left:window.scrollX,top:window.scrollY}
      setJobs(data.pending);setError('')
    }
    catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  }
  useEffect(()=>{void load(false)},[])
  return <section className="admin-panel">
    <h2>Vị trí cần xác nhận ({jobs.length})</h2>
    <p>Chỉ những tin chưa có tọa độ chính xác. Sắp xếp từ cũ nhất.</p>
    <button type="button" disabled={busy} onClick={()=>void load()}>Làm mới</button>
    {error&&<p className="admin-error" role="alert">{error}</p>}
    {!busy&&jobs.length===0&&<p>Không có tin chờ xác nhận.</p>}
    {jobs.length>0&&<div style={{border:'1px solid #e5e7eb',borderRadius:8,overflow:'hidden'}}>
      <div style={{display:'grid',gridTemplateColumns:ROW_GRID,gap:12,padding:'8px 12px',background:'#f3f4f6',fontWeight:700,fontSize:13}}>
        <span>#</span><span>Tin (공고)</span><span>Công ty (회사)</span><span>Địa chỉ gốc (원문 주소)</span><span>Trạng thái (상태)</span>
      </div>
      {jobs.map(job=><LocationReviewItem key={job.jobId} job={job} open={openId===job.jobId}
        onToggle={()=>setOpenId(openId===job.jobId?null:job.jobId)}
        onComplete={()=>{setOpenId(null);void refreshJobs();void load()}}/>)}
    </div>}
  </section>
}
