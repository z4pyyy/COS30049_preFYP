import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

interface InterviewEmailPayload {
  recipientEmail: string
  fullName: string
  tpaName: string
  interviewDate: string
  interviewTime: string
  interviewLocation: string
}

export async function sendInterviewScheduledEmail(payload: InterviewEmailPayload) {
  const { recipientEmail, fullName, tpaName, interviewDate, interviewTime, interviewLocation } = payload

  const formattedDate = new Date(interviewDate + 'T00:00:00').toLocaleDateString('en-MY', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:#1B3A24;padding:28px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;">Sarawak Forestry Corporation</h1>
            <p style="margin:4px 0 0;color:#8DC63F;font-size:14px;">Digital Park Guide Programme</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 16px;color:#1B3A24;font-size:20px;">Interview Scheduled</h2>
            <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 20px;">
              Dear <strong>${fullName}</strong>,
            </p>
            <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 20px;">
              Your guide application for <strong>${tpaName}</strong> has progressed to the interview stage. Please find the details below.
            </p>
            <!-- Interview Details Card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7f2;border-left:4px solid #2D6A3F;border-radius:8px;margin:0 0 24px;">
              <tr><td style="padding:20px 24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="color:#666;font-size:13px;padding:4px 0;">Date</td>
                    <td style="color:#1B3A24;font-size:15px;font-weight:bold;padding:4px 0;">${formattedDate}</td>
                  </tr>
                  <tr>
                    <td style="color:#666;font-size:13px;padding:4px 0;">Time</td>
                    <td style="color:#1B3A24;font-size:15px;font-weight:bold;padding:4px 0;">${interviewTime}</td>
                  </tr>
                  <tr>
                    <td style="color:#666;font-size:13px;padding:4px 0;">Location</td>
                    <td style="color:#1B3A24;font-size:15px;font-weight:bold;padding:4px 0;">${interviewLocation}</td>
                  </tr>
                </table>
              </td></tr>
            </table>
            <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 8px;">
              Please arrive at least <strong>15 minutes early</strong> and bring a valid form of identification.
            </p>
            <p style="color:#666;font-size:13px;line-height:1.6;margin:24px 0 0;">
              If you have any questions, please contact the Head of Department directly.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9f9f9;padding:20px 32px;border-top:1px solid #eee;">
            <p style="margin:0;color:#999;font-size:12px;">
              This is an automated notification from the Digital Park Guide system.<br>
              &copy; ${new Date().getFullYear()} Sarawak Forestry Corporation
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: recipientEmail,
    subject: `Interview Scheduled — ${tpaName} Guide Application`,
    html,
  })
}

interface ApplicationStatusEmailPayload {
  recipientEmail: string
  fullName: string
  tpaName: string
  status: 'APPROVED' | 'REJECTED'
  reviewerNotes: string
}

export async function sendApplicationStatusEmail(payload: ApplicationStatusEmailPayload) {
  const { recipientEmail, fullName, tpaName, status, reviewerNotes } = payload
  const approved = status === 'APPROVED'

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background:#1B3A24;padding:28px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;">Sarawak Forestry Corporation</h1>
            <p style="margin:4px 0 0;color:#8DC63F;font-size:14px;">Digital Park Guide Programme</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 16px;color:${approved ? '#2D6A3F' : '#b91c1c'};font-size:20px;">
              Application ${approved ? 'Approved' : 'Not Approved'}
            </h2>
            <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 20px;">Dear <strong>${fullName}</strong>,</p>
            <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 20px;">
              ${approved
                ? `Congratulations! Your guide application for <strong>${tpaName}</strong> has been approved. You now have access to the Guide dashboard.`
                : `After careful review, your guide application for <strong>${tpaName}</strong> was not approved at this time.`
              }
            </p>
            ${reviewerNotes ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;border-left:4px solid ${approved ? '#2D6A3F' : '#b91c1c'};border-radius:8px;margin:0 0 24px;">
              <tr><td style="padding:16px 20px;">
                <p style="margin:0;color:#666;font-size:13px;">Reviewer Notes</p>
                <p style="margin:8px 0 0;color:#333;font-size:14px;">${reviewerNotes}</p>
              </td></tr>
            </table>` : ''}
            <p style="color:#666;font-size:13px;line-height:1.6;margin:24px 0 0;">
              ${approved
                ? 'Log in to your account to access training materials and your guide dashboard.'
                : 'If you believe this decision was made in error, please contact the Head of Department.'
              }
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9f9f9;padding:20px 32px;border-top:1px solid #eee;">
            <p style="margin:0;color:#999;font-size:12px;">
              This is an automated notification from the Digital Park Guide system.<br>
              &copy; ${new Date().getFullYear()} Sarawak Forestry Corporation
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: recipientEmail,
    subject: `Application ${approved ? 'Approved' : 'Update'} — ${tpaName} Guide Application`,
    html,
  })
}
