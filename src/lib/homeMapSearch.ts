import { DEFAULT_FILTERS, RADIUS_MAX_KM, RADIUS_MIN_KM, findNearbyJobs, verifiedJobPoints } from './homeMapFilters'
import type { HomeMapFilterState, MapJobPoint } from './homeMapFilters'
import type { Job } from '../types/job'

export function normalizeSearchRadius(km: number): number {
  if (!Number.isFinite(km)) return DEFAULT_FILTERS.radiusKm
  return Math.round(Math.max(RADIUS_MIN_KM, Math.min(RADIUS_MAX_KM, km)) * 10) / 10
}

export function formatSearchRadius(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${Math.round(km * 10) / 10} km`
}

export function locationAccuracyWarning(accuracyMeters: number, radiusKm: number): boolean {
  return !Number.isFinite(accuracyMeters) || accuracyMeters < 0 || accuracyMeters > radiusKm * 1000
}

/** Counts describe loaded JOBI records only, never the provider's POI coverage. */
export function summarizeMapJobs(jobs: Job[], origin: MapJobPoint, filters: HomeMapFilterState) {
  const verified = jobs.filter((job) => verifiedJobPoints(job).length > 0).length
  const inRadius = findNearbyJobs(jobs, origin, { ...DEFAULT_FILTERS, radiusKm: filters.radiusKm }).length
  const matched = findNearbyJobs(jobs, origin, filters).length
  return {
    loaded: jobs.length, verified, inRadius, matched,
    unverified: jobs.length - verified,
    outsideRadius: verified - inRadius,
    filteredOut: inRadius - matched,
  }
}
