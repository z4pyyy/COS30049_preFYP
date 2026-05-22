import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const checkoutType: string = body.type ?? 'track'
  const origin = req.headers.get('origin') ?? 'http://localhost:3000'

  // ─── Mode 1: Single General Module ───────────────────────────
  if (checkoutType === 'general_module') {
    const { moduleId } = body
    if (!moduleId) return NextResponse.json({ error: 'moduleId required' }, { status: 400 })

    const { data: gm } = await supabase
      .from('general_modules')
      .select('id, title, price_myr')
      .eq('id', moduleId)
      .single()

    if (!gm) return NextResponse.json({ error: 'Module not found' }, { status: 404 })

    const { data: existing } = await supabase
      .from('general_module_enrollments')
      .select('id')
      .eq('guide_id', user.id)
      .eq('module_id', moduleId)
      .eq('payment_status', 'paid')
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Already enrolled and paid' }, { status: 400 })
    }

    if (gm.price_myr <= 0) {
      const admin = createAdminClient()
      await admin.from('general_module_enrollments').upsert(
        {
          guide_id: user.id,
          module_id: moduleId,
          status: 'active',
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
        },
        { onConflict: 'guide_id,module_id' }
      )
      return NextResponse.json({ url: `${origin}/training/tracks?tab=general-modules&payment=success&free=true` })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      currency: 'myr',
      line_items: [{
        price_data: {
          currency: 'myr',
          unit_amount: Math.round(gm.price_myr * 100),
          product_data: {
            name: `General Module: ${gm.title}`,
          },
        },
        quantity: 1,
      }],
      success_url: `${origin}/training/tracks?tab=general-modules&payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/training/tracks?tab=general-modules&payment=cancelled`,
      metadata: {
        type: 'general_module',
        guide_id: user.id,
        module_id: moduleId,
      },
      payment_intent_data: {
        metadata: { type: 'general_module', guide_id: user.id, module_id: moduleId },
      },
    })

    return NextResponse.json({ url: session.url })
  }

  // ─── Mode 3: Bundle (GMs + Track) ───────────────────────────
  if (checkoutType === 'bundle') {
    const { trackId, moduleIds } = body
    if (!trackId) return NextResponse.json({ error: 'trackId required' }, { status: 400 })
    if (!Array.isArray(moduleIds) || moduleIds.length === 0) {
      return NextResponse.json({ error: 'moduleIds required for bundle' }, { status: 400 })
    }

    const { data: track } = await supabase
      .from('training_tracks')
      .select('title, tpa_name, price_myr, price_per_module')
      .eq('id', trackId)
      .single()
    if (!track) return NextResponse.json({ error: 'Track not found' }, { status: 404 })

    const { data: gms } = await supabase
      .from('general_modules')
      .select('id, title, price_myr')
      .in('id', moduleIds)
    if (!gms || gms.length === 0) {
      return NextResponse.json({ error: 'No valid modules found' }, { status: 400 })
    }

    let trackPriceMyr: number
    if (track.price_per_module != null) {
      const { count: moduleCount } = await supabase
        .from('training_modules')
        .select('id', { count: 'exact', head: true })
        .eq('track_id', trackId)
        .eq('is_active', true)
        .eq('is_archived', false)
      trackPriceMyr = track.price_per_module * (moduleCount ?? 0)
    } else {
      trackPriceMyr = track.price_myr ?? 7800
    }

    const lineItems: Array<{
      price_data: { currency: string; unit_amount: number; product_data: { name: string } }
      quantity: number
    }> = []

    const freeGmIds: string[] = []
    for (const gm of gms) {
      if (gm.price_myr > 0) {
        lineItems.push({
          price_data: {
            currency: 'myr',
            unit_amount: Math.round(gm.price_myr * 100),
            product_data: { name: `General Module: ${gm.title}` },
          },
          quantity: 1,
        })
      } else {
        freeGmIds.push(gm.id)
      }
    }

    if (trackPriceMyr > 0) {
      lineItems.push({
        price_data: {
          currency: 'myr',
          unit_amount: Math.round(trackPriceMyr * 100),
          product_data: {
            name: `Training Track: ${track.title} — ${track.tpa_name}`,
          },
        },
        quantity: 1,
      })
    }

    const admin = createAdminClient()

    if (freeGmIds.length > 0) {
      for (const gmId of freeGmIds) {
        await admin.from('general_module_enrollments').upsert(
          {
            guide_id: user.id,
            module_id: gmId,
            status: 'active',
            payment_status: 'paid',
            paid_at: new Date().toISOString(),
          },
          { onConflict: 'guide_id,module_id' }
        )
      }
    }

    if (lineItems.length === 0) {
      return NextResponse.json({ error: 'Nothing to pay for' }, { status: 400 })
    }

    const { data: existingCert } = await admin
      .from('guide_track_certifications')
      .select('id')
      .eq('guide_id', user.id)
      .eq('track_id', trackId)
      .neq('stage', 'REJECTED')
      .maybeSingle()

    if (!existingCert) {
      await admin.from('guide_track_certifications').insert({
        guide_id: user.id,
        track_id: trackId,
        tpa_name: track.tpa_name,
        stage: 'AWAITING_PAYMENT',
      })
    }

    const paidGmIds = gms.filter(g => g.price_myr > 0).map(g => g.id)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      currency: 'myr',
      line_items: lineItems,
      success_url: `${origin}/training/tracks?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/training/tracks?payment=cancelled`,
      metadata: {
        type: 'bundle',
        guide_id: user.id,
        track_id: trackId,
        module_ids: paidGmIds.join(','),
      },
      payment_intent_data: {
        metadata: {
          type: 'bundle',
          guide_id: user.id,
          track_id: trackId,
          module_ids: paidGmIds.join(','),
        },
      },
    })

    return NextResponse.json({ url: session.url })
  }

  // ─── Mode 2: Track Only (existing, with prereq check) ───────
  const { trackId } = body
  if (!trackId) return NextResponse.json({ error: 'trackId required' }, { status: 400 })

  const { data: trackPrereqs } = await supabase
    .from('training_tracks')
    .select('prerequisite_gm_ids')
    .eq('id', trackId)
    .single()

  const requiredGmIds: string[] = trackPrereqs?.prerequisite_gm_ids ?? []
  if (requiredGmIds.length > 0) {
    const { data: completions } = await supabase
      .from('general_module_completions')
      .select('module_id')
      .eq('user_id', user.id)
      .in('module_id', requiredGmIds)

    const completedIds = new Set((completions ?? []).map(c => c.module_id))
    const missing = requiredGmIds.filter(id => !completedIds.has(id))
    if (missing.length > 0) {
      return NextResponse.json(
        { error: 'Complete prerequisite general modules first', missing_gm_ids: missing },
        { status: 400 }
      )
    }
  }

  const { data: track } = await supabase
    .from('training_tracks')
    .select('title, tpa_name, price_myr, price_per_module')
    .eq('id', trackId)
    .single()

  if (!track) return NextResponse.json({ error: 'Track not found' }, { status: 404 })

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
      { status: 400 }
    )
  }

  const trackName = `${track.title} — ${track.tpa_name}`
  const priceSen = totalMyr * 100

  const admin = createAdminClient()
  const { data: existingCert } = await admin
    .from('guide_track_certifications')
    .select('id')
    .eq('guide_id', user.id)
    .eq('track_id', trackId)
    .neq('stage', 'REJECTED')
    .maybeSingle()

  if (!existingCert) {
    await admin.from('guide_track_certifications').insert({
      guide_id: user.id,
      track_id: trackId,
      tpa_name: track.tpa_name,
      stage: 'AWAITING_PAYMENT',
    })
  }

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
      type: 'track',
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
