import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { resolveInvoiceLogo } from '../invoices/invoice-logo.util';

export interface QrPosterPage {
  locationName: string;
  address: string;
  label: string;
  url: string;
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const NAVY = '#134b7f';
const INK = '#0f172a';
const MUTED = '#475569';

function plain(value: string): string {
  return value.replace(/\u2013|\u2014/g, '-').replace(/\s+/g, ' ').trim();
}

export async function buildQrPostersPdf(pages: QrPosterPage[]): Promise<Buffer> {
  const logo = await resolveInvoiceLogo();
  const rendered = await Promise.all(
    pages.map(async (page) => ({
      ...page,
      locationName: plain(page.locationName),
      address: plain(page.address),
      label: plain(page.label),
      qr: await QRCode.toBuffer(page.url, {
        type: 'png',
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 900,
      }),
    })),
  );

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    rendered.forEach((page, index) => {
      if (index > 0) doc.addPage();
      drawPoster(doc, page, logo?.buffer);
    });
    doc.end();
  });
}

function drawPoster(
  doc: PDFKit.PDFDocument,
  page: QrPosterPage & { qr: Buffer },
  logo: Buffer | undefined,
) {
  doc.rect(0, 0, PAGE_W, PAGE_H).fill('#ffffff');
  doc.rect(0, 0, PAGE_W, 14).fill(NAVY);
  doc.rect(0, PAGE_H - 14, PAGE_W, 14).fill(NAVY);

  if (logo) {
    const logoSize = 78;
    doc.image(logo, (PAGE_W - logoSize) / 2, 36, {
      fit: [logoSize, logoSize],
      align: 'center',
      valign: 'center',
    });
  }

  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(22);
  doc.text('ASPIRE COWORKS', 48, 124, { width: PAGE_W - 96, align: 'center' });

  doc.fillColor(MUTED).font('Helvetica').fontSize(11);
  doc.text('Scan to raise a support ticket', 48, 152, { width: PAGE_W - 96, align: 'center' });

  const cardX = 48;
  const cardW = PAGE_W - 96;
  const cardY = 182;
  doc.roundedRect(cardX, cardY, cardW, 86, 10).fill('#e8f1f8');
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(16);
  doc.text(page.locationName, cardX + 16, cardY + 16, {
    width: cardW - 32,
    align: 'center',
  });
  doc.fillColor(INK).font('Helvetica').fontSize(11);
  doc.text(page.address || page.label, cardX + 16, cardY + 46, {
    width: cardW - 32,
    align: 'center',
  });

  const qrSize = 320;
  const qrX = (PAGE_W - qrSize) / 2;
  const qrY = 292;
  doc.image(page.qr, qrX, qrY, { width: qrSize, height: qrSize });

  if (logo) {
    const badge = 72;
    const badgeX = qrX + (qrSize - badge) / 2;
    const badgeY = qrY + (qrSize - badge) / 2;
    doc.roundedRect(badgeX, badgeY, badge, badge, 8).fill('#ffffff');
    doc.lineWidth(1).strokeColor('#e2e8f0').roundedRect(badgeX, badgeY, badge, badge, 8).stroke();
    doc.image(logo, badgeX + 8, badgeY + 8, {
      fit: [badge - 16, badge - 16],
      align: 'center',
      valign: 'center',
    });
  }

  doc.fillColor(INK).font('Helvetica-Bold').fontSize(14);
  doc.text('Point your phone camera at the code', 48, 632, {
    width: PAGE_W - 96,
    align: 'center',
  });

  doc.fillColor(MUTED).font('Helvetica').fontSize(12);
  const steps = 'No login  ·  Describe the issue  ·  Keep your ticket number';
  doc.text(steps, 48, 658, { width: PAGE_W - 96, align: 'center' });

  doc.fillColor(NAVY).font('Helvetica').fontSize(10);
  doc.text('A4 wall poster  ·  aspirecoworks.in', 48, 792, {
    width: PAGE_W - 96,
    align: 'center',
  });
}
