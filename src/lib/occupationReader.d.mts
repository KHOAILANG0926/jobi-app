export interface OccupationHit { occupation_code: string; occupation_evidence: string }
export interface OccupationCandidate { code: string; name_vi: string }
export function classifyOccupation(title: string, sourceText?: string): OccupationHit | null
export function occupationCandidates(category: string, subcategory?: string | null): OccupationCandidate[]
export function occupationForPost(input: { category: string; subcategory?: string | null; title: string; description: string }): OccupationHit | null
export function occupationName(code: string): string | null
