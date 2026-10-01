import { importLibrary, setOptions } from '@googlemaps/js-api-loader'

interface GoogleMapsLoaderOptions {
  key: string
  v: string
  language: string
  region: string
}

export interface GoogleMapsLoaderDeps {
  setOptions: (options: GoogleMapsLoaderOptions) => void
  importLibrary: (name: 'maps') => Promise<unknown>
}

export type GoogleMapsLoader = (apiKey: string) => Promise<google.maps.MapsLibrary>

export function createGoogleMapsLoader(deps: GoogleMapsLoaderDeps): GoogleMapsLoader {
  let configuredKey: string | null = null
  let loadPromise: Promise<google.maps.MapsLibrary> | null = null

  return (apiKey: string) => {
    const key = apiKey.trim()
    if (!key) return Promise.reject(new Error('Google Maps API key is required'))
    if (configuredKey && configuredKey !== key) {
      return Promise.reject(new Error('Google Maps loader is already configured with another API key'))
    }
    if (loadPromise) return loadPromise

    configuredKey = key
    try {
      deps.setOptions({ key, v: 'weekly', language: 'vi', region: 'VN' })
      loadPromise = deps.importLibrary('maps') as Promise<google.maps.MapsLibrary>
    } catch (error) {
      loadPromise = Promise.reject(error)
    }
    return loadPromise
  }
}

export const loadGoogleMaps = createGoogleMapsLoader({ setOptions, importLibrary })
