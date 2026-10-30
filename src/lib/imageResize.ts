// Lee 2026-10-30: 공고 사진은 고용주가 규격을 맞추지 않고 올릴 때 자동으로 줄인다(긴 쪽 최대 1600px, JPG).
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const MAX_SIDE = 1600

/** 긴 쪽이 maxSide를 넘으면 줄인 크기, 아니면 그대로. */
export function fitSize(w: number, h: number, maxSide = MAX_SIDE): { w: number; h: number } {
  const long = Math.max(w, h)
  if (!(long > maxSide)) return { w, h }
  const r = maxSide / long
  return { w: Math.round(w * r), h: Math.round(h * r) }
}

/** 사진 파일을 줄여 JPG로 돌려준다. 사진이 아니거나 10MB 초과면 오류. 브라우저에서만 쓴다. */
export async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) throw new Error('Chỉ chọn tệp ảnh (JPG, PNG).')
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Ảnh quá lớn (tối đa 10MB).')
  const bitmap = await createImageBitmap(file)
  const { w, h } = fitSize(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.8))
  if (!blob) return file
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
}
