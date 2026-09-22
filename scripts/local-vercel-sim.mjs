// vercel.json의 실제 rewrite 규칙을 그대로 재현하는 로컬 검증 서버 —
// `vercel dev`가 이 프로젝트의 Dev Command 설정(plain `vite`) 때문에
// api/ssr.js를 안 타고 그냥 vite로 프록시돼서 못 쓰길래(2026-09-22 확인),
// 배포 없이 실제 SSR 응답을 브라우저로 확인하기 위해 최소 재현 서버를
// 직접 만든다. 프로덕션 코드가 아니라 검증 전용 스크립트 — dist/를
// `npm run build`로 먼저 만들어둔 뒤 실행해야 한다.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ssrHandler from '../api/ssr.js'
import sitemapHandler from '../api/sitemap.xml.js'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const DIST = join(ROOT, 'dist')

const MIME = {
  '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon',
  '.html': 'text/html', '.woff2': 'font/woff2',
}

// vercel.json과 동일한 정적 슬러그 제외 목록 + :id 패턴 — api/ssr.js
// 내부에도 같은 목록이 있지만, 여기서는 "이 요청을 SSR로 보낼지 정적
// 파일/SPA로 보낼지" 라우팅 단계를 재현해야 해서 별도로 필요하다.
const STATIC_SLUGS = new Set(['da-luu', 'da-xem', 'phu-hop', 'goi-y', 'tuyen-gap', 'tim-kiem'])

function wrapRes(nodeRes) {
  const wrapped = {
    statusCode: 200,
    setHeader: (k, v) => nodeRes.setHeader(k, v),
    end: (body) => { nodeRes.statusCode = wrapped.statusCode; nodeRes.end(body) },
  }
  return wrapped
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const pathname = url.pathname

  if (pathname === '/sitemap.xml') {
    await sitemapHandler(req, wrapRes(res))
    return
  }

  const jobLamMatch = pathname.match(/^\/viec-lam\/([^/]+)$/)
  const isUrgentList = pathname === '/viec-lam/tuyen-gap'
  const isSearch = pathname === '/viec-lam/tim-kiem'
  const isJobDetail = jobLamMatch && !STATIC_SLUGS.has(jobLamMatch[1])
  if (isUrgentList || isSearch || isJobDetail) {
    await ssrHandler(req, wrapRes(res))
    return
  }

  // 정적 자산(dist/assets/*, /logo.png 등) 먼저 시도, 없으면 SPA
  // index.html로 폴백 — vercel.json의 `/((?!api/).*) -> /index.html`과 동일.
  const staticPath = join(DIST, pathname)
  try {
    const st = await stat(staticPath)
    if (st.isFile()) {
      const body = await readFile(staticPath)
      res.setHeader('Content-Type', MIME[extname(staticPath)] ?? 'application/octet-stream')
      res.end(body)
      return
    }
  } catch { /* fall through to SPA index.html */ }

  const indexHtml = await readFile(join(DIST, 'index.html'))
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(indexHtml)
})

const PORT = 3100
server.listen(PORT, () => {
  console.log(`local-vercel-sim listening on http://localhost:${PORT}`)
})
