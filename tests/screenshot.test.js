import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../src/server.js';
import { closeBrowser } from '../src/services/puppeteerService.js';

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
});
