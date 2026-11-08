// Lee 2026-11-08 "왜 이렇게 촌스럽냐 → 지금 바꿔": 사이트 바닥을 알바몬 구성 그대로(위 줄 = 도움말 링크·SNS, 가운데 = 회사 정보·고객센터, 아래 = 약관 링크·저작권).
// PC·모바일 공용(LayoutDesktop·LayoutMobile). 내용(이메일·시간·링크)은 기존 바닥 그대로 옮김, 새 정보 없음.
// 주의: JSX 글자에 &nbsp; 같은 HTML 엔티티를 쓰지 않는다(2026-09-22 SSR/클라이언트 hydration 불일치 사고).
const FB = 'M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z'
const IG = 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z'
const YT = 'M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z'

export function SiteFooter() {
  return (
    <footer className="layout__footer site-footer">
      <div className="site-footer__bar">
        <div className="site-footer__in site-footer__bar-in">
          <nav className="site-footer__help" aria-label="Hỗ trợ">
            <a href="/ho-tro">Câu hỏi thường gặp ›</a>
            <a href="mailto:support@viecganban.vn">Liên hệ 1:1 ›</a>
          </nav>
          <div className="site-footer__sns">
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="is-fb"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d={FB} /></svg></a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="is-ig"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d={IG} /></svg></a>
            <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="is-yt"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d={YT} /></svg></a>
          </div>
        </div>
      </div>
      <div className="site-footer__in site-footer__main">
        <div className="site-footer__co">
          <p className="site-footer__logo"><img src="/logo.png" alt="" width="24" height="24" />Việcganban</p>
          <p className="site-footer__name">Việt Gần Bạn</p>
          <p className="site-footer__txt">Email: support@viecganban.vn</p>
        </div>
        <div className="site-footer__cs">
          <p className="site-footer__cs-h">Trung tâm hỗ trợ</p>
          <p className="site-footer__cs-mail">support@viecganban.vn</p>
          <p className="site-footer__txt">T2–T6, 09:00–18:00</p>
        </div>
      </div>
      <div className="site-footer__in">
        <nav className="site-footer__links" aria-label="Liên kết">
          <a href="/dieu-khoan">Điều khoản sử dụng</a>
          <a href="/chinh-sach-bao-mat"><b>Chính sách bảo mật</b></a>
          <a href="/">Tìm việc làm</a>
          <a href="/dang-tin">Tuyển dụng</a>
          <a href="/lam-poster">Làm poster tuyển dụng</a>
          <a href="/cong-dong">Cộng đồng</a>
        </nav>
        <p className="site-footer__copy">© {new Date().getFullYear()} Việt Gần Bạn. All rights reserved.</p>
      </div>
    </footer>
  )
}
