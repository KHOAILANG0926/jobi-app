import { administrativeArea, areaContains, ADMINISTRATIVE_AREAS, administrativeAreaForTarget } from './administrativeArea'
function assert(value:unknown,message:string):asserts value {if(!value)throw new Error(message)}
const bacNinh = administrativeArea('Đường Nguyễn Văn Cừ, Bắc Ninh')
assert(bacNinh, 'original province gets administrative representative')
assert(bacNinh.key==='province:bac ninh','province identity retained')
assert(areaContains(bacNinh, {lat:21.1861,lng:106.0763}),'known city center inside original province')
assert(!areaContains(bacNinh,{lat:14.0583,lng:108.2772}),'Vietnam center is outside original province')
assert(administrativeArea('Không có vị trí')===null,'unknown text never creates nationwide point')
assert(administrativeArea('Bắc Ninh, Hà Nội')===null,'conflicting provinces not guessed')
const city=administrativeArea('TP. Bắc Ninh, Bắc Ninh')
assert(city && city.key==='city:bac ninh','explicit city uses sourced city representative before province')
assert(areaContains(city,{lat:21.18608,lng:106.07632}),'gazetteer witness proves representative lies in named city')
assert(!areaContains(city,{lat:21.098,lng:106.117}),'provincial interior point cannot pass city witness')
assert(administrativeArea('TP. Hải Dương, Hải Dương')===null,'unavailable other city boundary fails honestly')
for (const area of ADMINISTRATIVE_AREAS) assert(areaContains(area,area),area.key+' reference representative inside original polygon')
for(const name of ['Hải Dương','Bình Phước','Bà Rịa - Vũng Tàu'])assert(administrativeArea(name),name+' original province retained')
console.log('administrativeArea: province containment and unavailable city boundary assertions passed')

assert(administrativeArea('Đường A - TP. Hải Dương, Hải Dương')===null,'embedded unknown city never broadens to province')
assert(administrativeArea('Ngô Tất Tố - TP. Bắc Ninh')?.key==='city:bac ninh','hyphen embedded explicit city uses known locality witness')

assert(administrativeAreaForTarget('Hải Dương','Hải Dương, Hà Nội')?.key==='province:hai duong','concrete workplace does not inherit unrelated province conflict from summary')
