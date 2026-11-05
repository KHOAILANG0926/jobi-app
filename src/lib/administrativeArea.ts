// Administrative approximations are resolver inputs only. Public maps read the
// resulting canonical job_work_locations row, never this reference dataset.
import { ADMINISTRATIVE_CITY_REPRESENTATIVES } from '../data/administrativeCityRepresentatives'
import { ORIGINAL_PROVINCES } from '../data/originalProvinceBoundaries'
import { normalizePlaceText } from './locationCandidateMatch'
export interface AdministrativeArea {
 key:string; aliases:string[]; lat:number; lng:number
 geometry:{type:string;coordinates:unknown}; proofType?:string; parentKey?:string
}
type Position=number[]
function ringContains(ring:Position[], lat:number,lng:number):boolean {
 let inside=false
 for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
  const [x,y]=ring[i], [px,py]=ring[j]
  if ((y>lat)!==(py>lat) && lng<(px-x)*(lat-y)/(py-y)+x) inside=!inside
 }
 return inside
}
// The original-province polygons are simplified Natural Earth ADM1 outlines (Bắc Ninh: 38 points), which cut
// real border land: KCN Yên Phong mở rộng (Yên Trung, Bắc Ninh) sits ~0.8 km outside the simplified edge.
// Points within this distance of the outline count as inside (Lee 2026-11-06, Google place #5438 rejected as "outside").
export const BOUNDARY_TOLERANCE_M=2000
function metersToSegment(lat:number,lng:number,a:Position,b:Position):number {
 const k=111320, c=Math.cos(lat*Math.PI/180)
 const ax=(a[0]-lng)*k*c, ay=(a[1]-lat)*k, bx=(b[0]-lng)*k*c, by=(b[1]-lat)*k
 const dx=bx-ax, dy=by-ay, len=dx*dx+dy*dy
 const t=len?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/len)):0
 return Math.hypot(ax+t*dx, ay+t*dy)
}
function nearRing(ring:Position[], lat:number,lng:number, meters:number):boolean {
 for(let i=0,j=ring.length-1;i<ring.length;j=i++) if(metersToSegment(lat,lng,ring[j],ring[i])<=meters)return true
 return false
}
export function areaContains(area:AdministrativeArea, point:{lat:number;lng:number}):boolean {
 if(!Number.isFinite(point.lat)||!Number.isFinite(point.lng))return false
 if(area.proofType==='trusted_city_representative' && (Math.abs(point.lat-area.lat)>1e-8||Math.abs(point.lng-area.lng)>1e-8))return false
 const polygons=(area.geometry.type==='Polygon'?[area.geometry.coordinates]:area.geometry.coordinates) as Position[][][]
 if(polygons.some(rings=>ringContains(rings[0],point.lat,point.lng)&&!rings.slice(1).some(r=>ringContains(r,point.lat,point.lng))))return true
 return polygons.some(rings=>nearRing(rings[0],point.lat,point.lng,BOUNDARY_TOLERANCE_M))
}
export const ADMINISTRATIVE_AREAS=ORIGINAL_PROVINCES
export function administrativeArea(text:string):AdministrativeArea|null {
 const normalized=' '+normalizePlaceText(text)+' '
 const matches=ADMINISTRATIVE_AREAS.filter(a=>a.aliases.some(alias=>normalized.includes(' '+alias+' ')))
 if(matches.length!==1)return null
 let area=matches[0]
 const cities=ADMINISTRATIVE_CITY_REPRESENTATIVES.filter(c=>c.aliases.some(alias=>normalized.includes(' '+alias+' ')))
 if(cities.length>1)return null
 if(cities.length===1) {
  if(cities[0].parentKey!==area.key)return null
  area={...cities[0],geometry:area.geometry}
 }
 // An explicit subprovincial city must have its own boundary. A province
 // polygon cannot prove containment in the named city.
 const city=/(?:^| )(?:tp|thanh pho) /.test(normalizePlaceText(text))
 if(city && !area.key.startsWith('city:') && area.key!=='province:ha noi' && area.key!=='province:ho chi minh' && area.key!=='province:hai phong' && area.key!=='province:da nang' && area.key!=='province:can tho')return null
 return areaContains(area,area)?area:null
}
export function administrativeAreaForAddresses(addresses:string[]):AdministrativeArea|null {
 const inputs=addresses.filter(Boolean)
 const areas=inputs.map(administrativeArea)
 // An explicitly named city without proof cannot borrow the broader province.
 if(inputs.some((text,i)=>!areas[i]&&/(?:^| )(?:tp|thanh pho) /.test(normalizePlaceText(text))))return null
 const known=areas.filter((area):area is AdministrativeArea=>area!==null)
 if(!known.length)return null
 const specific=known.find(a=>a.key.startsWith('city:'))??known[0]
 return known.every(a=>a.key===specific.key||a.key===specific.parentKey)?specific:null
}
/** A concrete workplace's own named area precedes a multi-area job summary. */
export function administrativeAreaForTarget(address:string,context:string):AdministrativeArea|null {
 return administrativeArea(address)??administrativeAreaForAddresses([address,context])
}
