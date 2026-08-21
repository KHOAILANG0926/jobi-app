import type { SeekerProfile } from './storage'
import { supabase } from './supabase'

interface ProfileRow {
  full_name: string | null
  phone: string | null
  email: string | null
  city: string | null
  bio: string | null
}

function rowToProfile(row: ProfileRow): SeekerProfile {
  return {
    fullName: row.full_name ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    city: row.city ?? '',
    bio: row.bio ?? '',
  }
}

export async function loadAccountProfile(userId: string): Promise<SeekerProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('full_name,phone,email,city,bio')
    .eq('user_id', userId)
    .maybeSingle<ProfileRow>()

  if (error) throw new Error(error.message)
  return data ? rowToProfile(data) : null
}

export async function saveAccountProfile(
  userId: string,
  profile: SeekerProfile,
): Promise<void> {
  const { error } = await supabase.from('user_profiles').upsert({
    user_id: userId,
    full_name: profile.fullName,
    phone: profile.phone,
    email: profile.email,
    city: profile.city,
    bio: profile.bio,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  if (error) throw new Error(error.message)
}
