import { lazy, Suspense, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useJobs } from '../../context/JobsContext'
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
  const response=await fetch('/api/admin-location-review',{
    method:action==='list'?'GET':'POST',
    headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},
    ...(data?{body:JSON.stringify({action,...data})}:{})
  })
  const result=await response.json()
  if(!response.ok)throw new Error(result.error||'Không thể xác nhận vị trí')
  return result
}

function LocationReviewItem({job,onComplete}:{job:PendingJob;onComplete:()=>void}) {
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
  const searchUrl='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(job.address)
  return <article className="admin-location-card" style={{border:'1px solid #ddd',borderRadius:0,marginBottom:12,padding:12}}>
    <strong>#{job.jobId} — {job.title}</strong>
    <p>{job.company}</p>
    <p><b>Địa chỉ gốc:</b> {job.address || 'Không có địa chỉ trong tin — cần bổ sung nguồn trước khi xác nhận'}</p>
    <p><b>Ghim hiện tại:</b> {job.approximate
      ? `${job.approximate.lat.toFixed(6)}, ${job.approximate.lng.toFixed(6)} — ${job.approximate.accuracy}`
      : 'Chưa có tọa độ, chỉ hiển thị khu vực'}</p>
    {job.address && <p><a href={searchUrl} target="_blank" rel="noopener noreferrer">Xem địa chỉ gốc trên Google Maps</a></p>}
    <label>Liên kết chia sẻ Google Maps (bao gồm maps.app.goo.gl)
      <input style={{display:'block',width:'100%'}} type="url" value={link} onChange={e=>setLink(e.target.value)}
        placeholder="https://maps.app.goo.gl/..." />
    </label>
    <button type="button" disabled={busy||!link.trim()} onClick={()=>void resolve()}>Xem tọa độ từ liên kết</button>
    <p>Hoặc chạm vào bản đồ/vệ tinh để đặt ghim xác nhận.</p>
    <Suspense fallback={<p>Đang tải bản đồ…</p>}>
      <AdminVietMap center={point||job.approximate||CENTER}
        markers={point?[{id:'selected',...point,label:'Vị trí sẽ xác nhận',status:'picked'}]:
          job.approximate?[{id:'approx',...job.approximate,label:'Vị trí tạm',status:'pending'}]:[]}
        onPick={(p:AdminMapPick)=>{setPoint({lat:p.lat,lng:p.lng});setResolvedUrl('');setError('')}} height={260} />
    </Suspense>
    {point&&<p><b>Ghim sẽ xác nhận:</b> {point.lat.toFixed(6)}, {point.lng.toFixed(6)}</p>}
    {error&&<p role="alert" className="admin-error">{error}</p>}
    <button type="button" disabled={!point||busy||!job.address} onClick={()=>void confirm()}>Xác nhận tọa độ</button>
  </article>
}

export function AdminLocationReviewQueue(){
  const { refreshJobs } = useJobs()
  const [jobs,setJobs]=useState<PendingJob[]>([])
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(true)
  const load=async()=>{
    setBusy(true)
    try {const data=await request('list') as ReviewReply;setJobs(data.pending);setError('')}
    catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  }
  useEffect(()=>{void load()},[])
  return <section className="admin-panel">
    <h2>Vị trí cần xác nhận ({jobs.length})</h2>
    <p>Chỉ những tin chưa có tọa độ chính xác. Sắp xếp từ cũ nhất.</p>
    <button type="button" disabled={busy} onClick={()=>void load()}>Làm mới</button>
    {error&&<p className="admin-error" role="alert">{error}</p>}
    {!busy&&jobs.length===0&&<p>Không có tin chờ xác nhận.</p>}
    {jobs.map(job=><LocationReviewItem key={job.jobId} job={job} onComplete={()=>{void refreshJobs();void load()}}/>)}
  </section>
}
