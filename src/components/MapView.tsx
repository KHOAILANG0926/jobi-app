import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Job {
  id: number; title: string; company: string; location: string;
  salary: string; lat: number; lng: number; distance?: number;
}

const JOBS: Job[] = [
  { id:1, title:"Phục vụ quán cà phê", company:"Highlands Coffee", location:"Quận 1, TP.HCM", salary:"25.000đ/giờ", lat:10.7769, lng:106.7009 },
  { id:2, title:"Nhân viên bán hàng siêu thị", company:"WinMart", location:"Hà Đông, Hà Nội", salary:"6.500.000đ/tháng", lat:20.9678, lng:105.7800 },
  { id:3, title:"Giao hàng xe máy", company:"GrabFood", location:"Quận 3, TP.HCM", salary:"300.000đ/ngày", lat:10.7831, lng:106.6917 },
  { id:4, title:"Công nhân đóng gói", company:"Kho Logistics", location:"Bình Dương", salary:"200.000đ/ca", lat:10.9804, lng:106.6519 },
  { id:5, title:"Phục vụ nhà hàng", company:"Nhà hàng Ngon", location:"Hoàn Kiếm, Hà Nội", salary:"30.000đ/giờ", lat:21.0285, lng:105.8542 },
  { id:6, title:"Nhân viên rửa xe", company:"Car Wash 24h", location:"Quận 7, TP.HCM", salary:"150.000đ/ca", lat:10.7397, lng:106.7212 },
  { id:7, title:"Gia sư Toán", company:"Cá nhân", location:"Cầu Giấy, Hà Nội", salary:"150.000đ/giờ", lat:21.0356, lng:105.7941 },
  { id:8, title:"Nhân viên kho", company:"Lazada Vietnam", location:"Bình Tân, TP.HCM", salary:"180.000đ/ca", lat:10.7490, lng:106.6109 },
  { id:9, title:"Công nhân lắp ráp linh kiện", company:"Điện tử Bắc Ninh", location:"Bắc Ninh", salary:"35.000đ/giờ", lat:21.1861, lng:106.0763 },
  { id:10, title:"Nhân viên kho Samsung", company:"Samsung Bắc Ninh", location:"Bắc Ninh", salary:"180.000đ/ca", lat:21.1200, lng:106.0500 },
  { id:11, title:"Bảo vệ khu công nghiệp", company:"KCN Tiên Sơn", location:"Bắc Ninh", salary:"120.000đ/ca", lat:21.1500, lng:106.0800 },
  { id:12, title:"Tài xế giao hàng", company:"GHN Express", location:"Bắc Ninh", salary:"250.000đ/ngày", lat:21.1700, lng:106.0600 },
];

function calcDist(lat1:number,lng1:number,lat2:number,lng2:number){
  const R=6371,dLat=(lat2-lat1)*Math.PI/180,dLng=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

export default function MapView() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<L.Map|null>(null);
  const circleRef = useRef<L.Circle|null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const userLocRef = useRef<[number,number]|null>(null);

  const [radius, setRadius] = useState(5);
  const [jobs, setJobs] = useState<Job[]>(JOBS);
  const [hasLoc, setHasLoc] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job|null>(null);

  function filterAndRender(loc:[number,number], r:number){
    const filtered = JOBS.map(j=>({...j,distance:calcDist(loc[0],loc[1],j.lat,j.lng)})).filter(j=>j.distance<=r);
    setJobs(filtered);

    // 마커 업데이트
    markersRef.current.forEach(m=>m.remove());
    markersRef.current=[];
    if(mapInst.current){
      filtered.forEach(job=>{
        const m = L.marker([job.lat,job.lng])
          .addTo(mapInst.current!)
          .bindPopup(`<b style="color:#E84040">${job.title}</b><br/>${job.company}<br/><b style="color:#E84040">${job.salary}</b><br/><span style="color:#888;font-size:11px">📍 ${job.distance!.toFixed(1)}km</span>`);
        markersRef.current.push(m);
      });
    }

    // 원 업데이트
    if(circleRef.current){
      circleRef.current.setRadius(r*1000);
    }
  }

  useEffect(()=>{
    if(!mapRef.current || mapInst.current) return;

    const map = L.map(mapRef.current).setView([10.7769,106.7009],12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
      attribution:"© OpenStreetMap"
    }).addTo(map);
    mapInst.current = map;

    // 위치 없을 때 기본 마커
    JOBS.forEach(job=>{
      const m = L.marker([job.lat,job.lng])
        .addTo(map)
        .bindPopup(`<b style="color:#E84040">${job.title}</b><br/>${job.company}<br/><b style="color:#E84040">${job.salary}</b>`);
      markersRef.current.push(m);
    });

    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(pos=>{
        const loc:[number,number]=[pos.coords.latitude,pos.coords.longitude];
        userLocRef.current=loc;
        setHasLoc(true);
        map.setView(loc,13);

        // 내 위치 마커
        L.circleMarker(loc,{radius:10,color:"#4285F4",fillColor:"#4285F4",fillOpacity:1}).addTo(map);

        // 반경 원
        circleRef.current = L.circle(loc,{radius:5000,color:"#4285F4",fillOpacity:0.08,weight:2}).addTo(map);

        filterAndRender(loc, 5);
      });
    }
  },[]);

  function handleRadius(r:number){
    setRadius(r);
    if(userLocRef.current){
      filterAndRender(userLocRef.current, r);
    }
  }

  return (
    <div style={{fontFamily:"sans-serif"}}>
      <div style={{background:"#fff",borderBottom:"1px solid #f0f0f0",padding:"12px 16px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <span style={{fontWeight:700,fontSize:15}}>📍 Việc gần bạn</span>
        <div style={{display:"flex",gap:6}}>
          {[1,3,5,10].map(r=>(
            <button key={r} onClick={()=>handleRadius(r)} style={{padding:"5px 14px",borderRadius:20,border:"none",background:radius===r?"#E84040":"#f5f5f5",color:radius===r?"#fff":"#555",fontWeight:600,fontSize:13,cursor:"pointer"}}>
              {r} km
            </button>
          ))}
        </div>
        <span style={{marginLeft:"auto",color:"#E84040",fontWeight:700,fontSize:13}}>{jobs.length} việc làm</span>
      </div>

      <div ref={mapRef} style={{width:"100%",height:420}}/>

      <div style={{padding:"12px 16px"}}>
        <p style={{fontSize:13,color:"#888",marginBottom:10}}>
          {hasLoc?`Trong vòng ${radius}km từ vị trí của bạn`:"Tất cả khu vực"}
        </p>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {jobs.sort((a,b)=>(a.distance??99)-(b.distance??99)).map(job=>(
            <div key={job.id} onClick={()=>setSelectedJob(job)} style={{background:selectedJob?.id===job.id?"#fff5f5":"#fff",border:`1px solid ${selectedJob?.id===job.id?"#E84040":"#eee"}`,borderRadius:12,padding:"12px 14px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontWeight:700,fontSize:14,color:"#222"}}>{job.title}</div>
                <div style={{fontSize:12,color:"#888",marginTop:2}}>{job.company} · {job.location}</div>
                {job.distance!==undefined&&<div style={{fontSize:11,color:"#aaa",marginTop:2}}>📍 {job.distance.toFixed(1)} km</div>}
              </div>
              <div style={{color:"#E84040",fontWeight:700,fontSize:13,textAlign:"right",minWidth:90}}>{job.salary}</div>
            </div>
          ))}
          {jobs.length===0&&(
            <div style={{textAlign:"center",color:"#aaa",padding:32,fontSize:14}}>
              Không có việc làm trong vòng {radius}km 😢<br/>
              <button onClick={()=>handleRadius(10)} style={{marginTop:12,padding:"8px 20px",background:"#E84040",color:"#fff",border:"none",borderRadius:20,fontWeight:600,cursor:"pointer"}}>Mở rộng lên 10km</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}