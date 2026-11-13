import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MAX_TICKET_ATTACHMENT_BYTES } from './ticket.constants';

export interface DecodedTicketFile {
  buffer: Buffer;
  contentType: string;
  ext: string;
  fileName: string;
  sizeBytes: number;
}

function sniff(buf: Buffer): { contentType: string; ext: string } | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { contentType: 'image/jpeg', ext: 'jpg' };
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return { contentType: 'image/png', ext: 'png' };
  }
  if (buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-') {
    return { contentType: 'application/pdf', ext: 'pdf' };
  }
  return null;
}

export function decodeTicketFile(fileName: string, contentBase64: string): DecodedTicketFile {
  const raw = contentBase64.includes(',')
    ? contentBase64.slice(contentBase64.indexOf(',') + 1)
    : contentBase64;
  let buffer: Buffer;
  try {
    buffer = Buffer.from(raw, 'base64');
  } catch {
    throw new BadRequestException('Attachment could not be read');
  }
  if (buffer.length === 0) {
    throw new BadRequestException('Attachment is empty');
  }
  if (buffer.length > MAX_TICKET_ATTACHMENT_BYTES) {
    throw new BadRequestException('Attachment must be 4 MB or smaller');
  }
  const kind = sniff(buffer);
  if (!kind) {
    throw new BadRequestException('Attachment must be a JPG, PNG, or PDF file');
  }
  const base = fileName.replace(/[/\\]/g, '').trim() || `attachment.${kind.ext}`;
  const safe = base.slice(0, 120);
  return {
    buffer,
    contentType: kind.contentType,
    ext: kind.ext,
    fileName: safe,
    sizeBytes: buffer.length,
  };
}

export function newTicketFileKey(ticketId: string, ext: string): string {
  return `tickets/${ticketId}/${randomUUID()}.${ext}`;
}
