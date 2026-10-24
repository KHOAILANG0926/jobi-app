// CTY KDA (#4824) versus other published detail pages, PC/mobile, image normal/blocked.
// Measurement comes from the existing decision 0005 instrument; do not invent a missing approved drawing.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { measureJob } from '../layout/measure.mjs'

const jobs = ['4824', '4828', '4878']
const views = ['pc', 'mobile']
const keys = [
  'header.logo.w', 'header.logo.h', 'header.logo.top', 'header.chips.top',
  'header.title.font', 'header.company.font', 'header.salary.value.font',
  'tabs.h', 'mobile-cta.h', 'mobile-cta.w',
]
const browser = await chromium.launch()
const findings = []
const measured = {}
try {
  for (const id of jobs) for (const view of views) for (const noimg of [false, true]) {
    const key = id + '-' + view + (noimg ? '-noimg' : '')
    measured[key] = await measureJob(browser, id, view, { blockImages: noimg })
    const data = measured[key]
    if (!data['header.title.font']) findings.push(key + ': missing detail heading font / detail page')
    if (!data['sections.order']) findings.push(key + ': missing detail content sections')
    if (data['content.conditions.broken-items'] > 0) findings.push(key + ': broken work-condition items')
  }
  for (const view of views) for (const noimg of [false, true]) {
    const ending = '-' + view + (noimg ? '-noimg' : '')
    const base = measured['4824' + ending]
    for (const id of jobs.slice(1)) {
      const comparison = measured[id + ending]
      for (const metric of keys) {
        if (base[metric] === undefined || comparison[metric] === undefined) continue
        if (typeof base[metric] === 'number' && typeof comparison[metric] === 'number') {
          if (Math.abs(base[metric] - comparison[metric]) > 2) findings.push(id + ending + ': ' + metric + ' diverges from CTY KDA (' + comparison[metric] + ' vs ' + base[metric] + ')')
        } else if (base[metric] !== comparison[metric]) findings.push(id + ending + ': ' + metric + ' differs from CTY KDA (' + comparison[metric] + ' vs ' + base[metric] + ')')
      }
    }
  }
  for (const id of jobs) for (const view of views) {
    const normal = measured[id + '-' + view]
    const blocked = measured[id + '-' + view + '-noimg']
    for (const metric of ['header.logo.w', 'header.logo.h', 'header.title.font', 'sections.order']) {
      if (normal[metric] !== blocked[metric]) findings.push(id + '-' + view + ': image failure changes layout ' + metric)
    }
  }
} finally { await browser.close() }
mkdirSync('layout-out', { recursive: true })
writeFileSync('layout-out/kda-comparison.json', JSON.stringify({ jobs, views, findings, measured }, null, 2))
console.log('CTY KDA comparison: ' + (jobs.length * views.length * 2) + ' browser detail captures')
for (const finding of findings) console.log('::error::' + finding)
if (findings.length) process.exit(1)
console.log('CTY KDA reference comparison PASS')
