// Chợ Tốt(vieclamtot.com) 박닌 공고 수집 — Chrome 확장 javascript_tool로 로그인된 탭에서 실행(DB 쓰기 없음).
// 1) 목록(/viec-lam-bac-ninh?page=N)에서 상세 링크를 localStorage 'ct_links'에 모은다(탭이 멈추면 navigate로 새로고침).
// 2) 아래 루프: 숨김 iframe(동일 출처)로 상세를 열고 'Hiện số'를 1회 클릭해 번호 확인, 결과는 localStorage 'ct_res'.
//    공고당 약 12~16초(5초 간격). 번호가 안 열리고 차단 문구가 있거나 4건 연속 번호 실패면 중단.
// 주의: 경고 감지에 'xác thực'·'hạn chế' 같은 일반 단어를 쓰지 말 것(오탐으로 멈춤 — 2026-10-07 실제 발생).
// 결과 추출은 localStorage → 본문 <pre> → get_page_text(javascript_tool 출력은 약 1k자에서 잘림).
window.__ctStop = false; window.__ctLog = 'started'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const WARN = /tạm khóa|bị khóa|vượt quá giới hạn|quá nhiều lượt|captcha|robot/i
window.__ctRun = async () => {
  let noPhoneStreak = 0
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
      const d = fr.contentDocument, f = d.querySelector('footer')
      const t = d.body.innerText.replace(f ? f.innerText : '', '')
      const btn = [...d.querySelectorAll('*')].find(e => e.children.length == 0 && /^Hiện số/.test(e.textContent.trim()))
      let ph = ''
      if (btn) {
        btn.click(); await sleep(3500)
        const mm = (btn.textContent || '').match(/0\d{9,10}/)
        if (mm) ph = mm[0]
      }
      const w = (!ph && btn) ? WARN.exec(d.body.innerText.slice(0, 4000)) : null
      const L = t.split('\n').map(s => s.trim()).filter(Boolean)
      const k = L.findIndex((l, i) => l.length > 5 && l === L[i + 1])
      const o = JSON.parse(localStorage.getItem('ct_res') || '{}')
      o[id] = { u: new URL(full).pathname, t: L[k] || d.title, c: L[k + 2] || '', s: L[k + 3] || '', a: L[k + 4] || '', w2: L[k + 5] || '', ph, nb: !btn }
      localStorage.setItem('ct_res', JSON.stringify(o)); window.__ctLog = 'ok ' + id
      noPhoneStreak = (btn && !ph) ? noPhoneStreak + 1 : 0
      if (w || noPhoneStreak >= 4) { window.__ctLog = 'STOP'; fr.remove(); break }
    } catch (e) { window.__ctLog = 'err ' + id + ' ' + e.message }
    fr.remove(); await sleep(5000)
  }
  window.__ctLog += ' | finished'
}
window.__ctRun()
