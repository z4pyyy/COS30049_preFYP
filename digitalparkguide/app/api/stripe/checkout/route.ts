import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { trackId } = await req.json()
  if (!trackId) return NextResponse.json({ error: 'trackId required' }, { status: 400 })

  // Fetch track name and price configuration
  const { data: track } = await supabase
    .from('training_tracks')
    .select('title, tpa_name, price_myr, price_per_module')
    .eq('id', trackId)
    .single()

  if (!track) return NextResponse.json({ error: 'Track not found' }, { status: 404 })

  // Bug 9: derive total fee from module count when HoD has set a per-module rate.
  // Falls back to the legacy flat price_myr when price_per_module is NULL.
  let totalMyr: number
  if (track.price_per_module != null) {
    const { count: moduleCount } = await supabase
      .from('training_modules')
      .select('id', { count: 'exact', head: true })
      .eq('track_id', trackId)
      .eq('is_active', true)
      .eq('is_archived', false)
    totalMyr = track.price_per_module * (moduleCount ?? 0)
  } else {
    totalMyr = track.price_myr ?? 7800
  }
  if (totalMyr <= 0) {
    return NextResponse.json(
      { error: 'Track has no active modules or no pricing configured' },
      { status: 400 },
    )
  }

  const trackName = `${track.title} — ${track.tpa_name}`
  const priceSen = totalMyr * 100

  const origin = req.headers.get('origin') ?? 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    currency: 'myr',
    line_items: [
      {
        price_data: {
          currency: 'myr',
          unit_amount: priceSen,
          product_data: {
            name: 'Guide Certification Track',
            description: trackName,
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/training/tracks?payment=success&session_id={CHECKOUT_SESSION_ID}&amount=${totalMyr}`,
    cancel_url: `${origin}/training/tracks?payment=cancelled`,
    metadata: {
      guide_id: user.id,
      track_id: trackId,
    },
    payment_intent_data: {
      metadata: {
        guide_id: user.id,
        track_id: trackId,
      },
    },
  })

  return NextResponse.json({ url: session.url })
}
