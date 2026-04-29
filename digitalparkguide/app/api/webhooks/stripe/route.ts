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
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Upsert enrollment — idempotent if webhook fires more than once
    const { error } = await supabase
      .from('guide_track_enrollments')
      .upsert(
        {
          guide_id,
          track_id,
          status: 'active',
          payment_status: 'paid',
          stripe_session_id: session.id,
          paid_at: new Date().toISOString(),
        },
        { onConflict: 'guide_id,track_id' }
      )

    if (error) {
      console.error('Webhook enrollment upsert failed:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Bug 10: pre-satisfy modules already completed in prior tracks
    const { error: psErr } = await supabase.rpc('presatisfy_track_modules', {
      p_guide_id: guide_id,
      p_track_id: track_id,
    })
    if (psErr) console.error('[stripe-webhook] presatisfy_track_modules failed:', psErr.message)
  }

  return NextResponse.json({ received: true })
}
