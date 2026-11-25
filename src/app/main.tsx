import '../lib/browserEnvInstall' // 브라우저 저장소·이벤트 어댑터를 다른 모듈보다 먼저 끼운다(구조 정리 3번)
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AppRoot from './AppRoot'
import './app.css'
import './map.css' // 웹 지도 스타일 복사본(scripts/app/sync-map-css.mjs가 만들고 mapStyle.test.ts가 어긋남을 잡음)

// 앱 전용 입구(app.html). 웹 입구(src/main.tsx)·index.css·웹 화면은 불러오지 않는다.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
)
