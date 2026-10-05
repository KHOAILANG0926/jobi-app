const VIETMAP_VECTOR_STREET_STYLE_ENDPOINT = 'https://maps.vietmap.vn/maps/styles/tm/style.json'

export function createVietMapStyleUrl(apiKey: string): string {
  const key = apiKey.trim()
  if (!key) throw new Error('VIETMAP Tilemap key is required')
  return `${VIETMAP_VECTOR_STREET_STYLE_ENDPOINT}?${new URLSearchParams({ apikey: key }).toString()}`
}
