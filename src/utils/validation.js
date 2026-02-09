// Input Validation Utilities
// Validates and sanitizes user inputs

/**
 * Validate URL format (must be HTTP or HTTPS)
 * @param {string} urlString - URL to validate
 * @returns {object} - { valid: boolean, error: string|null }
 */
export const validateUrl = (urlString) => {
  if (!urlString || typeof urlString !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  const trimmed = urlString.trim();
  if (trimmed === '') {
    return { valid: false, error: 'URL cannot be empty' };
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { valid: false, error: 'URL must use HTTP or HTTPS protocol' };
    }
    return { valid: true, error: null, url: trimmed };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
};

/**
 * Validate an array of URLs
 * @param {Array} urls - Array of URL strings
 * @returns {object} - { valid: Array, invalid: Array, duplicates: Array }
 */
export const validateUrls = (urls) => {
  if (!Array.isArray(urls)) {
    return { valid: [], invalid: [], duplicates: [] };
  }

  const seen = new Set();
  const valid = [];
  const invalid = [];
  const duplicates = [];

  urls.forEach((url, index) => {
    const result = validateUrl(url);
    if (result.valid) {
      const normalizedUrl = result.url.toLowerCase();
      if (seen.has(normalizedUrl)) {
        duplicates.push({ url: result.url, index, error: 'Duplicate URL' });
      } else {
        seen.add(normalizedUrl);
        valid.push(result.url);
      }
    } else {
      invalid.push({ url: url || '', index, error: result.error });
    }
  });

  return { valid, invalid, duplicates };
};

/**
 * Validate ad creative input
 * @param {object} adCreative - Ad creative with url and size
 * @returns {object} - { valid: boolean, error: string|null }
 */
export const validateAdCreative = (adCreative) => {
  if (!adCreative || typeof adCreative !== 'object') {
    return { valid: false, error: 'Invalid ad creative format' };
  }

  const { url, size, type } = adCreative;

  // URL is required
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return { valid: false, error: 'Ad creative URL is required' };
  }

  // Validate URL format
  const urlResult = validateUrl(url);
  if (!urlResult.valid) {
    return { valid: false, error: `Invalid ad creative URL: ${urlResult.error}` };
  }

  // Size is required for display ads
  if (type !== 'video') {
    if (!size || typeof size !== 'string') {
      return { valid: false, error: 'Ad size is required for display ads' };
    }

    // Validate size format (WIDTHxHEIGHT)
    const sizeMatch = size.match(/^(\d+)x(\d+)$/);
    if (!sizeMatch) {
      return { valid: false, error: 'Ad size must be in format WIDTHxHEIGHT (e.g., 300x250)' };
    }
  }

  return { valid: true, error: null };
};

/**
 * Validate array of ad creatives
 * @param {Array} adCreatives - Array of ad creative objects
 * @returns {object} - { valid: Array, invalid: Array }
 */
export const validateAdCreatives = (adCreatives) => {
  if (!Array.isArray(adCreatives)) {
    return { valid: [], invalid: [] };
  }

  const valid = [];
  const invalid = [];

  adCreatives.forEach((ad, index) => {
    // Skip empty entries
    if (!ad || !ad.url || ad.url.trim() === '') {
      return;
    }

    const result = validateAdCreative(ad);
    if (result.valid) {
      valid.push({
        url: ad.url.trim(),
        size: ad.size,
        type: ad.type || 'display'
      });
    } else {
      invalid.push({ ad, index, error: result.error });
    }
  });

  return { valid, invalid };
};

/**
 * Sanitize input string to prevent XSS
 * @param {string} input - Input string to sanitize
 * @returns {string} - Sanitized string
 */
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '')
    .trim();
};

/**
 * Generate user-friendly error message
 * @param {Error} error - Error object
 * @param {string} context - Context description
 * @returns {object} - { message: string, details: string }
 */
export const formatError = (error, context = '') => {
  const errorMessage = error.message || 'An unknown error occurred';

  // Map common errors to user-friendly messages
  const errorMap = {
    'net::ERR_NAME_NOT_RESOLVED': {
      message: 'Website not found',
      details: 'The website address could not be resolved. Please check the URL is correct.'
    },
    'net::ERR_CONNECTION_REFUSED': {
      message: 'Connection refused',
      details: 'The website refused the connection. It may be down or blocking requests.'
    },
    'net::ERR_CONNECTION_TIMED_OUT': {
      message: 'Connection timed out',
      details: 'The website took too long to respond. Please try again later.'
    },
    'net::ERR_SSL_PROTOCOL_ERROR': {
      message: 'SSL/Security error',
      details: 'There was a security certificate problem with the website.'
    },
    'net::ERR_CERT_AUTHORITY_INVALID': {
      message: 'Invalid certificate',
      details: 'The website has an invalid security certificate.'
    },
    'Timeout': {
      message: 'Page load timeout',
      details: 'The page took too long to load. The website may be slow or unresponsive.'
    },
    'Navigation timeout': {
      message: 'Navigation timeout',
      details: 'Failed to navigate to the page within the allowed time.'
    }
  };

  // Find matching error
  for (const [key, value] of Object.entries(errorMap)) {
    if (errorMessage.includes(key)) {
      return {
        message: value.message,
        details: context ? `${context}: ${value.details}` : value.details
      };
    }
  }

  // Default error format
  return {
    message: 'Operation failed',
    details: context ? `${context}: ${errorMessage}` : errorMessage
  };
};

export default {
  validateUrl,
  validateUrls,
  validateAdCreative,
  validateAdCreatives,
  sanitizeInput,
  formatError
};
