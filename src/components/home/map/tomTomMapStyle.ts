const TOMTOM_ORBIS_STYLE_ENDPOINT = 'https://api.tomtom.com/maps/orbis/assets/styles/0.*/style'

export function createTomTomOrbisStyleUrl(apiKey: string): string {
  const key = apiKey.trim()
  if (!key) throw new Error('TomTom API key is required')
  const params = new URLSearchParams({
    apiVersion: '1',
    map: 'basic_street-light',
    key,
  })
  return `${TOMTOM_ORBIS_STYLE_ENDPOINT}?${params.toString()}`
}
