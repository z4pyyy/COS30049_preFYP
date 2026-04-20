import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { trackId } = await req.json()
  if (!trackId) return NextResponse.json({ error: 'trackId required' }, { status: 400 })

  // Fetch track name and price
  const { data: track } = await supabase
    .from('training_tracks')
    .select('title, tpa_name, price_myr')
    .eq('id', trackId)
    .single()

  if (!track) return NextResponse.json({ error: 'Track not found' }, { status: 404 })

  const trackName = `${track.title} — ${track.tpa_name}`
  const priceSen = (track.price_myr ?? 7800) * 100

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
    success_url: `${origin}/training/tracks?payment=success&session_id={CHECKOUT_SESSION_ID}&amount=${track.price_myr}`,
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
