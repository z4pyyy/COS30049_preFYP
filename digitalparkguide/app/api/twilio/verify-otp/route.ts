// POST /api/twilio/verify-otp
// Verifies the 6-digit code via Twilio, then creates or signs in the Supabase user.
// Phone-based users get a synthetic internal email: {digits}@sfc.internal
import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/admin'

function phoneToEmail(phone: string) {
  // Strip all non-digits, prefix with p_ to avoid collisions
  return `p_${phone.replace(/\D/g, '')}@sfc.internal`
}

export async function POST(request: Request) {
  const { phone, code, fullName = '' } = await request.json()

  if (!phone || !code) {
    return NextResponse.json({ error: 'Phone and code are required.' }, { status: 400 })
  }

  // 1. Verify OTP with Twilio
  const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  )

  let check
  try {
    check = await twilioClient.verify.v2
      .services(process.env.TWILIO_VERIFY_SID!)
      .verificationChecks.create({ to: phone, code })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Verification failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  if (check.status !== 'approved') {
    return NextResponse.json({ error: 'Incorrect or expired code.' }, { status: 400 })
  }

  // 2. Find or create Supabase user
  const supabase = createAdminClient()
  const syntheticEmail = phoneToEmail(phone)

  // Look up directly in auth.users by synthetic email — reliable, no pagination
  const { data: existingAuthUser } = await supabase
    .schema('auth')
    .from('users')
    .select('id')
    .eq('email', syntheticEmail)
    .maybeSingle()

  let userId: string

  if (existingAuthUser) {
    userId = existingAuthUser.id
    // Backfill phone in profile if it was never saved (handles old registrations)
    await supabase
      .from('profiles')
      .update({ phone })
      .eq('id', userId)
      .is('phone', null)
  } else {
    // New user — create with synthetic email + confirmed phone metadata
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: syntheticEmail,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone },
    })
    if (createErr || !created.user) {
      return NextResponse.json({ error: createErr?.message ?? 'Could not create account.' }, { status: 500 })
    }
    userId = created.user.id

    // Save phone to profile (trigger creates the profile row, we update the phone)
    await supabase
      .from('profiles')
      .upsert({ id: userId, full_name: fullName, phone })
  }

  // 3. Generate a magic link token so the client can establish a real session
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: syntheticEmail,
  })

  if (linkErr || !linkData?.properties?.hashed_token) {
    return NextResponse.json({ error: 'Could not create session.' }, { status: 500 })
  }

  return NextResponse.json({
    token_hash: linkData.properties.hashed_token,
    type: 'email',
  })
}
