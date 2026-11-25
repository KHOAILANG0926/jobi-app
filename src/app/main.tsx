import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AppRoot from './AppRoot'
import './app.css'

// 앱 전용 입구(app.html). 웹 입구(src/main.tsx)·index.css·웹 화면은 불러오지 않는다.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
)
