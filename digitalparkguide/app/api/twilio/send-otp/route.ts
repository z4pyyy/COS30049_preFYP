// POST /api/twilio/send-otp
// Sends a 6-digit SMS OTP via Twilio Verify to the given phone number.
import { NextResponse } from 'next/server'
import twilio from 'twilio'

export async function POST(request: Request) {
  const { phone } = await request.json()

  if (!phone) {
    return NextResponse.json({ error: 'Phone number is required.' }, { status: 400 })
  }

  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  )

  try {
    await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SID!)
      .verifications.create({ to: phone, channel: 'sms' })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send OTP.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
