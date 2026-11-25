import type { ReactNode } from 'react'
import { AuthProvider } from '../../context/AuthContext'
import { BrandsProvider } from '../../context/BrandsContext'
import { JobsProvider } from '../../context/JobsContext'

// 앱 데이터 공급자 — 웹(src/App.tsx)이 쓰는 같은 공급자(회원·공고·브랜드)를 그대로 쓴다. 공고 조회·공개 판정·위치 원본은
// 웹과 한 코드(src/context, src/lib)이므로 앱에서 따로 만들지 않는다.
export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <JobsProvider>
        <BrandsProvider>{children}</BrandsProvider>
      </JobsProvider>
    </AuthProvider>
  )
}
