import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../src/server.js';
import { closeBrowser, VIEWPORT_PRESETS, getViewport } from '../src/services/puppeteerService.js';

// Increase timeout for Puppeteer operations
jest.setTimeout(60000);

describe('Screenshot API', () => {
  afterAll(async () => {
    try {
      await closeBrowser();
    } catch {
      // Browser may not have been initialized
    }
  });

  describe('POST /api/screenshot - Validation', () => {
    it('should return 400 when URL is missing', async () => {
      const response = await request(app)
        .post('/api/screenshot')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('URL is required');
    });

    it('should return 400 for invalid URL format', async () => {
      const response = await request(app)
        .post('/api/screenshot')
        .send({ url: 'not-a-valid-url' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid URL format');
    });

    it('should return 400 for non-http URL', async () => {
      const response = await request(app)
        .post('/api/screenshot')
        .send({ url: 'ftp://example.com' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid URL format');
    });

    it('should accept valid http URL format', async () => {
      const response = await request(app)
        .post('/api/screenshot')
        .send({ url: 'http://example.com' });

      // Will either succeed (200) or fail at Puppeteer level (500)
      // but should NOT fail validation (400)
      expect(response.status).not.toBe(400);
    });

    it('should accept valid https URL format', async () => {
      const response = await request(app)
        .post('/api/screenshot')
        .send({ url: 'https://example.com' });

      // Will either succeed (200) or fail at Puppeteer level (500)
      // but should NOT fail validation (400)
      expect(response.status).not.toBe(400);
    });
  });

  describe('Viewport parameter', () => {
    it('should accept desktop viewport', async () => {
      const response = await request(app)
        .post('/api/screenshot')
        .send({ url: 'https://example.com', viewport: 'desktop' });

      expect(response.status).not.toBe(400);
    });

    it('should accept laptop viewport', async () => {
      const response = await request(app)
        .post('/api/screenshot')
        .send({ url: 'https://example.com', viewport: 'laptop' });

      expect(response.status).not.toBe(400);
    });

    it('should accept mobile viewport', async () => {
      const response = await request(app)
        .post('/api/screenshot')
        .send({ url: 'https://example.com', viewport: 'mobile' });

      expect(response.status).not.toBe(400);
    });

    it('should default to desktop for invalid viewport', async () => {
      const response = await request(app)
        .post('/api/screenshot')
        .send({ url: 'https://example.com', viewport: 'invalid' });

      // Should not fail validation - will use desktop as default
      expect(response.status).not.toBe(400);
    });
  });
});

describe('Viewport Presets', () => {
  it('should have desktop preset with correct dimensions', () => {
    expect(VIEWPORT_PRESETS.desktop).toBeDefined();
    expect(VIEWPORT_PRESETS.desktop.width).toBe(1920);
    expect(VIEWPORT_PRESETS.desktop.height).toBe(1080);
  });

  it('should have laptop preset with correct dimensions', () => {
    expect(VIEWPORT_PRESETS.laptop).toBeDefined();
    expect(VIEWPORT_PRESETS.laptop.width).toBe(1366);
    expect(VIEWPORT_PRESETS.laptop.height).toBe(768);
  });

  it('should have mobile preset with correct dimensions', () => {
    expect(VIEWPORT_PRESETS.mobile).toBeDefined();
    expect(VIEWPORT_PRESETS.mobile.width).toBe(375);
    expect(VIEWPORT_PRESETS.mobile.height).toBe(667);
    expect(VIEWPORT_PRESETS.mobile.isMobile).toBe(true);
    expect(VIEWPORT_PRESETS.mobile.hasTouch).toBe(true);
  });

  it('getViewport should return correct viewport for valid name', () => {
    const desktopViewport = getViewport('desktop');
    expect(desktopViewport.width).toBe(1920);
    expect(desktopViewport.height).toBe(1080);

    const mobileViewport = getViewport('mobile');
    expect(mobileViewport.width).toBe(375);
    expect(mobileViewport.isMobile).toBe(true);
  });

  it('getViewport should return default viewport for invalid name', () => {
    const viewport = getViewport('invalid');
    expect(viewport.width).toBe(1920);
    expect(viewport.height).toBe(1080);
  });

  it('getViewport should return default viewport when name is undefined', () => {
    const viewport = getViewport(undefined);
    expect(viewport.width).toBe(1920);
    expect(viewport.height).toBe(1080);
  });
});
