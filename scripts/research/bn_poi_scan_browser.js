// VietMap 벡터 타일 POI 스캐너 — viecganban.vn 탭의 javascript_tool로 실행(DB 쓰기 없음). 2026-10-07 chotot 100건 좌표 후보 dry-run에 사용.
// 타일은 VietMap 독자 형식이라 Node에서 직접 디코딩할 수 없다(표준 MVT 아님) → 공식 SDK(@vietmap/vietmap-gl-js)로 브라우저에서 읽는다.
// 키: 사이트 지도가 이미 요청한 style URL의 apikey(= VITE_VIETMAP_TILEMAP_KEY, 클라이언트 번들에 실리는 공개 키)를 performance 항목에서 읽는다. 파일·로그에 남기지 않는다.
// 입력: localStorage 'vm_tiles' = [[x,y],…] (z15 타일, scripts/research/bn_poi_plan2.mjs 산출). 출력: localStorage 'vm_poi'(이름 있는 POI), 요청 수 = 타일 수(위치당 1 타일).
// 내보내기: 클릭 제스처로 클립보드 복사 → PowerShell로 out/vm_poi.json 저장(손으로 옮기지 않음). 숨김 탭이면 렌더가 멈추므로 screenshot으로 깨운다.
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  const e = performance.getEntriesByType('resource').map(r => r.name).filter(n => /maps\.vietmap\.vn\/maps\/styles/.test(n))
  const key = (e.map(n => (n.match(/[?&]apikey=([^&]+)/) || [])[1]).filter(Boolean))[0]
  await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@vietmap/vietmap-gl-js@6.0.1/dist/vietmap-gl.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s) })
  const div = document.createElement('div'); div.style.cssText = 'position:fixed;left:-6000px;top:0;width:300px;height:300px'; document.body.appendChild(div)
  const map = new vietmapgl.Map({ container: div, style: `https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=${key}`, center: [105.98, 21.08], zoom: 15, attributionControl: false, fadeDuration: 0 })
  const tiles = JSON.parse(localStorage.getItem('vm_tiles')), poi = JSON.parse(localStorage.getItem('vm_poi') || '{}'), n = 2 ** 15
  const cen = (x, y) => [(x + 0.5) / n * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 0.5) / n))) * 180 / Math.PI]
  for (let i = +(localStorage.getItem('vm_idx') || 0); i < tiles.length; i++) {
    const [lng, lat] = cen(...tiles[i]); map.jumpTo({ center: [lng, lat], zoom: 15 })
    const t0 = Date.now(); while (Date.now() - t0 < 9000) { map.triggerRepaint(); if (map.isStyleLoaded() && map.areTilesLoaded()) break; await sleep(300) }
    await sleep(250)
    for (const ft of map.querySourceFeatures('openmaptiles', { sourceLayer: 'poi' })) {
      const p = ft.properties || {}, nm = p.name || p['name:vi']; const g = ft.geometry; if (!nm || g?.type !== 'Point') continue
      const k = nm + '|' + g.coordinates[0].toFixed(5) + '|' + g.coordinates[1].toFixed(5)
      if (!poi[k]) poi[k] = { n: nm, c: p.class || '', s: p.subclass || '', lng: +g.coordinates[0].toFixed(6), lat: +g.coordinates[1].toFixed(6) }
    }
    if (i % 10 === 9) { localStorage.setItem('vm_poi', JSON.stringify(poi)); localStorage.setItem('vm_idx', String(i + 1)) }
    await sleep(700) // 천천히 — 위치당 1 타일, 같은 타일은 지도 캐시
  }
  localStorage.setItem('vm_poi', JSON.stringify(poi)); localStorage.setItem('vm_idx', String(tiles.length))
})()
