import type { JobCategory } from '../types/job'

/** crawler/classifier.py의 SUBCATEGORY_LABELS와 반드시 같은 값을 유지해야
 * 한다(같은 판정이 두 파일에 따로 있으면 어긋나는 위험 — 이 세션에서 이미
 * 여러 번 겪은 패턴). local_jobs.subcategory 컬럼에 저장되는 값(예:
 * 'pha_che')은 여기 키와 정확히 일치한다. 'other' 대분류는 소분류 규칙
 * 자체가 없어(classifier.py도 동일) 여기 없음. */
export const SUBCATEGORY_LABELS: Partial<Record<JobCategory, Record<string, string>>> = {
  cafe: {
    pha_che: 'Pha chế / Barista',
    phuc_vu_quan: 'Phục vụ quán',
    thu_ngan: 'Thu ngân',
  },
  restaurant: {
    bep: 'Bếp (đầu bếp / phụ bếp)',
    phuc_vu_ban: 'Phục vụ bàn',
    rua_bat: 'Rửa bát / dọn dẹp',
    thu_ngan: 'Thu ngân',
  },
  retail: {
    thu_ngan: 'Thu ngân',
    ban_hang: 'Bán hàng / Tư vấn bán hàng',
    quan_ly_cua_hang: 'Quản lý cửa hàng',
    kinh_doanh: 'Kinh doanh / Đại diện kinh doanh',
  },
  delivery: {
    giao_hang_xe_may: 'Giao hàng xe máy / Shipper',
    lai_xe: 'Lái xe / Tài xế',
    kho_van: 'Kho vận / Logistics',
  },
  cleaning: {
    ve_sinh_cong_nghiep: 'Vệ sinh công nghiệp / văn phòng',
    giup_viec_nha: 'Giúp việc nhà / Tạp vụ',
    cham_soc: 'Chăm sóc trẻ em / người cao tuổi',
  },
  factory: {
    san_xuat_dong_goi: 'Sản xuất / Đóng gói / Lắp ráp',
    ky_thuat_bao_tri: 'Kỹ thuật / Bảo trì / Vận hành máy',
    han_co_khi: 'Hàn / Cơ khí',
  },
  office: {
    cskh: 'Chăm sóc khách hàng / Telesale',
    nhap_lieu: 'Nhập liệu',
    hanh_chinh_nhan_su: 'Hành chính / Nhân sự',
    le_tan: 'Lễ tân',
    ke_toan: 'Kế toán',
  },
}
