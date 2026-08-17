export function PrivacyPolicy() {
  return (
    <div className="page page--narrow" style={{ padding: '2rem 1rem', maxWidth: 760, margin: '0 auto', lineHeight: 1.9 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Chính sách bảo mật</h1>
      <p style={{ color: '#888', marginBottom: '2rem' }}>Cập nhật lần cuối: 01/01/2026</p>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '1.5rem 0 0.5rem' }}>1. Thông tin chúng tôi thu thập</h2>
      <p>Việt Gần Bạn thu thập các thông tin sau khi bạn sử dụng dịch vụ:</p>
      <ul style={{ paddingLeft: '1.5rem' }}>
        <li>Thông tin tài khoản: họ tên, địa chỉ email, số điện thoại khi đăng ký.</li>
        <li>Thông tin hồ sơ: kinh nghiệm làm việc, kỹ năng, khu vực mong muốn làm việc.</li>
        <li>Dữ liệu sử dụng: trang đã xem, tìm kiếm, thời gian truy cập (qua cookie và log máy chủ).</li>
        <li>Thông tin thiết bị: loại trình duyệt, hệ điều hành, địa chỉ IP.</li>
      </ul>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '1.5rem 0 0.5rem' }}>2. Mục đích sử dụng thông tin</h2>
      <ul style={{ paddingLeft: '1.5rem' }}>
        <li>Cung cấp và cải thiện các tính năng của nền tảng.</li>
        <li>Kết nối người tìm việc với nhà tuyển dụng phù hợp.</li>
        <li>Gửi thông báo về việc làm mới, trạng thái ứng tuyển.</li>
        <li>Phân tích hành vi người dùng để cải thiện trải nghiệm.</li>
        <li>Ngăn chặn gian lận và bảo vệ an toàn hệ thống.</li>
      </ul>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '1.5rem 0 0.5rem' }}>3. Chia sẻ thông tin</h2>
      <p>Chúng tôi không bán thông tin cá nhân của bạn cho bên thứ ba. Thông tin chỉ được chia sẻ trong các trường hợp:</p>
      <ul style={{ paddingLeft: '1.5rem' }}>
        <li>Nhà tuyển dụng xem hồ sơ ứng tuyển mà bạn đã nộp.</li>
        <li>Đối tác cung cấp dịch vụ kỹ thuật (lưu trữ, phân tích) theo hợp đồng bảo mật.</li>
        <li>Cơ quan nhà nước khi có yêu cầu hợp pháp.</li>
      </ul>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '1.5rem 0 0.5rem' }}>4. Cookie và quảng cáo</h2>
      <p>
        Chúng tôi sử dụng cookie để lưu trạng thái đăng nhập và cá nhân hóa nội dung.
        Nền tảng có thể hiển thị quảng cáo từ Google AdSense. Google sử dụng cookie để
        hiển thị quảng cáo phù hợp với sở thích của bạn. Bạn có thể tắt quảng cáo cá nhân hóa
        tại <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" style={{ color: '#e53935' }}>adssettings.google.com</a>.
      </p>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '1.5rem 0 0.5rem' }}>5. Bảo mật dữ liệu</h2>
      <p>
        Dữ liệu được mã hóa khi truyền tải (HTTPS) và lưu trữ trên hạ tầng bảo mật.
        Chúng tôi áp dụng các biện pháp kỹ thuật và tổ chức để bảo vệ thông tin cá nhân
        khỏi truy cập trái phép, mất mát hoặc tiết lộ.
      </p>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '1.5rem 0 0.5rem' }}>6. Quyền của người dùng</h2>
      <ul style={{ paddingLeft: '1.5rem' }}>
        <li>Truy cập và chỉnh sửa thông tin cá nhân trong phần Hồ sơ.</li>
        <li>Yêu cầu xóa tài khoản và toàn bộ dữ liệu liên quan.</li>
        <li>Từ chối nhận email thông báo bằng cách hủy đăng ký trong email.</li>
      </ul>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '1.5rem 0 0.5rem' }}>7. Thay đổi chính sách</h2>
      <p>
        Chúng tôi có thể cập nhật chính sách này theo thời gian. Khi có thay đổi quan trọng,
        chúng tôi sẽ thông báo qua email hoặc thông báo trên trang web. Việc tiếp tục sử dụng
        dịch vụ sau khi chính sách được cập nhật đồng nghĩa với việc bạn chấp nhận các thay đổi đó.
      </p>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '1.5rem 0 0.5rem' }}>8. Liên hệ</h2>
      <p>
        Mọi thắc mắc về chính sách bảo mật, vui lòng liên hệ:<br />
        Email: <a href="mailto:support@viecganban.vn" style={{ color: '#e53935' }}>support@viecganban.vn</a>
      </p>
    </div>
  )
}
