// 간편 템플릿 결과 HTML 정리: 실행되는 것(스크립트·틀·이벤트·javascript: 주소)은 지운다. 브라우저에서만(미리보기).
export function sanitizeTemplateHtml(html?: string): string {
  if (!html || typeof DOMParser === 'undefined') return ''
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  doc.querySelectorAll('script,iframe,object,embed,link,meta,form,base').forEach((el) => el.remove())
  doc.querySelectorAll('*').forEach((el) => {
    for (const a of Array.from(el.attributes)) {
      const v = a.value.trim().toLowerCase()
      if (a.name.startsWith('on') || ((a.name === 'href' || a.name === 'src') && (v.startsWith('javascript:') || v.startsWith('data:text')))) el.removeAttribute(a.name)
    }
  })
  return doc.body.firstElementChild?.innerHTML ?? ''
}
