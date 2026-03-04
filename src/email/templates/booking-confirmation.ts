import { escapeHtml, wrapBrandedEmail } from './layout';

export interface BookingConfirmationParams {
  name: string;
  locationName: string;
  address: string;
  date: Date;
  timeSlot: string;
  resourceType: string;
  amountPaid: number;
}

function formatResourceType(type: string): string {
  const map: Record<string, string> = {
    CONFERENCE_ROOM: 'Conference Room',
    DISCUSSION_ROOM: 'Discussion Room',
    DAY_PASS_DESK: 'Day Pass Desk',
  };
  return map[type] || type;
}

function getGoogleMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function bookingConfirmation(params: BookingConfirmationParams): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    name,
    locationName,
    address,
    date,
    timeSlot,
    resourceType,
    amountPaid,
  } = params;

  const subject = 'Your Aspire Coworks Booking is Confirmed';

  const dateStr = new Date(date).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const mapsUrl = getGoogleMapsUrl(address);
  const resourceLabel = formatResourceType(resourceType);
  const amountStr = `₹${amountPaid.toLocaleString('en-IN')}`;

  const content = `
  <p>Hello ${escapeHtml(name)},</p>
  <p>Your booking at Aspire Coworks has been confirmed.</p>
  <table style="border-collapse: collapse; margin: 16px 0; font-size: 15px; color: #374151;">
    <tr><td style="padding: 6px 12px 6px 0; font-weight: 600;">Location:</td><td>${escapeHtml(locationName)}</td></tr>
    <tr><td style="padding: 6px 12px 6px 0; font-weight: 600;">Address:</td><td>${escapeHtml(address)}</td></tr>
    <tr><td style="padding: 6px 12px 6px 0; font-weight: 600;">Date:</td><td>${escapeHtml(dateStr)}</td></tr>
    <tr><td style="padding: 6px 12px 6px 0; font-weight: 600;">Time:</td><td>${escapeHtml(timeSlot)}</td></tr>
    <tr><td style="padding: 6px 12px 6px 0; font-weight: 600;">Resource:</td><td>${escapeHtml(resourceLabel)}</td></tr>
    <tr><td style="padding: 6px 12px 6px 0; font-weight: 600;">Amount paid:</td><td>${escapeHtml(amountStr)}</td></tr>
  </table>
  <p><a href="${escapeHtml(mapsUrl)}" style="color:#2563eb; text-decoration:none;">View on Google Maps →</a></p>
  <p>We look forward to seeing you at Aspire Coworks!</p>
  `;

  const html = wrapBrandedEmail(content, 'Booking Confirmed');
  const text = `Hello ${name},\n\nYour booking at Aspire Coworks has been confirmed.\n\nLocation: ${locationName}\nAddress: ${address}\nDate: ${dateStr}\nTime: ${timeSlot}\nResource: ${resourceLabel}\nAmount paid: ${amountStr}\n\nView on Google Maps: ${mapsUrl}\n\n— Aspire Coworks`;

  return { subject, html, text };
}
