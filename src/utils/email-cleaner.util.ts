/**
 * Email Content Cleaner Utility
 *
 * Aggressively cleans email content before sending to LLM/embedding models
 * to reduce token usage and improve semantic quality.
 */

/**
 * Remove HTML tags and decode HTML entities
 */
function stripHtml(text: string): string {
  return text
    // Remove script and style tags with their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove all HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, ' '); // Remove other entities
}

/**
 * Remove email signatures (common patterns)
 */
function removeSignatures(text: string): string {
  const signaturePatterns = [
    // Common signature markers
    /--\s*$/gm,
    /^--\s*$/gm,
    /_{2,}/g, // Multiple underscores
    /^[-_=]{3,}$/gm, // Separator lines

    // "Sent from" patterns
    /sent from (my )?(iphone|ipad|android|mobile|blackberry)/gi,
    /get outlook for (ios|android)/gi,

    // Common signature starters (be careful with these)
    /\n\s*(best regards|regards|sincerely|thanks|thank you|cheers|best)\s*,?\s*\n[\s\S]*$/gi,

    // Phone/fax patterns in signatures
    /\b(phone|tel|mobile|fax|cell):\s*[+\d\s\-().]+/gi,

    // Email addresses in signatures (but keep in from/to headers)
    /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi,

    // Job titles and company info (common patterns)
    /\n[A-Z][a-z]+ [A-Z][a-z]+\s*\|\s*[A-Z][a-z\s]+/g,
  ];

  let cleaned = text;
  signaturePatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });

  return cleaned;
}

/**
 * Remove quoted replies and forwarded content
 */
function removeQuotedReplies(text: string): string {
  const quotedPatterns = [
    // "On [date] [person] wrote:" pattern
    /on\s+.{0,100}wrote:\s*/gi,
    /on\s+.{0,100}<.+?>\s+wrote:\s*/gi,

    // Gmail/Outlook quoted reply markers
    /^>+\s*.*/gm, // Lines starting with >
    /^\s*>{1,}\s*.*/gm,

    // Original message markers
    /[-_]{3,}\s*original message\s*[-_]{3,}/gi,
    /[-_]{3,}\s*forwarded message\s*[-_]{3,}/gi,
    /^from:\s*.*/gmi,
    /^sent:\s*.*/gmi,
    /^to:\s*.*/gmi,
    /^cc:\s*.*/gmi,
    /^subject:\s*.*/gmi,

    // Outlook style
    /-----\s*original message\s*-----/gi,
    /________________________________/g,

    // Thread history
    /\n{2,}.*?wrote:\s*\n[\s\S]*/gi,
  ];

  let cleaned = text;
  quotedPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });

  return cleaned;
}

/**
 * Remove legal disclaimers and confidentiality notices
 */
function removeDisclaimers(text: string): string {
  const disclaimerPatterns = [
    // Confidentiality notices (very aggressive - catches full paragraphs)
    /confidential(ity)?[\s\S]{0,800}?(delete|destroy|notify)/gi,
    /this\s+(email|message)[\s\S]{0,500}?(confidential|privileged|intended)/gi,
    /privileged[\s\S]{0,300}?confidential/gi,

    // Intended recipient notices
    /intended\s+solely[\s\S]{0,300}?(recipient|use)/gi,
    /if\s+you[\s\S]{0,300}?(not\s+the\s+intended|received.*error|delete.*message)/gi,

    // Environmental notices
    /please\s+consider[\s\S]{0,100}?environment/gi,
    /think\s+before\s+you\s+print/gi,

    // Virus/security notices
    /this\s+email\s+has\s+been\s+scanned/gi,
    /no\s+virus\s+found/gi,
    /scanned\s+for\s+viruses/gi,

    // IRS circular notices
    /irs\s+circular\s+230/gi,
    /treasury\s+department\s+regulations/gi,
  ];

  let cleaned = text;
  disclaimerPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });

  return cleaned;
}

/**
 * Remove inline images, CSS, and other non-text content
 */
function removeInlineContent(text: string): string {
  return text
    // Remove inline images (base64 or CID)
    .replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, '')
    .replace(/cid:[^\s]+/g, '')

    // Remove CSS (in case HTML stripping missed it)
    .replace(/style\s*=\s*"[^"]*"/gi, '')
    .replace(/style\s*=\s*'[^']*'/gi, '')

    // Remove URLs (optional - may want to keep some)
    .replace(/https?:\/\/[^\s]+/g, '')

    // Remove email tracking pixels
    .replace(/\[image:[^\]]+\]/gi, '')
    .replace(/\[cid:[^\]]+\]/gi, '');
}

/**
 * Clean up whitespace and formatting
 */
function normalizeWhitespace(text: string): string {
  return text
    // Replace multiple newlines with double newline
    .replace(/\n{3,}/g, '\n\n')
    // Replace multiple spaces with single space
    .replace(/[ \t]{2,}/g, ' ')
    // Remove trailing whitespace from lines
    .replace(/[ \t]+$/gm, '')
    // Remove leading whitespace from lines (but keep paragraph structure)
    .replace(/^[ \t]+/gm, '')
    // Trim start and end
    .trim();
}

/**
 * Remove control characters and special unicode
 */
function removeControlCharacters(text: string): string {
  return text
    // Remove control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    // Remove zero-width characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Replace non-breaking spaces
    .replace(/\u00A0/g, ' ');
}

/**
 * Main function: Aggressively clean email content
 *
 * @param text - Raw email body text
 * @param options - Cleaning options
 * @returns Cleaned text optimized for LLM/embeddings
 */
export function cleanEmailContent(
  text: string,
  options: {
    stripHtml?: boolean;
    removeSignatures?: boolean;
    removeQuoted?: boolean;
    removeDisclaimers?: boolean;
    removeInlineContent?: boolean;
    maxLength?: number;
  } = {}
): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Default: enable all cleaning
  const {
    stripHtml: doStripHtml = true,
    removeSignatures: doRemoveSignatures = true,
    removeQuoted: doRemoveQuoted = true,
    removeDisclaimers: doRemoveDisclaimers = true,
    removeInlineContent: doRemoveInlineContent = true,
    maxLength = 3000,
  } = options;

  let cleaned = text;

  // Step 1: Strip HTML (do this first)
  if (doStripHtml) {
    cleaned = stripHtml(cleaned);
  }

  // Step 2: Remove inline content (images, CSS, etc.)
  if (doRemoveInlineContent) {
    cleaned = removeInlineContent(cleaned);
  }

  // Step 3: Remove quoted replies
  if (doRemoveQuoted) {
    cleaned = removeQuotedReplies(cleaned);
  }

  // Step 4: Remove signatures
  if (doRemoveSignatures) {
    cleaned = removeSignatures(cleaned);
  }

  // Step 5: Remove disclaimers
  if (doRemoveDisclaimers) {
    cleaned = removeDisclaimers(cleaned);
  }

  // Step 6: Clean control characters
  cleaned = removeControlCharacters(cleaned);

  // Step 7: Normalize whitespace
  cleaned = normalizeWhitespace(cleaned);

  // Step 8: Truncate to max length
  if (maxLength && cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength);
  }

  return cleaned;
}

/**
 * Clean email subject line
 * (Less aggressive than body cleaning)
 */
export function cleanEmailSubject(subject: string): string {
  if (!subject || typeof subject !== 'string') {
    return '';
  }

  return subject
    // Remove common prefixes
    .replace(/^(re|fw|fwd):\s*/gi, '')
    // Remove multiple "Re:" or "Fwd:"
    .replace(/(re|fw|fwd):\s*/gi, '')
    // Clean control characters
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}
