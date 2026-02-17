/**
 * Branded email layout and CTA helpers for Aspire Coworks.
 * Uses global buildEmailTemplate from common/email.
 */

import { buildEmailTemplate, escapeHtml, ctaButton } from '../../common/email/email-template';

export { escapeHtml, ctaButton };

/**
 * Wrap content in branded email layout. Uses buildEmailTemplate with empty title.
 * For emails with a section title, use buildEmailTemplate directly.
 */
export function wrapBrandedEmail(content: string, title = ''): string {
  return buildEmailTemplate(title, content);
}
