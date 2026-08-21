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
