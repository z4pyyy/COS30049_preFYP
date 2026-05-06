import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import type Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid signature'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    const guide_id = session.metadata?.guide_id
    const track_id = session.metadata?.track_id

    if (!guide_id || !track_id) {
      console.warn(
        `[stripe webhook] checkout.session.completed ignored — session ${session.id} is missing guide_id or track_id in metadata. ` +
        'This session was not created by the checkout route and requires no action.'
      )
      return NextResponse.json({ received: true })
    }

    const supabase = createAdminClient()

    const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : null
    const amountCents = session.amount_total ?? 0
    const currency = session.currency?.toUpperCase() ?? 'MYR'

    // Upsert enrollment with full Stripe payment details
    const { error } = await supabase
      .from('guide_track_enrollments')
      .upsert(
        {
          guide_id,
          track_id,
          status: 'active',
          payment_status: 'paid',
          stripe_session_id: session.id,
          stripe_payment_intent: paymentIntent,
          amount_cents: amountCents,
          currency,
          paid_at: new Date().toISOString(),
        },
        { onConflict: 'guide_id,track_id' }
      )

    if (error) {
      console.error('Webhook enrollment upsert failed:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Find or create the guide_track_certifications row for this guide+track.
    // Uses service-role client so it bypasses RLS on both the select and insert.
    const { data: existingCert } = await supabase
      .from('guide_track_certifications')
      .select('id, stage')
      .eq('guide_id', guide_id)
      .eq('track_id', track_id)
      .neq('stage', 'REJECTED')
      .maybeSingle()

    let certId: string

    if (existingCert) {
      certId = existingCert.id
    } else {
      const { data: track, error: trackError } = await supabase
        .from('training_tracks')
        .select('tpa_name')
        .eq('id', track_id)
        .single()

      if (trackError || !track) {
        console.error('[stripe webhook] training_tracks lookup failed for track', track_id, trackError?.message)
        return NextResponse.json({ error: 'Track not found' }, { status: 500 })
      }

      const { data: newCert, error: certInsertError } = await supabase
        .from('guide_track_certifications')
        .insert({ guide_id, track_id, tpa_name: track.tpa_name, stage: 'AWAITING_PAYMENT' })
        .select('id')
        .single()

      if (certInsertError || !newCert) {
        console.error('[stripe webhook] guide_track_certifications insert failed:', certInsertError?.message)
        return NextResponse.json({ error: certInsertError?.message ?? 'Cert insert failed' }, { status: 500 })
      }

      certId = newCert.id
    }

    // Phase 1: advance AWAITING_PAYMENT → PAID (fires fn_advance_paid_cert trigger)
    await supabase
      .from('guide_track_certifications')
      .update({
        stage: 'PAID',
        paid_at: new Date().toISOString(),
      })
      .eq('id', certId)
      .eq('stage', 'AWAITING_PAYMENT')

    // Phase 2: stamp stripe_session_id unconditionally
    await supabase
      .from('guide_track_certifications')
      .update({
        stripe_session_id: session.id,
      })
      .eq('id', certId)
  }

  return NextResponse.json({ received: true })
}
