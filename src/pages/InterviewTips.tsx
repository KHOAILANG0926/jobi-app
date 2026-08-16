import { useState } from 'react'

type Category = 'chung' | 'fnb' | 'retail' | 'factory'

interface QA {
  q: string
  points: string[]
  example?: string
}

const DATA: Record<Category, { label: string; items: QA[] }> = {
  chung: {
    label: 'Câu hỏi chung',
    items: [
      {
        q: 'Hãy giới thiệu bản thân bạn.',
        points: [
          'Trả lời trong 1–2 phút: tên, tuổi, học vấn, kinh nghiệm liên quan',
          'Kết thúc bằng lý do ứng tuyển vị trí này',
          'Giọng điệu tự tin, nhìn thẳng người phỏng vấn',
        ],
        example: '"Em tên A, 22 tuổi, đã có 6 tháng làm phục vụ tại quán cà phê X. Em muốn tìm công việc ổn định hơn và gần nhà để tiết kiệm thời gian đi lại."',
      },
      {
        q: 'Tại sao bạn muốn làm việc tại đây?',
        points: [
          'Nghiên cứu trước về thương hiệu, văn hóa, địa điểm',
          'Tránh câu chung chung như "vì công ty nổi tiếng"',
          'Gắn lý do cá nhân cụ thể (gần nhà, giờ ca phù hợp, yêu thích sản phẩm)',
        ],
        example: '"Em chọn vì cửa hàng gần nhà, ca làm phù hợp lịch học, và em đã là khách hàng thân thiết của thương hiệu này từ lâu."',
      },
      {
        q: 'Điểm mạnh và điểm yếu của bạn?',
        points: [
          'Điểm mạnh: chọn 1–2 điểm thực sự liên quan đến công việc',
          'Điểm yếu: nêu thật nhưng kèm cách bạn đang khắc phục',
          'Không nói điểm yếu quá nghiêm trọng hoặc giả tạo',
        ],
        example: '"Điểm mạnh của em là cẩn thận và chịu khó. Điểm yếu là đôi khi em quá cầu toàn, nhưng em đang học cách ưu tiên việc quan trọng hơn."',
      },
      {
        q: 'Bạn có thể bắt đầu làm việc từ khi nào?',
        points: [
          'Trả lời thẳng và chính xác',
          'Nếu cần thời gian: nêu lý do ngắn gọn (bàn giao chỗ cũ, sắp xếp gia đình)',
          'Tránh trả lời mơ hồ hoặc "tùy công ty"',
        ],
        example: '"Em có thể bắt đầu từ tuần sau" hoặc "Em cần khoảng 1 tuần để bàn giao công việc cũ, tức là bắt đầu được từ ngày 20."',
      },
      {
        q: 'Mức lương mong muốn của bạn là bao nhiêu?',
        points: [
          'Tìm hiểu mức thị trường trước khi phỏng vấn',
          'Đưa ra khoảng lương thực tế dựa trên kinh nghiệm',
          'Có thể hỏi ngược về mức lương công ty đang trả để định hướng',
        ],
        example: '"Em mong muốn khoảng 6–7 triệu/tháng cho vị trí full-time, nhưng em cũng linh hoạt tùy theo phúc lợi đi kèm như bảo hiểm và phụ cấp."',
      },
      {
        q: 'Bạn có câu hỏi nào cho chúng tôi không?',
        points: [
          'Luôn chuẩn bị ít nhất 1–2 câu hỏi — không hỏi bị đánh giá thiếu chủ động',
          'Hỏi về lịch ca, lộ trình đào tạo, hoặc văn hóa nhóm',
          'Tránh hỏi ngay về lương/thưởng nếu chưa được đề cập',
        ],
        example: '"Ca làm việc cụ thể được sắp xếp như thế nào?" hoặc "Sau thời gian thử việc, công ty có chương trình phát triển nào cho nhân viên ạ?"',
      },
    ],
  },
  fnb: {
    label: 'F&B / Cà phê / Nhà hàng',
    items: [
      {
        q: 'Bạn có kinh nghiệm phục vụ hoặc pha chế chưa?',
        points: [
          'Nếu có: nêu cụ thể nơi làm, thời gian, nhiệm vụ chính',
          'Nếu chưa: nhấn mạnh khả năng học nhanh và chịu khó',
          'Mọi kinh nghiệm liên quan đều có giá trị (phụ bán hàng gia đình, quán ăn nhỏ)',
        ],
        example: '"Em chưa có kinh nghiệm chính thức, nhưng em đã phụ giúp gia đình bán hàng ăn 2 năm và rất quen với môi trường bếp núc và phục vụ khách."',
      },
      {
        q: 'Khi khách phàn nàn về đồ uống hoặc món ăn, bạn xử lý thế nào?',
        points: [
          'Quy tắc 3 bước: Lắng nghe — Xin lỗi — Giải quyết',
          'Không tranh cãi, không đổ lỗi cho đồng nghiệp',
          'Nếu vượt thẩm quyền: báo ngay quản lý, không để khách chờ lâu',
        ],
        example: '"Em sẽ xin lỗi khách trước, hỏi kỹ vấn đề, rồi đề xuất đổi món hoặc hoàn tiền tùy tình huống. Nếu cần thiết em sẽ mời quản lý hỗ trợ."',
      },
      {
        q: 'Bạn có thể làm ca sáng sớm (5–6h) hoặc ca tối muộn không?',
        points: [
          'Trả lời thật — xung đột ca sẽ gây vấn đề sau khi nhận việc',
          'Nếu được: nêu rõ "em có phương tiện, ở gần đây"',
          'Nếu có giới hạn: nêu sớm và đề xuất ca phù hợp thay thế',
        ],
        example: '"Em có thể làm ca sáng từ 5h30 vì em ở gần đây và có xe máy. Ca tối em có thể đến 22h."',
      },
      {
        q: 'Khi quán đông khách, nhiều bàn gọi cùng lúc, bạn xử lý thế nào?',
        points: [
          'Ưu tiên theo thứ tự: ghi chú rõ ràng, phục vụ theo thứ tự gọi',
          'Chủ động nhờ đồng nghiệp hỗ trợ khi quá tải',
          'Luôn giữ thái độ vui vẻ, xin lỗi khách nếu chờ lâu',
        ],
        example: '"Em sẽ ghi nhanh order các bàn, ưu tiên bàn đã chờ lâu nhất, và nếu cần thì báo đồng nghiệp hỗ trợ để không bàn nào bị bỏ quên."',
      },
      {
        q: 'Bạn biết pha những loại đồ uống nào?',
        points: [
          'Liệt kê cụ thể dù chỉ là cơ bản (cà phê đen, trà đá, sinh tố)',
          'Thể hiện sẵn sàng học thêm kỹ thuật mới',
          'Nếu có chứng chỉ barista hoặc pha chế: đây là lợi thế lớn',
        ],
        example: '"Em biết pha cà phê phin, bạc xỉu, trà đào cơ bản. Em chưa có kỹ năng espresso chuyên nghiệp nhưng rất muốn được đào tạo thêm."',
      },
    ],
  },
  retail: {
    label: 'Bán lẻ / Siêu thị',
    items: [
      {
        q: 'Bạn đã từng làm thu ngân hoặc bán hàng chưa?',
        points: [
          'Nếu có: nêu loại hàng hóa, quy mô cửa hàng, thời gian',
          'Nếu chưa: nhấn mạnh tính cẩn thận với con số, học phần mềm POS nhanh',
          'Đề cập kinh nghiệm xử lý tiền mặt hoặc giao dịch nếu có',
        ],
        example: '"Em chưa làm thu ngân chính thức nhưng em hay phụ ba mẹ bán hàng tạp hóa, quen tính tiền và trả lại tiền thừa cho khách hàng ngày."',
      },
      {
        q: 'Khi khách tranh cãi về giá hoặc từ chối trả thêm phí, bạn xử lý thế nào?',
        points: [
          'Giữ bình tĩnh, không cãi nhau trước mặt khách khác',
          'Giải thích lịch sự dựa trên quy định của cửa hàng',
          'Nếu không giải quyết được: mời quản lý, không tự quyết định ngoại lệ',
        ],
        example: '"Em sẽ bình tĩnh giải thích chính sách giá của cửa hàng. Nếu khách vẫn không đồng ý, em sẽ lịch sự mời quản lý xuống hỗ trợ."',
      },
      {
        q: 'Bạn có thể đứng ca dài 8–10 tiếng không?',
        points: [
          'Trả lời tự tin nếu bạn đã quen làm việc đứng nhiều',
          'Có thể hỏi thêm về lịch nghỉ giải lao trong ca',
          'Nếu chưa thử: thể hiện tinh thần sẵn sàng thích nghi',
        ],
        example: '"Em tin mình có thể thích nghi được. Em thường hay đi lại và đứng nhiều trong sinh hoạt hàng ngày, sức khỏe tốt."',
      },
      {
        q: 'Bạn có kinh nghiệm sắp xếp hàng hóa, kiểm kho không?',
        points: [
          'Nêu bất kỳ kinh nghiệm liên quan: bán hàng, phụ kho, cửa hàng gia đình',
          'Nhấn mạnh tính cẩn thận, ngăn nắp và chú ý hạn sử dụng',
          'Đây là kỹ năng học được nhanh — thể hiện thái độ sẵn lòng học',
        ],
        example: '"Em đã phụ sắp xếp hàng và kiểm tra hạn dùng tại tạp hóa nhà. Em khá ngăn nắp và luôn chú ý để hàng gần hết hạn ra ngoài trước."',
      },
      {
        q: 'Bạn có thể làm ca đêm hoặc ngày lễ, Tết không?',
        points: [
          'Bán lẻ thường yêu cầu linh hoạt cao, đặc biệt mùa lễ Tết',
          'Nếu được: nói rõ và hỏi về phụ cấp ca đêm/lễ',
          'Nếu có ràng buộc: nêu thẳng sớm tránh mâu thuẫn sau',
        ],
        example: '"Em có thể làm ca đêm và ngày lễ. Em muốn hỏi thêm về mức phụ cấp ca đêm và lễ của công ty ạ?"',
      },
    ],
  },
  factory: {
    label: 'Nhà máy / Sản xuất',
    items: [
      {
        q: 'Bạn có kinh nghiệm làm trong môi trường nhà máy chưa?',
        points: [
          'Nếu có: nêu loại nhà máy, dây chuyền, thời gian làm',
          'Nếu chưa: nhấn mạnh thể lực, kỷ luật, sẵn sàng học quy trình',
          'Bất kỳ công việc chân tay, lao động nặng nào cũng là kinh nghiệm liên quan',
        ],
        example: '"Em chưa làm nhà máy nhưng em quen làm việc chân tay và nghiêm chỉnh tuân thủ nội quy. Em tin mình có thể thích nghi nhanh với dây chuyền."',
      },
      {
        q: 'Bạn có thể làm ca đêm hoặc ca xoay (sáng–chiều–tối luân phiên) không?',
        points: [
          'Đây là câu hỏi quan trọng nhất khi ứng tuyển nhà máy',
          'Trả lời thẳng thắn — xung đột ca gây hậu quả nghiêm trọng',
          'Nếu được: thể hiện đã chuẩn bị tinh thần cho điều này',
        ],
        example: '"Em có thể làm ca xoay, em đã sắp xếp sinh hoạt cá nhân phù hợp và hiểu đây là yêu cầu của công việc."',
      },
      {
        q: 'Bạn có thể làm việc thể chất 8–12 tiếng không?',
        points: [
          'Khẳng định sức khỏe nếu bạn đã có kinh nghiệm lao động chân tay',
          'Có thể hỏi thêm về thời gian giải lao và phụ cấp làm thêm giờ',
          'Đây cũng là cơ hội để hỏi về bảo hộ lao động, điều kiện làm việc',
        ],
        example: '"Em thường xuyên làm việc nặng và quen đứng lâu. Em cũng muốn hỏi về chính sách làm thêm giờ của xưởng ạ."',
      },
      {
        q: 'Khi phát hiện sản phẩm lỗi trên dây chuyền, bạn làm gì?',
        points: [
          'Không tự xử lý hoặc bỏ qua để đảm bảo chỉ tiêu',
          'Tách sản phẩm lỗi ra khỏi dây chuyền ngay lập tức',
          'Báo ngay tổ trưởng hoặc QC — thể hiện tinh thần trách nhiệm',
        ],
        example: '"Em sẽ tách sản phẩm lỗi ra, ghi chú lại và báo ngay cho tổ trưởng hoặc bộ phận kiểm soát chất lượng, không tự quyết định xử lý."',
      },
      {
        q: 'Bạn có thể làm thêm giờ khi có đơn hàng gấp không?',
        points: [
          'Thể hiện sự linh hoạt nhưng vẫn giữ quyền lợi cá nhân',
          'Đề xuất được thông báo trước để sắp xếp',
          'Hỏi về mức phụ cấp làm thêm giờ nếu chủ đề chưa được đề cập',
        ],
        example: '"Em có thể làm thêm giờ khi cần, nhưng mong công ty thông báo trước để em sắp xếp. Mức phụ cấp OT được tính như thế nào ạ?"',
      },
      {
        q: 'Bạn có tuân thủ nghiêm các quy định an toàn lao động không?',
        points: [
          'Khẳng định dứt khoát — đây là điểm cộng lớn với mọi nhà tuyển dụng',
          'Đội mũ, mang giày bảo hộ, không dùng điện thoại tại khu vực nguy hiểm',
          'Nếu biết quy định cụ thể của ngành: nêu ra để thể hiện am hiểu',
        ],
        example: '"Dạ có. An toàn lao động là ưu tiên số một. Em luôn trang bị đầy đủ bảo hộ cá nhân và tuân thủ nội quy xưởng."',
      },
    ],
  },
}

const TABS: { key: Category; label: string }[] = [
  { key: 'chung',   label: 'Câu hỏi chung' },
  { key: 'fnb',     label: 'F&B / Cà phê' },
  { key: 'retail',  label: 'Bán lẻ / Siêu thị' },
  { key: 'factory', label: 'Nhà máy' },
]

function AccordionItem({ item, index }: { item: QA; index: number }) {
  const [open, setOpen] = useState(false)
  const num = String(index + 1).padStart(2, '0')

  return (
    <div className={`it2-item${open ? ' it2-item--open' : ''}`}>
      <button type="button" className="it2-item__header" onClick={() => setOpen(o => !o)}>
        <span className="it2-item__num">{num}</span>
        <span className="it2-item__q">{item.q}</span>
        <svg
          className="it2-item__chevron"
          width="18" height="18" viewBox="0 0 18 18" fill="none"
        >
          <path d="M5 7l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="it2-item__body">
          {/* Key points */}
          <div className="it2-points">
            <p className="it2-points__label">Điểm cần nhớ</p>
            <ul className="it2-points__list">
              {item.points.map((p, i) => (
                <li key={i} className="it2-points__item">
                  <span className="it2-points__dot" />
                  {p}
                </li>
              ))}
            </ul>
          </div>

          {/* Example */}
          {item.example && (
            <div className="it2-example">
              <p className="it2-example__label">Ví dụ thực tế</p>
              <p className="it2-example__text">{item.example}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function InterviewTips() {
  const [cat, setCat] = useState<Category>('chung')
  const current = DATA[cat]

  return (
    <div className="page page--narrow it2-page">

      {/* Header */}
      <div className="it2-header">
        <span className="it2-header__eyebrow">Chuẩn bị phỏng vấn</span>
        <h1 className="it2-header__title">Câu hỏi thường gặp<br/>và cách trả lời</h1>
        <p className="it2-header__desc">
          Tổng hợp những câu hỏi nhà tuyển dụng hay hỏi nhất,
          kèm gợi ý trả lời thực tế cho từng ngành.
        </p>
      </div>

      {/* Tabs */}
      <div className="it2-tabs">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`it2-tab${cat === key ? ' it2-tab--active' : ''}`}
            onClick={() => setCat(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Count */}
      <p className="it2-count">{current.items.length} câu hỏi</p>

      {/* Accordion list */}
      <div className="it2-list">
        {current.items.map((item, i) => (
          <AccordionItem key={`${cat}-${i}`} item={item} index={i} />
        ))}
      </div>

      {/* Footer tip */}
      <div className="it2-tip">
        <span className="it2-tip__icon">💡</span>
        <div>
          <strong>Mẹo quan trọng</strong>
          <p>Đến sớm 10–15 phút · Ăn mặc gọn gàng · Mang CCCD và bản sao bằng cấp nếu có</p>
        </div>
      </div>
    </div>
  )
}

export default InterviewTips
