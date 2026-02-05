import { jest } from '@jest/globals';
import {
  isAdServerUrl,
  getIABSizeName,
  getAdServerDomains,
  getIABSizes
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
});
