// 업데이트 호환 시험용 작은 전환 프록시(격리 실제 스택 E2E 전용): 같은 주소(origin)로 '옛 빌드'와 '새 빌드'를 번갈아 내보낸다.
// 브라우저 입장에서는 같은 사이트가 배포로 새 버전이 된 것과 같다(저장값·세션·서비스 워커·캐시가 그대로 남는다).
// 사용: node scripts/ops/switch-proxy.mjs <포트> <옛 빌드 포트> <새 빌드 포트>  — GET /__switch?to=old|new 로 전환.
import http from 'node:http'
const [port, oldPort, newPort] = process.argv.slice(2).map(Number)
let target = newPort
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x')
  if (u.pathname === '/__switch') { target = u.searchParams.get('to') === 'old' ? oldPort : newPort; res.end(String(target)); return }
  const up = http.request({ host: '127.0.0.1', port: target, method: req.method, path: req.url, headers: { ...req.headers, host: `127.0.0.1:${target}` } }, (r) => { res.writeHead(r.statusCode ?? 502, r.headers); r.pipe(res) })
  up.on('error', () => { res.statusCode = 502; res.end() })
  req.pipe(up)
}).listen(port, '127.0.0.1', () => console.log(`switch-proxy ${port} → old ${oldPort} / new ${newPort}`))
