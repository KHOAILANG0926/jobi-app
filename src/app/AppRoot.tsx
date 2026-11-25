import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AppShell from './AppShell'
import ScreenStub from './ScreenStub'
import { EMPLOYER_TABS, SEEKER_TABS } from './tabs'

// 주소는 /app 아래만 쓴다(vercel.json이 /app, /app/* 를 app.html로 보냄). 웹 주소와 섞이지 않는다.
export default function AppRoot() {
  return (
    <BrowserRouter basename="/app">
      <Routes>
        <Route element={<AppShell />}>
          {[...SEEKER_TABS, ...EMPLOYER_TABS].map((tab) => (
            <Route key={tab.key} path={tab.to} element={<ScreenStub />} />
          ))}
          <Route path="*" element={<ScreenStub />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
