import { useState } from 'react'

type Category = 'chung' | 'fnb' | 'retail' | 'factory'

interface QA {
  q: string
  a: string
}

const DATA: Record<Category, { label: string; icon: string; items: QA[] }> = {
  chung: {
    label: 'Câu hỏi chung',
    icon: '💬',
    items: [
      {
        q: 'Hãy giới thiệu bản thân bạn.',
        a: 'Trả lời ngắn gọn trong 1–2 phút: tên, tuổi, quê quán, trình độ học vấn và kinh nghiệm làm việc liên quan. Kết thúc bằng lý do bạn ứng tuyển vị trí này. Ví dụ: "Em tên A, 22 tuổi, đã có 6 tháng làm phục vụ tại quán cà phê X, hiện đang tìm công việc ổn định hơn gần nhà."',
      },
      {
        q: 'Tại sao bạn muốn làm việc tại đây?',
        a: 'Nghiên cứu trước về công ty: thương hiệu, văn hóa làm việc, vị trí địa lý. Trả lời trung thực và cụ thể — tránh câu chung chung "vì công ty nổi tiếng". Ví dụ: "Em chọn vì cửa hàng gần nhà, giờ ca phù hợp với lịch học và em đã từng là khách hàng thường xuyên."',
      },
      {
        q: 'Điểm mạnh và điểm yếu của bạn là gì?',
        a: 'Điểm mạnh: chọn 1–2 điểm thực sự liên quan đến công việc (cẩn thận, chịu khó, giao tiếp tốt). Điểm yếu: nêu thật nhưng kèm hành động khắc phục. Ví dụ: "Em đôi khi quá cầu toàn, nhưng em đang học cách ưu tiên công việc quan trọng hơn."',
      },
      {
        q: 'Bạn có thể bắt đầu làm việc từ khi nào?',
        a: 'Trả lời thẳng thắn và chính xác. Nếu cần thời gian báo trước cho chỗ cũ hoặc sắp xếp việc gia đình, hãy nói rõ. Ví dụ: "Em có thể bắt đầu từ tuần sau" hoặc "Em cần 1 tuần để bàn giao công việc cũ."',
      },
      {
        q: 'Mức lương mong muốn của bạn?',
        a: 'Tìm hiểu mức thị trường trước khi phỏng vấn. Đưa ra khoảng lương thực tế dựa trên kinh nghiệm của bạn. Ví dụ: "Em mong muốn khoảng 6–7 triệu/tháng cho vị trí full-time, nhưng em cũng linh hoạt tùy theo phúc lợi đi kèm."',
      },
      {
        q: 'Bạn có câu hỏi gì cho chúng tôi không?',
        a: 'Luôn chuẩn bị 1–2 câu hỏi thể hiện sự quan tâm. Ví dụ: "Ca làm việc cụ thể sẽ được sắp xếp như thế nào?" hoặc "Sau thời gian thử việc, công ty có lộ trình phát triển gì cho nhân viên?"',
      },
    ],
  },
  fnb: {
    label: 'F&B / Cà phê / Nhà hàng',
    icon: '☕',
    items: [
      {
        q: 'Bạn có kinh nghiệm phục vụ hoặc pha chế chưa?',
        a: 'Nếu có: nêu cụ thể nơi làm, thời gian, nhiệm vụ. Nếu chưa: nhấn mạnh khả năng học nhanh và tinh thần chịu khó. Ví dụ: "Em chưa có kinh nghiệm chính thức nhưng đã giúp gia đình bán hàng ăn và rất quen với môi trường bếp núc."',
      },
      {
        q: 'Bạn xử lý thế nào khi khách hàng phàn nàn về đồ uống/món ăn?',
        a: 'Quy tắc 3 bước: Lắng nghe — Xin lỗi — Giải quyết. Không tranh cãi với khách. Ví dụ: "Em sẽ lắng nghe khách, xin lỗi về trải nghiệm chưa tốt, sau đó đề xuất đổi món hoặc báo cáo cho quản lý để xử lý phù hợp nhất."',
      },
      {
        q: 'Bạn có thể làm ca sáng sớm (5–6 giờ sáng) hoặc ca tối muộn không?',
        a: 'Trả lời thật. Nếu được thì nói rõ: "Em có thể làm ca sáng từ 5h30, em ở gần đây và có phương tiện." Nếu có giới hạn thì nêu sớm để tránh xung đột sau.',
      },
      {
        q: 'Bạn xử lý thế nào khi quán rất đông, nhiều bàn gọi cùng lúc?',
        a: 'Nhấn mạnh kỹ năng ưu tiên và bình tĩnh. Ví dụ: "Em sẽ ghi chú rõ ràng, phục vụ theo thứ tự gọi món, nếu quá tải thì chủ động nhờ đồng nghiệp hỗ trợ và luôn giữ thái độ vui vẻ với khách."',
      },
      {
        q: 'Bạn có dị ứng thực phẩm hoặc vấn đề sức khỏe khi đứng lâu không?',
        a: 'Trả lời trung thực. Công việc F&B yêu cầu đứng và di chuyển nhiều giờ. Nếu có vấn đề sức khỏe liên quan, hãy trao đổi thẳng để cả hai phía tránh khó khăn sau này.',
      },
      {
        q: 'Bạn biết pha những loại đồ uống nào?',
        a: 'Liệt kê cụ thể những gì bạn biết dù chỉ là cơ bản (cà phê đen, cà phê sữa, trà đá...). Thể hiện sẵn sàng học thêm: "Em chưa biết pha espresso chuyên nghiệp nhưng rất muốn được đào tạo thêm."',
      },
    ],
  },
  retail: {
    label: 'Bán lẻ / Siêu thị',
    icon: '🛍️',
    items: [
      {
        q: 'Bạn đã từng làm thu ngân hoặc bán hàng chưa?',
        a: 'Nếu có kinh nghiệm: nêu cụ thể loại hàng hóa, quy mô cửa hàng. Nếu chưa: "Em chưa có kinh nghiệm thu ngân nhưng em cẩn thận với con số, học nhanh và sẵn sàng được đào tạo về phần mềm POS."',
      },
      {
        q: 'Bạn xử lý thế nào khi khách tranh cãi về giá hoặc từ chối trả thêm phí?',
        a: 'Giữ bình tĩnh, giải thích lịch sự dựa trên quy định. Nếu không giải quyết được thì mời quản lý hỗ trợ. Tuyệt đối không cãi nhau hay mất bình tĩnh trước khách.',
      },
      {
        q: 'Bạn có thể đứng ca dài (8–10 tiếng) không?',
        a: 'Trả lời thật và tự tin nếu bạn đã quen. Nếu chưa thử: "Em tin mình có thể thích nghi được, em sức khỏe tốt và sẵn sàng thử thách." Có thể hỏi lại về lịch nghỉ giải lao trong ca.',
      },
      {
        q: 'Bạn có kinh nghiệm sắp xếp hàng hóa, kiểm kho không?',
        a: 'Mô tả bất kỳ kinh nghiệm liên quan: bán hàng tạp hóa, phụ giúp gia đình, kho xưởng... Nhấn mạnh tính cẩn thận và ngăn nắp.',
      },
      {
        q: 'Bạn làm gì khi phát hiện hàng hết hoặc không tìm được hàng trong kho?',
        a: 'Quy trình chuẩn: kiểm tra hệ thống hoặc hỏi đồng nghiệp trước, sau đó báo quản lý. Thông báo lịch sự cho khách về tình trạng hàng và gợi ý sản phẩm thay thế nếu có.',
      },
      {
        q: 'Bạn có thể làm ca đêm hoặc ngày lễ/Tết không?',
        a: 'Bán lẻ thường yêu cầu linh hoạt về lịch, đặc biệt dịp Tết và lễ lớn. Nếu được: nói rõ và hỏi về phụ cấp ca đêm/lễ. Nếu có ràng buộc: nêu sớm và thẳng thắn.',
      },
    ],
  },
  factory: {
    label: 'Nhà máy / Sản xuất',
    icon: '🏭',
    items: [
      {
        q: 'Bạn có kinh nghiệm làm việc trong môi trường nhà máy chưa?',
        a: 'Nếu có: nêu loại nhà máy, dây chuyền, thời gian. Nếu chưa: nhấn mạnh thể lực tốt, kỷ luật, sẵn sàng học quy trình mới. Ví dụ: "Em chưa làm nhà máy nhưng em quen làm việc chân tay và tuân thủ nội quy nghiêm."',
      },
      {
        q: 'Bạn có thể làm ca đêm hoặc ca xoay (sáng-chiều-tối luân phiên) không?',
        a: 'Đây là câu hỏi quan trọng nhất khi ứng tuyển nhà máy. Trả lời thẳng thắn. Nếu được: "Em có thể làm ca xoay, em đã chuẩn bị tinh thần cho điều này." Nếu có giới hạn: nêu rõ để tránh ảnh hưởng sau.',
      },
      {
        q: 'Bạn có thể đứng hoặc làm việc thể chất 8–12 tiếng không?',
        a: 'Khẳng định sức khỏe của bạn. Nếu đã quen lao động chân tay: "Em thường xuyên làm việc nặng và quen với việc đứng lâu." Có thể hỏi thêm về thời gian giải lao và phụ cấp làm thêm giờ.',
      },
      {
        q: 'Bạn xử lý thế nào khi phát hiện sản phẩm lỗi trên dây chuyền?',
        a: 'Không tự xử lý hay bỏ qua. Quy trình đúng: dừng lại, tách sản phẩm lỗi ra, báo ngay cho tổ trưởng hoặc QC. Thể hiện tinh thần trách nhiệm với chất lượng sản phẩm.',
      },
      {
        q: 'Bạn có thể làm thêm giờ khi có đơn hàng gấp không?',
        a: '"Em có thể làm thêm giờ khi cần thiết, nhưng mong công ty thông báo trước để em sắp xếp." Đây là câu trả lời cân bằng — thể hiện linh hoạt nhưng vẫn giữ quyền lợi cá nhân.',
      },
      {
        q: 'Bạn có bằng lái xe hoặc chứng chỉ nghề liên quan không?',
        a: 'Liệt kê tất cả bằng cấp, chứng chỉ bạn có (xe nâng, hàn xì, điện, cơ khí...). Nếu chưa có nhưng đang học hoặc có kinh nghiệm thực tế thì nêu rõ.',
      },
      {
        q: 'Bạn có biết tuân thủ an toàn lao động (đội mũ, mang giày bảo hộ) không?',
        a: 'Khẳng định dứt khoát: "Dạ có, an toàn lao động là ưu tiên hàng đầu. Em luôn trang bị đầy đủ bảo hộ và tuân thủ nội quy nhà máy." Đây là điểm cộng lớn với nhà tuyển dụng.',
      },
    ],
  },
}

function AccordionItem({ item }: { item: QA }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`it-item${open ? ' it-item--open' : ''}`}>
      <button type="button" className="it-item__q" onClick={() => setOpen(o => !o)}>
        <span>{item.q}</span>
        <svg className="it-item__arrow" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
        </svg>
      </button>
      {open && <div className="it-item__a">{item.a}</div>}
    </div>
  )
}

export function InterviewTips() {
  const [cat, setCat] = useState<Category>('chung')
  const current = DATA[cat]

  return (
    <div className="page page--narrow it-page">
      <h1 className="it-title">Câu hỏi phỏng vấn thường gặp</h1>
      <p className="it-subtitle">Chuẩn bị trước để tự tin hơn trong buổi phỏng vấn xin việc</p>

      {/* Category tabs */}
      <div className="it-tabs">
        {(Object.keys(DATA) as Category[]).map(key => (
          <button
            key={key}
            type="button"
            className={`it-tab${cat === key ? ' it-tab--active' : ''}`}
            onClick={() => setCat(key)}
          >
            {DATA[key].icon} {DATA[key].label}
          </button>
        ))}
      </div>

      {/* Questions */}
      <div className="it-list">
        <p className="it-list__count">{current.items.length} câu hỏi</p>
        {current.items.map((item, i) => (
          <AccordionItem key={i} item={item} />
        ))}
      </div>

      <div className="it-tip">
        💡 <strong>Mẹo chung:</strong> Đến sớm 10–15 phút, ăn mặc gọn gàng phù hợp vị trí, mang theo CMND/CCCD và bản sao bằng cấp nếu có.
      </div>
    </div>
  )
}

export default InterviewTips
