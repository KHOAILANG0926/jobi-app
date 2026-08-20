import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import ApplyModal from '../components/ApplyModal'
import JobCard from '../components/JobCard'
import { KoreaBanner } from '../components/KoreaBanner'
import { useApply } from '../components/useApply'
import { useAuth } from '../context/AuthContext'
import { useJobs } from '../context/JobsContext'
import { jobMatchesRegion, REGION_MACRO_TABS, type JobRegionId } from '../data/jobRegions'
import { loadApplications } from '../lib/applicationsStorage'
import { calcDistanceKm, guessCoordinatesFromLocation, normalizeViText } from '../lib/jobCoords'
import { loadSavedJobIds, toggleSavedJobId } from '../lib/storage'
import type { Job, JobCategory } from '../types/job'

/* ── 3D Category Icons ────────────────────────────────────────────── */
function Icon3DBell() {
  return (
    <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="44" height="44">
      <defs>
        <radialGradient id="bellBody" cx="38%" cy="28%" r="65%">
          <stop offset="0%" stopColor="#FFE566"/>
          <stop offset="40%" stopColor="#F5C518"/>
          <stop offset="100%" stopColor="#B8860B"/>
        </radialGradient>
        <radialGradient id="bellShine" cx="30%" cy="20%" r="50%">
          <stop offset="0%" stopColor="#FFF9C4" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#FFF9C4" stopOpacity="0"/>
        </radialGradient>
        <filter id="bellShadow" x="-20%" y="-10%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#8B6914" floodOpacity="0.4"/>
        </filter>
        <linearGradient id="bellTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE566"/>
          <stop offset="100%" stopColor="#D4A017"/>
        </linearGradient>
        <linearGradient id="bellBase" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F5C518"/>
          <stop offset="100%" stopColor="#A07800"/>
        </linearGradient>
      </defs>
      {/* Shadow */}
      <ellipse cx="28" cy="51" rx="12" ry="3" fill="#8B6914" opacity="0.25"/>
      {/* Bell body */}
      <g filter="url(#bellShadow)">
        <path d="M28 8 C18 8 13 16 13 26 L13 38 Q13 41 10 42 L46 42 Q43 41 43 38 L43 26 C43 16 38 8 28 8Z" fill="url(#bellBody)"/>
        <path d="M28 8 C18 8 13 16 13 26 L13 38 Q13 41 10 42 L46 42 Q43 41 43 38 L43 26 C43 16 38 8 28 8Z" fill="url(#bellShine)"/>
      </g>
      {/* Rim */}
      <rect x="9" y="41" width="38" height="4" rx="2" fill="url(#bellBase)"/>
      {/* Clapper */}
      <circle cx="28" cy="47" r="4" fill="url(#bellBase)"/>
      {/* Top knob */}
      <circle cx="28" cy="7" r="3.5" fill="url(#bellTop)"/>
      <circle cx="26.5" cy="5.5" r="1.2" fill="#FFFDE7" opacity="0.8"/>
      {/* Shine highlight */}
      <ellipse cx="21" cy="20" rx="5" ry="7" fill="white" opacity="0.22" transform="rotate(-15 21 20)"/>
    </svg>
  )
}

function Icon3DPin() {
  return (
    <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="44" height="44">
      <defs>
        <linearGradient id="mapGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E8F4E8"/>
          <stop offset="100%" stopColor="#C8E6C9"/>
        </linearGradient>
        <linearGradient id="mapFold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A5D6A7"/>
          <stop offset="100%" stopColor="#66BB6A"/>
        </linearGradient>
        <radialGradient id="pinBall" cx="35%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#FF6B6B"/>
          <stop offset="50%" stopColor="#E53935"/>
          <stop offset="100%" stopColor="#B71C1C"/>
        </radialGradient>
        <filter id="pinShadow">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#333" floodOpacity="0.3"/>
        </filter>
      </defs>
      <ellipse cx="28" cy="52" rx="11" ry="2.5" fill="#333" opacity="0.18"/>
      {/* Map panel - 3D perspective */}
      <g filter="url(#pinShadow)">
        <path d="M6 18 L28 12 L50 18 L50 44 L28 50 L6 44 Z" fill="url(#mapGrad)"/>
        {/* Map fold lines */}
        <path d="M28 12 L28 50" stroke="url(#mapFold)" strokeWidth="1.5" opacity="0.5"/>
        <path d="M6 31 L50 31" stroke="url(#mapFold)" strokeWidth="1" opacity="0.4"/>
        {/* Road lines */}
        <path d="M12 24 Q20 28 18 36" stroke="#81C784" strokeWidth="2" strokeLinecap="round"/>
        <path d="M34 16 Q38 25 44 28" stroke="#81C784" strokeWidth="2" strokeLinecap="round"/>
      </g>
      {/* Pin */}
      <g filter="url(#pinShadow)">
        <path d="M28 10 C23 10 19 14 19 19 C19 26 28 38 28 38 C28 38 37 26 37 19 C37 14 33 10 28 10Z" fill="url(#pinBall)"/>
        <circle cx="28" cy="19" r="6" fill="url(#pinBall)"/>
        <circle cx="25.5" cy="16.5" r="2.2" fill="white" opacity="0.5"/>
      </g>
    </svg>
  )
}

function Icon3DFactory() {
  return (
    <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="44" height="44">
      <defs>
        <linearGradient id="factWall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#90A4AE"/>
          <stop offset="100%" stopColor="#546E7A"/>
        </linearGradient>
        <linearGradient id="factRoof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#78909C"/>
          <stop offset="100%" stopColor="#37474F"/>
        </linearGradient>
        <linearGradient id="chimney" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#B0BEC5"/>
          <stop offset="100%" stopColor="#607D8B"/>
        </linearGradient>
        <filter id="factShadow">
          <feDropShadow dx="2" dy="3" stdDeviation="2.5" floodColor="#263238" floodOpacity="0.4"/>
        </filter>
      </defs>
      <ellipse cx="28" cy="52" rx="16" ry="2.5" fill="#263238" opacity="0.2"/>
      <g filter="url(#factShadow)">
        {/* Main building */}
        <rect x="8" y="28" width="40" height="20" rx="1" fill="url(#factWall)"/>
        {/* Roof */}
        <rect x="8" y="24" width="40" height="5" rx="1" fill="url(#factRoof)"/>
        {/* Side face (3D) */}
        <path d="M48 24 L53 21 L53 50 L48 48 Z" fill="#37474F"/>
        {/* Chimney 1 */}
        <rect x="14" y="10" width="6" height="18" rx="1" fill="url(#chimney)"/>
        {/* Chimney 2 */}
        <rect x="24" y="14" width="5" height="14" rx="1" fill="url(#chimney)"/>
        {/* Windows */}
        <rect x="12" y="33" width="7" height="6" rx="1" fill="#B3E5FC"/>
        <rect x="24" y="33" width="7" height="6" rx="1" fill="#B3E5FC"/>
        <rect x="36" y="33" width="7" height="6" rx="1" fill="#B3E5FC"/>
        {/* Door */}
        <rect x="32" y="38" width="8" height="10" rx="1" fill="#455A64"/>
        {/* Pipe */}
        <rect x="38" y="20" width="4" height="10" rx="1" fill="#78909C"/>
      </g>
      {/* Smoke puffs */}
      <circle cx="17" cy="7" r="3.5" fill="#CFD8DC" opacity="0.75"/>
      <circle cx="21" cy="4" r="2.8" fill="#ECEFF1" opacity="0.6"/>
      <circle cx="25" cy="2" r="2" fill="#ECEFF1" opacity="0.45"/>
      <circle cx="27" cy="10" r="2.8" fill="#CFD8DC" opacity="0.7"/>
      <circle cx="30" cy="7" r="2.2" fill="#ECEFF1" opacity="0.55"/>
    </svg>
  )
}

function Icon3DCup() {
  return (
    <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="44" height="44">
      <defs>
        <linearGradient id="cupBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF"/>
          <stop offset="100%" stopColor="#E0E0E0"/>
        </linearGradient>
        <linearGradient id="saucer" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F5F5F5"/>
          <stop offset="100%" stopColor="#BDBDBD"/>
        </linearGradient>
        <radialGradient id="liquid" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#8D6E63"/>
          <stop offset="100%" stopColor="#4E342E"/>
        </radialGradient>
        <filter id="cupShadow">
          <feDropShadow dx="1" dy="3" stdDeviation="2.5" floodColor="#555" floodOpacity="0.3"/>
        </filter>
      </defs>
      <ellipse cx="28" cy="52" rx="13" ry="2.5" fill="#555" opacity="0.18"/>
      <g filter="url(#cupShadow)">
        {/* Saucer */}
        <ellipse cx="28" cy="45" rx="16" ry="4" fill="url(#saucer)"/>
        <ellipse cx="28" cy="43.5" rx="13" ry="2.5" fill="#EEEEEE"/>
        {/* Cup body */}
        <path d="M16 28 Q16 44 28 44 Q40 44 40 28 Z" fill="url(#cupBody)"/>
        <path d="M14 28 L42 28 Q42 22 28 22 Q14 22 14 28Z" fill="url(#cupBody)"/>
        {/* Liquid surface */}
        <ellipse cx="28" cy="27" rx="12" ry="3" fill="url(#liquid)"/>
        {/* Handle */}
        <path d="M40 30 Q48 30 48 36 Q48 42 40 42" stroke="#E0E0E0" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
        <path d="M40 30 Q47 30 47 36 Q47 41 40 42" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.6"/>
        {/* Cup shine */}
        <path d="M19 30 Q19 40 22 43" stroke="white" strokeWidth="2" opacity="0.5" strokeLinecap="round"/>
      </g>
      {/* Steam */}
      <path d="M22 20 Q20 15 22 10 Q24 5 22 2" stroke="#90CAF9" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7"/>
      <path d="M28 18 Q26 13 28 8 Q30 3 28 0" stroke="#90CAF9" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7"/>
      <path d="M34 20 Q32 15 34 10 Q36 5 34 2" stroke="#90CAF9" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7"/>
    </svg>
  )
}

function Icon3DTruck() {
  return (
    <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="44" height="44">
      <defs>
        <linearGradient id="truckCab" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#42A5F5"/>
          <stop offset="100%" stopColor="#1565C0"/>
        </linearGradient>
        <linearGradient id="truckBox" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#64B5F6"/>
          <stop offset="100%" stopColor="#1976D2"/>
        </linearGradient>
        <linearGradient id="truckSide" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1565C0"/>
          <stop offset="100%" stopColor="#0D47A1"/>
        </linearGradient>
        <radialGradient id="headlight" cx="40%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#FFF9C4"/>
          <stop offset="100%" stopColor="#F9A825"/>
        </radialGradient>
        <filter id="truckShadow">
          <feDropShadow dx="2" dy="3" stdDeviation="2.5" floodColor="#0D47A1" floodOpacity="0.4"/>
        </filter>
      </defs>
      <ellipse cx="28" cy="52" rx="18" ry="2.5" fill="#0D47A1" opacity="0.2"/>
      <g filter="url(#truckShadow)">
        {/* Cargo box top */}
        <path d="M4 14 L4 40 L52 40 L52 14 Z" fill="url(#truckBox)"/>
        {/* Cargo box side face */}
        <path d="M52 14 L56 17 L56 43 L52 40 Z" fill="url(#truckSide)"/>
        {/* Cab front */}
        <path d="M4 24 Q4 14 14 14 L4 14 Z" fill="url(#truckCab)"/>
        {/* Bumper */}
        <rect x="3" y="38" width="50" height="4" rx="1" fill="#0D47A1"/>
        {/* Windshield */}
        <rect x="6" y="17" width="22" height="14" rx="2" fill="#B3E5FC" opacity="0.85"/>
        <rect x="7" y="18" width="10" height="12" rx="1" fill="white" opacity="0.2"/>
        {/* Box door lines */}
        <line x1="28" y1="14" x2="28" y2="40" stroke="white" strokeWidth="1" opacity="0.3"/>
        <line x1="4" y1="27" x2="52" y2="27" stroke="white" strokeWidth="0.8" opacity="0.2"/>
        {/* Headlights */}
        <rect x="5" y="32" width="8" height="5" rx="1" fill="url(#headlight)"/>
        {/* Logo stripe */}
        <rect x="30" y="22" width="20" height="6" rx="1" fill="white" opacity="0.15"/>
        {/* Grille */}
        <rect x="5" y="38" width="20" height="3" rx="1" fill="#1565C0"/>
      </g>
      {/* Wheels */}
      <circle cx="13" cy="44" r="6" fill="#37474F"/>
      <circle cx="13" cy="44" r="3.5" fill="#607D8B"/>
      <circle cx="13" cy="44" r="1.5" fill="#90A4AE"/>
      <circle cx="43" cy="44" r="6" fill="#37474F"/>
      <circle cx="43" cy="44" r="3.5" fill="#607D8B"/>
      <circle cx="43" cy="44" r="1.5" fill="#90A4AE"/>
    </svg>
  )
}

function Icon3DBag() {
  return (
    <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="44" height="44">
      <defs>
        <linearGradient id="bag1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9575CD"/>
          <stop offset="100%" stopColor="#4527A0"/>
        </linearGradient>
        <linearGradient id="bag1side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#4527A0"/>
          <stop offset="100%" stopColor="#311B92"/>
        </linearGradient>
        <linearGradient id="bag2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#42A5F5"/>
          <stop offset="100%" stopColor="#1565C0"/>
        </linearGradient>
        <linearGradient id="bag2side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1565C0"/>
          <stop offset="100%" stopColor="#0D47A1"/>
        </linearGradient>
        <filter id="bagShadow">
          <feDropShadow dx="1" dy="3" stdDeviation="2.5" floodColor="#1A237E" floodOpacity="0.35"/>
        </filter>
      </defs>
      <ellipse cx="30" cy="52" rx="16" ry="2.5" fill="#1A237E" opacity="0.2"/>
      {/* Back bag (blue) */}
      <g filter="url(#bagShadow)">
        <rect x="22" y="20" width="26" height="28" rx="3" fill="url(#bag2)"/>
        <path d="M48 20 L52 23 L52 51 L48 48 Z" fill="url(#bag2side)"/>
        {/* Handle */}
        <path d="M28 20 Q28 12 35 12 Q42 12 42 20" stroke="#1976D2" strokeWidth="3" fill="none" strokeLinecap="round"/>
        <path d="M29 20 Q29 13 35 13 Q41 13 41 20" stroke="#64B5F6" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5"/>
        {/* Shine */}
        <rect x="25" y="24" width="6" height="16" rx="3" fill="white" opacity="0.12"/>
        {/* Logo dot */}
        <circle cx="35" cy="34" r="3" fill="white" opacity="0.2"/>
      </g>
      {/* Front bag (purple) */}
      <g filter="url(#bagShadow)">
        <rect x="8" y="18" width="26" height="28" rx="3" fill="url(#bag1)"/>
        <path d="M34 18 L38 21 L38 49 L34 46 Z" fill="url(#bag1side)"/>
        {/* Handle */}
        <path d="M13 18 Q13 10 21 10 Q29 10 29 18" stroke="#512DA8" strokeWidth="3" fill="none" strokeLinecap="round"/>
        <path d="M14 18 Q14 11 21 11 Q28 11 28 18" stroke="#B39DDB" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5"/>
        {/* Shine */}
        <rect x="11" y="22" width="6" height="16" rx="3" fill="white" opacity="0.15"/>
        {/* Logo dot */}
        <circle cx="21" cy="32" r="3" fill="white" opacity="0.22"/>
      </g>
    </svg>
  )
}

/* ── Static data ─────────────────────────────────────────────────── */

const FEATURED_BRANDS = [
  { name: 'GrabFood',         search: 'Grab',      initial: 'G', color: '#00b14f', logo: 'https://www.google.com/s2/favicons?sz=64&domain=grab.com' },
  { name: 'Highlands',        search: 'Highlands', initial: 'H', color: '#006241', logo: 'https://www.google.com/s2/favicons?sz=64&domain=highlandscoffee.com.vn' },
  { name: 'Shopee',           search: 'Shopee',    initial: 'S', color: '#ff5722', logo: 'https://www.google.com/s2/favicons?sz=64&domain=shopee.vn' },
  { name: 'Samsung',          search: 'Samsung',   initial: 'S', color: '#1428a0', logo: 'https://www.google.com/s2/favicons?sz=64&domain=samsung.com' },
  { name: "McDonald's",       search: 'McDonald',  initial: 'M', color: '#FFC72C', logo: 'https://www.google.com/s2/favicons?sz=64&domain=mcdonalds.com' },
  { name: 'KFC',              search: 'KFC',       initial: 'K', color: '#e4003b', logo: 'https://www.google.com/s2/favicons?sz=64&domain=kfc.com' },
  { name: 'Lotteria',         search: 'Lotteria',  initial: 'L', color: '#e60028', logo: 'https://www.google.com/s2/favicons?sz=64&domain=lotteria.com' },
  { name: 'Circle K',         search: 'Circle',    initial: 'C', color: '#c8102e', logo: 'https://www.google.com/s2/favicons?sz=64&domain=circlek.com' },
  { name: 'FamilyMart',       search: 'Family',    initial: 'F', color: '#00539f', logo: 'https://www.google.com/s2/favicons?sz=64&domain=familymart.com' },
  { name: 'WinMart',          search: 'WinMart',   initial: 'W', color: '#e30613', logo: 'https://www.google.com/s2/favicons?sz=64&domain=winmart.vn' },
]


/* ── Ad slot (replace <div className="ad-slot__ph"> with real ad code) */

const AD_CONFIGS = {
  header: {
    bg: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
    icon: '🎓',
    eyebrow: 'Khóa học kỹ năng nghề',
    headline: 'Nâng cao kỹ năng — tăng lương ngay',
    sub: 'Hơn 200 khóa học chứng chỉ nghề trực tuyến',
    cta: 'Đăng ký miễn phí →',
    light: true,
  },
  mid: {
    bg: 'linear-gradient(135deg,#0f2027 0%,#203a43 50%,#2c5364 100%)',
    icon: '🏢',
    eyebrow: 'Dành cho nhà tuyển dụng',
    headline: 'Tìm ứng viên chất lượng cao',
    sub: 'Đăng tin miễn phí — Tiếp cận 50.000+ ứng viên',
    cta: 'Đăng tin ngay →',
    light: true,
  },
  inline: {
    bg: 'linear-gradient(90deg,#f7971e 0%,#ffd200 100%)',
    icon: '📱',
    headline: 'Tải app Việc gần Bạn — Nhận việc làm trên di động',
    cta: 'Tải ngay miễn phí →',
    light: false,
  },
  card1: {
    bg: '#fff',
    icon: '☕',
    eyebrow: 'Highlands Coffee',
    headline: 'Cùng Highlands Coffee tìm kiếm nhân tài.',
    cta: '',
    light: false,
    img: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=180&fit=crop',
  },
  card2: {
    bg: '#fff',
    icon: '🏪',
    eyebrow: 'WinMart / WinMart+',
    headline: 'Tuyển dụng nhân viên bán hàng toàn quốc.',
    cta: '',
    light: false,
    img: 'https://images.unsplash.com/photo-1534723452862-4c874018d66d?w=300&h=180&fit=crop',
  },
}

interface AdSlotProps {
  slotId: keyof typeof AD_CONFIGS
}

function AdSlot({ slotId }: AdSlotProps) {
  const cfg = AD_CONFIGS[slotId]
  if (slotId === 'card1' || slotId === 'card2') {
    const c = cfg as typeof cfg & { eyebrow?: string; sub?: string; img?: string }
    return (
      <div className="ad-card" data-ad-slot={slotId}>
        <div className="ad-card__body">
          <p className="ad-card__eyebrow">{c.eyebrow ?? ''}</p>
          <p className="ad-card__headline">{c.headline ?? ''}</p>
        </div>
        {c.img && <img className="ad-card__img" src={c.img} alt={c.eyebrow ?? ''} />}
        <span className="ad-slot__label" style={{ color: 'rgba(0,0,0,0.3)' }}>QC</span>
      </div>
    )
  }
  if (slotId === 'inline') {
    return (
      <div className="ad-slot ad-slot--inline" data-ad-slot={slotId} style={{ background: cfg.bg }}>
        <div className="ad-slot__inline-content">
          <span className="ad-slot__inline-icon">{cfg.icon}</span>
          <span className="ad-slot__inline-text" style={{ color: cfg.light ? '#fff' : '#1a1a1a' }}>
            {cfg.headline}
          </span>
          <a href="/dang-tin" className="ad-slot__inline-cta" style={{ color: cfg.light ? '#fff' : '#7c2d12' }}>
            {cfg.cta}
          </a>
        </div>
        <span className="ad-slot__label" style={{ color: cfg.light ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)' }}>QC</span>
      </div>
    )
  }
  const textColor = cfg.light ? '#fff' : '#1a1a1a'
  const subColor  = cfg.light ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.6)'
  return (
    <div className="ad-slot" data-ad-slot={slotId} style={{ background: cfg.bg }}>
      <span className="ad-slot__label" style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}>QC</span>
      <div className="ad-slot__content">
        <span className="ad-slot__big-icon">{cfg.icon}</span>
        <div className="ad-slot__text-wrap">
          {'eyebrow' in cfg && <p className="ad-slot__eyebrow" style={{ color: 'rgba(255,255,255,0.7)' }}>{cfg.eyebrow}</p>}
          <p className="ad-slot__headline" style={{ color: textColor }}>{cfg.headline}</p>
          {'sub' in cfg && <p className="ad-slot__sub" style={{ color: subColor }}>{cfg.sub}</p>}
        </div>
        <a href="/dang-tin" className="ad-slot__cta-btn">
          {cfg.cta}
        </a>
      </div>
    </div>
  )
}

/* ── Brand logo with image + initial fallback ───────────────────── */

function BrandLogo({ initial, color, logo }: {
  name: string; initial: string; color: string; logo: string
}) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span className="home-brand__logo" style={{ background: color }}>
        <span className="home-brand__logo-initial">{initial}</span>
      </span>
    )
  }
  return (
    <span className="home-brand__logo home-brand__logo--img">
      <img src={logo} alt="" aria-hidden className="home-brand__logo-img" onError={() => setFailed(true)} />
    </span>
  )
}

/* ── Main component ──────────────────────────────────────────────── */

export function Home() {
  const { jobs } = useJobs()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { status, job: applyJob, profile, openApply, confirm, close, retry } = useApply()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<JobCategory | 'all'>('all')
  const [urgentOnly, setUrgentOnly] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set(loadSavedJobIds()))
  const [selectedCity, setSelectedCity] = useState<JobRegionId | null>(null)
  const [brandFilter, setBrandFilter] = useState<string | null>(null)

  const [nearMe, setNearMe] = useState(false)
  const [deadlineFilter, setDeadlineFilter] = useState<'all' | 'today' | 'week'>('all')
  const [activeRec, setActiveRec] = useState<string | null>(null)
  // include: title+company에서 하나라도 매칭 (OR)
  // exclude: title에서 하나라도 매칭되면 제외
  // cats: job.category가 목록에 있으면 include 없이 통과
  const [recFilter, setRecFilter] = useState<{ include: string[]; exclude: string[]; cats: string[] } | null>(null)

  useEffect(() => {
    const p = new URLSearchParams(location.search)
    const q = p.get('q')
    const brand = p.get('brand')
    const cat = p.get('cat')
    const region = p.get('region')
    const urgent = p.get('urgent')
    const near = p.get('near')

    setSearch(q ?? '')
    setBrandFilter(brand ?? null)
    setCategory((cat as JobCategory) ?? 'all')
    setSelectedCity((region as JobRegionId) ?? null)
    setUrgentOnly(urgent === '1')
    setNearMe(near === '1')
  }, [location.search])
  const [nearRadius] = useState(5)
  const [userCoords] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    const sync = () => setSavedIds(new Set(loadSavedJobIds()))
    window.addEventListener('vgb:saved-jobs', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('vgb:saved-jobs', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const handleToggleSave = useCallback((job: Job) => { toggleSavedJobId(job.id) }, [])

  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!user?.id) { setAppliedIds(new Set()); return }
    let cancelled = false
    const sync = () => {
      loadApplications().then((apps) => {
        if (cancelled) return
        setAppliedIds(new Set(apps.filter((a) => a.seekerId === user.id).map((a) => a.jobId)))
      })
    }
    sync()
    window.addEventListener('vgb:applications', sync)
    return () => { cancelled = true; window.removeEventListener('vgb:applications', sync) }
  }, [user?.id])



  const jobDistances = useMemo<Record<string, number>>(() => {
    if (!nearMe || !userCoords) return {}
    const r: Record<string, number> = {}
    for (const job of jobs) {
      const c = guessCoordinatesFromLocation(job.location)
      r[job.id] = calcDistanceKm(userCoords.lat, userCoords.lng, c.lat, c.lng)
    }
    return r
  }, [jobs, nearMe, userCoords])



  const filtered = useMemo(() => {
    const q = normalizeViText(search)
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const weekLater = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10)
    let result = jobs.filter((j) => {
      if (category !== 'all') {
        // cafe와 restaurant는 같은 F&B 그룹으로 통합 필터링
        const FNB = ['cafe', 'restaurant']
        const allowed = FNB.includes(category) ? FNB : [category]
        if (!allowed.includes(j.category)) return false
      }
      if (urgentOnly && !j.urgent) return false
      if (selectedCity && !jobMatchesRegion(j.location, selectedCity)) return false
      if (brandFilter) {
        const nb = normalizeViText(brandFilter)
        // 프랜차이즈 매장은 회사명이 운영사(예: Wincommerce)로 등록되고
        // 브랜드명은 공고 제목에만 나오는 경우가 많아 title도 함께 검사
        const matches = normalizeViText(j.company).includes(nb) || normalizeViText(j.title).includes(nb)
        if (!matches) return false
      }
      if (q && !normalizeViText(`${j.title} ${j.company} ${j.location}`).includes(q)) return false
      if (recFilter) {
        const titleCo = normalizeViText(`${j.title} ${j.company}`)
        // category 목록에 있으면 자동 통과, 아니면 include 키워드 확인
        const catPass = recFilter.cats.includes(j.category)
        const includePass = catPass || recFilter.include.some(kw => titleCo.includes(kw))
        if (!includePass) return false
        // exclude 키워드가 title에 있으면 제외
        if (recFilter.exclude.some(kw => titleCo.includes(kw))) return false
      }
      if (nearMe && userCoords) {
        const d = jobDistances[j.id]
        if (d === undefined || d > nearRadius) return false
      }
      if (deadlineFilter !== 'all' && j.applicationDeadline) {
        if (deadlineFilter === 'today' && j.applicationDeadline > todayStr) return false
        if (deadlineFilter === 'week' && j.applicationDeadline > weekLater) return false
      }
      return true
    })
    if (nearMe && userCoords) {
      result = [...result].sort((a, b) => (jobDistances[a.id] ?? 99) - (jobDistances[b.id] ?? 99))
    }
    return result
  }, [jobs, search, brandFilter, category, urgentOnly, selectedCity, nearMe, userCoords, nearRadius, jobDistances, deadlineFilter, recFilter])

  const urgentJobs  = useMemo(() => filtered.filter((j) => j.urgent), [filtered])
  const regularJobs = useMemo(() => filtered.filter((j) => !j.urgent), [filtered])

  const handleApply = useCallback((job: Job) => {
    if (!user) { navigate('/dang-nhap'); return }
    openApply(job)
  }, [user, navigate, openApply])

  // Ref for scrolling to city results
  const cityResultRef = useRef<HTMLElement>(null)
  // Ref for scrolling to the main job list (quick-filter chips)
  const jobResultRef = useRef<HTMLElement>(null)

  // Scroll to results when a city is selected
  useEffect(() => {
    if (selectedCity && cityResultRef.current) {
      cityResultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selectedCity])

  // Scroll to the job list instantly when a quick-filter chip is tapped
  useEffect(() => {
    if (activeRec && !selectedCity && jobResultRef.current) {
      jobResultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [activeRec, selectedCity])

  const resetFilters = () => {
    setSearch(''); setCategory('all'); setUrgentOnly(false); setNearMe(false); setSelectedCity(null); setDeadlineFilter('all')
    setActiveRec(null); setRecFilter(null)
  }

  const handleRecClick = (key: string, action: () => void) => {
    if (activeRec === key) {
      // 토글 해제
      setActiveRec(null)
      setRecFilter(null)
      setUrgentOnly(false)
      setNearMe(false)
      setCategory('all')
      setSearch('')
    } else {
      setActiveRec(key)
      setRecFilter(null)
      setUrgentOnly(false)
      setNearMe(false)
      setCategory('all')
      setSearch('')
      action()
    }
  }

  // Filters that are NOT city-based (used for the bottom job section)
  const hasOtherFilters = !!(search || category !== 'all' || urgentOnly || nearMe || recFilter)


  const handleBrandClick = (brandSearch: string) => {
    setBrandFilter(brandSearch); setSearch(''); setCategory('all'); setNearMe(false); setSelectedCity(null)
  }

  const handleHeroSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSelectedCity(null)
    setBrandFilter(null)
    window.requestAnimationFrame(() => {
      jobResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }


  const isApplied = useCallback((id: string) => appliedIds.has(id), [appliedIds])

  const JobGrid = ({ jobs: list, title }: { jobs: Job[]; title?: string }) => (
    <section className="home-section">
      {title && <h2 className="home-section__title">{title}</h2>}
      <div className="home-jobs-grid">
        {list.map((job) => (
          <div key={job.id} className="home-card-wrap" onClick={() => navigate(`/viec-lam/${job.id}`)}>
            <JobCard
              job={job}
              isApplied={isApplied(job.id)}
              onApply={handleApply}
              isSaved={savedIds.has(job.id)}
              onToggleSave={handleToggleSave}
              distanceKm={jobDistances[job.id]}
            />
          </div>
        ))}
      </div>
    </section>
  )

  return (
    <div className="home-page">

      {/* ── White top section ─────────────────────────────── */}
      <div className="home-top-bg">

      {/* ── Brand hero: Korea bridge + local job search ─────────── */}
      <section className="home-brand-hero">
        <div className="home-brand-hero__content">
          <span className="home-brand-hero__eyebrow">VIỆC TẠI VIỆT NAM · CƠ HỘI TẠI HÀN QUỐC</span>
          <h1 className="home-brand-hero__title">
            Việc tốt gần bạn,<br />
            <span>cơ hội mới tại Hàn Quốc</span>
          </h1>
          <p className="home-brand-hero__lead">
            Tìm công việc phù hợp tại Việt Nam hôm nay và chuẩn bị lộ trình làm việc tại Hàn Quốc cho ngày mai.
          </p>
          <form className="home-hero-search" onSubmit={handleHeroSearch} role="search">
            <span className="home-hero-search__icon" aria-hidden>⌕</span>
            <input
              className="home-hero-search__input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo công việc, công ty hoặc địa điểm"
              aria-label="Tìm việc làm"
            />
            {search && (
              <button type="button" className="home-hero-search__clear" onClick={() => setSearch('')} aria-label="Xóa tìm kiếm">×</button>
            )}
            <button type="submit" className="home-hero-search__button">Tìm việc</button>
          </form>
          <div className="home-brand-hero__links">
            <span>{filtered.length} việc làm đang mở</span>
            <NavLink to="/viec-han-quoc">Khám phá việc làm Hàn Quốc →</NavLink>
          </div>
        </div>
        <div className="home-brand-hero__visual" aria-hidden="true">
          <div className="home-seoul-card">
            <div className="home-seoul-card__top">
              <span className="home-seoul-card__flag">🇰🇷</span>
              <span>SEOUL · KOREA</span>
            </div>
            <div className="home-seoul-card__sun" />
            <div className="home-seoul-card__tower"><span /></div>
            <div className="home-seoul-card__skyline">
              <i /><i /><i /><i /><i /><i />
            </div>
            <div className="home-seoul-card__bridge">VIỆT NAM <b>↗</b> HÀN QUỐC</div>
          </div>
        </div>
      </section>

      {/* ── Curated opportunities: same card rhythm ───────────── */}
      <section className="home-discovery">
        <div className="home-discovery__head">
          <span className="home-discovery__kicker">Dành riêng cho hành trình của bạn</span>
          <h2>Khám phá cơ hội dành cho bạn</h2>
        </div>
        <div className="home-discovery__grid">
          <div className="home-discovery__card home-discovery__card--korea">
            <KoreaBanner />
          </div>
          <div className="home-discovery__card home-discovery__card--skill">
            <AdSlot slotId="header" />
          </div>
          <div className="home-discovery__card home-discovery__card--account">
            <div className="home-discovery-account__copy">
              <span className="home-discovery-account__eyebrow">Cá nhân hóa cơ hội</span>
              <strong>{user ? `Chào ${user.name}` : 'Đăng nhập để không bỏ lỡ việc tốt'}</strong>
              <p>{user ? 'Xem hồ sơ, tin đã lưu và trạng thái ứng tuyển.' : 'Lưu việc, tạo CV và theo dõi hồ sơ ở một nơi.'}</p>
              <NavLink to={user ? '/ho-so' : '/dang-nhap'} className="home-discovery-account__button">
                {user ? 'Mở hồ sơ →' : 'Đăng nhập →'}
              </NavLink>
            </div>
            <img src="/char-upper.png" className="home-discovery-account__mascot" aria-hidden alt="" />
          </div>
        </div>
      </section>

      {/* ── Brands + Region ── */}
      <div className="home-brands-region-grid">

        {/* LEFT: Brands + 2 ad cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 0 }}>
          <section className="home-brands-section">
            <div className="home-brands-box">
              <div className="home-brands-box__head">
                <h2 className="home-brands-box__title">Thương hiệu tuyển dụng</h2>
                <span className="home-brands-box__sub">Nhấn để xem việc làm</span>
              </div>
              <div className="home-brands-box__row">
                <div className="home-brands-box__track">
                  {[...FEATURED_BRANDS, ...FEATURED_BRANDS].map((b, i) => (
                    <button key={`${b.name}-${i}`} className="home-brand" onClick={() => handleBrandClick(b.search)} title={b.name}>
                      <BrandLogo name={b.name} initial={b.initial} color={b.color} logo={b.logo} />
                      <span className="home-brand__name">{b.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
          <div className="home-ad-cards">
            <AdSlot slotId="card1" />
            <AdSlot slotId="card2" />
          </div>
        </div>

        {/* RIGHT: Region + 추천 */}
        <div className="home-region-panel">
          <h2 className="home-region-panel__title">Việc làm theo khu vực</h2>
          <div className="home-region-panel__grid">
            {[
              { id: 'hanoi', label: 'Hà Nội' },
              { id: 'haiphong', label: 'Hải Phòng' },
              { id: 'bacninh', label: 'Bắc Ninh' },
              { id: 'bacgiang', label: 'Bắc Giang' },
              { id: 'thainguyen', label: 'Thái Nguyên' },
              { id: 'danang', label: 'Đà Nẵng' },
              { id: 'hue', label: 'Huế' },
              { id: 'khanhhoa', label: 'Khánh Hòa' },
              { id: 'hcm', label: 'TP. HCM' },
              { id: 'dongnai', label: 'Đồng Nai' },
              { id: 'cantho', label: 'Cần Thơ' },
            ].map(p => (
              <button key={p.id} className={`home-region-panel__btn${selectedCity === p.id ? ' home-region-panel__btn--active' : ''}`}
                onClick={() => { setSelectedCity(p.id as any); setSearch(''); setBrandFilter(null); setCategory('all'); setUrgentOnly(false); setNearMe(false); }}>
                {p.label}
              </button>
            ))}
          </div>

          {/* 추천 섹션 */}
          <h2 className="home-region-panel__title" style={{ marginTop: '0.9rem', paddingTop: '0.75rem', borderTop: '1px solid #f0f0f0' }}>Gợi ý tìm kiếm</h2>
          <div className="home-rec-grid">
            {[
              {
                key: 'urgent',
                label: 'Tuyển gấp',
                node: <Icon3DBell />,
                action: () => { setUrgentOnly(true) },
              },
              {
                key: 'nearme',
                label: 'Gần tôi',
                node: <Icon3DPin />,
                action: () => { setNearMe(true) },
              },
              {
                key: 'factory',
                label: 'Nhà máy',
                node: <Icon3DFactory />,
                action: () => setRecFilter({
                  include: ['nha may', 'cong nhan', 'kcn', 'san xuat', 'lap rap', 'co khi', 'dien tu', 'cong xuong'],
                  exclude: ['kinh doanh', 'ke toan', 'lap trinh', 'thu mua', 'hanh chinh', 'nhan su'],
                  cats: ['factory'],
                }),
              },
              {
                key: 'restaurant',
                label: 'Nhà hàng',
                node: <Icon3DCup />,
                action: () => setRecFilter({
                  // title+company에 하나라도 있으면 포함 (OR)
                  include: [
                    'nha hang', 'quan an', 'phu bep', 'dau bep', 'bep truong', 'bep chinh', 'bep pho',
                    'phuc vu ban', 'pha che', 'barista', 'bartender',
                    'jollibee', 'haidilao', 'kfc', 'lotteria', 'mcdo', 'bingsu',
                    'tra sua', 'ca phe', 'cafe', 'coffee', 'f&b', 'fnb', 'buffet',
                  ],
                  // title+company에 하나라도 있으면 제외 (사무직 필터)
                  exclude: [
                    'kinh doanh', 'ky thuat', 'thu mua', 'lap trinh', 'ke toan',
                    'hanh chinh', 'marketing', 'nhan su', 'cong nghe thong tin',
                    'phan tich', 'tu van', 'du an',
                  ],
                  cats: ['cafe', 'restaurant'],
                }),
              },
              {
                key: 'delivery',
                label: 'Giao hàng',
                node: <Icon3DTruck />,
                action: () => setRecFilter({
                  include: ['giao hang', 'shipper', 'tai xe', 'van chuyen', 'kho van', 'logistics', 'boc xep'],
                  exclude: ['ke toan', 'lap trinh', 'kinh doanh', 'hanh chinh'],
                  cats: ['delivery'],
                }),
              },
              {
                key: 'retail',
                label: 'Bán lẻ',
                node: <Icon3DBag />,
                action: () => setRecFilter({
                  include: ['ban le', 'ban hang', 'thu ngan', 'sieu thi', 'cua hang', 'tien loi', 'showroom', 'tap hoa'],
                  exclude: ['kinh doanh du an', 'ky thuat', 'lap trinh', 'ke toan', 'hanh chinh', 'nhan su'],
                  cats: ['retail'],
                }),
              },
            ].map(item => (
              <button
                key={item.key}
                className={`home-rec-btn${activeRec === item.key ? ' home-rec-btn--active' : ''}`}
                onClick={() => handleRecClick(item.key, item.action)}
              >
                <span className="home-rec-btn__icon home-rec-btn__icon--3d">{item.node}</span>
                <span className="home-rec-btn__label">{item.label}</span>
              </button>
            ))}
          </div>

        </div>
      </div>

      </div>{/* /.home-top-bg */}

      {/* ── City filtered results ──────────────────────────────── */}
      {selectedCity && (() => {
        const cityLabel = REGION_MACRO_TABS.flatMap(t => t.provinces).find(p => p.id === selectedCity)?.label ?? ''
        return (
          <section className="city-result" ref={cityResultRef}>
            <div className="city-result__head">
              <div className="city-result__title-wrap">
                <span className="city-result__pin">📍</span>
                <h2 className="city-result__title">Việc làm tại {cityLabel}</h2>
                <span className="city-result__count">{filtered.length} kết quả</span>
              </div>
              <button className="city-result__clear" onClick={() => setSelectedCity(null)}>
                ✕ Bỏ chọn
              </button>
            </div>

            {filtered.length === 0 ? (
              <div className="city-result__empty">
                <span>🔍</span>
                <p>Chưa có việc làm tại <strong>{cityLabel}</strong></p>
                <button onClick={() => setSelectedCity(null)}>← Xem tất cả</button>
              </div>
            ) : (
              <>
                {urgentJobs.length > 0 && (
                  <div className="home-jobs-grid">
                    {urgentJobs.map(job => (
                      <div key={job.id} className="home-card-wrap" onClick={() => navigate(`/viec-lam/${job.id}`)}>
                        <JobCard job={job} isApplied={isApplied(job.id)} onApply={handleApply} isSaved={savedIds.has(job.id)} onToggleSave={handleToggleSave} />
                      </div>
                    ))}
                  </div>
                )}
                {urgentJobs.length > 0 && regularJobs.length > 0 && (
                  <AdSlot slotId="inline" />
                )}
                {regularJobs.length > 0 && (
                  <div className="home-jobs-grid">
                    {regularJobs.map(job => (
                      <div key={job.id} className="home-card-wrap" onClick={() => navigate(`/viec-lam/${job.id}`)}>
                        <JobCard job={job} isApplied={isApplied(job.id)} onApply={handleApply} isSaved={savedIds.has(job.id)} onToggleSave={handleToggleSave} />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        )
      })()}

      {/* ── Job listings ─────────────────────────────────────── */}
      {!selectedCity && (
        <>
          <section className="home-jobs-section" ref={jobResultRef}>
            <div className="home-jobs-section__head">
              <h2 className="home-jobs-section__title">Việc làm mới nhất <span style={{fontSize:'0.85rem',fontWeight:400,color:'#888',marginLeft:'8px'}}>{filtered.length} việc làm</span></h2>
            </div>
          </section>

          {hasOtherFilters && filtered.length === 0 ? (
            <div className="home-empty">
              <span className="home-empty__icon">🔍</span>
              <p className="home-empty__text">Không tìm thấy việc làm phù hợp</p>
              <button className="home-empty__reset" onClick={resetFilters}>Xóa bộ lọc</button>
            </div>
          ) : nearMe && userCoords ? (
            <JobGrid jobs={filtered} title="📍 Việc làm gần bạn" />
          ) : (
            <>
              {!urgentOnly && urgentJobs.length > 0 && (
                <JobGrid jobs={urgentJobs} title="🔥 Tuyển gấp" />
              )}
              {!urgentOnly && urgentJobs.length > 0 && regularJobs.length > 0 && (
                <AdSlot slotId="inline" />
              )}
              {(urgentOnly ? filtered : regularJobs).length > 0 && (
                <JobGrid
                  jobs={urgentOnly ? filtered : regularJobs}
                  title={(!urgentOnly && urgentJobs.length > 0) ? '📋 Tất cả kết quả' : undefined}
                />
              )}
            </>
          )}
        </>
      )}


      <ApplyModal status={status} job={applyJob} profile={profile} onConfirm={confirm} onClose={close} onRetry={retry} />
    </div>
  )
}
