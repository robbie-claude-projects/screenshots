import { jest } from '@jest/globals';
import {
  parseSize,
  matchAdsToplacements
} from '../src/services/adReplacement.js';

describe('Ad Replacement Module', () => {
  describe('parseSize', () => {
    it('should parse valid size strings', () => {
      expect(parseSize('300x250')).toEqual({ width: 300, height: 250 });
      expect(parseSize('728x90')).toEqual({ width: 728, height: 90 });
      expect(parseSize('160x600')).toEqual({ width: 160, height: 600 });
    });

    it('should handle large sizes', () => {
      expect(parseSize('1920x1080')).toEqual({ width: 1920, height: 1080 });
      expect(parseSize('970x250')).toEqual({ width: 970, height: 250 });
    });

    it('should return null for invalid formats', () => {
      expect(parseSize('300-250')).toBeNull();
      expect(parseSize('300 x 250')).toBeNull();
      expect(parseSize('300X250')).toBeNull(); // uppercase X
      expect(parseSize('x250')).toBeNull();
      expect(parseSize('300x')).toBeNull();
    });

    it('should return null for non-numeric values', () => {
      expect(parseSize('abcxdef')).toBeNull();
      expect(parseSize('300xabc')).toBeNull();
    });

    it('should return null for empty or invalid inputs', () => {
      expect(parseSize('')).toBeNull();
      expect(parseSize(null)).toBeNull();
      expect(parseSize(undefined)).toBeNull();
      expect(parseSize(123)).toBeNull();
      expect(parseSize({})).toBeNull();
    });
  });

  describe('matchAdsToplacements', () => {
    const mockPlacements = [
      {
        selector: '#ad-1',
        size: { width: 300, height: 250 },
        sizeString: '300x250',
        type: 'iframe'
      },
      {
        selector: '.ad-banner',
        size: { width: 728, height: 90 },
        sizeString: '728x90',
        type: 'css'
      },
      {
        selector: '#sidebar-ad',
        size: { width: 300, height: 600 },
        sizeString: '300x600',
        type: 'css'
      },
      {
        selector: '#ad-2',
        size: { width: 300, height: 250 },
        sizeString: '300x250',
        type: 'iframe'
      }
    ];

    it('should match client ads to placements by exact size', () => {
      const clientAds = [
        { url: 'https://example.com/ad1.jpg', size: '300x250' }
      ];

      const matches = matchAdsToplacements(mockPlacements, clientAds);

      expect(matches.length).toBe(1);
      expect(matches[0].clientAd.url).toBe('https://example.com/ad1.jpg');
      expect(matches[0].placement.selector).toBe('#ad-1');
    });

    it('should match multiple different sized ads', () => {
      const clientAds = [
        { url: 'https://example.com/ad1.jpg', size: '300x250' },
        { url: 'https://example.com/ad2.jpg', size: '728x90' }
      ];

      const matches = matchAdsToplacements(mockPlacements, clientAds);

      expect(matches.length).toBe(2);
      expect(matches.some(m => m.clientAd.size === '300x250')).toBe(true);
      expect(matches.some(m => m.clientAd.size === '728x90')).toBe(true);
    });

    it('should not reuse placements for multiple same-sized ads', () => {
      const clientAds = [
        { url: 'https://example.com/ad1.jpg', size: '300x250' },
        { url: 'https://example.com/ad2.jpg', size: '300x250' }
      ];

      const matches = matchAdsToplacements(mockPlacements, clientAds);

      // Should match both 300x250 placements
      expect(matches.length).toBe(2);
      const selectors = matches.map(m => m.placement.selector);
      expect(selectors).toContain('#ad-1');
      expect(selectors).toContain('#ad-2');
    });

    it('should return empty array when no sizes match', () => {
      const clientAds = [
        { url: 'https://example.com/ad.jpg', size: '320x50' }
      ];

      const matches = matchAdsToplacements(mockPlacements, clientAds);

      expect(matches.length).toBe(0);
    });

    it('should return empty array for empty inputs', () => {
      expect(matchAdsToplacements([], [])).toEqual([]);
      expect(matchAdsToplacements(mockPlacements, [])).toEqual([]);
      expect(matchAdsToplacements([], [{ url: 'test.jpg', size: '300x250' }])).toEqual([]);
    });

    it('should skip client ads with invalid size formats', () => {
      const clientAds = [
        { url: 'https://example.com/ad1.jpg', size: 'invalid' },
        { url: 'https://example.com/ad2.jpg', size: '728x90' }
      ];

      const matches = matchAdsToplacements(mockPlacements, clientAds);

      expect(matches.length).toBe(1);
      expect(matches[0].clientAd.size).toBe('728x90');
    });

    it('should match within tolerance for slightly different sizes', () => {
      const placementsWithSlightDiff = [
        {
          selector: '#ad-1',
          size: { width: 302, height: 248 }, // Slightly off from 300x250
          sizeString: '302x248',
          type: 'css'
        }
      ];

      const clientAds = [
        { url: 'https://example.com/ad.jpg', size: '300x250' }
      ];

      const matches = matchAdsToplacements(placementsWithSlightDiff, clientAds);

      expect(matches.length).toBe(1);
    });
  });

  describe('Integration with screenshot route', () => {
    it('should handle adCreatives array in request body format', () => {
      // This tests the expected format from the frontend
      const requestBody = {
        url: 'https://example.com',
        adCreatives: [
          { url: 'https://example.com/ad1.jpg', size: '300x250' },
          { url: 'https://example.com/ad2.jpg', size: '728x90' },
          { url: '', size: '300x600' } // Empty URL should be filtered
        ]
      };

      const validAds = requestBody.adCreatives.filter(
        ad => ad && ad.url && ad.url.trim() !== '' && ad.size
      );

      expect(validAds.length).toBe(2);
      expect(validAds[0].size).toBe('300x250');
      expect(validAds[1].size).toBe('728x90');
    });
  });
});
