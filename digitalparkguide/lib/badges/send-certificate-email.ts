import nodemailer from 'nodemailer'

export interface CertificateEmailParams {
  guideEmail:  string
  guideName:   string
  trackName:   string
  parkName:    string
  issuedAt:    Date
  renewalDue:  Date
  pdfBytes:    Uint8Array
}

function buildTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-MY', { day: '2-digit', month: 'long', year: 'numeric' })
}

export async function sendCertificateEmail(params: CertificateEmailParams): Promise<boolean> {
  const { guideEmail, guideName, trackName, parkName, issuedAt, renewalDue, pdfBytes } = params

  const transporter = buildTransporter()

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:auto">
      <div style="background:#1B3A24;padding:24px 32px">
        <h1 style="color:#F0A500;margin:0;font-size:20px">Sarawak Forestry Corporation</h1>
        <p style="color:#fff;margin:6px 0 0;font-size:13px">Guide &amp; Ranger Training Programme</p>
      </div>
      <div style="padding:32px;border:1px solid #e5e7eb">
        <p style="margin-top:0">Dear <strong>${guideName}</strong>,</p>
        <p>Congratulations! You have successfully completed the following certification track:</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr>
            <td style="padding:8px 12px;background:#f3f4f6;font-weight:600;width:40%">Track</td>
            <td style="padding:8px 12px">${trackName}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f3f4f6;font-weight:600">Park / TPA</td>
            <td style="padding:8px 12px">${parkName}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f3f4f6;font-weight:600">Issue Date</td>
            <td style="padding:8px 12px">${formatDate(issuedAt)}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f3f4f6;font-weight:600">Renewal Due</td>
            <td style="padding:8px 12px">${formatDate(renewalDue)}</td>
          </tr>
        </table>
        <p>Your certificate is attached to this email as a PDF. Please retain it for your records.</p>
        <p style="font-size:12px;color:#6b7280">
          This badge is park-specific and non-transferable. It is valid for one year from the issue date.
        </p>
      </div>
      <div style="background:#1B3A24;padding:12px 32px">
        <p style="color:#F0A500;margin:0;font-size:11px">
          Sarawak Forestry Corporation · Kuching, Sarawak, Malaysia
        </p>
      </div>
    </div>
  `

  try {
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
      to:      guideEmail,
      subject: `Your Digital Park Guide Certification — ${trackName}`,
      html,
      attachments: [
        {
          filename:    'certificate.pdf',
          content:     Buffer.from(pdfBytes),
          contentType: 'application/pdf',
        },
      ],
    })
    return true
  } catch (err) {
    console.error('[sendCertificateEmail] SMTP error:', err)
    return false
  }
}
