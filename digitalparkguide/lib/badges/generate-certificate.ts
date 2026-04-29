import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'

export interface CertificateFields {
  guideName: string
  trackName: string
  parkName: string
  issuedAt: Date
}

const DARK_GREEN  = rgb(0.106, 0.227, 0.141)  // #1B3A24
const MEDIUM_GREEN = rgb(0.176, 0.416, 0.247) // #2D6A3F
const AMBER       = rgb(0.941, 0.647, 0.0)    // #F0A500
const OFF_WHITE   = rgb(0.976, 0.969, 0.937)
const WHITE       = rgb(1, 1, 1)

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-MY', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Generates a certificate-of-completion PDF entirely in-memory.
 * Uses only pdf-lib built-in standard fonts — no network fetches, no disk I/O.
 * Returns the raw PDF bytes; the caller is responsible for storage/delivery.
 */
export async function generateCertificate(fields: CertificateFields): Promise<Uint8Array> {
  const { guideName, trackName, parkName, issuedAt } = fields

  const doc = await PDFDocument.create()

  // A4 landscape
  const page = doc.addPage([841.89, 595.28])
  const { width, height } = page.getSize()

  const fontRegular  = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold     = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontOblique  = await doc.embedFont(StandardFonts.HelveticaOblique)

  // ── Background ──────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: 0, width, height, color: OFF_WHITE })

  // Dark green left bar
  page.drawRectangle({ x: 0, y: 0, width: 18, height, color: DARK_GREEN })
  // Dark green right bar
  page.drawRectangle({ x: width - 18, y: 0, width: 18, height, color: DARK_GREEN })
  // Amber top stripe
  page.drawRectangle({ x: 18, y: height - 18, width: width - 36, height: 18, color: AMBER })
  // Amber bottom stripe
  page.drawRectangle({ x: 18, y: 0, width: width - 36, height: 18, color: AMBER })

  // Header band
  page.drawRectangle({ x: 18, y: height - 90, width: width - 36, height: 72, color: DARK_GREEN })

  // ── Header text ─────────────────────────────────────────────────────────────
  const orgText = 'SARAWAK FORESTRY CORPORATION'
  page.drawText(orgText, {
    x: width / 2 - fontBold.widthOfTextAtSize(orgText, 15) / 2,
    y: height - 52,
    size: 15,
    font: fontBold,
    color: AMBER,
  })

  const subheader = 'Guide & Ranger Training Programme'
  page.drawText(subheader, {
    x: width / 2 - fontOblique.widthOfTextAtSize(subheader, 10) / 2,
    y: height - 70,
    size: 10,
    font: fontOblique,
    color: WHITE,
  })

  // ── Certificate title ───────────────────────────────────────────────────────
  const titleText = 'Certificate of Completion'
  page.drawText(titleText, {
    x: width / 2 - fontBold.widthOfTextAtSize(titleText, 32) / 2,
    y: height - 160,
    size: 32,
    font: fontBold,
    color: DARK_GREEN,
  })

  // Amber underline beneath title
  page.drawLine({
    start: { x: width / 2 - 160, y: height - 170 },
    end:   { x: width / 2 + 160, y: height - 170 },
    thickness: 2,
    color: AMBER,
  })

  // ── Body copy ───────────────────────────────────────────────────────────────
  const certifyText = 'This is to certify that'
  page.drawText(certifyText, {
    x: width / 2 - fontRegular.widthOfTextAtSize(certifyText, 13) / 2,
    y: height - 215,
    size: 13,
    font: fontRegular,
    color: MEDIUM_GREEN,
  })

  // Guide name — large, bold
  page.drawText(guideName, {
    x: width / 2 - fontBold.widthOfTextAtSize(guideName, 28) / 2,
    y: height - 265,
    size: 28,
    font: fontBold,
    color: DARK_GREEN,
  })

  // Thin amber line under name
  const nameWidth = Math.min(fontBold.widthOfTextAtSize(guideName, 28) + 40, width - 120)
  page.drawLine({
    start: { x: width / 2 - nameWidth / 2, y: height - 275 },
    end:   { x: width / 2 + nameWidth / 2, y: height - 275 },
    thickness: 1,
    color: AMBER,
  })

  const completedText = 'has successfully completed the training track'
  page.drawText(completedText, {
    x: width / 2 - fontRegular.widthOfTextAtSize(completedText, 13) / 2,
    y: height - 305,
    size: 13,
    font: fontRegular,
    color: MEDIUM_GREEN,
  })

  // Track name
  page.drawText(trackName, {
    x: width / 2 - fontBold.widthOfTextAtSize(trackName, 18) / 2,
    y: height - 340,
    size: 18,
    font: fontBold,
    color: DARK_GREEN,
  })

  const atText = 'at'
  page.drawText(atText, {
    x: width / 2 - fontRegular.widthOfTextAtSize(atText, 13) / 2,
    y: height - 368,
    size: 13,
    font: fontRegular,
    color: MEDIUM_GREEN,
  })

  // Park name
  page.drawText(parkName, {
    x: width / 2 - fontBold.widthOfTextAtSize(parkName, 16) / 2,
    y: height - 398,
    size: 16,
    font: fontBold,
    color: DARK_GREEN,
  })

  // ── Issue date ──────────────────────────────────────────────────────────────
  const issuedLabel = `Issued: ${formatDate(issuedAt)}`
  page.drawText(issuedLabel, {
    x: width / 2 - fontRegular.widthOfTextAtSize(issuedLabel, 11) / 2,
    y: height - 435,
    size: 11,
    font: fontRegular,
    color: MEDIUM_GREEN,
  })

  // ── Footer ──────────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 18, y: 18, width: width - 36, height: 52, color: DARK_GREEN })

  const footerNote =
    'This badge is park-specific and non-transferable. Valid for one year from the date of issue.'
  page.drawText(footerNote, {
    x: width / 2 - fontOblique.widthOfTextAtSize(footerNote, 9) / 2,
    y: 42,
    size: 9,
    font: fontOblique,
    color: WHITE,
  })

  const sfcText = 'Sarawak Forestry Corporation · Kuching, Sarawak, Malaysia'
  page.drawText(sfcText, {
    x: width / 2 - fontRegular.widthOfTextAtSize(sfcText, 8) / 2,
    y: 28,
    size: 8,
    font: fontRegular,
    color: AMBER,
  })

  return doc.save()
}
