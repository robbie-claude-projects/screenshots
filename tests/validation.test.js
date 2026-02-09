import { jest } from '@jest/globals';
import {
  validateUrl,
  validateUrls,
  validateAdCreative,
  validateAdCreatives,
  sanitizeInput,
  formatError
} from '../src/utils/validation.js';

describe('Validation Module', () => {
  describe('validateUrl', () => {
    it('should validate valid HTTP URLs', () => {
      const result = validateUrl('http://example.com');
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
      expect(result.url).toBe('http://example.com');
    });

    it('should validate valid HTTPS URLs', () => {
      const result = validateUrl('https://example.com/path?query=1');
      expect(result.valid).toBe(true);
      expect(result.url).toBe('https://example.com/path?query=1');
    });

    it('should trim whitespace from URLs', () => {
      const result = validateUrl('  https://example.com  ');
      expect(result.valid).toBe(true);
      expect(result.url).toBe('https://example.com');
    });

    it('should reject empty or null URLs', () => {
      expect(validateUrl('').valid).toBe(false);
      expect(validateUrl('').error).toMatch(/URL (is required|cannot be empty)/);
      expect(validateUrl(null).valid).toBe(false);
      expect(validateUrl(undefined).valid).toBe(false);
    });

    it('should reject non-HTTP/HTTPS protocols', () => {
      expect(validateUrl('ftp://example.com').valid).toBe(false);
      expect(validateUrl('ftp://example.com').error).toBe('URL must use HTTP or HTTPS protocol');
      expect(validateUrl('file:///path/to/file').valid).toBe(false);
    });

    it('should reject invalid URL formats', () => {
      expect(validateUrl('not-a-url').valid).toBe(false);
      expect(validateUrl('not-a-url').error).toBe('Invalid URL format');
      expect(validateUrl('://missing-protocol.com').valid).toBe(false);
    });
  });

  describe('validateUrls', () => {
    it('should validate array of valid URLs', () => {
      const result = validateUrls([
        'https://example.com',
        'https://test.com'
      ]);
      expect(result.valid.length).toBe(2);
      expect(result.invalid.length).toBe(0);
      expect(result.duplicates.length).toBe(0);
    });

    it('should detect duplicate URLs (case-insensitive)', () => {
      const result = validateUrls([
        'https://example.com',
        'https://EXAMPLE.COM',
        'https://test.com'
      ]);
      expect(result.valid.length).toBe(2);
      expect(result.duplicates.length).toBe(1);
      expect(result.duplicates[0].error).toBe('Duplicate URL');
    });

    it('should separate valid and invalid URLs', () => {
      const result = validateUrls([
        'https://valid.com',
        'not-valid',
        'ftp://wrong-protocol.com'
      ]);
      expect(result.valid.length).toBe(1);
      expect(result.invalid.length).toBe(2);
    });

    it('should handle non-array input', () => {
      const result = validateUrls('not an array');
      expect(result.valid).toEqual([]);
      expect(result.invalid).toEqual([]);
    });
  });

  describe('validateAdCreative', () => {
    it('should validate valid display ad creative', () => {
      const result = validateAdCreative({
        url: 'https://example.com/ad.jpg',
        size: '300x250',
        type: 'display'
      });
      expect(result.valid).toBe(true);
    });

    it('should validate valid video ad creative', () => {
      const result = validateAdCreative({
        url: 'https://example.com/video.jpg',
        type: 'video'
      });
      expect(result.valid).toBe(true);
    });

    it('should reject missing URL', () => {
      const result = validateAdCreative({ size: '300x250' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Ad creative URL is required');
    });

    it('should reject invalid URL format', () => {
      const result = validateAdCreative({
        url: 'not-a-url',
        size: '300x250'
      });
      expect(result.valid).toBe(false);
    });

    it('should require size for display ads', () => {
      const result = validateAdCreative({
        url: 'https://example.com/ad.jpg',
        type: 'display'
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Ad size is required for display ads');
    });

    it('should validate size format', () => {
      const invalid = validateAdCreative({
        url: 'https://example.com/ad.jpg',
        size: 'invalid-size'
      });
      expect(invalid.valid).toBe(false);
      expect(invalid.error).toBe('Ad size must be in format WIDTHxHEIGHT (e.g., 300x250)');
    });

    it('should reject non-object input', () => {
      expect(validateAdCreative(null).valid).toBe(false);
      expect(validateAdCreative('string').valid).toBe(false);
    });
  });

  describe('validateAdCreatives', () => {
    it('should validate array of ad creatives', () => {
      const result = validateAdCreatives([
        { url: 'https://example.com/ad1.jpg', size: '300x250' },
        { url: 'https://example.com/ad2.jpg', size: '728x90' }
      ]);
      expect(result.valid.length).toBe(2);
      expect(result.invalid.length).toBe(0);
    });

    it('should skip empty entries', () => {
      const result = validateAdCreatives([
        { url: '', size: '300x250' },
        { url: 'https://example.com/ad.jpg', size: '300x250' },
        null
      ]);
      expect(result.valid.length).toBe(1);
      expect(result.invalid.length).toBe(0);
    });

    it('should handle non-array input', () => {
      const result = validateAdCreatives('not an array');
      expect(result.valid).toEqual([]);
      expect(result.invalid).toEqual([]);
    });
  });

  describe('sanitizeInput', () => {
    it('should remove HTML tags', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
    });

    it('should trim whitespace', () => {
      expect(sanitizeInput('  test  ')).toBe('test');
    });

    it('should return empty string for non-strings', () => {
      expect(sanitizeInput(null)).toBe('');
      expect(sanitizeInput(123)).toBe('');
      expect(sanitizeInput({})).toBe('');
    });
  });

  describe('formatError', () => {
    it('should format known error types', () => {
      const result = formatError(new Error('net::ERR_NAME_NOT_RESOLVED'));
      expect(result.message).toBe('Website not found');
      expect(result.details).toContain('could not be resolved');
    });

    it('should format connection refused errors', () => {
      const result = formatError(new Error('net::ERR_CONNECTION_REFUSED'));
      expect(result.message).toBe('Connection refused');
    });

    it('should format timeout errors', () => {
      const result = formatError(new Error('Timeout'));
      expect(result.message).toBe('Page load timeout');
    });

    it('should include context in details', () => {
      const result = formatError(new Error('net::ERR_NAME_NOT_RESOLVED'), 'Screenshot capture');
      expect(result.details).toContain('Screenshot capture');
    });

    it('should handle unknown errors', () => {
      const result = formatError(new Error('Some unknown error'));
      expect(result.message).toBe('Operation failed');
      expect(result.details).toContain('Some unknown error');
    });
  });
});
