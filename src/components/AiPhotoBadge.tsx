import type { CSSProperties } from 'react'
import { AI_PHOTO_LABEL, isAiPhoto } from '../lib/cardPhoto'

// AI 그림 표시(대표 2026-11-28): 우리가 만든 AI 그림(이미지 목록 kind='ai')일 때만 표시한다. 실제 기업 사진·브랜드 로고·실제 사진(stock)에는 붙이지 않는다.
// 판정은 이미지 목록 한 곳(cardPhoto.managedPhotoKind) — 화면마다 따로 판단하지 않는다. 위치를 맞추는 부모 CSS를 건드리지 않도록 스타일은 여기 둔다(레이아웃 영향 없음: 절대 위치 또는 음수 여백).

const BASE: CSSProperties = { pointerEvents: 'none', background: 'rgba(17,24,39,.62)', color: '#fff', fontWeight: 600, lineHeight: 1, borderRadius: 4, whiteSpace: 'nowrap' }
const STYLE: Record<Variant, CSSProperties> = {
  // 웹 카드: 로고 칸(flex) 안에서 그림 오른쪽 아래 모서리에 겹친다(음수 여백, 차지하는 자리 없음)
  flow: { ...BASE, alignSelf: 'flex-end', marginLeft: -22, marginBottom: 3, marginRight: 4, padding: '2px 4px', fontSize: 9, letterSpacing: '.02em', flex: 'none' },
  // 앱 카드·앱 상세 로고: 부모(.app-card__thumb / .app-dcard__top)가 relative
  corner: { ...BASE, position: 'absolute', left: 3, bottom: 3, padding: '2px 4px', fontSize: 9, letterSpacing: '.02em' },
  dcard: { ...BASE, position: 'absolute', left: 3, top: 47, padding: '2px 4px', fontSize: 9, letterSpacing: '.02em' },
  // 상세 ④ 머리 그림(.jd2-desc-visual, relative): 왼쪽 아래 작은 반투명 칸
  banner: { ...BASE, position: 'absolute', zIndex: 3, left: 8, bottom: 8, padding: '3px 7px', fontSize: 11 },
}
export type Variant = 'flow' | 'corner' | 'dcard' | 'banner'

export function AiPhotoBadge({ url, variant }: { url?: string | null; variant: Variant }) {
  if (!isAiPhoto(url)) return null
  const full = variant === 'banner'
  return <span data-testid="ai-badge" className={`ai-badge ai-badge--${variant}`} style={STYLE[variant]} title={AI_PHOTO_LABEL} aria-label={AI_PHOTO_LABEL}>{full ? AI_PHOTO_LABEL : 'AI'}</span>
}
