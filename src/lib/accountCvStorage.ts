import type { CvData } from './cvStorage'
import { supabase } from './supabase'

const CV_PHOTO_BUCKET = 'cv-photos'
const PHOTO_MAX_BYTES = 1.5 * 1024 * 1024
const PHOTO_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export interface AccountCv {
  cv: CvData
  photoPath: string | null
}

interface CvRow {
  cv_data: Omit<CvData, 'profilePhotoDataUrl'>
  photo_path: string | null
}

function withoutEmbeddedPhoto(cv: CvData): Omit<CvData, 'profilePhotoDataUrl'> {
  const { profilePhotoDataUrl: _photo, ...document } = cv
  return document
}

export async function loadAccountCv(userId: string): Promise<AccountCv | null> {
  const { data, error } = await supabase
    .from('user_cvs')
    .select('cv_data,photo_path')
    .eq('user_id', userId)
    .maybeSingle<CvRow>()

  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    cv: { ...data.cv_data, profilePhotoDataUrl: null },
    photoPath: data.photo_path,
  }
}

export async function saveAccountCv(
  userId: string,
  cv: CvData,
  photoPath: string | null,
): Promise<void> {
  const { error } = await supabase.from('user_cvs').upsert({
    user_id: userId,
    cv_data: withoutEmbeddedPhoto(cv),
    photo_path: photoPath,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  if (error) throw new Error(error.message)
  window.dispatchEvent(new CustomEvent('vgb:account-cv-saved'))
}

function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl)
  if (!match) throw new Error('Invalid CV photo data')
  const mimeType = match[1]
  if (!PHOTO_EXTENSIONS[mimeType]) throw new Error('Unsupported CV photo type')
  const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0))
  if (bytes.byteLength > PHOTO_MAX_BYTES) throw new Error('CV photo exceeds 1.5 MB')
  return new Blob([bytes], { type: mimeType })
}

function assertOwnedPath(userId: string, path: string): void {
  if (!path.startsWith(`${userId}/`)) throw new Error('CV photo path is not owned by user')
}

export async function uploadCvPhoto(userId: string, dataUrl: string): Promise<string> {
  const blob = dataUrlToBlob(dataUrl)
  const extension = PHOTO_EXTENSIONS[blob.type]
  const path = `${userId}/profile.${extension}`
  const { error } = await supabase.storage.from(CV_PHOTO_BUCKET).upload(path, blob, {
    contentType: blob.type,
    upsert: true,
  })
  if (error) throw new Error(error.message)
  return path
}

export async function loadCvPhoto(userId: string, path: string): Promise<string> {
  assertOwnedPath(userId, path)
  const { data, error } = await supabase.storage.from(CV_PHOTO_BUCKET).download(path)
  if (error || !data) throw new Error(error?.message ?? 'CV photo download failed')
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('CV photo could not be read'))
    reader.onload = () => resolve(reader.result as string)
    reader.readAsDataURL(data)
  })
}

export async function deleteCvPhoto(userId: string, path: string): Promise<void> {
  assertOwnedPath(userId, path)
  const { error } = await supabase.storage.from(CV_PHOTO_BUCKET).remove([path])
  if (error) throw new Error(error.message)
}

/** 지원 시점 CV 사진 스냅샷. 원본 경로(`<userId>/profile.ext`)는 재업로드 시
 * 덮어써지므로, 지원 당시 사진을 나중에도 그대로 보여주려면 별도 불변 경로로
 * 복사해둬야 한다 — `applications/<jobId>/<seekerId>/...` 경로에만 쓰기가
 * 허용되는 storage 정책(마이그레이션 20260916090000)과 짝을 이룬다. 원본
 * 사진이 없으면 그냥 null을 돌려주고(스냅샷 없음), 복사 자체가 실패해도
 * 지원 흐름 전체를 막지 않도록 호출부에서 실패를 삼킬 수 있게 예외를 던진다. */
export async function snapshotCvPhotoForApplication(
  userId: string,
  jobId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_cvs')
    .select('photo_path')
    .eq('user_id', userId)
    .maybeSingle<{ photo_path: string | null }>()
  if (error) throw new Error(error.message)
  const sourcePath = data?.photo_path
  if (!sourcePath) return null
  const extension = sourcePath.split('.').pop() ?? 'jpg'
  const destPath = `applications/${jobId}/${userId}/photo.${extension}`
  const { error: copyError } = await supabase.storage
    .from(CV_PHOTO_BUCKET)
    .copy(sourcePath, destPath)
  if (copyError) throw new Error(copyError.message)
  return destPath
}

/** 기업(또는 본인)이 지원 시점 CV 사진 스냅샷을 읽는다. 경로 자체는 서버가
 * 만든 `applications.cv_photo_snapshot_path` 값을 그대로 쓰며, 실제 접근
 * 허용 여부는 storage RLS(cv_photos_select_application_snapshot — 그 공고의
 * employer_id인지, 스냅샷을 낸 본인인지)가 매번 검증한다. 공개 URL이 아니라
 * 매번 서명 없는 인증된 download() 호출이라 정책을 통과 못 하면 그냥 실패한다. */
export async function loadApplicationCvPhoto(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(CV_PHOTO_BUCKET).download(path)
  if (error || !data) throw new Error(error?.message ?? 'CV photo snapshot download failed')
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('CV photo could not be read'))
    reader.onload = () => resolve(reader.result as string)
    reader.readAsDataURL(data)
  })
}
