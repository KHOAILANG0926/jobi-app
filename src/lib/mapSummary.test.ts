const assert = { equal(a: unknown, b: unknown, message = '') { if (a !== b) throw new Error(message || `${a} !== ${b}`) }, deepEqual(a: unknown, b: unknown, message = '') { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(message || 'not equal') } }
import * as model from './mapR1.ts'
import { DEFAULT_FILTERS } from './homeMapFilters.ts'
import type { Job } from '../types/job'
assert.equal(typeof model.summarizeMapEntries, 'function', 'map results need a unique-job industry summary')
const job = (id: string, category = 'san_xuat_xay_dung', urgent = false) => ({id, category, urgent, title:id, company:'', salary:'Thỏa thuận', location:''} as Job)
const jobs = [job('a', 'am_thuc_do_uong', true), job('b'), job('no-point')]
const reps = {a:{lat:21.1,lng:106.07,kind:'area' as const,source:'verified area',checkedAt:'2026-10-22'},b:{lat:21.2,lng:106.1,kind:'area' as const,source:'verified area',checkedAt:'2026-10-22'}}
const bounds={west:106,east:106.2,south:21,north:21.3}
const search=(b=bounds,r:number|null=null)=>model.mapSearch(jobs,DEFAULT_FILTERS,r===null?null:{lat:21.1,lng:106.07},r,b,reps)
const summary=model.summarizeMapEntries(search().visibleEntries)
assert.equal(summary.total,2,'no-point job excluded')
assert.equal(summary.urgent,1)
assert.deepEqual(summary.categories,[{category:'am_thuc_do_uong',count:1},{category:'san_xuat_xay_dung',count:1}])
assert.equal(model.summarizeMapEntries(search({...bounds,north:21.15}).visibleEntries).total,1,'pan updates summary')
assert.equal(model.summarizeMapEntries(search(bounds,0.1).visibleEntries).total,1,'radius excludes outside representative even if pin remains')
assert.equal(model.summarizeMapEntries([...search().visibleEntries,...search().visibleEntries]).total,2,'one job counted once')
assert.deepEqual(model.summarizeMapEntries([]),{total:0,urgent:0,categories:[]})
console.log('mapSummary: viewport, radius, no-point, unique jobs, industries, urgent passed')
