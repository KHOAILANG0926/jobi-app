const assert = { equal(a: unknown, b: unknown, msg = '') { if (a !== b) throw new Error(msg || `${a} !== ${b}`) }, deepEqual(a: unknown, b: unknown, msg = '') { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(msg || 'not equal') } }
import { parseJobSearchParamsFromQueryString, filterAndSortJobs } from './jobSearch.ts'
import type { Job } from '../types/job.ts'
const jobs = [
 {id:'regular-day',urgent:false,jobDuration:'Một ngày',laborContractPledge:true},
 {id:'regular-week',urgent:false,jobDuration:'Dưới 1 tuần',socialInsurancePledge:true},
 {id:'urgent-long',urgent:true,jobDuration:'Trên 1 năm'},
 {id:'unknown',urgent:false},
].map(j=>({title:j.id,company:'Fixture',location:'Bắc Ninh',category:'san_xuat_xay_dung',salary:'Thỏa thuận',...j} as Job))
const search=(q:string)=>filterAndSortJobs(jobs,parseJobSearchParamsFromQueryString(q),new Map()).map(j=>j.id)
assert.deepEqual(search('?duration=M%E1%BB%99t+ng%C3%A0y'),['regular-day'],'duration searches ordinary postings too, excluding unknown and other periods')
assert.deepEqual(search('?pledge=1'),['regular-day','regular-week'],'either explicit contract or insurance pledge qualifies, including nonurgent jobs')
assert.deepEqual(search('?urgent=1'),['urgent-long'],'urgent remains explicitly urgent-only')
assert.deepEqual(search('?duration=D%C6%B0%E1%BB%9Bi+1+tu%E1%BA%A7n&pledge=1'),['regular-week'],'duration and pledge intersect')
assert.deepEqual(search('?urgent=1&pledge=1'),[],'unknown pledge must never qualify')
assert.equal(search('').length,4,'clearing conditions restores all postings')
console.log('jobSearchMenu: ordinary/urgent, explicit/missing pledge, duration and combined conditions passed')
