// Deprecated: badge records are now managed via guide_track_certifications. This file is kept for reference only.
import type { SupabaseClient } from '@supabase/supabase-js'

export interface BadgeRecord {
  id: string
  enrollment_id: string
  guide_id: string
  guide_name: string
  track_name: string
  park_name: string
  issued_at: string
  renewal_due_at: string
  status: string
  created_at: string
}

/**
 * Inserts a badge for the given enrollment, or silently returns the existing
 * one if it was already issued (idempotent — safe to call from a webhook retry).
 *
 * Looks up all required fields by joining:
 *   guide_track_enrollments → training_tracks (track_name, park_name)
 *   guide_track_enrollments → profiles          (guide_name)
 */
export async function insertBadge(
  stripeSessionId: string,
  supabase: SupabaseClient,
): Promise<BadgeRecord> {
  // Resolve enrollment + training_tracks via stripe_session_id.
  // profiles is queried separately because guide_id FK points to auth.users,
  // not profiles directly — PostgREST cannot traverse that indirect relationship.
  const { data: enrollment, error: enrollmentError } = await supabase
    .from('guide_track_enrollments')
    .select(`
      id,
      guide_id,
      track_id,
      training_tracks ( title, tpa_name )
    `)
    .eq('stripe_session_id', stripeSessionId)
    .single()

  if (enrollmentError || !enrollment) {
    throw new Error(
      `insertBadge: enrollment not found for session ${stripeSessionId}: ${enrollmentError?.message ?? 'no row'}`,
    )
  }

  const track = enrollment.training_tracks as unknown as { title: string; tpa_name: string } | null

  if (!track) {
    throw new Error(
      `insertBadge: training_tracks join returned null for enrollment ${enrollment.id}`,
    )
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', enrollment.guide_id)
    .single()

  if (profileError || !profile) {
    throw new Error(
      `insertBadge: profile not found for guide_id ${enrollment.guide_id}: ${profileError?.message ?? 'no row'}`,
    )
  }

  const issuedAt = new Date()
  const renewalDueAt = new Date(issuedAt)
  renewalDueAt.setFullYear(renewalDueAt.getFullYear() + 1)

  const { data: badge, error: insertError } = await supabase
    .from('guide_badges')
    .insert({
      enrollment_id:  enrollment.id,
      guide_id:       enrollment.guide_id,
      guide_name:     profile.full_name,
      track_name:     track.title,
      park_name:      track.tpa_name,
      issued_at:      issuedAt.toISOString(),
      renewal_due_at: renewalDueAt.toISOString(),
      status:         'active',
    })
    .select()
    .single()

  // Unique constraint on enrollment_id — if row already exists, fetch and return it
  if (insertError) {
    if (insertError.code === '23505') {
      const { data: existing, error: fetchError } = await supabase
        .from('guide_badges')
        .select()
        .eq('enrollment_id', enrollment.id)
        .single()

      if (fetchError || !existing) {
        throw new Error(
          `insertBadge: conflict but could not fetch existing badge: ${fetchError?.message ?? 'no row'}`,
        )
      }

      return existing as BadgeRecord
    }

    throw new Error(`insertBadge: insert failed: ${insertError.message}`)
  }

  return badge as BadgeRecord
}
