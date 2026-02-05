import { jest } from '@jest/globals';
import {
  isAdServerUrl,
  isAdRelatedName,
  getIABSizeName,
  matchIABSize,
  getAdServerDomains,
  getIABSizes,
  getAdContainerSelectors,
  getAdPatterns
} from '../src/services/adDetection.js';

describe('Ad Detection Module', () => {
  describe('isAdServerUrl', () => {
    it('should return true for doubleclick.net URLs', () => {
      expect(isAdServerUrl('https://ad.doubleclick.net/ddm/ad/N123')).toBe(true);
      expect(isAdServerUrl('https://pagead2.doubleclick.net/something')).toBe(true);
    });

    it('should return true for googlesyndication.com URLs', () => {
      expect(isAdServerUrl('https://pagead2.googlesyndication.com/pagead/show_ads.js')).toBe(true);
    });

    it('should return true for adnxs.com URLs', () => {
      expect(isAdServerUrl('https://ib.adnxs.com/tt?id=12345')).toBe(true);
    });

    it('should return true for advertising.com URLs', () => {
      expect(isAdServerUrl('https://ad.advertising.com/ad/inline')).toBe(true);
    });

    it('should return false for non-ad server URLs', () => {
      expect(isAdServerUrl('https://example.com')).toBe(false);
      expect(isAdServerUrl('https://google.com')).toBe(false);
      expect(isAdServerUrl('https://youtube.com/embed/video123')).toBe(false);
    });

    it('should return false for empty or null URLs', () => {
      expect(isAdServerUrl('')).toBe(false);
      expect(isAdServerUrl(null)).toBe(false);
      expect(isAdServerUrl(undefined)).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isAdServerUrl('https://AD.DOUBLECLICK.NET/ddm')).toBe(true);
      expect(isAdServerUrl('https://PageAd2.GoogleSyndication.COM')).toBe(true);
    });
  });

  describe('getIABSizeName', () => {
    it('should return correct name for Medium Rectangle (300x250)', () => {
      expect(getIABSizeName(300, 250)).toBe('Medium Rectangle');
    });

    it('should return correct name for Leaderboard (728x90)', () => {
      expect(getIABSizeName(728, 90)).toBe('Leaderboard');
    });

    it('should return correct name for Half Page (300x600)', () => {
      expect(getIABSizeName(300, 600)).toBe('Half Page');
    });

    it('should return correct name for Mobile Banner (320x50)', () => {
      expect(getIABSizeName(320, 50)).toBe('Mobile Banner');
    });

    it('should return correct name for Wide Skyscraper (160x600)', () => {
      expect(getIABSizeName(160, 600)).toBe('Wide Skyscraper');
    });

    it('should return correct name for Billboard (970x250)', () => {
      expect(getIABSizeName(970, 250)).toBe('Billboard');
    });

    it('should return null for non-standard sizes', () => {
      expect(getIABSizeName(100, 100)).toBeNull();
      expect(getIABSizeName(500, 500)).toBeNull();
      expect(getIABSizeName(0, 0)).toBeNull();
    });
  });

  describe('getAdServerDomains', () => {
    it('should return an array of ad server domains', () => {
      const domains = getAdServerDomains();
      expect(Array.isArray(domains)).toBe(true);
      expect(domains.length).toBeGreaterThan(0);
    });

    it('should include major ad server domains', () => {
      const domains = getAdServerDomains();
      expect(domains).toContain('doubleclick.net');
      expect(domains).toContain('googlesyndication.com');
      expect(domains).toContain('adnxs.com');
      expect(domains).toContain('advertising.com');
    });

    it('should return a copy (not the original array)', () => {
      const domains1 = getAdServerDomains();
      const domains2 = getAdServerDomains();
      expect(domains1).not.toBe(domains2);
      expect(domains1).toEqual(domains2);
    });
  });

  describe('getIABSizes', () => {
    it('should return an object of IAB sizes', () => {
      const sizes = getIABSizes();
      expect(typeof sizes).toBe('object');
      expect(sizes).not.toBeNull();
    });

    it('should include standard IAB sizes', () => {
      const sizes = getIABSizes();
      expect(sizes['300x250']).toBe('Medium Rectangle');
      expect(sizes['728x90']).toBe('Leaderboard');
      expect(sizes['300x600']).toBe('Half Page');
    });

    it('should return a copy (not the original object)', () => {
      const sizes1 = getIABSizes();
      const sizes2 = getIABSizes();
      expect(sizes1).not.toBe(sizes2);
      expect(sizes1).toEqual(sizes2);
    });
  });

  // CSS Detection Tests
  describe('isAdRelatedName', () => {
    it('should return true for exact ad class names', () => {
      expect(isAdRelatedName('ad')).toBe(true);
      expect(isAdRelatedName('ads')).toBe(true);
      expect(isAdRelatedName('AD')).toBe(true);
    });

    it('should return true for ad-prefixed names', () => {
      expect(isAdRelatedName('ad-container')).toBe(true);
      expect(isAdRelatedName('ad_slot')).toBe(true);
      expect(isAdRelatedName('ad-banner')).toBe(true);
    });

    it('should return true for ad-suffixed names', () => {
      expect(isAdRelatedName('banner-ad')).toBe(true);
      expect(isAdRelatedName('sidebar_ad')).toBe(true);
      expect(isAdRelatedName('header-ad')).toBe(true);
    });

    it('should return true for advertisement-related names', () => {
      expect(isAdRelatedName('advertisement')).toBe(true);
      expect(isAdRelatedName('adslot')).toBe(true);
      expect(isAdRelatedName('adunit')).toBe(true);
    });

    it('should return true for sponsored content names', () => {
      expect(isAdRelatedName('sponsored')).toBe(true);
      expect(isAdRelatedName('sponsored-content')).toBe(true);
    });

    it('should return true for DFP/GPT ad names', () => {
      expect(isAdRelatedName('dfp-ad')).toBe(true);
      expect(isAdRelatedName('gpt-ad')).toBe(true);
      expect(isAdRelatedName('gptad')).toBe(true);
    });

    it('should return false for non-ad names', () => {
      expect(isAdRelatedName('header')).toBe(false);
      expect(isAdRelatedName('footer')).toBe(false);
      expect(isAdRelatedName('content')).toBe(false);
      expect(isAdRelatedName('sidebar')).toBe(false);
    });

    it('should return false for names that contain ad but are not ads', () => {
      expect(isAdRelatedName('loading')).toBe(false);
      expect(isAdRelatedName('heading')).toBe(false);
      expect(isAdRelatedName('padding')).toBe(false);
    });

    it('should return false for empty or null values', () => {
      expect(isAdRelatedName('')).toBe(false);
      expect(isAdRelatedName(null)).toBe(false);
      expect(isAdRelatedName(undefined)).toBe(false);
    });
  });

  describe('matchIABSize', () => {
    it('should return exact IAB size match', () => {
      expect(matchIABSize(300, 250)).toBe('300x250');
      expect(matchIABSize(728, 90)).toBe('728x90');
      expect(matchIABSize(300, 600)).toBe('300x600');
    });

    it('should match sizes within default tolerance (5px)', () => {
      expect(matchIABSize(302, 248)).toBe('300x250');
      expect(matchIABSize(298, 252)).toBe('300x250');
      expect(matchIABSize(730, 88)).toBe('728x90');
    });

    it('should match sizes within custom tolerance', () => {
      expect(matchIABSize(310, 240, 10)).toBe('300x250');
      expect(matchIABSize(290, 260, 10)).toBe('300x250');
    });

    it('should return null for sizes outside tolerance', () => {
      expect(matchIABSize(310, 240)).toBeNull();
      expect(matchIABSize(290, 260)).toBeNull();
    });

    it('should return null for non-standard sizes', () => {
      expect(matchIABSize(100, 100)).toBeNull();
      expect(matchIABSize(500, 500)).toBeNull();
    });
  });

  describe('getAdContainerSelectors', () => {
    it('should return an array of CSS selectors', () => {
      const selectors = getAdContainerSelectors();
      expect(Array.isArray(selectors)).toBe(true);
      expect(selectors.length).toBeGreaterThan(0);
    });

    it('should include common ad container classes', () => {
      const selectors = getAdContainerSelectors();
      expect(selectors).toContain('.ad');
      expect(selectors).toContain('.ads');
      expect(selectors).toContain('.advertisement');
      expect(selectors).toContain('.adslot');
    });

    it('should include attribute selectors', () => {
      const selectors = getAdContainerSelectors();
      expect(selectors).toContain('[data-ad]');
      expect(selectors).toContain('[data-ad-slot]');
    });

    it('should return a copy (not the original array)', () => {
      const selectors1 = getAdContainerSelectors();
      const selectors2 = getAdContainerSelectors();
      expect(selectors1).not.toBe(selectors2);
      expect(selectors1).toEqual(selectors2);
    });
  });

  describe('getAdPatterns', () => {
    it('should return an array of RegExp patterns', () => {
      const patterns = getAdPatterns();
      expect(Array.isArray(patterns)).toBe(true);
      expect(patterns.length).toBeGreaterThan(0);
      patterns.forEach(pattern => {
        expect(pattern).toBeInstanceOf(RegExp);
      });
    });

    it('should include patterns for common ad names', () => {
      const patterns = getAdPatterns();
      const testCases = ['ad', 'ads', 'ad-container', 'banner-ad', 'advertisement'];

      testCases.forEach(testCase => {
        const matches = patterns.some(pattern => pattern.test(testCase));
        expect(matches).toBe(true);
      });
    });

    it('should return copies of patterns (not originals)', () => {
      const patterns1 = getAdPatterns();
      const patterns2 = getAdPatterns();
      expect(patterns1).not.toBe(patterns2);
      expect(patterns1[0]).not.toBe(patterns2[0]);
    });
  });
});
