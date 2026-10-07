// Chợ Tốt(vieclamtot.com) 박닌 공고 수집 — Chrome 확장 javascript_tool로 로그인된 탭에서 실행(DB 쓰기 없음).
// 1) 목록(/viec-lam-bac-ninh?page=N) HTML을 same-origin fetch로 읽어 상세 링크를 localStorage 'ct_links'에 모은다(페이지 간 1.5초 간격).
// 2) 아래 루프: 숨김 iframe(동일 출처)으로 상세를 열고, 'Hiện số' 버튼이 있을 때만 1회 클릭해 번호 확인.
//    제목·회사·주소·본문은 상세의 __NEXT_DATA__ JSON(ad 객체)에서 읽는다(2026-10-07 화면 개편으로 텍스트 파싱 불가).
//    결과는 localStorage 'ct_res'. 공고당 약 12~16초(5초 간격).
//    버튼이 있는데 번호가 안 열리는 경우가 연속 3건이면, 또는 차단 문구가 보이면 중단.
// 주의: 경고 감지에 'xác thực'·'hạn chế' 같은 일반 단어를 쓰지 말 것(오탐으로 멈춤 — 2026-10-07 실제 발생).
// 결과 반출: javascript_tool 출력은 약 1k자에서 잘리므로 공고 단위(또는 소량)로 잘라 받아 바로 파일에 저장한다(손으로 옮겨 쓰기 금지).
window.__ctStop = false; window.__ctLog = 'started'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const WARN = /tạm khóa|bị khóa|vượt quá giới hạn|quá nhiều lượt|captcha|robot/i
const findAd = d => {
  const s = d.querySelector('script#__NEXT_DATA__'); if (!s) return null
  let found = null
  const walk = (o, n) => { if (found || !o || typeof o !== 'object' || n > 9) return
    if (o.company_name !== undefined && o.subject !== undefined) { found = o; return }
    for (const k in o) walk(o[k], n + 1) }
  try { walk(JSON.parse(s.textContent), 0) } catch (e) {}
  return found
}
window.__ctRun = async () => {
  let failStreak = 0
  const links = JSON.parse(localStorage.getItem('ct_links') || '[]')
  for (const full of links) {
    if (window.__ctStop) break
    const id = full.match(/(\d+)\.htm/)[1]
    if (JSON.parse(localStorage.getItem('ct_res') || '{}')[id]) continue
    const fr = document.createElement('iframe')
    fr.style.cssText = 'width:1000px;height:800px;position:fixed;left:-2000px'
    fr.src = new URL(full).pathname
    document.body.appendChild(fr)
    try {
      await Promise.race([new Promise(r => fr.onload = r), sleep(15000)]); await sleep(2500)
      const d = fr.contentDocument
      const ad = findAd(d)
      const btn = [...d.querySelectorAll('*')].find(e => e.children.length == 0 && /^Hiện số/.test(e.textContent.trim()))
      let ph = ''
      if (btn) {
        btn.click(); await sleep(3500)
        const mm = (btn.textContent || '').match(/0\d{9,10}/)
        if (mm) ph = mm[0]
      }
      const w = (!ph && btn) ? WARN.exec(d.body.innerText.slice(0, 4000)) : null
      const o = JSON.parse(localStorage.getItem('ct_res') || '{}')
      o[id] = { u: new URL(full).pathname, sub: ad?.subject || '', co: ad?.company_name || '', acc: ad?.account_name || '',
        addr: [ad?.detail_address, ad?.ward_name_v3 || ad?.ward_name, ad?.area_name, ad?.region_name_v3 || ad?.region_name].filter(Boolean).join(', '),
        sal: ad?.price_string || '', date: ad?.date || '', lt: ad?.list_time || '', body: (ad?.body || '').slice(0, 2500),
        ph, masked: ad?.phone || '', btn: !!btn, ok: !!ad }
      localStorage.setItem('ct_res', JSON.stringify(o)); window.__ctLog = 'ok ' + id
      failStreak = (btn && !ph) ? failStreak + 1 : 0
      if (w || failStreak >= 3) { window.__ctLog = 'STOP ' + (w ? w[0] : 'nophone3'); fr.remove(); break }
    } catch (e) { window.__ctLog = 'err ' + id + ' ' + e.message }
    fr.remove(); await sleep(5000)
  }
  window.__ctLog += ' | finished'
}
window.__ctRun()
